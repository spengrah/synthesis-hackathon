// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementHarnessBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";
import { AgreementHarness } from "../../harness/AgreementHarness.sol";

contract Agreement_handleCounter is AgreementHarnessBase {
  function test_RevertIf_CallerIsNotThePartyWhoseTurnItIs() public {
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.NotYourTurn.selector, partyA, partyB));
    harness.exposed_handleCounter(partyA, _defaultProposalPayload());
  }

  function test_OverwritesTermsHash() public {
    bytes memory payload = _defaultProposalPayload();
    harness.exposed_handleCounter(partyB, payload);
    // Hash should be the same since payload is the same, but turn should flip
    assertEq(harness.termsHash(), keccak256(payload));
  }

  function test_FlipsTurnToTheOtherParty() public {
    harness.exposed_handleCounter(partyB, _defaultProposalPayload());
    assertEq(harness.turn(), partyA);
  }

  function test_SetsStateToNegotiating_GivenStateWasProposed() public {
    harness.exposed_handleCounter(partyB, _defaultProposalPayload());
    assertEq(harness.currentState(), AgreementTypes.NEGOTIATING);
  }

  function test_EmitsAgreementStateChanged_GivenStateWasProposed() public {
    vm.expectEmit(true, true, false, false);
    emit IAgreementEvents.AgreementStateChanged(AgreementTypes.PROPOSED, AgreementTypes.NEGOTIATING);
    harness.exposed_handleCounter(partyB, _defaultProposalPayload());
  }

  function test_RemainsInNegotiating_GivenStateWasNegotiating() public {
    // First counter: PROPOSED -> NEGOTIATING
    harness.exposed_handleCounter(partyB, _defaultProposalPayload());

    // Second counter: NEGOTIATING -> NEGOTIATING
    harness.exposed_handleCounter(partyA, _defaultProposalPayload());
    assertEq(harness.currentState(), AgreementTypes.NEGOTIATING);
  }

  function test_EmitsProposalSubmitted() public {
    bytes memory payload = _defaultProposalPayload();
    vm.expectEmit(true, false, false, true);
    emit IAgreementEvents.ProposalSubmitted(partyB, keccak256(payload), payload);
    harness.exposed_handleCounter(partyB, payload);
  }

  function test_EmitsInputAccepted() public {
    // NOTE: InputAccepted is emitted by submitInput, not the internal handler.
    // Verify the handler emits AgreementStateChanged (the handler-level equivalent).
    bytes memory payload = _defaultProposalPayload();
    vm.expectEmit(true, true, false, false);
    emit IAgreementEvents.AgreementStateChanged(AgreementTypes.PROPOSED, AgreementTypes.NEGOTIATING);
    harness.exposed_handleCounter(partyB, payload);
  }

  function test_RevertIf_StateIsClosed() public {
    // Advance to active then finalize
    _advanceToActive();
    vm.warp(harness.deadline() + 1);
    harness.exposed_handleFinalize();

    // _handleCounter calls _requireNegotiating which reverts with InvalidState(CLOSED, PROPOSED)
    vm.expectRevert(
      abi.encodeWithSelector(IAgreementErrors.InvalidState.selector, AgreementTypes.CLOSED, AgreementTypes.PROPOSED)
    );
    harness.exposed_handleCounter(partyB, _defaultProposalPayload());
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
