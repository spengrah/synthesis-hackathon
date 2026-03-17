// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementHarnessBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { TZTypes } from "../../../src/lib/TZTypes.sol";
import { AgreementHarness } from "../../harness/AgreementHarness.sol";
import { Defaults } from "../../helpers/Defaults.sol";
import { Constants } from "../../helpers/Constants.sol";

contract Agreement_getHatStatus is AgreementHarnessBase {
  function test_ReturnsFalse_GivenHatExplicitlyDeactivated() public {
    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);

    TZTypes.TZMechanism[] memory mechs = new TZTypes.TZMechanism[](1);
    mechs[0] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Reward,
      moduleKind: TZTypes.TZModuleKind.External,
      module: address(0xdead),
      data: ""
    });
    zones[0].mechanisms = mechs;

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (AgreementHarness agr,) = _createHarnessCloneWithPayload(payload);
    agr.exposed_handleAccept(partyB, payload);
    agr.exposed_handleSetUp(partyA);
    agr.exposed_handleActivate(partyA);

    // File a claim and adjudicate with DEACTIVATE on zone 0
    agr.exposed_handleClaim(partyA, abi.encode(uint256(0), bytes("evidence")));

    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](1);
    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0, targetIndex: 0, actionType: AgreementTypes.DEACTIVATE, params: ""
    });
    agr.exposed_handleAdjudicate(adjudicator, abi.encode(uint256(0), true, actions));

    // Zone 0 hat should be deactivated even though agreement is still ACTIVE
    uint256 zoneHat0 = agr.zoneHatIds(0);
    assertFalse(agr.getHatStatus(zoneHat0));

    // Zone 1 hat should still be active
    uint256 zoneHat1 = agr.zoneHatIds(1);
    assertTrue(agr.getHatStatus(zoneHat1));
  }

  function test_ReturnsFalse_GivenStateIsProposed() public view {
    assertFalse(harness.getHatStatus(0));
  }

  function test_ReturnsFalse_GivenStateIsAccepted() public {
    _advanceToAccepted();
    assertFalse(harness.getHatStatus(0));
  }

  function test_ReturnsTrue_GivenStateIsReady() public {
    _advanceToReady();
    assertTrue(harness.getHatStatus(0));
  }

  function test_ReturnsFalse_GivenStateIsActiveAndDeadlineHasPassed() public {
    _advanceToActive();
    vm.warp(harness.deadline() + 1);
    assertFalse(harness.getHatStatus(0));
  }

  function test_ReturnsTrue_GivenStateIsActiveAndDeadlineHasNotPassed() public {
    _advanceToActive();
    assertTrue(harness.getHatStatus(0));
  }

  function test_ReturnsFalse_GivenStateIsClosed() public {
    _advanceToActive();
    vm.warp(harness.deadline() + 1);
    harness.exposed_handleFinalize();
    assertFalse(harness.getHatStatus(0));
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

  function _advanceToActive() internal {
    _advanceToReady();
    harness.exposed_handleActivate(partyA);
  }
}
