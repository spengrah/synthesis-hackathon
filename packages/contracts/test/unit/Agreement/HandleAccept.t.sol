// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";

contract Agreement_handleAccept is AgreementBase {
  function test_RevertIf_StateIsProposedAndCallerIsNotOtherParty() public {
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.NotYourTurn.selector, partyA, partyB));
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.ACCEPT, _defaultProposalPayload());
  }

  function test_RevertIf_StateIsNegotiatingAndCallerIsNotTurnParty() public {
    _advanceToNegotiating(agreement);
    // After counter by partyB, turn is partyA
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.NotYourTurn.selector, partyB, partyA));
    vm.prank(partyB);
    agreement.submitInput(AgreementTypes.ACCEPT, _defaultProposalPayload());
  }

  function test_SetsStateToAccepted() public {
    vm.prank(partyB);
    agreement.submitInput(AgreementTypes.ACCEPT, _defaultProposalPayload());
    assertEq(agreement.currentState(), AgreementTypes.ACCEPTED);
  }

  function test_EmitsAgreementStateChanged() public {
    vm.expectEmit(true, true, false, false);
    emit IAgreementEvents.AgreementStateChanged(AgreementTypes.PROPOSED, AgreementTypes.ACCEPTED);
    vm.prank(partyB);
    agreement.submitInput(AgreementTypes.ACCEPT, _defaultProposalPayload());
  }

  function test_EmitsInputAccepted() public {
    bytes memory payload = _defaultProposalPayload();
    vm.expectEmit(true, true, true, true);
    emit IAgreementEvents.InputAccepted(
      AgreementTypes.PROPOSED, AgreementTypes.ACCEPTED, AgreementTypes.ACCEPT, payload
    );
    vm.prank(partyB);
    agreement.submitInput(AgreementTypes.ACCEPT, payload);
  }

  function test_RevertIf_TermsHashDoesNotMatch() public {
    // Submit a different payload whose hash doesn't match
    bytes memory wrongPayload = abi.encode("wrong");
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.InvalidInput.selector, AgreementTypes.ACCEPT));
    vm.prank(partyB);
    agreement.submitInput(AgreementTypes.ACCEPT, wrongPayload);
  }
}
