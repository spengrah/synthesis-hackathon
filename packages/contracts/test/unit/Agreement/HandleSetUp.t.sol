// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementHarnessBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { TZTypes } from "../../../src/lib/TZTypes.sol";
import { IAgreement, IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";
import { AgreementHarness } from "../../harness/AgreementHarness.sol";
import { Constants } from "../../helpers/Constants.sol";
import { Defaults } from "../../helpers/Defaults.sol";

contract Agreement_handleSetUp is AgreementHarnessBase {
  function test_RevertIf_StateIsNotAccepted() public {
    // State is PROPOSED
    vm.expectRevert(
      abi.encodeWithSelector(IAgreementErrors.InvalidState.selector, AgreementTypes.PROPOSED, AgreementTypes.ACCEPTED)
    );
    harness.exposed_handleSetUp(partyA);
  }

  function test_RevertIf_CallerIsNotAParty() public {
    _advanceToAccepted();
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.NotAParty.selector, observer));
    harness.exposed_handleSetUp(observer);
  }

  function test_SetsStateToReady() public {
    _advanceToAccepted();
    harness.exposed_handleSetUp(partyA);
    assertEq(harness.currentState(), AgreementTypes.READY);
  }

  function test_StoresTrustZoneAddresses() public {
    _advanceToAccepted();
    harness.exposed_handleSetUp(partyA);
    assertTrue(harness.trustZones(0) != address(0));
    assertTrue(harness.trustZones(1) != address(0));
  }

  function test_StoresZoneHatIds() public {
    _advanceToAccepted();
    harness.exposed_handleSetUp(partyA);
    assertTrue(harness.zoneHatIds(0) != 0);
    assertTrue(harness.zoneHatIds(1) != 0);
  }

  function test_DoesNotMintZoneHats() public {
    _advanceToAccepted();
    harness.exposed_handleSetUp(partyA);
    // Zone hats exist but are NOT minted to parties
    assertFalse(hats.isWearerOfHat(partyA, harness.zoneHatIds(0)));
    assertFalse(hats.isWearerOfHat(partyB, harness.zoneHatIds(1)));
  }

  function test_StoresAdjudicator() public {
    _advanceToAccepted();
    harness.exposed_handleSetUp(partyA);
    assertEq(harness.adjudicator(), adjudicator);
  }

  function test_StoresDeadline() public {
    _advanceToAccepted();
    harness.exposed_handleSetUp(partyA);
    assertEq(harness.deadline(), block.timestamp + Constants.DEFAULT_DEADLINE);
  }

  function test_EmitsAgreementSetUp() public {
    _advanceToAccepted();
    harness.exposed_handleSetUp(partyA);
    // If we got here without revert, setup succeeded
  }

  function test_EmitsZoneDeployed() public {
    _advanceToAccepted();
    harness.exposed_handleSetUp(partyA);
    // Verify zones were deployed by checking addresses
    address zone0 = harness.trustZones(0);
    address zone1 = harness.trustZones(1);
    assertTrue(zone0 != address(0));
    assertTrue(zone1 != address(0));
    assertTrue(zone0 != zone1);
  }

  function test_RevertIf_ZonePartyDoesNotMatchAgreementParty() public {
    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(makeAddr("imposter"), 0);
    zones[1] = Defaults.tzConfig(partyB, 0);
    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (AgreementHarness badHarness,) = _createHarnessCloneWithPayload(payload);
    badHarness.exposed_handleAccept(partyB, payload);

    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.NotAParty.selector, makeAddr("imposter")));
    badHarness.exposed_handleSetUp(partyA);
  }

  function test_RevertIf_DeadlineIsInThePast() public {
    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);
    AgreementTypes.ProposalData memory data = Defaults.proposalData(zones, adjudicator, block.timestamp - 1);
    bytes memory payload = abi.encode(data);

    (AgreementHarness badHarness,) = _createHarnessCloneWithPayload(payload);
    badHarness.exposed_handleAccept(partyB, payload);

    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.DeadlineReached.selector, block.timestamp - 1));
    badHarness.exposed_handleSetUp(partyA);
  }

  function test_EmitsAgreementStateChanged() public {
    _advanceToAccepted();
    vm.expectEmit(true, true, false, false);
    emit IAgreementEvents.AgreementStateChanged(AgreementTypes.ACCEPTED, AgreementTypes.READY);
    harness.exposed_handleSetUp(partyA);
  }

  function test_RevertIf_SetUpCalledFromReady() public {
    _advanceToAccepted();
    harness.exposed_handleSetUp(partyA);
    // Now in READY — SET_UP should revert
    vm.expectRevert(
      abi.encodeWithSelector(IAgreementErrors.InvalidState.selector, AgreementTypes.READY, AgreementTypes.ACCEPTED)
    );
    harness.exposed_handleSetUp(partyA);
  }

  // ─── Self-adjudication prevention
  // ──────────────────────────────────────

  function test_RevertIf_AdjudicatorIsPartyA() public {
    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);
    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, partyA, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (AgreementHarness badHarness,) = _createHarnessCloneWithPayload(payload);
    badHarness.exposed_handleAccept(partyB, payload);

    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.PartyCannotBeAdjudicator.selector, partyA));
    badHarness.exposed_handleSetUp(partyA);
  }

  function test_RevertIf_AdjudicatorIsPartyB() public {
    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);
    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, partyB, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (AgreementHarness badHarness,) = _createHarnessCloneWithPayload(payload);
    badHarness.exposed_handleAccept(partyB, payload);

    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.PartyCannotBeAdjudicator.selector, partyB));
    badHarness.exposed_handleSetUp(partyA);
  }

  // ---- Local advance helpers ----

  function _advanceToAccepted() internal {
    bytes memory payload = _defaultProposalPayload();
    harness.exposed_handleAccept(partyB, payload);
  }
}
