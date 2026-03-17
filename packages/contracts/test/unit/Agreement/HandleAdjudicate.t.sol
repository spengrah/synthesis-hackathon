// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementHarnessBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { TZTypes } from "../../../src/lib/TZTypes.sol";
import { IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";
import { AgreementHarness } from "../../harness/AgreementHarness.sol";
import { Defaults } from "../../helpers/Defaults.sol";
import { Constants } from "../../helpers/Constants.sol";

contract Agreement_handleAdjudicate is AgreementHarnessBase {
  AgreementHarness internal activeHarness;

  function setUp() public override {
    super.setUp();
    activeHarness = _createActiveHarnessWithClaim();
  }

  function _createActiveHarnessWithClaim() internal returns (AgreementHarness) {
    // Build proposal with a mechanism
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

    // Accept with the correct payload
    agr.exposed_handleAccept(partyB, payload);

    // Activate
    agr.exposed_handleActivate(partyA);

    // File a claim
    agr.exposed_handleClaim(partyA, abi.encode(uint256(0), bytes("evidence")));

    return agr;
  }

  function test_RevertIf_StateIsNotActive() public {
    bytes memory proposalPayload = _defaultProposalPayload();
    (AgreementHarness newHarness,) = _createHarnessCloneWithPayload(proposalPayload);
    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](0);
    vm.expectRevert(
      abi.encodeWithSelector(IAgreementErrors.InvalidState.selector, AgreementTypes.PROPOSED, AgreementTypes.ACTIVE)
    );
    newHarness.exposed_handleAdjudicate(adjudicator, abi.encode(uint256(0), true, actions));
  }

  function test_RevertIf_CallerIsNotAdjudicator() public {
    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](0);
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.NotAdjudicator.selector, partyA));
    activeHarness.exposed_handleAdjudicate(partyA, abi.encode(uint256(0), true, actions));
  }

  function test_RevertIf_ClaimIdIsInvalid() public {
    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](0);
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.InvalidClaimId.selector, uint256(999)));
    activeHarness.exposed_handleAdjudicate(adjudicator, abi.encode(uint256(999), true, actions));
  }

  function test_RevertIf_ClaimAlreadyAdjudicated() public {
    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](0);
    // First adjudication succeeds
    activeHarness.exposed_handleAdjudicate(adjudicator, abi.encode(uint256(0), true, actions));

    // Second adjudication of same claim reverts
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.ClaimAlreadyAdjudicated.selector, uint256(0)));
    activeHarness.exposed_handleAdjudicate(adjudicator, abi.encode(uint256(0), true, actions));
  }

  function test_EmitsAdjudicationDelivered() public {
    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](0);
    bytes32[] memory actionTypes = new bytes32[](0);
    vm.expectEmit(true, false, false, true);
    emit IAgreementEvents.AdjudicationDelivered(0, true, actionTypes);
    activeHarness.exposed_handleAdjudicate(adjudicator, abi.encode(uint256(0), true, actions));
  }

  function test_ClosesOnCloseAction() public {
    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](1);
    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0, targetIndex: 0, actionType: AgreementTypes.CLOSE, params: ""
    });

    activeHarness.exposed_handleAdjudicate(adjudicator, abi.encode(uint256(0), true, actions));

    assertEq(activeHarness.currentState(), AgreementTypes.CLOSED);
    assertEq(activeHarness.outcome(), keccak256("ADJUDICATED"));
  }
}
