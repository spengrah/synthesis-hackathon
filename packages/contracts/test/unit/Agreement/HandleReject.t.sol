// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";

contract Agreement_handleReject is AgreementBase {
  function test_RevertIf_StateIsProposedAndCallerIsNotOtherParty() public {
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.NotYourTurn.selector, partyA, partyB));
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.REJECT, "");
  }

  function test_SetsStateToRejected_WhenCallerIsAuthorized() public {
    vm.prank(partyB);
    agreement.submitInput(AgreementTypes.REJECT, "");
    assertEq(agreement.currentState(), AgreementTypes.REJECTED);
  }

  function test_EmitsAgreementStateChanged() public {
    vm.expectEmit(true, true, false, false);
    emit IAgreementEvents.AgreementStateChanged(AgreementTypes.PROPOSED, AgreementTypes.REJECTED);
    vm.prank(partyB);
    agreement.submitInput(AgreementTypes.REJECT, "");
  }

  function test_EmitsInputAccepted() public {
    vm.expectEmit(true, true, true, true);
    emit IAgreementEvents.InputAccepted(AgreementTypes.PROPOSED, AgreementTypes.REJECTED, AgreementTypes.REJECT, "");
    vm.prank(partyB);
    agreement.submitInput(AgreementTypes.REJECT, "");
  }

  function test_EitherPartyCanReject_WhenNegotiating() public {
    _advanceToNegotiating(agreement);
    // partyA should be able to reject even though it's partyA's turn to counter
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.REJECT, "");
    assertEq(agreement.currentState(), AgreementTypes.REJECTED);
  }

  function test_RevertIf_CallerIsNotAParty_WhenNegotiating() public {
    _advanceToNegotiating(agreement);
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.NotAParty.selector, observer));
    vm.prank(observer);
    agreement.submitInput(AgreementTypes.REJECT, "");
  }
}
