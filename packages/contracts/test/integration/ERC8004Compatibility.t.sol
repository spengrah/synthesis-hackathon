// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { ForkTestBase } from "../Base.t.sol";
import { Agreement } from "../../src/Agreement.sol";
import { AgreementTypes } from "../../src/lib/AgreementTypes.sol";
import { TZTypes } from "../../src/lib/TZTypes.sol";
import { Defaults } from "../helpers/Defaults.sol";
import { Constants } from "../helpers/Constants.sol";

contract Agreement_ERC8004Compatibility is ForkTestBase {
  struct RealAgent {
    uint256 id;
    address owner;
  }

  function setUp() public override {
    super.setUp();
    _deployAll();
  }

  function _findTwoRealAgents() internal view returns (RealAgent memory first, RealAgent memory second) {
    uint256 found;
    for (uint256 id = 1; id <= 5000 && found < 2; id++) {
      (bool ok, bytes memory data) =
        Constants.IDENTITY_REGISTRY.staticcall(abi.encodeWithSignature("ownerOf(uint256)", id));
      if (!ok || data.length < 32) continue;

      address owner = abi.decode(data, (address));
      if (owner == address(0)) continue;

      if (found == 0) {
        first = RealAgent({ id: id, owner: owner });
        found = 1;
      } else if (owner != first.owner) {
        second = RealAgent({ id: id, owner: owner });
        found = 2;
      }
    }

    require(found == 2, "insufficient forked 8004 ids");
  }

  function _createActiveAgreementWithRealAgents(bool withClaimMechanism)
    internal
    returns (Agreement agr, RealAgent memory first, RealAgent memory second)
  {
    (first, second) = _findTwoRealAgents();
    partyA = first.owner;
    partyB = second.owner;
    vm.deal(partyA, 100 ether);
    vm.deal(partyB, 100 ether);

    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, first.id);
    zones[1] = Defaults.tzConfig(partyB, second.id);

    if (withClaimMechanism) {
      zones[0].mechanisms = new TZTypes.TZMechanism[](1);
      zones[0].mechanisms[0] = TZTypes.TZMechanism({
        paramType: TZTypes.TZParamType.Reward,
        moduleKind: TZTypes.TZModuleKind.External,
        module: address(0xBEEF),
        data: ""
      });
    }

    bytes memory payload =
      abi.encode(Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE));
    (agr,) = _createAgreementClone(payload);

    vm.prank(partyB);
    agr.submitInput(AgreementTypes.ACCEPT, payload);

    vm.prank(partyA);
    agr.submitInput(AgreementTypes.SET_UP, "");

    vm.prank(partyA);
    agr.submitInput(AgreementTypes.ACTIVATE, "");
  }

  function test_Fork_ExpiredClose_WritesToRealReputationRegistry() public {
    (Agreement agr,,) = _createActiveAgreementWithRealAgents(false);

    vm.warp(block.timestamp + Constants.DEFAULT_DEADLINE + 1);
    vm.prank(observer);
    agr.submitInput(AgreementTypes.FINALIZE, "");

    assertEq(agr.currentState(), AgreementTypes.CLOSED);
    assertEq(agr.outcome(), keccak256("EXPIRED"));
  }

  function test_Fork_AdjudicateFeedback_WritesToRealReputationRegistry() public {
    (Agreement agr, RealAgent memory first,) = _createActiveAgreementWithRealAgents(true);

    vm.prank(partyA);
    agr.submitInput(AgreementTypes.CLAIM, abi.encode(uint256(0), bytes("fork-feedback-claim")));

    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](1);
    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0,
      targetIndex: 0,
      actionType: AgreementTypes.FEEDBACK,
      params: abi.encode("ipfs://fork-feedback", keccak256("fork-feedback"))
    });

    vm.prank(adjudicator);
    agr.submitInput(AgreementTypes.ADJUDICATE, abi.encode(uint256(0), true, actions));

    assertEq(agr.currentState(), AgreementTypes.ACTIVE);
    assertEq(agr.agentIds(0), first.id);
  }

  function test_Fork_CompletedClose_WritesPeerFeedbackToRealReputationRegistry() public {
    (Agreement agr, RealAgent memory first, RealAgent memory second) = _createActiveAgreementWithRealAgents(false);

    vm.prank(partyA);
    agr.submitInput(AgreementTypes.COMPLETE, abi.encode("ipfs://party-a-feedback", keccak256("party-a-feedback")));

    vm.prank(partyB);
    agr.submitInput(AgreementTypes.COMPLETE, abi.encode("ipfs://party-b-feedback", keccak256("party-b-feedback")));

    assertEq(agr.currentState(), AgreementTypes.CLOSED);
    assertEq(agr.outcome(), keccak256("COMPLETED"));
    assertEq(agr.agentIds(0), first.id);
    assertEq(agr.agentIds(1), second.id);
  }
}
