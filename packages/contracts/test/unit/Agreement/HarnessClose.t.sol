// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementHarnessBase } from "../../Base.t.sol";
import { AgreementHarness } from "../../harness/AgreementHarness.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { TZTypes } from "../../../src/lib/TZTypes.sol";
import { IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";
import { IReputationRegistry } from "../../../src/interfaces/IERC8004.sol";
import { TrustZone } from "../../../src/TrustZone.sol";
import { ITrustZoneErrors } from "../../../src/interfaces/ITrustZone.sol";
import { Constants } from "../../helpers/Constants.sol";
import { Defaults } from "../../helpers/Defaults.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

contract CloseTarget {
  uint256 public callCount;

  function ping() external {
    callCount++;
  }
}

contract Agreement_HarnessClose is AgreementHarnessBase {
  /// @dev Create an active agreement clone with nonzero agentIds on both parties.
  function _createActiveWithAgentIds(uint256 agentIdA, uint256 agentIdB) internal returns (AgreementHarness clone) {
    // Mock identity registry for both agent IDs
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

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (clone,) = _createHarnessClone(payload);

    vm.prank(partyB);
    clone.submitInput(AgreementTypes.ACCEPT, payload);
    vm.prank(partyA);
    clone.submitInput(AgreementTypes.ACTIVATE, "");
  }

  /// @dev Create an active agreement clone with nonzero agentIds and a mechanism for claims.
  function _createActiveWithAgentIdsAndMechanism(uint256 agentIdA, uint256 agentIdB)
    internal
    returns (AgreementHarness clone)
  {
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

    (clone,) = _createHarnessClone(payload);

    vm.prank(partyB);
    clone.submitInput(AgreementTypes.ACCEPT, payload);
    vm.prank(partyA);
    clone.submitInput(AgreementTypes.ACTIVATE, "");
  }

  /// @dev Create an active agreement with one party having agentId, other not.
  function _createActiveWithOneAgentId(uint256 agentIdA) internal returns (AgreementHarness clone) {
    vm.mockCall(
      Constants.IDENTITY_REGISTRY,
      abi.encodeWithSelector(bytes4(keccak256("ownerOf(uint256)")), agentIdA),
      abi.encode(partyA)
    );

    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, agentIdA);
    zones[1] = Defaults.tzConfig(partyB, 0); // no agentId

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (clone,) = _createHarnessClone(payload);

    vm.prank(partyB);
    clone.submitInput(AgreementTypes.ACCEPT, payload);
    vm.prank(partyA);
    clone.submitInput(AgreementTypes.ACTIVATE, "");
  }

  function _createActiveWithResources(bool includeMechanism) internal returns (AgreementHarness clone) {
    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);

    zones[0].resources = new TZTypes.TZResourceTokenConfig[](1);
    zones[0].resources[0] = Defaults.resourceTokenConfig(TZTypes.TZParamType.Permission, Defaults.permissionMetadata());
    zones[1].resources = new TZTypes.TZResourceTokenConfig[](1);
    zones[1].resources[0] = Defaults.resourceTokenConfig(TZTypes.TZParamType.Directive, Defaults.directiveMetadata());

    if (includeMechanism) {
      zones[0].mechanisms = new TZTypes.TZMechanism[](1);
      zones[0].mechanisms[0] = TZTypes.TZMechanism({
        paramType: TZTypes.TZParamType.Reward,
        moduleKind: TZTypes.TZModuleKind.External,
        module: address(0xdead),
        data: ""
      });
    }

    bytes memory payload =
      abi.encode(Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE));

    (clone,) = _createHarnessClone(payload);
    vm.prank(partyB);
    clone.submitInput(AgreementTypes.ACCEPT, payload);
    vm.prank(partyA);
    clone.submitInput(AgreementTypes.ACTIVATE, "");
  }

  function _sign(uint256 pk, bytes32 hash) internal pure returns (bytes memory) {
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, hash);
    return abi.encodePacked(r, s, v);
  }

  // ---- test_Close_CompletedWritesPeerFeedback ----

  function test_Close_CompletedWritesPeerFeedback() public {
    uint256 agentIdA = 42;
    uint256 agentIdB = 43;
    AgreementHarness clone = _createActiveWithAgentIds(agentIdA, agentIdB);

    string memory feedbackURIA = "ipfs://feedbackA";
    bytes32 feedbackHashA = keccak256(bytes(feedbackURIA));
    string memory feedbackURIB = "ipfs://feedbackB";
    bytes32 feedbackHashB = keccak256(bytes(feedbackURIB));

    // partyA signals complete
    vm.prank(partyA);
    clone.submitInput(AgreementTypes.COMPLETE, abi.encode(feedbackURIA, feedbackHashA));

    string memory endpoint = Strings.toHexString(uint160(address(clone)), 20);

    // Mock reputation registry
    vm.mockCall(
      Constants.REPUTATION_REGISTRY, abi.encodeWithSelector(IReputationRegistry.giveFeedback.selector), abi.encode()
    );

    // Expect: for agentIdA (index 0), feedback comes from counterparty B's submission
    vm.expectCall(
      Constants.REPUTATION_REGISTRY,
      abi.encodeCall(
        IReputationRegistry.giveFeedback,
        (agentIdA, 0, 0, "trust-zone-agreement", "COMPLETED", endpoint, feedbackURIB, feedbackHashB)
      )
    );
    // Expect: for agentIdB (index 1), feedback comes from counterparty A's submission
    vm.expectCall(
      Constants.REPUTATION_REGISTRY,
      abi.encodeCall(
        IReputationRegistry.giveFeedback,
        (agentIdB, 0, 0, "trust-zone-agreement", "COMPLETED", endpoint, feedbackURIA, feedbackHashA)
      )
    );

    // partyB signals complete — triggers close
    vm.prank(partyB);
    clone.submitInput(AgreementTypes.COMPLETE, abi.encode(feedbackURIB, feedbackHashB));

    assertEq(clone.currentState(), AgreementTypes.CLOSED);
    assertEq(clone.outcome(), keccak256("COMPLETED"));
  }

  // ---- test_Close_ExitedWritesPeerFeedback ----

  function test_Close_ExitedWritesPeerFeedback() public {
    uint256 agentIdA = 42;
    uint256 agentIdB = 43;
    AgreementHarness clone = _createActiveWithAgentIds(agentIdA, agentIdB);

    string memory feedbackURIA = "ipfs://exitA";
    bytes32 feedbackHashA = keccak256(bytes(feedbackURIA));
    string memory feedbackURIB = "ipfs://exitB";
    bytes32 feedbackHashB = keccak256(bytes(feedbackURIB));

    vm.prank(partyA);
    clone.submitInput(AgreementTypes.EXIT, abi.encode(feedbackURIA, feedbackHashA));

    string memory endpoint = Strings.toHexString(uint160(address(clone)), 20);

    vm.mockCall(
      Constants.REPUTATION_REGISTRY, abi.encodeWithSelector(IReputationRegistry.giveFeedback.selector), abi.encode()
    );

    // For EXITED: peer feedback from counterparty exit submissions
    vm.expectCall(
      Constants.REPUTATION_REGISTRY,
      abi.encodeCall(
        IReputationRegistry.giveFeedback,
        (agentIdA, 0, 0, "trust-zone-agreement", "EXITED", endpoint, feedbackURIB, feedbackHashB)
      )
    );
    vm.expectCall(
      Constants.REPUTATION_REGISTRY,
      abi.encodeCall(
        IReputationRegistry.giveFeedback,
        (agentIdB, 0, 0, "trust-zone-agreement", "EXITED", endpoint, feedbackURIA, feedbackHashA)
      )
    );

    vm.prank(partyB);
    clone.submitInput(AgreementTypes.EXIT, abi.encode(feedbackURIB, feedbackHashB));

    assertEq(clone.currentState(), AgreementTypes.CLOSED);
    assertEq(clone.outcome(), keccak256("EXITED"));
  }

  // ---- test_Close_ExpiredUsesAgreementReference ----

  function test_Close_ExpiredUsesAgreementReference() public {
    uint256 agentIdA = 42;
    uint256 agentIdB = 43;
    AgreementHarness clone = _createActiveWithAgentIds(agentIdA, agentIdB);

    string memory endpoint = Strings.toHexString(uint160(address(clone)), 20);
    bytes32 expectedHash = keccak256(abi.encodePacked(endpoint));

    vm.mockCall(
      Constants.REPUTATION_REGISTRY, abi.encodeWithSelector(IReputationRegistry.giveFeedback.selector), abi.encode()
    );

    // For EXPIRED: feedbackURI = endpoint, feedbackHash = keccak256(endpoint)
    vm.expectCall(
      Constants.REPUTATION_REGISTRY,
      abi.encodeCall(
        IReputationRegistry.giveFeedback,
        (agentIdA, 0, 0, "trust-zone-agreement", "EXPIRED", endpoint, endpoint, expectedHash)
      )
    );
    vm.expectCall(
      Constants.REPUTATION_REGISTRY,
      abi.encodeCall(
        IReputationRegistry.giveFeedback,
        (agentIdB, 0, 0, "trust-zone-agreement", "EXPIRED", endpoint, endpoint, expectedHash)
      )
    );

    vm.warp(clone.deadline() + 1);
    clone.submitInput(AgreementTypes.FINALIZE, "");

    assertEq(clone.outcome(), keccak256("EXPIRED"));
  }

  // ---- test_Close_AdjudicatedUsesAgreementReference ----

  function test_Close_AdjudicatedUsesAgreementReference() public {
    uint256 agentIdA = 42;
    uint256 agentIdB = 43;

    // Need a mechanism so CLAIM works — create with mechanism
    AgreementHarness clone = _createActiveWithAgentIdsAndMechanism(agentIdA, agentIdB);

    // File a claim
    vm.prank(partyA);
    clone.submitInput(AgreementTypes.CLAIM, abi.encode(uint256(0), bytes("evidence")));

    string memory endpoint = Strings.toHexString(uint160(address(clone)), 20);
    bytes32 expectedHash = keccak256(abi.encodePacked(endpoint));

    vm.mockCall(
      Constants.REPUTATION_REGISTRY, abi.encodeWithSelector(IReputationRegistry.giveFeedback.selector), abi.encode()
    );

    // ADJUDICATED uses agreement reference (same as EXPIRED)
    vm.expectCall(
      Constants.REPUTATION_REGISTRY,
      abi.encodeCall(
        IReputationRegistry.giveFeedback,
        (agentIdA, 0, 0, "trust-zone-agreement", "ADJUDICATED", endpoint, endpoint, expectedHash)
      )
    );
    vm.expectCall(
      Constants.REPUTATION_REGISTRY,
      abi.encodeCall(
        IReputationRegistry.giveFeedback,
        (agentIdB, 0, 0, "trust-zone-agreement", "ADJUDICATED", endpoint, endpoint, expectedHash)
      )
    );

    // Close via adjudication
    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](1);
    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0, targetIndex: 0, actionType: AgreementTypes.CLOSE, params: ""
    });

    vm.prank(adjudicator);
    clone.submitInput(AgreementTypes.ADJUDICATE, abi.encode(uint256(0), true, actions));

    assertEq(clone.outcome(), keccak256("ADJUDICATED"));
  }

  // ---- test_Close_OnlyWritesForNonzeroAgentId ----

  function test_Close_OnlyWritesForNonzeroAgentId() public {
    uint256 agentIdA = 42;
    AgreementHarness clone = _createActiveWithOneAgentId(agentIdA);

    string memory endpoint = Strings.toHexString(uint160(address(clone)), 20);
    bytes32 expectedHash = keccak256(abi.encodePacked(endpoint));

    vm.mockCall(
      Constants.REPUTATION_REGISTRY, abi.encodeWithSelector(IReputationRegistry.giveFeedback.selector), abi.encode()
    );

    // Only one call should happen — for agentIdA. PartyB has agentId == 0, so no call.
    vm.expectCall(
      Constants.REPUTATION_REGISTRY,
      abi.encodeCall(
        IReputationRegistry.giveFeedback,
        (agentIdA, 0, 0, "trust-zone-agreement", "EXPIRED", endpoint, endpoint, expectedHash)
      ),
      1 // exactly 1 call
    );

    vm.warp(clone.deadline() + 1);
    clone.submitInput(AgreementTypes.FINALIZE, "");
  }

  // ---- test_Close_EmitsReputationFeedbackWritten ----

  function test_Close_EmitsReputationFeedbackWritten() public {
    uint256 agentIdA = 42;
    uint256 agentIdB = 43;
    AgreementHarness clone = _createActiveWithAgentIds(agentIdA, agentIdB);

    string memory endpoint = Strings.toHexString(uint160(address(clone)), 20);
    bytes32 expectedHash = keccak256(abi.encodePacked(endpoint));

    vm.mockCall(
      Constants.REPUTATION_REGISTRY, abi.encodeWithSelector(IReputationRegistry.giveFeedback.selector), abi.encode()
    );

    // Expect events for both parties
    vm.expectEmit(true, false, false, true);
    emit IAgreementEvents.ReputationFeedbackWritten(agentIdA, "EXPIRED", endpoint, expectedHash);
    vm.expectEmit(true, false, false, true);
    emit IAgreementEvents.ReputationFeedbackWritten(agentIdB, "EXPIRED", endpoint, expectedHash);

    vm.warp(clone.deadline() + 1);
    clone.submitInput(AgreementTypes.FINALIZE, "");
  }

  // ---- test_Close_DeactivatesZoneHats ----

  function test_Close_DeactivatesZoneHats() public {
    uint256 agentIdA = 42;
    uint256 agentIdB = 43;
    AgreementHarness clone = _createActiveWithAgentIds(agentIdA, agentIdB);

    uint256 hatId0 = clone.zoneHatIds(0);
    uint256 hatId1 = clone.zoneHatIds(1);

    // Hats should be active before close
    assertTrue(clone.getHatStatus(hatId0), "hat0 should be active before close");
    assertTrue(clone.getHatStatus(hatId1), "hat1 should be active before close");

    vm.mockCall(
      Constants.REPUTATION_REGISTRY, abi.encodeWithSelector(IReputationRegistry.giveFeedback.selector), abi.encode()
    );

    vm.warp(clone.deadline() + 1);
    clone.submitInput(AgreementTypes.FINALIZE, "");

    // After close, getHatStatus should return false
    assertFalse(clone.getHatStatus(hatId0), "hat0 should be inactive after close");
    assertFalse(clone.getHatStatus(hatId1), "hat1 should be inactive after close");
  }

  function test_Close_ResourceTokensRemainHeld_AfterExpired() public {
    AgreementHarness clone = _createActiveWithResources(false);
    address tz0 = clone.trustZones(0);
    uint256 permissionTokenId = (uint256(1) << 8) | uint256(Defaults.PERMISSION_TYPE);

    assertEq(registry.balanceOf(tz0, permissionTokenId), 1, "resource token should be minted before close");

    vm.warp(clone.deadline() + 1);
    clone.submitInput(AgreementTypes.FINALIZE, "");

    assertEq(clone.outcome(), keccak256("EXPIRED"));
    assertEq(registry.balanceOf(tz0, permissionTokenId), 1, "resource token should remain held after EXPIRED close");
  }

  function test_Close_ResourceTokensRemainHeld_AfterAdjudicated() public {
    AgreementHarness clone = _createActiveWithResources(true);
    address tz0 = clone.trustZones(0);
    uint256 permissionTokenId = (uint256(1) << 8) | uint256(Defaults.PERMISSION_TYPE);

    vm.prank(partyA);
    clone.submitInput(AgreementTypes.CLAIM, abi.encode(uint256(0), bytes("evidence")));

    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](1);
    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0, targetIndex: 0, actionType: AgreementTypes.CLOSE, params: ""
    });

    vm.prank(adjudicator);
    clone.submitInput(AgreementTypes.ADJUDICATE, abi.encode(uint256(0), true, actions));

    assertEq(clone.outcome(), keccak256("ADJUDICATED"));
    assertEq(registry.balanceOf(tz0, permissionTokenId), 1, "resource token should remain held after ADJUDICATED close");
  }

  function test_Close_ZoneCannotExecute_EvenThoughResourceTokensRemain() public {
    AgreementHarness clone = _createActiveWithResources(false);
    address tz0 = clone.trustZones(0);
    uint256 permissionTokenId = (uint256(1) << 8) | uint256(Defaults.PERMISSION_TYPE);
    CloseTarget target = new CloseTarget();
    TrustZone zone = TrustZone(payable(tz0));

    vm.warp(clone.deadline() + 1);
    clone.submitInput(AgreementTypes.FINALIZE, "");

    assertEq(registry.balanceOf(tz0, permissionTokenId), 1, "resource token should remain held after close");

    vm.prank(partyA);
    vm.expectRevert(ITrustZoneErrors.Unauthorized.selector);
    zone.execute(address(target), 0, abi.encodeCall(CloseTarget.ping, ()));
  }

  function test_Close_ZoneCannotValidateSignature_EvenThoughResourceTokensRemain() public {
    (address signerA, uint256 signerPkA) = makeAddrAndKey("close-signer-a");
    (address signerB,) = makeAddrAndKey("close-signer-b");
    partyA = signerA;
    partyB = signerB;

    AgreementHarness clone = _createActiveWithResources(false);
    address tz0 = clone.trustZones(0);
    uint256 permissionTokenId = (uint256(1) << 8) | uint256(Defaults.PERMISSION_TYPE);
    TrustZone zone = TrustZone(payable(tz0));
    bytes32 hash = keccak256("closed-zone-signature");
    bytes memory signature = abi.encodePacked(address(hatValidator), _sign(signerPkA, hash));

    vm.warp(clone.deadline() + 1);
    clone.submitInput(AgreementTypes.FINALIZE, "");

    assertEq(registry.balanceOf(tz0, permissionTokenId), 1, "resource token should remain held after close");
    assertEq(zone.isValidSignature(hash, signature), bytes4(0xffffffff));
  }
}
