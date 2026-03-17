// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { IntegrationBase } from "../Base.t.sol";
import { Agreement } from "../../src/Agreement.sol";
import { IAgreementErrors } from "../../src/interfaces/IAgreement.sol";
import { AgreementTypes } from "../../src/lib/AgreementTypes.sol";
import { TZTypes } from "../../src/lib/TZTypes.sol";
import { Defaults } from "../helpers/Defaults.sol";
import { Constants } from "../helpers/Constants.sol";
import { HatsModule } from "hats-module/HatsModule.sol";

contract RecordingExternalModule {
  uint256 public initCount;
  bytes32 public initKey;
  uint256 public initValue;
  uint256 public rewardCount;
  address public lastRewardRecipient;
  uint256 public lastRewardAmount;

  function initialize(bytes32 key, uint256 value) external {
    initCount++;
    initKey = key;
    initValue = value;
  }

  function reward(address recipient, uint256 amount) external {
    rewardCount++;
    lastRewardRecipient = recipient;
    lastRewardAmount = amount;
  }
}

contract RevertingExternalModule {
  function initialize() external pure {
    revert("bad-init");
  }
}

contract StandaloneRecorderHatsModule is HatsModule {
  bytes32 public initKey;
  uint256 public actionCount;
  bytes32 public lastActionKey;

  constructor(string memory version) HatsModule(version) { }

  function _setUp(bytes calldata initData) internal override {
    initKey = abi.decode(initData, (bytes32));
  }

  function record(bytes32 actionKey) external {
    actionCount++;
    lastActionKey = actionKey;
  }
}

contract RevertingStandaloneHatsModule is HatsModule {
  constructor(string memory version) HatsModule(version) { }

  function _setUp(bytes calldata) internal pure override {
    revert("bad-standalone-init");
  }
}

contract Agreement_ExternalModulesIntegration is IntegrationBase {
  function _proposalPayload(TZTypes.TZConfig[] memory zones) internal view returns (bytes memory) {
    return abi.encode(Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE));
  }

  function _baseZones() internal view returns (TZTypes.TZConfig[] memory zones) {
    zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);
  }

  function _createActiveAgreement(TZTypes.TZConfig[] memory zones) internal returns (Agreement agr) {
    bytes memory payload = _proposalPayload(zones);
    (agr,) = _createAgreementClone(payload);

    vm.prank(partyB);
    agr.submitInput(AgreementTypes.ACCEPT, payload);

    vm.prank(partyA);
    agr.submitInput(AgreementTypes.SET_UP, "");

    vm.prank(partyA);
    agr.submitInput(AgreementTypes.ACTIVATE, "");
  }

  function test_ExternalModule_ReceivesActivationInit_AndAdjudicationCall() public {
    RecordingExternalModule module = new RecordingExternalModule();
    TZTypes.TZConfig[] memory zones = _baseZones();

    zones[0].mechanisms = new TZTypes.TZMechanism[](1);
    zones[0].mechanisms[0] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Reward,
      moduleKind: TZTypes.TZModuleKind.External,
      module: address(module),
      data: abi.encodeCall(RecordingExternalModule.initialize, (bytes32("external-init"), 123))
    });

    Agreement agr = _createActiveAgreement(zones);

    assertEq(module.initCount(), 1);
    assertEq(module.initKey(), bytes32("external-init"));
    assertEq(module.initValue(), 123);

    (
      TZTypes.TZParamType paramType,
      TZTypes.TZModuleKind moduleKind,
      address registeredModule,
      uint256 zoneIndex,
      bytes memory context
    ) = agr.mechanisms(0);

    assertEq(uint256(paramType), uint256(TZTypes.TZParamType.Reward));
    assertEq(uint256(moduleKind), uint256(TZTypes.TZModuleKind.External));
    assertEq(registeredModule, address(module));
    assertEq(zoneIndex, 0);
    assertEq(context, abi.encodeCall(RecordingExternalModule.initialize, (bytes32("external-init"), 123)));

    vm.prank(partyA);
    agr.submitInput(AgreementTypes.CLAIM, abi.encode(uint256(0), bytes("reward evidence")));

    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](1);
    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0,
      targetIndex: 0,
      actionType: AgreementTypes.REWARD,
      params: abi.encodeCall(RecordingExternalModule.reward, (partyA, 7))
    });

    vm.prank(adjudicator);
    agr.submitInput(AgreementTypes.ADJUDICATE, abi.encode(uint256(0), true, actions));

    assertEq(module.rewardCount(), 1);
    assertEq(module.lastRewardRecipient(), partyA);
    assertEq(module.lastRewardAmount(), 7);
  }

  function test_RevertIf_ExternalModuleInitFails_OnActivation() public {
    RevertingExternalModule module = new RevertingExternalModule();
    TZTypes.TZConfig[] memory zones = _baseZones();

    zones[0].mechanisms = new TZTypes.TZMechanism[](1);
    zones[0].mechanisms[0] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Reward,
      moduleKind: TZTypes.TZModuleKind.External,
      module: address(module),
      data: abi.encodeCall(RevertingExternalModule.initialize, ())
    });

    bytes memory payload = _proposalPayload(zones);
    (Agreement agr,) = _createAgreementClone(payload);

    vm.prank(partyB);
    agr.submitInput(AgreementTypes.ACCEPT, payload);

    vm.prank(partyA);
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.InvalidInput.selector, bytes32("EXTERNAL_INIT")));
    agr.submitInput(AgreementTypes.SET_UP, "");

    assertEq(agr.currentState(), AgreementTypes.ACCEPTED);
    assertEq(agr.mechanismCount(), 0);
    assertEq(agr.trustZones(0), address(0));
    assertEq(agr.trustZones(1), address(0));
  }

  function test_StandaloneHatsModule_DeploysClone_ButDoesNotWireHatEligibility() public {
    StandaloneRecorderHatsModule module = new StandaloneRecorderHatsModule("1.0.0");
    TZTypes.TZConfig[] memory zones = _baseZones();

    zones[0].mechanisms = new TZTypes.TZMechanism[](1);
    zones[0].mechanisms[0] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Reward,
      moduleKind: TZTypes.TZModuleKind.HatsModule,
      module: address(module),
      data: abi.encode(bytes(""), abi.encode(bytes32("standalone-init")))
    });

    bytes memory packedData = abi.encode(bytes(""), abi.encode(bytes32("standalone-init")));
    Agreement agr = _createActiveAgreement(zones);
    uint256 zoneHatId = agr.zoneHatIds(0);

    (
      TZTypes.TZParamType paramType,
      TZTypes.TZModuleKind moduleKind,
      address registeredModule,
      uint256 zoneIndex,
      bytes memory context
    ) = agr.mechanisms(0);

    assertEq(uint256(paramType), uint256(TZTypes.TZParamType.Reward));
    assertEq(uint256(moduleKind), uint256(TZTypes.TZModuleKind.HatsModule));
    assertEq(zoneIndex, 0);
    assertEq(context, packedData);
    assertTrue(registeredModule != address(0));
    assertTrue(registeredModule != address(module));
    assertEq(hats.getHatEligibilityModule(zoneHatId), address(agr));

    StandaloneRecorderHatsModule deployed = StandaloneRecorderHatsModule(registeredModule);
    assertEq(deployed.hatId(), zoneHatId);
    assertEq(deployed.initKey(), bytes32("standalone-init"));

    vm.prank(partyA);
    agr.submitInput(AgreementTypes.CLAIM, abi.encode(uint256(0), bytes("standalone evidence")));

    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](1);
    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0,
      targetIndex: 0,
      actionType: AgreementTypes.REWARD,
      params: abi.encodeCall(StandaloneRecorderHatsModule.record, (bytes32("reward-action")))
    });

    vm.prank(adjudicator);
    agr.submitInput(AgreementTypes.ADJUDICATE, abi.encode(uint256(0), true, actions));

    assertEq(deployed.actionCount(), 1);
    assertEq(deployed.lastActionKey(), bytes32("reward-action"));
  }

  function test_RevertIf_StandaloneHatsModuleInitFails_OnActivation() public {
    RevertingStandaloneHatsModule module = new RevertingStandaloneHatsModule("1.0.0");
    TZTypes.TZConfig[] memory zones = _baseZones();

    zones[0].mechanisms = new TZTypes.TZMechanism[](1);
    zones[0].mechanisms[0] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Reward,
      moduleKind: TZTypes.TZModuleKind.HatsModule,
      module: address(module),
      data: abi.encode(bytes32("bad-init"))
    });

    bytes memory payload = _proposalPayload(zones);
    (Agreement agr,) = _createAgreementClone(payload);

    vm.prank(partyB);
    agr.submitInput(AgreementTypes.ACCEPT, payload);

    vm.prank(partyA);
    vm.expectRevert();
    agr.submitInput(AgreementTypes.SET_UP, "");

    assertEq(agr.currentState(), AgreementTypes.ACCEPTED);
    assertEq(agr.mechanismCount(), 0);
    assertEq(agr.trustZones(0), address(0));
    assertEq(agr.zoneHatIds(0), 0);
  }
}
