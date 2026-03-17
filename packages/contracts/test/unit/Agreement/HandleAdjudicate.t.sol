// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { TZTypes } from "../../../src/lib/TZTypes.sol";
import { IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";
import { Agreement } from "../../../src/Agreement.sol";
import { Defaults } from "../../helpers/Defaults.sol";
import { Constants } from "../../helpers/Constants.sol";

contract Agreement_handleAdjudicate is AgreementBase {
  Agreement internal activeAgreement;

  function setUp() public override {
    super.setUp();
    activeAgreement = _createActiveAgreementWithClaim();
  }

  function _createActiveAgreementWithClaim() internal returns (Agreement) {
    // Build proposal with a mechanism
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

    // Accept with the correct payload
    vm.prank(partyB);
    agr.submitInput(AgreementTypes.ACCEPT, payload);

    // Activate
    vm.prank(partyA);
    agr.submitInput(AgreementTypes.ACTIVATE, "");

    // File a claim
    vm.prank(partyA);
    agr.submitInput(AgreementTypes.CLAIM, abi.encode(uint256(0), bytes("evidence")));

    return agr;
  }

  function test_RevertIf_StateIsNotActive() public {
    bytes memory proposalPayload = _defaultProposalPayload();
    (Agreement newAgreement,) = _createAgreementClone(proposalPayload);
    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](0);
    vm.expectRevert(
      abi.encodeWithSelector(IAgreementErrors.InvalidState.selector, AgreementTypes.PROPOSED, AgreementTypes.ACTIVE)
    );
    vm.prank(adjudicator);
    newAgreement.submitInput(AgreementTypes.ADJUDICATE, abi.encode(uint256(0), true, actions));
  }

  function test_RevertIf_CallerIsNotAdjudicator() public {
    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](0);
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.NotAdjudicator.selector, partyA));
    vm.prank(partyA);
    activeAgreement.submitInput(AgreementTypes.ADJUDICATE, abi.encode(uint256(0), true, actions));
  }

  function test_RevertIf_ClaimIdIsInvalid() public {
    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](0);
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.InvalidClaimId.selector, uint256(999)));
    vm.prank(adjudicator);
    activeAgreement.submitInput(AgreementTypes.ADJUDICATE, abi.encode(uint256(999), true, actions));
  }

  function test_EmitsAdjudicationDelivered() public {
    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](0);
    bytes32[] memory actionTypes = new bytes32[](0);
    vm.expectEmit(true, false, false, true);
    emit IAgreementEvents.AdjudicationDelivered(0, true, actionTypes);
    vm.prank(adjudicator);
    activeAgreement.submitInput(AgreementTypes.ADJUDICATE, abi.encode(uint256(0), true, actions));
  }

  function test_ClosesOnCloseAction() public {
    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](1);
    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0, targetIndex: 0, actionType: AgreementTypes.CLOSE, params: ""
    });

    vm.prank(adjudicator);
    activeAgreement.submitInput(AgreementTypes.ADJUDICATE, abi.encode(uint256(0), true, actions));

    assertEq(activeAgreement.currentState(), AgreementTypes.CLOSED);
    assertEq(activeAgreement.outcome(), keccak256("ADJUDICATED"));
  }
}
