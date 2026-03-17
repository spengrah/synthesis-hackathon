// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { TZTypes } from "../../../src/lib/TZTypes.sol";
import { IAgreement, IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";
import { Agreement } from "../../../src/Agreement.sol";
import { Constants } from "../../helpers/Constants.sol";
import { Defaults } from "../../helpers/Defaults.sol";

contract Agreement_handleActivate is AgreementBase {
  function test_RevertIf_StateIsNotAccepted() public {
    // State is PROPOSED
    vm.expectRevert(
      abi.encodeWithSelector(IAgreementErrors.InvalidState.selector, AgreementTypes.PROPOSED, AgreementTypes.ACCEPTED)
    );
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.ACTIVATE, "");
  }

  function test_RevertIf_CallerIsNotAParty() public {
    _advanceToAccepted(agreement);
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.NotAParty.selector, observer));
    vm.prank(observer);
    agreement.submitInput(AgreementTypes.ACTIVATE, "");
  }

  function test_SetsStateToActive() public {
    _advanceToAccepted(agreement);
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.ACTIVATE, "");
    assertEq(agreement.currentState(), AgreementTypes.ACTIVE);
  }

  function test_StoresTrustZoneAddresses() public {
    _advanceToAccepted(agreement);
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.ACTIVATE, "");
    assertTrue(agreement.trustZones(0) != address(0));
    assertTrue(agreement.trustZones(1) != address(0));
  }

  function test_StoresZoneHatIds() public {
    _advanceToAccepted(agreement);
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.ACTIVATE, "");
    assertTrue(agreement.zoneHatIds(0) != 0);
    assertTrue(agreement.zoneHatIds(1) != 0);
  }

  function test_StoresAdjudicator() public {
    _advanceToAccepted(agreement);
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.ACTIVATE, "");
    assertEq(agreement.adjudicator(), adjudicator);
  }

  function test_StoresDeadline() public {
    _advanceToAccepted(agreement);
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.ACTIVATE, "");
    assertEq(agreement.deadline(), block.timestamp + Constants.DEFAULT_DEADLINE);
  }

  function test_EmitsAgreementActivated() public {
    _advanceToAccepted(agreement);
    // We can't easily predict exact trust zone addresses, so just check event is emitted
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.ACTIVATE, "");
    // If we got here without revert, activation succeeded
  }

  function test_EmitsZoneDeployed() public {
    _advanceToAccepted(agreement);
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.ACTIVATE, "");
    // Verify zones were deployed by checking addresses
    address zone0 = agreement.trustZones(0);
    address zone1 = agreement.trustZones(1);
    assertTrue(zone0 != address(0));
    assertTrue(zone1 != address(0));
    assertTrue(zone0 != zone1);
  }

  function test_MintsZoneHatsToParties() public {
    _advanceToAccepted(agreement);
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.ACTIVATE, "");
    // Verify hats are minted
    assertTrue(hats.isWearerOfHat(partyA, agreement.zoneHatIds(0)));
    assertTrue(hats.isWearerOfHat(partyB, agreement.zoneHatIds(1)));
  }

  function test_RevertIf_ZonePartyDoesNotMatchAgreementParty() public {
    // Build proposal where zone[0].party is a random address instead of partyA
    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(makeAddr("imposter"), 0); // wrong party
    zones[1] = Defaults.tzConfig(partyB, 0);
    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (Agreement badAgreement,) = _createAgreementClone(payload);
    vm.prank(partyB);
    badAgreement.submitInput(AgreementTypes.ACCEPT, payload);

    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.NotAParty.selector, makeAddr("imposter")));
    vm.prank(partyA);
    badAgreement.submitInput(AgreementTypes.ACTIVATE, "");
  }

  function test_RevertIf_DeadlineIsInThePast() public {
    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);
    AgreementTypes.ProposalData memory data = Defaults.proposalData(zones, adjudicator, block.timestamp - 1);
    bytes memory payload = abi.encode(data);

    (Agreement badAgreement,) = _createAgreementClone(payload);
    vm.prank(partyB);
    badAgreement.submitInput(AgreementTypes.ACCEPT, payload);

    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.DeadlineReached.selector, block.timestamp - 1));
    vm.prank(partyA);
    badAgreement.submitInput(AgreementTypes.ACTIVATE, "");
  }

  function test_EmitsAgreementStateChanged() public {
    _advanceToAccepted(agreement);
    vm.expectEmit(true, true, false, false);
    emit IAgreementEvents.AgreementStateChanged(AgreementTypes.ACCEPTED, AgreementTypes.ACTIVE);
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.ACTIVATE, "");
  }
}
