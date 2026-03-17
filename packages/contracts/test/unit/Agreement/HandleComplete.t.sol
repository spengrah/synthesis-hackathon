// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";

contract Agreement_handleComplete is AgreementBase {
  function setUp() public override {
    super.setUp();
    _advanceToActive(agreement);
  }

  function test_RevertIf_StateIsNotActive() public {
    // Create a new agreement in PROPOSED state
    bytes memory proposalPayload = _defaultProposalPayload();
    (Agreement newAgreement,) = _createAgreementClone(proposalPayload);
    vm.expectRevert(
      abi.encodeWithSelector(IAgreementErrors.InvalidState.selector, AgreementTypes.PROPOSED, AgreementTypes.ACTIVE)
    );
    vm.prank(partyA);
    newAgreement.submitInput(AgreementTypes.COMPLETE, abi.encode("ipfs://feedback", bytes32(uint256(1))));
  }

  function test_RevertIf_CallerIsNotAParty() public {
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.NotAParty.selector, observer));
    vm.prank(observer);
    agreement.submitInput(AgreementTypes.COMPLETE, abi.encode("ipfs://feedback", bytes32(uint256(1))));
  }

  function test_RevertIf_CallerHasAlreadySignaled() public {
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.COMPLETE, abi.encode("ipfs://feedback", bytes32(uint256(1))));

    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.AlreadySignaled.selector, partyA));
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.COMPLETE, abi.encode("ipfs://feedback2", bytes32(uint256(2))));
  }

  function test_StoresFeedbackForParty() public {
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.COMPLETE, abi.encode("ipfs://feedback", bytes32(uint256(1))));
    assertTrue(agreement.completionSignaled(0));
    assertFalse(agreement.completionSignaled(1));
  }

  function test_EmitsCompletionSignaled() public {
    vm.expectEmit(true, false, false, true);
    emit IAgreementEvents.CompletionSignaled(partyA, "ipfs://feedback", bytes32(uint256(1)));
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.COMPLETE, abi.encode("ipfs://feedback", bytes32(uint256(1))));
  }

  function test_RemainsInActive_GivenOtherPartyHasNotSignaled() public {
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.COMPLETE, abi.encode("ipfs://feedback", bytes32(uint256(1))));
    assertEq(agreement.currentState(), AgreementTypes.ACTIVE);
  }

  function test_ClosesWithCompleted_GivenBothPartiesHaveSignaled() public {
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.COMPLETE, abi.encode("ipfs://feedbackA", bytes32(uint256(1))));

    vm.prank(partyB);
    agreement.submitInput(AgreementTypes.COMPLETE, abi.encode("ipfs://feedbackB", bytes32(uint256(2))));

    assertEq(agreement.currentState(), AgreementTypes.CLOSED);
    assertEq(agreement.outcome(), keccak256("COMPLETED"));
  }
}

import { Agreement } from "../../../src/Agreement.sol";
