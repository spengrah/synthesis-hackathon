// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";

contract Agreement_handleCounter is AgreementBase {
  function test_RevertIf_CallerIsNotThePartyWhoseTurnItIs() public {
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.NotYourTurn.selector, partyA, partyB));
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.COUNTER, _defaultProposalPayload());
  }

  function test_OverwritesTermsHash() public {
    bytes memory payload = _defaultProposalPayload();
    vm.prank(partyB);
    agreement.submitInput(AgreementTypes.COUNTER, payload);
    // Hash should be the same since payload is the same, but turn should flip
    assertEq(agreement.termsHash(), keccak256(payload));
  }

  function test_FlipsTurnToTheOtherParty() public {
    vm.prank(partyB);
    agreement.submitInput(AgreementTypes.COUNTER, _defaultProposalPayload());
    assertEq(agreement.turn(), partyA);
  }

  function test_SetsStateToNegotiating_GivenStateWasProposed() public {
    vm.prank(partyB);
    agreement.submitInput(AgreementTypes.COUNTER, _defaultProposalPayload());
    assertEq(agreement.currentState(), AgreementTypes.NEGOTIATING);
  }

  function test_EmitsAgreementStateChanged_GivenStateWasProposed() public {
    vm.expectEmit(true, true, false, false);
    emit IAgreementEvents.AgreementStateChanged(AgreementTypes.PROPOSED, AgreementTypes.NEGOTIATING);
    vm.prank(partyB);
    agreement.submitInput(AgreementTypes.COUNTER, _defaultProposalPayload());
  }

  function test_RemainsInNegotiating_GivenStateWasNegotiating() public {
    // First counter: PROPOSED -> NEGOTIATING
    vm.prank(partyB);
    agreement.submitInput(AgreementTypes.COUNTER, _defaultProposalPayload());

    // Second counter: NEGOTIATING -> NEGOTIATING
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.COUNTER, _defaultProposalPayload());
    assertEq(agreement.currentState(), AgreementTypes.NEGOTIATING);
  }

  function test_EmitsProposalSubmitted() public {
    bytes memory payload = _defaultProposalPayload();
    vm.expectEmit(true, false, false, true);
    emit IAgreementEvents.ProposalSubmitted(partyB, keccak256(payload), payload);
    vm.prank(partyB);
    agreement.submitInput(AgreementTypes.COUNTER, payload);
  }

  function test_EmitsInputAccepted() public {
    bytes memory payload = _defaultProposalPayload();
    vm.expectEmit(true, true, true, true);
    emit IAgreementEvents.InputAccepted(
      AgreementTypes.PROPOSED, AgreementTypes.NEGOTIATING, AgreementTypes.COUNTER, payload
    );
    vm.prank(partyB);
    agreement.submitInput(AgreementTypes.COUNTER, payload);
  }

  function test_RevertIf_StateIsClosed() public {
    // Advance to active then finalize
    _advanceToActive(agreement);
    vm.warp(agreement.deadline() + 1);
    agreement.submitInput(AgreementTypes.FINALIZE, "");

    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.InvalidState.selector, AgreementTypes.CLOSED, bytes32(0)));
    vm.prank(partyB);
    agreement.submitInput(AgreementTypes.COUNTER, _defaultProposalPayload());
  }
}
