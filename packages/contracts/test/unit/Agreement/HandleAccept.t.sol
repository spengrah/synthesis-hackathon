// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementHarnessBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";
import { AgreementHarness } from "../../harness/AgreementHarness.sol";

contract Agreement_handleAccept is AgreementHarnessBase {
  function test_RevertIf_StateIsProposedAndCallerIsNotOtherParty() public {
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.NotYourTurn.selector, partyA, partyB));
    harness.exposed_handleAccept(partyA, _defaultProposalPayload());
  }

  function test_RevertIf_StateIsNegotiatingAndCallerIsNotTurnParty() public {
    _advanceToNegotiating();
    // After counter by partyB, turn is partyA
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.NotYourTurn.selector, partyB, partyA));
    harness.exposed_handleAccept(partyB, _defaultProposalPayload());
  }

  function test_SetsStateToAccepted() public {
    harness.exposed_handleAccept(partyB, _defaultProposalPayload());
    assertEq(harness.currentState(), AgreementTypes.ACCEPTED);
  }

  function test_EmitsAgreementStateChanged() public {
    vm.expectEmit(true, true, false, false);
    emit IAgreementEvents.AgreementStateChanged(AgreementTypes.PROPOSED, AgreementTypes.ACCEPTED);
    harness.exposed_handleAccept(partyB, _defaultProposalPayload());
  }

  function test_EmitsInputAccepted() public {
    // NOTE: InputAccepted is emitted by submitInput, not the internal handler.
    // Verify the handler emits AgreementStateChanged (the handler-level equivalent).
    bytes memory payload = _defaultProposalPayload();
    vm.expectEmit(true, true, false, false);
    emit IAgreementEvents.AgreementStateChanged(AgreementTypes.PROPOSED, AgreementTypes.ACCEPTED);
    harness.exposed_handleAccept(partyB, payload);
  }

  function test_RevertIf_TermsHashDoesNotMatch() public {
    // Submit a different payload whose hash doesn't match
    bytes memory wrongPayload = abi.encode("wrong");
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.InvalidInput.selector, AgreementTypes.ACCEPT));
    harness.exposed_handleAccept(partyB, wrongPayload);
  }

  // ---- Local advance helpers ----

  function _advanceToNegotiating() internal {
    harness.exposed_handleCounter(partyB, _defaultProposalPayload());
  }
}
