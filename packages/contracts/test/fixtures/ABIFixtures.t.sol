// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { Test, console } from "forge-std/Test.sol";
import { AgreementTypes } from "../../src/lib/AgreementTypes.sol";
import { TZTypes } from "../../src/lib/TZTypes.sol";

/// @notice Generates deterministic ABI-encoded bytes for cross-language fixture testing.
///         Run with: forge test --match-contract ABIFixtures -vvv
contract ABIFixtures is Test {
  address partyA;
  address partyB;
  address adjudicatorAddr;

  function setUp() public {
    partyA = makeAddr("partyA");
    partyB = makeAddr("partyB");
    adjudicatorAddr = makeAddr("adjudicator");
  }

  // ---- Constants ----

  function test_logConstants() public pure {
    // States
    console.log("=== STATES ===");
    console.logBytes32(AgreementTypes.PROPOSED);
    console.logBytes32(AgreementTypes.NEGOTIATING);
    console.logBytes32(AgreementTypes.ACCEPTED);
    console.logBytes32(AgreementTypes.ACTIVE);
    console.logBytes32(AgreementTypes.CLOSED);
    console.logBytes32(AgreementTypes.REJECTED);

    // Inputs
    console.log("=== INPUTS ===");
    console.logBytes32(AgreementTypes.PROPOSE);
    console.logBytes32(AgreementTypes.COUNTER);
    console.logBytes32(AgreementTypes.ACCEPT);
    console.logBytes32(AgreementTypes.REJECT);
    console.logBytes32(AgreementTypes.ACTIVATE);
    console.logBytes32(AgreementTypes.CLAIM);
    console.logBytes32(AgreementTypes.ADJUDICATE);
    console.logBytes32(AgreementTypes.WITHDRAW);
    console.logBytes32(AgreementTypes.COMPLETE);
    console.logBytes32(AgreementTypes.EXIT);
    console.logBytes32(AgreementTypes.FINALIZE);

    // Actions
    console.log("=== ACTIONS ===");
    console.logBytes32(AgreementTypes.PENALIZE);
    console.logBytes32(AgreementTypes.REWARD);
    console.logBytes32(AgreementTypes.FEEDBACK);
    console.logBytes32(AgreementTypes.DEACTIVATE);
    console.logBytes32(AgreementTypes.CLOSE);

    // Outcomes (not in AgreementTypes, compute inline)
    console.log("=== OUTCOMES ===");
    console.logBytes32(keccak256("COMPLETED"));
    console.logBytes32(keccak256("EXITED"));
    console.logBytes32(keccak256("EXPIRED"));
    console.logBytes32(keccak256("ADJUDICATED"));
  }

  // ---- Addresses ----

  function test_logAddresses() public view {
    console.log("=== ADDRESSES ===");
    console.log("partyA:", partyA);
    console.log("partyB:", partyB);
    console.log("adjudicator:", adjudicatorAddr);
  }

  // ---- Basic ProposalData ----

  function test_encodeBasicProposal() public view {
    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);

    zones[0].party = partyA;
    zones[0].agentId = 0;
    zones[0].hatMaxSupply = 1;
    zones[0].hatDetails = "Test Zone Hat";

    zones[1].party = partyB;
    zones[1].agentId = 0;
    zones[1].hatMaxSupply = 1;
    zones[1].hatDetails = "Test Zone Hat";

    AgreementTypes.ProposalData memory data =
      AgreementTypes.ProposalData({ termsDocUri: "", zones: zones, adjudicator: adjudicatorAddr, deadline: 1_000_000 });

    bytes memory encoded = abi.encode(data);
    console.log("=== BASIC PROPOSAL ===");
    console.logBytes(encoded);
  }

  // ---- Rich ProposalData ----

  function test_encodeRichProposal() public view {
    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);

    // Zone A: one mechanism, one resource
    zones[0].party = partyA;
    zones[0].agentId = 0;
    zones[0].hatMaxSupply = 1;
    zones[0].hatDetails = "Test Zone Hat";
    zones[0].mechanisms = new TZTypes.TZMechanism[](1);
    zones[0].mechanisms[0] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Penalty,
      moduleKind: TZTypes.TZModuleKind.External,
      module: address(0xdead),
      data: hex"1234"
    });
    zones[0].resources = new TZTypes.TZResourceTokenConfig[](1);
    zones[0].resources[0] =
      TZTypes.TZResourceTokenConfig({ tokenType: TZTypes.TZParamType.Permission, metadata: hex"abcd" });

    // Zone B: one mechanism, one resource
    zones[1].party = partyB;
    zones[1].agentId = 0;
    zones[1].hatMaxSupply = 1;
    zones[1].hatDetails = "Test Zone Hat";
    zones[1].mechanisms = new TZTypes.TZMechanism[](1);
    zones[1].mechanisms[0] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Reward,
      moduleKind: TZTypes.TZModuleKind.External,
      module: address(0xbeef),
      data: hex"5678"
    });
    zones[1].resources = new TZTypes.TZResourceTokenConfig[](1);
    zones[1].resources[0] =
      TZTypes.TZResourceTokenConfig({ tokenType: TZTypes.TZParamType.Responsibility, metadata: hex"ef01" });

    AgreementTypes.ProposalData memory data =
      AgreementTypes.ProposalData({ termsDocUri: "", zones: zones, adjudicator: adjudicatorAddr, deadline: 1_000_000 });

    bytes memory encoded = abi.encode(data);
    console.log("=== RICH PROPOSAL ===");
    console.logBytes(encoded);
  }

  // ---- CLAIM payload ----

  function test_encodeClaim() public pure {
    bytes memory evidence = bytes("evidence");
    bytes memory encoded = abi.encode(uint256(0), evidence);
    console.log("=== CLAIM ===");
    console.logBytes(encoded);
  }

  // ---- ADJUDICATE payload ----

  function test_encodeAdjudicate() public pure {
    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](2);
    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0, targetIndex: 0, actionType: AgreementTypes.PENALIZE, params: hex""
    });
    actions[1] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0, targetIndex: 0, actionType: AgreementTypes.CLOSE, params: hex""
    });

    bytes memory encoded = abi.encode(uint256(0), true, actions);
    console.log("=== ADJUDICATE ===");
    console.logBytes(encoded);
  }

  // ---- COMPLETE / EXIT payload ----

  function test_encodeFeedback() public pure {
    string memory feedbackURI = "ipfs://test-feedback";
    bytes32 feedbackHash = keccak256("feedback");
    bytes memory encoded = abi.encode(feedbackURI, feedbackHash);
    console.log("=== FEEDBACK ===");
    console.logBytes(encoded);
    console.log("feedbackHash:");
    console.logBytes32(feedbackHash);
  }
}
