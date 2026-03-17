// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { TZTypes } from "../../../src/lib/TZTypes.sol";
import { IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";
import { Agreement } from "../../../src/Agreement.sol";
import { Defaults } from "../../helpers/Defaults.sol";
import { Constants } from "../../helpers/Constants.sol";

contract Agreement_getHatStatus is AgreementBase {
  function test_ReturnsFalse_GivenHatExplicitlyDeactivated() public {
    // Create an active agreement with a claim
    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);

    TZTypes.TZMechanism[] memory mechs = new TZTypes.TZMechanism[](1);
    mechs[0] = TZTypes.TZMechanism({ paramType: TZTypes.TZParamType.Reward, module: address(0xdead), initData: "" });
    zones[0].mechanisms = mechs;

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (Agreement agr,) = _createAgreementClone(payload);
    vm.prank(partyB);
    agr.submitInput(AgreementTypes.ACCEPT, payload);
    vm.prank(partyA);
    agr.submitInput(AgreementTypes.ACTIVATE, "");

    // File a claim and adjudicate with DEACTIVATE on zone 0
    vm.prank(partyA);
    agr.submitInput(AgreementTypes.CLAIM, abi.encode(uint256(0), bytes("evidence")));

    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](1);
    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0, targetIndex: 0, actionType: AgreementTypes.DEACTIVATE, params: ""
    });
    vm.prank(adjudicator);
    agr.submitInput(AgreementTypes.ADJUDICATE, abi.encode(uint256(0), true, actions));

    // Zone 0 hat should be deactivated even though agreement is still ACTIVE
    uint256 zoneHat0 = agr.zoneHatIds(0);
    assertFalse(agr.getHatStatus(zoneHat0));

    // Zone 1 hat should still be active
    uint256 zoneHat1 = agr.zoneHatIds(1);
    assertTrue(agr.getHatStatus(zoneHat1));
  }

  function test_ReturnsFalse_GivenStateIsNotActive() public view {
    // State is PROPOSED
    assertFalse(agreement.getHatStatus(0));
  }

  function test_ReturnsFalse_GivenStateIsActiveAndDeadlineHasPassed() public {
    _advanceToActive(agreement);
    vm.warp(agreement.deadline() + 1);
    assertFalse(agreement.getHatStatus(0));
  }

  function test_ReturnsTrue_GivenStateIsActiveAndDeadlineHasNotPassed() public {
    _advanceToActive(agreement);
    assertTrue(agreement.getHatStatus(0));
  }

  function test_ReturnsFalse_GivenStateIsClosed() public {
    _advanceToActive(agreement);
    vm.warp(agreement.deadline() + 1);
    agreement.submitInput(AgreementTypes.FINALIZE, "");
    assertFalse(agreement.getHatStatus(0));
  }
}
