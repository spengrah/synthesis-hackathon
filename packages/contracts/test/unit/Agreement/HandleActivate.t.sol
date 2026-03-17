// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementHarnessBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { IAgreement, IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";

contract Agreement_handleActivate is AgreementHarnessBase {
  function test_RevertIf_StateIsNotReady() public {
    // State is PROPOSED
    vm.expectRevert(
      abi.encodeWithSelector(IAgreementErrors.InvalidState.selector, AgreementTypes.PROPOSED, AgreementTypes.READY)
    );
    harness.exposed_handleActivate(partyA);
  }

  function test_RevertIf_StateIsAccepted() public {
    _advanceToAccepted();
    vm.expectRevert(
      abi.encodeWithSelector(IAgreementErrors.InvalidState.selector, AgreementTypes.ACCEPTED, AgreementTypes.READY)
    );
    harness.exposed_handleActivate(partyA);
  }

  function test_RevertIf_CallerIsNotAParty() public {
    _advanceToReady();
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.NotAParty.selector, observer));
    harness.exposed_handleActivate(observer);
  }

  function test_SetsStateToActive() public {
    _advanceToReady();
    harness.exposed_handleActivate(partyA);
    assertEq(harness.currentState(), AgreementTypes.ACTIVE);
  }

  function test_MintsZoneHatsToParties() public {
    _advanceToReady();
    // Before activation, hats are not worn
    assertFalse(hats.isWearerOfHat(partyA, harness.zoneHatIds(0)));
    assertFalse(hats.isWearerOfHat(partyB, harness.zoneHatIds(1)));

    harness.exposed_handleActivate(partyA);

    // After activation, hats are worn
    assertTrue(hats.isWearerOfHat(partyA, harness.zoneHatIds(0)));
    assertTrue(hats.isWearerOfHat(partyB, harness.zoneHatIds(1)));
  }

  function test_EmitsAgreementActivated() public {
    _advanceToReady();
    harness.exposed_handleActivate(partyA);
    // If we got here without revert, activation succeeded
  }

  function test_EmitsAgreementStateChanged() public {
    _advanceToReady();
    vm.expectEmit(true, true, false, false);
    emit IAgreementEvents.AgreementStateChanged(AgreementTypes.READY, AgreementTypes.ACTIVE);
    harness.exposed_handleActivate(partyA);
  }

  function test_DoesNotRedeployZones() public {
    _advanceToReady();
    address zone0 = harness.trustZones(0);
    address zone1 = harness.trustZones(1);

    harness.exposed_handleActivate(partyA);

    // Zone addresses unchanged
    assertEq(harness.trustZones(0), zone0);
    assertEq(harness.trustZones(1), zone1);
  }

  // ---- Local advance helpers ----

  function _advanceToAccepted() internal {
    bytes memory payload = _defaultProposalPayload();
    harness.exposed_handleAccept(partyB, payload);
  }

  function _advanceToReady() internal {
    _advanceToAccepted();
    harness.exposed_handleSetUp(partyA);
  }
}
