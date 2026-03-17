// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementHarnessBase } from "../../Base.t.sol";
import { AgreementHarness } from "../../harness/AgreementHarness.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { TZTypes } from "../../../src/lib/TZTypes.sol";
import { IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";
import { IReputationRegistry } from "../../../src/interfaces/IERC8004.sol";
import { Constants } from "../../helpers/Constants.sol";
import { Defaults } from "../../helpers/Defaults.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

/// @dev Mock mechanism that records the last call data it received.
contract MockMechanism {
  bytes public lastCallData;
  bool public shouldRevert;
  bool public wasCalled;

  function setRevert(bool _shouldRevert) external {
    shouldRevert = _shouldRevert;
  }

  fallback() external payable {
    if (shouldRevert) revert("mock revert");
    wasCalled = true;
    lastCallData = msg.data;
  }

  receive() external payable { }
}

contract Agreement_HarnessAdjudication is AgreementHarnessBase {
  AgreementHarness internal activeAgreement;
  MockMechanism internal mockMech;

  function setUp() public override {
    super.setUp();
    activeAgreement = _createActiveAgreementWithMockMechanism();
  }

  function _createActiveAgreementWithMockMechanism() internal returns (AgreementHarness) {
    mockMech = new MockMechanism();

    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);

    TZTypes.TZMechanism[] memory mechs = new TZTypes.TZMechanism[](1);
    mechs[0] = TZTypes.TZMechanism({ paramType: TZTypes.TZParamType.Penalty, module: address(mockMech), initData: "" });
    zones[0].mechanisms = mechs;

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (AgreementHarness clone,) = _createHarnessClone(payload);

    vm.prank(partyB);
    clone.submitInput(AgreementTypes.ACCEPT, payload);

    vm.prank(partyA);
    clone.submitInput(AgreementTypes.ACTIVATE, "");

    // File a claim
    vm.prank(partyA);
    clone.submitInput(AgreementTypes.CLAIM, abi.encode(uint256(0), bytes("evidence")));

    return clone;
  }

  // ---- test_Adjudicate_PenalizeCallsMechanism ----

  function test_Adjudicate_PenalizeCallsMechanism() public {
    bytes memory penalizeParams = abi.encodeWithSignature("penalize(address,uint256)", partyA, 100);

    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](1);
    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0, targetIndex: 0, actionType: AgreementTypes.PENALIZE, params: penalizeParams
    });

    vm.prank(adjudicator);
    activeAgreement.submitInput(AgreementTypes.ADJUDICATE, abi.encode(uint256(0), true, actions));

    assertTrue(mockMech.wasCalled(), "mechanism should have been called");
    assertEq(mockMech.lastCallData(), penalizeParams);
  }

  // ---- test_Adjudicate_RewardCallsMechanism ----

  function test_Adjudicate_RewardCallsMechanism() public {
    // Create an agreement with a Reward mechanism
    MockMechanism rewardMech = new MockMechanism();

    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);

    TZTypes.TZMechanism[] memory mechs = new TZTypes.TZMechanism[](1);
    mechs[0] = TZTypes.TZMechanism({ paramType: TZTypes.TZParamType.Reward, module: address(rewardMech), initData: "" });
    zones[0].mechanisms = mechs;

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (AgreementHarness clone,) = _createHarnessClone(payload);

    vm.prank(partyB);
    clone.submitInput(AgreementTypes.ACCEPT, payload);
    vm.prank(partyA);
    clone.submitInput(AgreementTypes.ACTIVATE, "");
    vm.prank(partyA);
    clone.submitInput(AgreementTypes.CLAIM, abi.encode(uint256(0), bytes("evidence")));

    bytes memory rewardParams = abi.encodeWithSignature("reward(address,uint256)", partyA, 50);

    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](1);
    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0, targetIndex: 0, actionType: AgreementTypes.REWARD, params: rewardParams
    });

    vm.prank(adjudicator);
    clone.submitInput(AgreementTypes.ADJUDICATE, abi.encode(uint256(0), true, actions));

    assertTrue(rewardMech.wasCalled(), "reward mechanism should have been called");
    assertEq(rewardMech.lastCallData(), rewardParams);
  }

  // ---- test_Adjudicate_FeedbackWritesToReputationRegistry ----

  function test_Adjudicate_FeedbackWritesToReputationRegistry() public {
    uint256 agentIdA = 42;
    uint256 agentIdB = 43;

    // Mock identity registry
    vm.mockCall(
      Constants.IDENTITY_REGISTRY,
      abi.encodeWithSelector(bytes4(keccak256("ownerOf(uint256)")), agentIdA),
      abi.encode(partyA)
    );
    vm.mockCall(
      Constants.IDENTITY_REGISTRY,
      abi.encodeWithSelector(bytes4(keccak256("ownerOf(uint256)")), agentIdB),
      abi.encode(partyB)
    );

    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, agentIdA);
    zones[1] = Defaults.tzConfig(partyB, agentIdB);

    // Need at least one mechanism so CLAIM(mechanismIndex=0) works
    TZTypes.TZMechanism[] memory mechs = new TZTypes.TZMechanism[](1);
    mechs[0] = TZTypes.TZMechanism({ paramType: TZTypes.TZParamType.Reward, module: address(0xdead), initData: "" });
    zones[0].mechanisms = mechs;

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (AgreementHarness clone,) = _createHarnessClone(payload);

    vm.prank(partyB);
    clone.submitInput(AgreementTypes.ACCEPT, payload);
    vm.prank(partyA);
    clone.submitInput(AgreementTypes.ACTIVATE, "");
    vm.prank(partyA);
    clone.submitInput(AgreementTypes.CLAIM, abi.encode(uint256(0), bytes("evidence")));

    string memory feedbackURI = "ipfs://adjudication-feedback";
    bytes32 feedbackHash = keccak256(bytes(feedbackURI));
    bytes memory feedbackParams = abi.encode(feedbackURI, feedbackHash);

    string memory endpoint = Strings.toHexString(uint160(address(clone)), 20);

    // Mock and expect giveFeedback call for agentIdA (targetIndex=0)
    vm.mockCall(
      Constants.REPUTATION_REGISTRY, abi.encodeWithSelector(IReputationRegistry.giveFeedback.selector), abi.encode()
    );
    vm.expectCall(
      Constants.REPUTATION_REGISTRY,
      abi.encodeCall(
        IReputationRegistry.giveFeedback,
        (agentIdA, 0, 0, "trust-zone-agreement", "ADJUDICATED", endpoint, feedbackURI, feedbackHash)
      )
    );

    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](1);
    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0, targetIndex: 0, actionType: AgreementTypes.FEEDBACK, params: feedbackParams
    });

    vm.prank(adjudicator);
    clone.submitInput(AgreementTypes.ADJUDICATE, abi.encode(uint256(0), true, actions));
  }

  // ---- test_Adjudicate_FeedbackRevertsInvalidTargetIndex ----

  function test_Adjudicate_FeedbackRevertsInvalidTargetIndex() public {
    // Need agentIds set for FEEDBACK
    uint256 agentIdA = 42;
    vm.mockCall(
      Constants.IDENTITY_REGISTRY,
      abi.encodeWithSelector(bytes4(keccak256("ownerOf(uint256)")), agentIdA),
      abi.encode(partyA)
    );

    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, agentIdA);
    zones[1] = Defaults.tzConfig(partyB, 0);

    // Need at least one mechanism so CLAIM(mechanismIndex=0) works
    TZTypes.TZMechanism[] memory mechs = new TZTypes.TZMechanism[](1);
    mechs[0] = TZTypes.TZMechanism({ paramType: TZTypes.TZParamType.Reward, module: address(0xdead), initData: "" });
    zones[0].mechanisms = mechs;

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (AgreementHarness clone,) = _createHarnessClone(payload);

    vm.prank(partyB);
    clone.submitInput(AgreementTypes.ACCEPT, payload);
    vm.prank(partyA);
    clone.submitInput(AgreementTypes.ACTIVATE, "");
    vm.prank(partyA);
    clone.submitInput(AgreementTypes.CLAIM, abi.encode(uint256(0), bytes("evidence")));

    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](1);
    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0,
      targetIndex: 5, // out of bounds (>= 2)
      actionType: AgreementTypes.FEEDBACK,
      params: abi.encode("uri", bytes32(0))
    });

    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.InvalidMechanismIndex.selector, uint256(5)));
    vm.prank(adjudicator);
    clone.submitInput(AgreementTypes.ADJUDICATE, abi.encode(uint256(0), true, actions));
  }

  // ---- test_Adjudicate_FeedbackRevertsZeroAgentId ----

  function test_Adjudicate_FeedbackRevertsZeroAgentId() public {
    // Default agreement has agentId == 0 for both parties
    // File a claim first
    AgreementHarness clone = _createActiveAgreementWithMockMechanism();

    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](1);
    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0,
      targetIndex: 0, // valid index but agentId is 0
      actionType: AgreementTypes.FEEDBACK,
      params: abi.encode("uri", bytes32(0))
    });

    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.InvalidInput.selector, AgreementTypes.FEEDBACK));
    vm.prank(adjudicator);
    clone.submitInput(AgreementTypes.ADJUDICATE, abi.encode(uint256(0), true, actions));
  }

  // ---- test_Adjudicate_DeactivateSetsHatStatusFalse ----

  function test_Adjudicate_DeactivateSetsHatStatusFalse() public {
    uint256 zoneHat0 = activeAgreement.zoneHatIds(0);

    // Verify hat is active before deactivation
    assertTrue(activeAgreement.getHatStatus(zoneHat0), "hat should be active before deactivation");

    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](1);
    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0, targetIndex: 0, actionType: AgreementTypes.DEACTIVATE, params: ""
    });

    vm.prank(adjudicator);
    activeAgreement.submitInput(AgreementTypes.ADJUDICATE, abi.encode(uint256(0), true, actions));

    assertFalse(activeAgreement.getHatStatus(zoneHat0), "hat should be inactive after DEACTIVATE");
  }

  // ---- test_Adjudicate_InvalidMechanismIndexReverts ----

  function test_Adjudicate_InvalidMechanismIndexReverts() public {
    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](1);
    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 999, // out of bounds
      targetIndex: 0,
      actionType: AgreementTypes.PENALIZE,
      params: ""
    });

    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.InvalidMechanismIndex.selector, uint256(999)));
    vm.prank(adjudicator);
    activeAgreement.submitInput(AgreementTypes.ADJUDICATE, abi.encode(uint256(0), true, actions));
  }

  // ---- test_Adjudicate_FailedExternalCallReverts ----

  function test_Adjudicate_FailedExternalCallReverts() public {
    // Set the mock mechanism to revert
    mockMech.setRevert(true);

    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](1);
    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0,
      targetIndex: 0,
      actionType: AgreementTypes.PENALIZE,
      params: abi.encodeWithSignature("penalize(address)", partyA)
    });

    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.InvalidInput.selector, AgreementTypes.PENALIZE));
    vm.prank(adjudicator);
    activeAgreement.submitInput(AgreementTypes.ADJUDICATE, abi.encode(uint256(0), true, actions));
  }
}
