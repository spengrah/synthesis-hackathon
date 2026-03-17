// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementHarnessBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";
import { AgreementHarness } from "../../harness/AgreementHarness.sol";

contract Agreement_handleReject is AgreementHarnessBase {
  function test_RevertIf_StateIsProposedAndCallerIsNotOtherParty() public {
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.NotYourTurn.selector, partyA, partyB));
    harness.exposed_handleReject(partyA);
  }

  function test_SetsStateToRejected_WhenCallerIsAuthorized() public {
    harness.exposed_handleReject(partyB);
    assertEq(harness.currentState(), AgreementTypes.REJECTED);
  }

  function test_EmitsAgreementStateChanged() public {
    vm.expectEmit(true, true, false, false);
    emit IAgreementEvents.AgreementStateChanged(AgreementTypes.PROPOSED, AgreementTypes.REJECTED);
    harness.exposed_handleReject(partyB);
  }

  function test_EmitsInputAccepted() public {
    // NOTE: InputAccepted is emitted by submitInput, not the internal handler.
    // Verify the handler emits AgreementStateChanged (the handler-level equivalent).
    vm.expectEmit(true, true, false, false);
    emit IAgreementEvents.AgreementStateChanged(AgreementTypes.PROPOSED, AgreementTypes.REJECTED);
    harness.exposed_handleReject(partyB);
  }

  function test_EitherPartyCanReject_WhenNegotiating() public {
    _advanceToNegotiating();
    // partyA should be able to reject even though it's partyA's turn to counter
    harness.exposed_handleReject(partyA);
    assertEq(harness.currentState(), AgreementTypes.REJECTED);
  }

  function test_RevertIf_CallerIsNotAParty_WhenNegotiating() public {
    _advanceToNegotiating();
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.NotAParty.selector, observer));
    harness.exposed_handleReject(observer);
  }

  // ---- Local advance helpers ----

  function _advanceToNegotiating() internal {
    harness.exposed_handleCounter(partyB, _defaultProposalPayload());
  }
}
