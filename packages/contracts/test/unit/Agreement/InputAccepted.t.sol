// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementHarnessBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { TZTypes } from "../../../src/lib/TZTypes.sol";
import { IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";
import { AgreementHarness } from "../../harness/AgreementHarness.sol";
import { Constants } from "../../helpers/Constants.sol";
import { Defaults } from "../../helpers/Defaults.sol";

/// @notice Verifies that submitInput emits InputAccepted with correct (fromState, toState, inputId, payload)
///         for every input type. These tests use submitInput (not harness exposed_ calls) because
///         InputAccepted is emitted by the submitInput wrapper, not by the internal handlers.
contract Agreement_InputAccepted is AgreementHarnessBase {
  function test_InputAccepted_Counter() public {
    bytes memory payload = _defaultProposalPayload();
    vm.expectEmit(true, true, true, true);
    emit IAgreementEvents.InputAccepted(
      AgreementTypes.PROPOSED, AgreementTypes.NEGOTIATING, AgreementTypes.COUNTER, payload
    );
    vm.prank(partyB);
    harness.submitInput(AgreementTypes.COUNTER, payload);
  }

  function test_InputAccepted_Accept() public {
    // Advance to NEGOTIATING first
    bytes memory payload = _defaultProposalPayload();
    vm.prank(partyB);
    harness.submitInput(AgreementTypes.COUNTER, payload);

    vm.expectEmit(true, true, true, true);
    emit IAgreementEvents.InputAccepted(
      AgreementTypes.NEGOTIATING, AgreementTypes.ACCEPTED, AgreementTypes.ACCEPT, payload
    );
    vm.prank(partyA);
    harness.submitInput(AgreementTypes.ACCEPT, payload);
  }

  function test_InputAccepted_Reject() public {
    bytes memory payload = "";
    vm.expectEmit(true, true, true, false);
    emit IAgreementEvents.InputAccepted(
      AgreementTypes.PROPOSED, AgreementTypes.REJECTED, AgreementTypes.REJECT, payload
    );
    vm.prank(partyB);
    harness.submitInput(AgreementTypes.REJECT, payload);
  }

  function test_InputAccepted_Withdraw() public {
    vm.expectEmit(true, true, true, false);
    emit IAgreementEvents.InputAccepted(AgreementTypes.PROPOSED, AgreementTypes.REJECTED, AgreementTypes.WITHDRAW, "");
    vm.prank(partyA);
    harness.submitInput(AgreementTypes.WITHDRAW, "");
  }

  function test_InputAccepted_SetUp() public {
    // Advance to ACCEPTED
    bytes memory payload = _defaultProposalPayload();
    vm.prank(partyB);
    harness.submitInput(AgreementTypes.ACCEPT, payload);

    vm.expectEmit(true, true, true, false);
    emit IAgreementEvents.InputAccepted(AgreementTypes.ACCEPTED, AgreementTypes.READY, AgreementTypes.SET_UP, "");
    vm.prank(partyA);
    harness.submitInput(AgreementTypes.SET_UP, "");
  }

  function test_InputAccepted_Activate() public {
    // Advance to READY
    bytes memory payload = _defaultProposalPayload();
    vm.prank(partyB);
    harness.submitInput(AgreementTypes.ACCEPT, payload);
    vm.prank(partyA);
    harness.submitInput(AgreementTypes.SET_UP, "");

    vm.expectEmit(true, true, true, false);
    emit IAgreementEvents.InputAccepted(AgreementTypes.READY, AgreementTypes.ACTIVE, AgreementTypes.ACTIVATE, "");
    vm.prank(partyA);
    harness.submitInput(AgreementTypes.ACTIVATE, "");
  }

  function test_InputAccepted_Claim() public {
    // Need a proposal with at least one mechanism so mechanismIndex 0 is valid
    AgreementHarness claimHarness = _createHarnessWithMechanism();

    bytes memory claimPayload = abi.encode(uint256(0), abi.encode("evidence"));
    vm.expectEmit(true, true, true, false);
    emit IAgreementEvents.InputAccepted(
      AgreementTypes.ACTIVE, AgreementTypes.ACTIVE, AgreementTypes.CLAIM, claimPayload
    );
    vm.prank(partyA);
    claimHarness.submitInput(AgreementTypes.CLAIM, claimPayload);
  }

  function test_InputAccepted_Complete() public {
    _activateViaSubmitInput();

    bytes memory payload = abi.encode("ipfs://feedback", keccak256("feedback"));
    vm.expectEmit(true, true, true, false);
    emit IAgreementEvents.InputAccepted(AgreementTypes.ACTIVE, AgreementTypes.ACTIVE, AgreementTypes.COMPLETE, payload);
    vm.prank(partyA);
    harness.submitInput(AgreementTypes.COMPLETE, payload);
  }

  function test_InputAccepted_Exit() public {
    _activateViaSubmitInput();

    bytes memory payload = abi.encode("ipfs://exit", keccak256("exit"));
    vm.expectEmit(true, true, true, false);
    emit IAgreementEvents.InputAccepted(AgreementTypes.ACTIVE, AgreementTypes.ACTIVE, AgreementTypes.EXIT, payload);
    vm.prank(partyA);
    harness.submitInput(AgreementTypes.EXIT, payload);
  }

  function test_InputAccepted_Finalize() public {
    _activateViaSubmitInput();

    vm.warp(harness.deadline() + 1);

    vm.expectEmit(true, true, true, false);
    emit IAgreementEvents.InputAccepted(AgreementTypes.ACTIVE, AgreementTypes.CLOSED, AgreementTypes.FINALIZE, "");
    vm.prank(partyA);
    harness.submitInput(AgreementTypes.FINALIZE, "");
  }

  function test_InputAccepted_Adjudicate_NonClose() public {
    AgreementHarness claimHarness = _createClaimedHarnessWithMechanism();
    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](1);
    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0,
      targetIndex: 0,
      actionType: AgreementTypes.REWARD,
      params: abi.encodeWithSignature("reward(address,uint256)", partyA, 1)
    });
    bytes memory payload = abi.encode(uint256(0), true, actions);

    vm.expectEmit(true, true, true, false);
    emit IAgreementEvents.InputAccepted(
      AgreementTypes.ACTIVE, AgreementTypes.ACTIVE, AgreementTypes.ADJUDICATE, payload
    );
    vm.prank(adjudicator);
    claimHarness.submitInput(AgreementTypes.ADJUDICATE, payload);
  }

  function test_InputAccepted_Adjudicate_Close() public {
    AgreementHarness claimHarness = _createClaimedHarnessWithMechanism();
    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](1);
    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0, targetIndex: 0, actionType: AgreementTypes.CLOSE, params: ""
    });
    bytes memory payload = abi.encode(uint256(0), true, actions);

    vm.expectEmit(true, true, true, false);
    emit IAgreementEvents.InputAccepted(
      AgreementTypes.ACTIVE, AgreementTypes.CLOSED, AgreementTypes.ADJUDICATE, payload
    );
    vm.prank(adjudicator);
    claimHarness.submitInput(AgreementTypes.ADJUDICATE, payload);
  }

  // ---- Helpers ----

  function _activateViaSubmitInput() internal {
    bytes memory payload = _defaultProposalPayload();
    vm.prank(partyB);
    harness.submitInput(AgreementTypes.ACCEPT, payload);
    vm.prank(partyA);
    harness.submitInput(AgreementTypes.SET_UP, "");
    vm.prank(partyA);
    harness.submitInput(AgreementTypes.ACTIVATE, "");
  }

  function _createHarnessWithMechanism() internal returns (AgreementHarness) {
    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);

    // Add a dummy Penalty mechanism to zone 0
    zones[0].mechanisms = new TZTypes.TZMechanism[](1);
    zones[0].mechanisms[0] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Penalty,
      moduleKind: TZTypes.TZModuleKind.External,
      module: makeAddr("mockMechanism"),
      data: ""
    });

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (AgreementHarness h,) = _createHarnessCloneWithPayload(payload);
    vm.prank(partyB);
    h.submitInput(AgreementTypes.ACCEPT, payload);
    vm.prank(partyA);
    h.submitInput(AgreementTypes.SET_UP, "");
    vm.prank(partyA);
    h.submitInput(AgreementTypes.ACTIVATE, "");
    return h;
  }

  function _createClaimedHarnessWithMechanism() internal returns (AgreementHarness h) {
    h = _createHarnessWithMechanism();
    vm.prank(partyA);
    h.submitInput(AgreementTypes.CLAIM, abi.encode(uint256(0), bytes("evidence")));
  }
}
