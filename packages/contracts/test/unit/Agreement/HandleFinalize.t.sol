// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";
import { Agreement } from "../../../src/Agreement.sol";

contract Agreement_handleFinalize is AgreementBase {
  function setUp() public override {
    super.setUp();
    _advanceToActive(agreement);
  }

  function test_RevertIf_StateIsNotActive() public {
    bytes memory proposalPayload = _defaultProposalPayload();
    (Agreement newAgreement,) = _createAgreementClone(proposalPayload);
    vm.expectRevert(
      abi.encodeWithSelector(IAgreementErrors.InvalidState.selector, AgreementTypes.PROPOSED, AgreementTypes.ACTIVE)
    );
    newAgreement.submitInput(AgreementTypes.FINALIZE, "");
  }

  function test_RevertIf_DeadlineHasNotPassed() public {
    vm.expectRevert(
      abi.encodeWithSelector(IAgreementErrors.DeadlineNotReached.selector, agreement.deadline(), block.timestamp)
    );
    agreement.submitInput(AgreementTypes.FINALIZE, "");
  }

  function test_ClosesWithExpired_WhenDeadlineHasPassed() public {
    vm.warp(agreement.deadline() + 1);
    agreement.submitInput(AgreementTypes.FINALIZE, "");

    assertEq(agreement.currentState(), AgreementTypes.CLOSED);
    assertEq(agreement.outcome(), keccak256("EXPIRED"));
  }

  function test_EmitsAgreementClosed() public {
    vm.warp(agreement.deadline() + 1);
    vm.expectEmit(true, false, false, false);
    emit IAgreementEvents.AgreementClosed(keccak256("EXPIRED"));
    agreement.submitInput(AgreementTypes.FINALIZE, "");
  }

  function test_AnyoneCanFinalize() public {
    vm.warp(agreement.deadline() + 1);
    vm.prank(observer);
    agreement.submitInput(AgreementTypes.FINALIZE, "");
    assertEq(agreement.currentState(), AgreementTypes.CLOSED);
  }
}
