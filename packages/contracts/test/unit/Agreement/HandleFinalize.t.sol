// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementHarnessBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";
import { AgreementHarness } from "../../harness/AgreementHarness.sol";

contract Agreement_handleFinalize is AgreementHarnessBase {
  function setUp() public override {
    super.setUp();
    _advanceToActive();
  }

  function test_RevertIf_StateIsNotActive() public {
    bytes memory proposalPayload = _defaultProposalPayload();
    (AgreementHarness newHarness,) = _createHarnessCloneWithPayload(proposalPayload);
    vm.expectRevert(
      abi.encodeWithSelector(IAgreementErrors.InvalidState.selector, AgreementTypes.PROPOSED, AgreementTypes.ACTIVE)
    );
    newHarness.exposed_handleFinalize(partyA);
  }

  function test_RevertIf_CallerIsNotAParty() public {
    vm.warp(harness.deadline() + 1);
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.NotAParty.selector, observer));
    harness.exposed_handleFinalize(observer);
  }

  function test_RevertIf_DeadlineHasNotPassed() public {
    vm.expectRevert(
      abi.encodeWithSelector(IAgreementErrors.DeadlineNotReached.selector, harness.deadline(), block.timestamp)
    );
    harness.exposed_handleFinalize(partyA);
  }

  function test_ClosesWithExpired_WhenDeadlineHasPassed() public {
    vm.warp(harness.deadline() + 1);
    harness.exposed_handleFinalize(partyA);

    assertEq(harness.currentState(), AgreementTypes.CLOSED);
    assertEq(harness.outcome(), keccak256("EXPIRED"));
  }

  function test_EmitsAgreementClosed() public {
    vm.warp(harness.deadline() + 1);
    vm.expectEmit(true, false, false, false);
    emit IAgreementEvents.AgreementClosed(keccak256("EXPIRED"));
    harness.exposed_handleFinalize(partyA);
  }

  function test_EitherPartyCanFinalize() public {
    vm.warp(harness.deadline() + 1);
    harness.exposed_handleFinalize(partyB);
    assertEq(harness.currentState(), AgreementTypes.CLOSED);
  }

  // ---- Local advance helpers ----

  function _advanceToAccepted() internal {
    bytes memory payload = _defaultProposalPayload();
    harness.exposed_handleAccept(partyB, payload);
  }

  function _advanceToActive() internal {
    _advanceToAccepted();
    harness.exposed_handleSetUp(partyA);
    harness.exposed_handleActivate(partyA);
  }
}
