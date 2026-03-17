// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementHarnessBase } from "../../Base.t.sol";
import { AgreementHarness } from "../../harness/AgreementHarness.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { TZTypes } from "../../../src/lib/TZTypes.sol";
import { IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";
import { Constants } from "../../helpers/Constants.sol";
import { Defaults } from "../../helpers/Defaults.sol";
import { ResourceTokenRegistry } from "../../../src/ResourceTokenRegistry.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract Agreement_HarnessActivation is AgreementHarnessBase {
  // ---- test_RevertIf_InvalidZoneCount (1 zone) ----

  function test_RevertIf_InvalidZoneCount_OneZone() public {
    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](1);
    zones[0] = Defaults.tzConfig(partyA, 0);

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (AgreementHarness clone,) = _createHarnessClone(payload);

    // Accept
    vm.prank(partyB);
    clone.submitInput(AgreementTypes.ACCEPT, payload);

    // Activate should revert
    vm.expectRevert(IAgreementErrors.InvalidZoneCount.selector);
    vm.prank(partyA);
    clone.submitInput(AgreementTypes.ACTIVATE, "");
  }

  // ---- test_RevertIf_InvalidZoneCount (3 zones) ----

  function test_RevertIf_InvalidZoneCount_ThreeZones() public {
    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](3);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);
    zones[2] = Defaults.tzConfig(partyA, 0);

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (AgreementHarness clone,) = _createHarnessClone(payload);

    vm.prank(partyB);
    clone.submitInput(AgreementTypes.ACCEPT, payload);

    vm.expectRevert(IAgreementErrors.InvalidZoneCount.selector);
    vm.prank(partyA);
    clone.submitInput(AgreementTypes.ACTIVATE, "");
  }

  // ---- test_RevertIf_AgentIdVerificationFailed ----

  function test_RevertIf_AgentIdVerificationFailed() public {
    uint256 fakeAgentId = 999_999;

    // Mock ownerOf to return some address that is NOT partyA
    vm.mockCall(
      Constants.IDENTITY_REGISTRY,
      abi.encodeWithSelector(IERC721.ownerOf.selector, fakeAgentId),
      abi.encode(makeAddr("notPartyA"))
    );

    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, fakeAgentId);
    zones[1] = Defaults.tzConfig(partyB, 0);

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (AgreementHarness clone,) = _createHarnessClone(payload);

    vm.prank(partyB);
    clone.submitInput(AgreementTypes.ACCEPT, payload);

    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.AgentIdVerificationFailed.selector, fakeAgentId, partyA));
    vm.prank(partyA);
    clone.submitInput(AgreementTypes.ACTIVATE, "");
  }

  // ---- test_AgentIdVerification_Succeeds ----

  function test_AgentIdVerification_Succeeds() public {
    uint256 agentIdA = 42;
    uint256 agentIdB = 43;

    // Mock ownerOf to return the correct parties
    vm.mockCall(
      Constants.IDENTITY_REGISTRY, abi.encodeWithSelector(IERC721.ownerOf.selector, agentIdA), abi.encode(partyA)
    );
    vm.mockCall(
      Constants.IDENTITY_REGISTRY, abi.encodeWithSelector(IERC721.ownerOf.selector, agentIdB), abi.encode(partyB)
    );

    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, agentIdA);
    zones[1] = Defaults.tzConfig(partyB, agentIdB);

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (AgreementHarness clone,) = _createHarnessClone(payload);

    vm.prank(partyB);
    clone.submitInput(AgreementTypes.ACCEPT, payload);

    vm.prank(partyA);
    clone.submitInput(AgreementTypes.ACTIVATE, "");

    assertEq(clone.currentState(), AgreementTypes.ACTIVE);
    assertEq(clone.agentIds(0), agentIdA);
    assertEq(clone.agentIds(1), agentIdB);
  }

  // ---- test_MechanismRegistryContents ----

  function test_MechanismRegistryContents() public {
    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);

    // Zone 0: one Reward + one Penalty mechanism
    TZTypes.TZMechanism[] memory mechs0 = new TZTypes.TZMechanism[](2);
    mechs0[0] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Reward, module: makeAddr("rewardModule"), initData: hex"aa"
    });
    mechs0[1] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Penalty, module: makeAddr("penaltyModule"), initData: hex"bb"
    });
    zones[0].mechanisms = mechs0;

    // Zone 1: one Constraint mechanism
    TZTypes.TZMechanism[] memory mechs1 = new TZTypes.TZMechanism[](1);
    mechs1[0] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Constraint, module: makeAddr("constraintModule"), initData: hex"cc"
    });
    zones[1].mechanisms = mechs1;

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (AgreementHarness clone,) = _createHarnessClone(payload);

    vm.prank(partyB);
    clone.submitInput(AgreementTypes.ACCEPT, payload);

    vm.prank(partyA);
    clone.submitInput(AgreementTypes.ACTIVATE, "");

    // 3 mechanisms total (all types registered, Constraint included)
    assertEq(clone.mechanismCount(), 3);

    // Mechanism 0: Reward from zone 0
    (TZTypes.TZParamType pt0, address mod0, uint256 zi0,) = clone.mechanisms(0);
    assertEq(uint8(pt0), uint8(TZTypes.TZParamType.Reward));
    assertEq(mod0, makeAddr("rewardModule"));
    assertEq(zi0, 0);

    // Mechanism 1: Penalty from zone 0
    (TZTypes.TZParamType pt1, address mod1, uint256 zi1,) = clone.mechanisms(1);
    assertEq(uint8(pt1), uint8(TZTypes.TZParamType.Penalty));
    assertEq(mod1, makeAddr("penaltyModule"));
    assertEq(zi1, 0);

    // Mechanism 2: Constraint from zone 1
    (TZTypes.TZParamType pt2, address mod2, uint256 zi2,) = clone.mechanisms(2);
    assertEq(uint8(pt2), uint8(TZTypes.TZParamType.Constraint));
    assertEq(mod2, makeAddr("constraintModule"));
    assertEq(zi2, 1);
  }

  // ---- test_ResourceTokenAssignment ----

  function test_ResourceTokenAssignment() public {
    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);

    // Zone 0: one permission token + one responsibility token
    TZTypes.TZResourceTokenConfig[] memory res0 = new TZTypes.TZResourceTokenConfig[](2);
    res0[0] = Defaults.resourceTokenConfig(TZTypes.TZParamType.Permission, Defaults.permissionMetadata());
    res0[1] = Defaults.resourceTokenConfig(TZTypes.TZParamType.Responsibility, Defaults.responsibilityMetadata());
    zones[0].resources = res0;

    // Zone 1: one directive token
    TZTypes.TZResourceTokenConfig[] memory res1 = new TZTypes.TZResourceTokenConfig[](1);
    res1[0] = Defaults.resourceTokenConfig(TZTypes.TZParamType.Directive, Defaults.directiveMetadata());
    zones[1].resources = res1;

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (AgreementHarness clone,) = _createHarnessClone(payload);

    vm.prank(partyB);
    clone.submitInput(AgreementTypes.ACCEPT, payload);

    vm.prank(partyA);
    clone.submitInput(AgreementTypes.ACTIVATE, "");

    address tz0 = clone.trustZones(0);
    address tz1 = clone.trustZones(1);

    // Each type has its own counter. First mint per type gets counter=1.
    // Token ID = (counter << 8) | typePrefix
    uint256 permTokenId = (uint256(1) << 8) | uint256(Defaults.PERMISSION_TYPE); // 257
    uint256 respTokenId = (uint256(1) << 8) | uint256(Defaults.RESPONSIBILITY_TYPE); // 258
    uint256 dirTokenId = (uint256(1) << 8) | uint256(Defaults.DIRECTIVE_TYPE); // 259

    assertEq(registry.balanceOf(tz0, permTokenId), 1);
    assertEq(registry.balanceOf(tz0, respTokenId), 1);
    assertEq(registry.balanceOf(tz1, dirTokenId), 1);

    // Verify metadata
    assertEq(registry.tokenMetadata(permTokenId), Defaults.permissionMetadata());
    assertEq(registry.tokenMetadata(respTokenId), Defaults.responsibilityMetadata());
    assertEq(registry.tokenMetadata(dirTokenId), Defaults.directiveMetadata());
  }

  // ---- test_ConstraintHooksCollected ----

  function test_ConstraintHooksCollected() public {
    // Test the pure function directly via harness
    TZTypes.TZMechanism[] memory mechs = new TZTypes.TZMechanism[](3);
    mechs[0] =
      TZTypes.TZMechanism({ paramType: TZTypes.TZParamType.Constraint, module: makeAddr("hook1"), initData: "" });
    mechs[1] = TZTypes.TZMechanism({ paramType: TZTypes.TZParamType.Reward, module: makeAddr("reward"), initData: "" });
    mechs[2] =
      TZTypes.TZMechanism({ paramType: TZTypes.TZParamType.Constraint, module: makeAddr("hook2"), initData: "" });

    address[] memory hooks = harness.exposed_collectConstraintHooks(mechs);
    assertEq(hooks.length, 2);
    assertEq(hooks[0], makeAddr("hook1"));
    assertEq(hooks[1], makeAddr("hook2"));
  }

  // ---- test_ConstraintHooksInstalled ----

  function test_ConstraintHooksInstalled() public {
    // Deploy a mock hook contract (needs to be a contract, not an EOA, for HookMultiPlexer)
    address mockHook = address(new MockHook());

    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);

    TZTypes.TZMechanism[] memory mechs = new TZTypes.TZMechanism[](1);
    mechs[0] = TZTypes.TZMechanism({ paramType: TZTypes.TZParamType.Constraint, module: mockHook, initData: "" });
    zones[0].mechanisms = mechs;

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (AgreementHarness clone,) = _createHarnessClone(payload);

    vm.prank(partyB);
    clone.submitInput(AgreementTypes.ACCEPT, payload);

    vm.prank(partyA);
    clone.submitInput(AgreementTypes.ACTIVATE, "");

    // Activation should succeed — the TrustZone was initialized with constraint hooks
    assertEq(clone.currentState(), AgreementTypes.ACTIVE);
    assertTrue(clone.trustZones(0) != address(0));
  }

  // ---- test_EligibilityModuleWired ----

  function test_EligibilityModuleWired() public {
    // Deploy a mock eligibility module implementation
    MockEligibilityModule mockEligImpl = new MockEligibilityModule("1.0.0");

    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);

    TZTypes.TZMechanism[] memory mechs = new TZTypes.TZMechanism[](1);
    mechs[0] =
      TZTypes.TZMechanism({ paramType: TZTypes.TZParamType.Eligibility, module: address(mockEligImpl), initData: "" });
    zones[0].mechanisms = mechs;

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (AgreementHarness clone,) = _createHarnessClone(payload);

    vm.prank(partyB);
    clone.submitInput(AgreementTypes.ACCEPT, payload);

    vm.prank(partyA);
    clone.submitInput(AgreementTypes.ACTIVATE, "");

    assertEq(clone.currentState(), AgreementTypes.ACTIVE);

    // The hat's eligibility should NOT be the agreement itself (address(clone)),
    // it should be a deployed module instance
    uint256 zoneHat0 = clone.zoneHatIds(0);
    (,,, address eligibility,,,,,) = hats.viewHat(zoneHat0);
    assertTrue(eligibility != address(clone), "eligibility should be a deployed module, not the agreement");
    assertTrue(eligibility != address(0), "eligibility should not be zero");
  }

  // ---- test_EligibilitiesChainWired ----

  function test_EligibilitiesChainWired() public {
    // Deploy two mock eligibility module implementations (need distinct addresses for the chain)
    MockEligibilityModule mockEligImpl1 = new MockEligibilityModule("1.0.0");
    MockEligibilityModule mockEligImpl2 = new MockEligibilityModule("2.0.0");

    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);

    TZTypes.TZMechanism[] memory mechs = new TZTypes.TZMechanism[](2);
    mechs[0] =
      TZTypes.TZMechanism({ paramType: TZTypes.TZParamType.Eligibility, module: address(mockEligImpl1), initData: "" });
    mechs[1] =
      TZTypes.TZMechanism({ paramType: TZTypes.TZParamType.Eligibility, module: address(mockEligImpl2), initData: "" });
    zones[0].mechanisms = mechs;

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (AgreementHarness clone,) = _createHarnessClone(payload);

    vm.prank(partyB);
    clone.submitInput(AgreementTypes.ACCEPT, payload);

    vm.prank(partyA);
    clone.submitInput(AgreementTypes.ACTIVATE, "");

    assertEq(clone.currentState(), AgreementTypes.ACTIVE);

    // With 2 eligibility modules, the hat's eligibility should be an EligibilitiesChain,
    // which is neither the agreement nor the individual modules
    uint256 zoneHat0 = clone.zoneHatIds(0);
    (,,, address eligibility,,,,,) = hats.viewHat(zoneHat0);
    assertTrue(eligibility != address(clone), "eligibility should be chain, not agreement");
    assertTrue(eligibility != address(mockEligImpl1), "eligibility should be chain, not impl1");
    assertTrue(eligibility != address(mockEligImpl2), "eligibility should be chain, not impl2");
    assertTrue(eligibility != address(0), "eligibility should not be zero");
  }

  // ---- test_ConstraintHookOnInstallCalled ----

  function test_ConstraintHookOnInstallCalled() public {
    RecordingMockHook recordingHook = new RecordingMockHook();

    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);

    bytes memory initData = abi.encode(uint256(42), address(0xbeef));
    TZTypes.TZMechanism[] memory mechs = new TZTypes.TZMechanism[](1);
    mechs[0] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Constraint, module: address(recordingHook), initData: initData
    });
    zones[0].mechanisms = mechs;

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (AgreementHarness clone,) = _createHarnessClone(payload);

    vm.prank(partyB);
    clone.submitInput(AgreementTypes.ACCEPT, payload);

    vm.prank(partyA);
    clone.submitInput(AgreementTypes.ACTIVATE, "");

    assertEq(clone.currentState(), AgreementTypes.ACTIVE);
    assertTrue(recordingHook.onInstallCalled(), "onInstall should have been called");
    assertEq(recordingHook.lastInitData(), initData, "onInstall should receive correct initData");
  }

  // ---- test_ConstraintHookOnInstallSkippedWhenNoInitData ----

  function test_ConstraintHookOnInstallSkippedWhenNoInitData() public {
    RecordingMockHook recordingHook = new RecordingMockHook();

    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);

    TZTypes.TZMechanism[] memory mechs = new TZTypes.TZMechanism[](1);
    mechs[0] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Constraint,
      module: address(recordingHook),
      initData: "" // empty initData
    });
    zones[0].mechanisms = mechs;

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (AgreementHarness clone,) = _createHarnessClone(payload);

    vm.prank(partyB);
    clone.submitInput(AgreementTypes.ACCEPT, payload);

    vm.prank(partyA);
    clone.submitInput(AgreementTypes.ACTIVATE, "");

    assertEq(clone.currentState(), AgreementTypes.ACTIVE);
    assertFalse(recordingHook.onInstallCalled(), "onInstall should not have been called for empty initData");
  }

  // ---- test_DuplicateConstraintHooksDoNotRevert ----

  function test_DuplicateConstraintHooksDoNotRevert() public {
    address mockHook = address(new MockHook());

    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);

    // Two CONSTRAINT mechanisms with the same hook address but different initData
    TZTypes.TZMechanism[] memory mechs = new TZTypes.TZMechanism[](2);
    mechs[0] = TZTypes.TZMechanism({ paramType: TZTypes.TZParamType.Constraint, module: mockHook, initData: hex"aa" });
    mechs[1] = TZTypes.TZMechanism({ paramType: TZTypes.TZParamType.Constraint, module: mockHook, initData: hex"bb" });
    zones[0].mechanisms = mechs;

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (AgreementHarness clone,) = _createHarnessClone(payload);

    vm.prank(partyB);
    clone.submitInput(AgreementTypes.ACCEPT, payload);

    vm.prank(partyA);
    clone.submitInput(AgreementTypes.ACTIVATE, "");

    assertEq(clone.currentState(), AgreementTypes.ACTIVE);
  }

  // ---- test_MechanismRegistryIncludesAllTypes ----

  function test_MechanismRegistryIncludesAllTypes() public {
    MockEligibilityModule mockEligImpl = new MockEligibilityModule("1.0.0");
    address mockHook = address(new MockHook());

    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);

    // Zone 0: Constraint + Eligibility + Penalty — all should be registered
    TZTypes.TZMechanism[] memory mechs = new TZTypes.TZMechanism[](3);
    mechs[0] = TZTypes.TZMechanism({ paramType: TZTypes.TZParamType.Constraint, module: mockHook, initData: "" });
    mechs[1] =
      TZTypes.TZMechanism({ paramType: TZTypes.TZParamType.Eligibility, module: address(mockEligImpl), initData: "" });
    mechs[2] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Penalty, module: makeAddr("penaltyModule"), initData: hex"dd"
    });
    zones[0].mechanisms = mechs;

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (AgreementHarness clone,) = _createHarnessClone(payload);

    vm.prank(partyB);
    clone.submitInput(AgreementTypes.ACCEPT, payload);

    vm.prank(partyA);
    clone.submitInput(AgreementTypes.ACTIVATE, "");

    // All 3 mechanisms registered
    assertEq(clone.mechanismCount(), 3);
    (TZTypes.TZParamType pt0,,,) = clone.mechanisms(0);
    (TZTypes.TZParamType pt1,,,) = clone.mechanisms(1);
    (TZTypes.TZParamType pt2, address mod2,,) = clone.mechanisms(2);
    assertEq(uint8(pt0), uint8(TZTypes.TZParamType.Constraint));
    assertEq(uint8(pt1), uint8(TZTypes.TZParamType.Eligibility));
    assertEq(uint8(pt2), uint8(TZTypes.TZParamType.Penalty));
    assertEq(mod2, makeAddr("penaltyModule"));
  }

  // ---- test_ClaimRevertsForConstraintMechanism ----

  function test_ClaimRevertsForConstraintMechanism() public {
    address mockHook = address(new MockHook());

    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);

    // Zone 0: Constraint at index 0, Penalty at index 1
    TZTypes.TZMechanism[] memory mechs = new TZTypes.TZMechanism[](2);
    mechs[0] = TZTypes.TZMechanism({ paramType: TZTypes.TZParamType.Constraint, module: mockHook, initData: "" });
    mechs[1] =
      TZTypes.TZMechanism({ paramType: TZTypes.TZParamType.Penalty, module: makeAddr("penaltyModule"), initData: "" });
    zones[0].mechanisms = mechs;

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (AgreementHarness clone,) = _createHarnessClone(payload);
    vm.prank(partyB);
    clone.submitInput(AgreementTypes.ACCEPT, payload);
    vm.prank(partyA);
    clone.submitInput(AgreementTypes.ACTIVATE, "");

    // CLAIM against Constraint (index 0) should revert
    bytes memory claimPayload = abi.encode(uint256(0), abi.encode("evidence"));
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.InvalidMechanismIndex.selector, uint256(0)));
    clone.exposed_handleClaim(partyA, claimPayload);

    // CLAIM against Penalty (index 1) should succeed
    claimPayload = abi.encode(uint256(1), abi.encode("evidence"));
    clone.exposed_handleClaim(partyA, claimPayload);
    assertEq(clone.claimCount(), 1);
  }
}

// ---- Helper contracts ----

/// @dev Minimal mock hook — just needs to be a contract (not EOA) for HookMultiPlexer.
contract MockHook {
  fallback() external payable { }
}

/// @dev Mock hook that records onInstall calls for testing constraint hook initialization.
contract RecordingMockHook {
  bool public onInstallCalled;
  bytes public lastInitData;

  function onInstall(bytes calldata data) external {
    onInstallCalled = true;
    lastInitData = data;
  }

  fallback() external payable { }
}

/// @dev Minimal mock HatsModule eligibility implementation.
///      Needs setUp(hatId, data) and version() for HatsModuleFactory, plus getWearerStatus.
contract MockEligibilityModule {
  string public version_;

  // HatsModule immutable pattern
  constructor(string memory _version) {
    version_ = _version;
  }

  function version() external view returns (string memory) {
    return version_;
  }

  function hatId() external pure returns (uint256) {
    return 0;
  }

  function setUp(bytes calldata) external { }

  function getWearerStatus(address, uint256) external pure returns (bool eligible, bool standing) {
    return (true, true);
  }
}
