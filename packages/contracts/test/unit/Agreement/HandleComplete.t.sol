// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementHarnessBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";
import { AgreementHarness } from "../../harness/AgreementHarness.sol";

contract Agreement_handleComplete is AgreementHarnessBase {
  function setUp() public override {
    super.setUp();
    _advanceToActive();
  }

  function test_RevertIf_StateIsNotActive() public {
    // Create a new harness in PROPOSED state
    bytes memory proposalPayload = _defaultProposalPayload();
    (AgreementHarness newHarness,) = _createHarnessCloneWithPayload(proposalPayload);
    vm.expectRevert(
      abi.encodeWithSelector(IAgreementErrors.InvalidState.selector, AgreementTypes.PROPOSED, AgreementTypes.ACTIVE)
    );
    newHarness.exposed_handleComplete(partyA, abi.encode("ipfs://feedback", bytes32(uint256(1))));
  }

  function test_RevertIf_CallerIsNotAParty() public {
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.NotAParty.selector, observer));
    harness.exposed_handleComplete(observer, abi.encode("ipfs://feedback", bytes32(uint256(1))));
  }

  function test_RevertIf_CallerHasAlreadySignaled() public {
    harness.exposed_handleComplete(partyA, abi.encode("ipfs://feedback", bytes32(uint256(1))));

    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.AlreadySignaled.selector, partyA));
    harness.exposed_handleComplete(partyA, abi.encode("ipfs://feedback2", bytes32(uint256(2))));
  }

  function test_StoresFeedbackForParty() public {
    harness.exposed_handleComplete(partyA, abi.encode("ipfs://feedback", bytes32(uint256(1))));
    assertTrue(harness.completionSignaled(0));
    assertFalse(harness.completionSignaled(1));
  }

  function test_EmitsCompletionSignaled() public {
    vm.expectEmit(true, false, false, true);
    emit IAgreementEvents.CompletionSignaled(partyA, "ipfs://feedback", bytes32(uint256(1)));
    harness.exposed_handleComplete(partyA, abi.encode("ipfs://feedback", bytes32(uint256(1))));
  }

  function test_RemainsInActive_GivenOtherPartyHasNotSignaled() public {
    harness.exposed_handleComplete(partyA, abi.encode("ipfs://feedback", bytes32(uint256(1))));
    assertEq(harness.currentState(), AgreementTypes.ACTIVE);
  }

  function test_ClosesWithCompleted_GivenBothPartiesHaveSignaled() public {
    harness.exposed_handleComplete(partyA, abi.encode("ipfs://feedbackA", bytes32(uint256(1))));

    harness.exposed_handleComplete(partyB, abi.encode("ipfs://feedbackB", bytes32(uint256(2))));

    assertEq(harness.currentState(), AgreementTypes.CLOSED);
    assertEq(harness.outcome(), keccak256("COMPLETED"));
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
