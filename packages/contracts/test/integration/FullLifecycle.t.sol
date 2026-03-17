// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { ForkTestBase } from "../Base.t.sol";
import { Constants } from "../helpers/Constants.sol";
import { Defaults } from "../helpers/Defaults.sol";

import { Agreement } from "../../src/Agreement.sol";
import { AgreementRegistry } from "../../src/AgreementRegistry.sol";
import { IAgreement, IAgreementEvents } from "../../src/interfaces/IAgreement.sol";
import { IAgreementRegistryEvents } from "../../src/interfaces/IAgreementRegistry.sol";
import { AgreementTypes } from "../../src/lib/AgreementTypes.sol";
import { TZTypes } from "../../src/lib/TZTypes.sol";

import { DeployResourceTokenRegistry } from "../../script/DeployResourceTokenRegistry.s.sol";
import { DeployAgreementRegistry } from "../../script/DeployAgreementRegistry.s.sol";

/// @notice Base for integration tests. Deploys the full stack including AgreementRegistry.
abstract contract IntegrationBase is ForkTestBase {
  function setUp() public virtual override {
    super.setUp();
    _deployAll();
  }

  /// @dev Deploy AgreementRegistry using the deploy script, along with a fresh
  ///      ResourceTokenRegistry owned by the AgreementRegistry so it can call registerMinter.
  function _deployAgreementRegistry() internal override {
    address testContract = address(this);
    uint256 testNonce = vm.getNonce(testContract);

    // testNonce+0 = new DeployResourceTokenRegistry
    // testNonce+1 = new DeployAgreementRegistry
    address deployScriptAddr = vm.computeCreateAddress(testContract, testNonce + 1);
    // AgreementRegistry is created inside execute() at deploy script's nonce 1 (EIP-161)
    address predictedAgreementRegistry = vm.computeCreateAddress(deployScriptAddr, 1);

    // Deploy RTR with predicted AgreementRegistry as owner
    DeployResourceTokenRegistry rtrScript = new DeployResourceTokenRegistry();
    registry = rtrScript.execute(predictedAgreementRegistry);

    // Deploy AgreementRegistry
    DeployAgreementRegistry deployScript = new DeployAgreementRegistry();
    agreementRegistry = deployScript.execute(address(hats), address(registry), address(agreementImpl));

    require(address(agreementRegistry) == predictedAgreementRegistry, "AgreementRegistry address mismatch");
  }

  // ====================
  // Payload builders
  // ====================

  /// @dev Build a proposal payload with a mechanism on each zone (needed for CLAIM tests).
  function _proposalPayloadWithMechanism() internal view returns (bytes memory) {
    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);

    // Add a dummy mechanism to zone 0 so CLAIM has a valid mechanismIndex
    zones[0].mechanisms = new TZTypes.TZMechanism[](1);
    zones[0].mechanisms[0] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Penalty, moduleKind: TZTypes.TZModuleKind.External, module: address(0), data: ""
    });

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    return abi.encode(data);
  }

  // ====================
  // Lifecycle helpers
  // ====================

  /// @dev Create an agreement via the registry. Returns the Agreement instance.
  function _createAgreement(bytes memory proposalPayload) internal returns (Agreement) {
    vm.prank(partyA);
    address agr = agreementRegistry.createAgreement(partyB, proposalPayload);
    return Agreement(agr);
  }

  /// @dev Advance from PROPOSED to ACCEPTED by having partyB counter then partyA accept.
  function _advanceToAcceptedViaRegistry(Agreement agr, bytes memory proposalPayload) internal {
    // partyB counters (turn is partyB after creation)
    vm.prank(partyB);
    agr.submitInput(AgreementTypes.COUNTER, proposalPayload);

    // partyA accepts (turn flipped to partyA after counter)
    vm.prank(partyA);
    agr.submitInput(AgreementTypes.ACCEPT, proposalPayload);
  }

  /// @dev Advance from PROPOSED through to ACTIVE.
  function _advanceToActiveViaRegistry(Agreement agr, bytes memory proposalPayload) internal {
    _advanceToAcceptedViaRegistry(agr, proposalPayload);

    // Either party can activate
    vm.prank(partyA);
    agr.submitInput(AgreementTypes.ACTIVATE, "");
  }
}

// ====================
// Test contracts
// ====================

contract FullLifecycle_Adjudication is IntegrationBase {
  function test_FullLifecycle_Adjudication() public {
    // --- 1. Create agreement ---
    bytes memory payload = _proposalPayloadWithMechanism();
    Agreement agr = _createAgreement(payload);
    assertEq(agr.currentState(), AgreementTypes.PROPOSED, "should be PROPOSED after creation");
    assertEq(agr.parties(0), partyA);
    assertEq(agr.parties(1), partyB);
    assertEq(agr.turn(), partyB);

    // --- 2. Counter ---
    vm.prank(partyB);
    agr.submitInput(AgreementTypes.COUNTER, payload);
    assertEq(agr.currentState(), AgreementTypes.NEGOTIATING, "should be NEGOTIATING after counter");
    assertEq(agr.turn(), partyA, "turn should flip to partyA");

    // --- 3. Accept ---
    vm.prank(partyA);
    agr.submitInput(AgreementTypes.ACCEPT, payload);
    assertEq(agr.currentState(), AgreementTypes.ACCEPTED, "should be ACCEPTED");

    // --- 4. Activate ---
    vm.prank(partyA);
    agr.submitInput(AgreementTypes.ACTIVATE, "");
    assertEq(agr.currentState(), AgreementTypes.ACTIVE, "should be ACTIVE");

    // Verify trust zones deployed
    assertTrue(agr.trustZones(0) != address(0), "zone 0 should be deployed");
    assertTrue(agr.trustZones(1) != address(0), "zone 1 should be deployed");

    // Verify zone hat IDs set
    assertTrue(agr.zoneHatIds(0) != 0, "zone hat 0 should be set");
    assertTrue(agr.zoneHatIds(1) != 0, "zone hat 1 should be set");

    // Verify hats minted to parties
    assertTrue(hats.isWearerOfHat(partyA, agr.zoneHatIds(0)), "partyA should wear zone hat 0");
    assertTrue(hats.isWearerOfHat(partyB, agr.zoneHatIds(1)), "partyB should wear zone hat 1");

    // Verify deadline set
    assertTrue(agr.deadline() > block.timestamp, "deadline should be in the future");

    // Verify adjudicator set
    assertEq(agr.adjudicator(), adjudicator, "adjudicator should be set");

    // Verify mechanism registered (we added one to zone 0)
    assertEq(agr.mechanismCount(), 1, "should have 1 mechanism");

    // --- 5. File claim ---
    bytes memory claimPayload = abi.encode(uint256(0), abi.encode("rate limit exceeded"));
    vm.prank(partyA);
    agr.submitInput(AgreementTypes.CLAIM, claimPayload);
    assertEq(agr.claimCount(), 1, "claim count should be 1");
    assertEq(agr.currentState(), AgreementTypes.ACTIVE, "should still be ACTIVE after claim");

    // --- 6. Adjudicate with CLOSE ---
    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](1);
    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0, targetIndex: 0, actionType: AgreementTypes.CLOSE, params: ""
    });
    bytes memory adjPayload = abi.encode(uint256(0), true, actions);

    vm.prank(adjudicator);
    agr.submitInput(AgreementTypes.ADJUDICATE, adjPayload);

    assertEq(agr.currentState(), AgreementTypes.CLOSED, "should be CLOSED after adjudication");
    assertEq(agr.outcome(), keccak256("ADJUDICATED"), "outcome should be ADJUDICATED");
  }
}

contract FullLifecycle_Completion is IntegrationBase {
  function test_FullLifecycle_Completion() public {
    bytes memory payload = _defaultProposalPayload();
    Agreement agr = _createAgreement(payload);

    _advanceToActiveViaRegistry(agr, payload);
    assertEq(agr.currentState(), AgreementTypes.ACTIVE, "should be ACTIVE");

    // --- partyA signals completion ---
    bytes memory completeA = abi.encode("ipfs://feedbackA", keccak256("feedbackA"));
    vm.prank(partyA);
    agr.submitInput(AgreementTypes.COMPLETE, completeA);

    assertEq(agr.currentState(), AgreementTypes.ACTIVE, "should still be ACTIVE after first completion");
    assertTrue(agr.completionSignaled(0), "partyA completion should be signaled");
    assertFalse(agr.completionSignaled(1), "partyB completion should not be signaled yet");

    // --- partyB signals completion ---
    bytes memory completeB = abi.encode("ipfs://feedbackB", keccak256("feedbackB"));
    vm.prank(partyB);
    agr.submitInput(AgreementTypes.COMPLETE, completeB);

    assertEq(agr.currentState(), AgreementTypes.CLOSED, "should be CLOSED after both complete");
    assertEq(agr.outcome(), keccak256("COMPLETED"), "outcome should be COMPLETED");
  }
}

contract FullLifecycle_MutualExit is IntegrationBase {
  function test_FullLifecycle_MutualExit() public {
    bytes memory payload = _defaultProposalPayload();
    Agreement agr = _createAgreement(payload);

    _advanceToActiveViaRegistry(agr, payload);
    assertEq(agr.currentState(), AgreementTypes.ACTIVE, "should be ACTIVE");

    // --- partyA signals exit ---
    bytes memory exitA = abi.encode("ipfs://exitA", keccak256("exitA"));
    vm.prank(partyA);
    agr.submitInput(AgreementTypes.EXIT, exitA);

    assertEq(agr.currentState(), AgreementTypes.ACTIVE, "should still be ACTIVE after first exit");
    assertTrue(agr.exitSignaled(0), "partyA exit should be signaled");
    assertFalse(agr.exitSignaled(1), "partyB exit should not be signaled yet");

    // --- partyB signals exit ---
    bytes memory exitB = abi.encode("ipfs://exitB", keccak256("exitB"));
    vm.prank(partyB);
    agr.submitInput(AgreementTypes.EXIT, exitB);

    assertEq(agr.currentState(), AgreementTypes.CLOSED, "should be CLOSED after mutual exit");
    assertEq(agr.outcome(), keccak256("EXITED"), "outcome should be EXITED");
  }
}

contract FullLifecycle_Expiry is IntegrationBase {
  function test_FullLifecycle_Expiry() public {
    bytes memory payload = _defaultProposalPayload();
    Agreement agr = _createAgreement(payload);

    _advanceToActiveViaRegistry(agr, payload);
    assertEq(agr.currentState(), AgreementTypes.ACTIVE, "should be ACTIVE");

    // Warp past the deadline
    vm.warp(block.timestamp + Constants.DEFAULT_DEADLINE + 1);

    // Anyone can finalize after deadline
    vm.prank(observer);
    agr.submitInput(AgreementTypes.FINALIZE, "");

    assertEq(agr.currentState(), AgreementTypes.CLOSED, "should be CLOSED after finalize");
    assertEq(agr.outcome(), keccak256("EXPIRED"), "outcome should be EXPIRED");
  }
}
