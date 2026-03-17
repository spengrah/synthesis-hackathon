// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { ForkTestBase } from "../Base.t.sol";
import { Agreement } from "../../src/Agreement.sol";
import { TrustZone } from "../../src/TrustZone.sol";
import { ITrustZoneErrors } from "../../src/interfaces/ITrustZone.sol";
import { AgreementTypes } from "../../src/lib/AgreementTypes.sol";
import { TZTypes } from "../../src/lib/TZTypes.sol";
import { Defaults } from "../helpers/Defaults.sol";
import { Constants } from "../helpers/Constants.sol";
import { ERC7579HookBase } from "modulekit/Modules.sol";

contract ZoneBehaviorTarget {
  uint256 public callCount;
  address public lastCaller;
  uint256 public lastValue;
  bytes public lastData;

  function ping(uint256) external payable {
    callCount++;
    lastCaller = msg.sender;
    lastValue = msg.value;
    lastData = msg.data;
  }
}

contract SelectiveConstraintHook is ERC7579HookBase {
  error BlockedTarget(address target);

  mapping(address account => address) public blockedTarget;

  bytes4 internal constant EXECUTE_SELECTOR = bytes4(keccak256("execute(bytes32,bytes)"));

  function onInstall(bytes calldata data) external override {
    (address forwarder, address blocked) = abi.decode(data, (address, address));
    trustedForwarder[msg.sender] = forwarder;
    blockedTarget[msg.sender] = blocked;
  }

  function onUninstall(bytes calldata) external override {
    clearTrustedForwarder();
    delete blockedTarget[msg.sender];
  }

  function isModuleType(uint256 typeId) external pure override returns (bool) {
    return typeId == TYPE_HOOK;
  }

  function isInitialized(address smartAccount) external view returns (bool) {
    return blockedTarget[smartAccount] != address(0);
  }

  function _preCheck(address account, address, uint256, bytes calldata msgData)
    internal
    override
    returns (bytes memory hookData)
  {
    if (msgData.length >= 120 && bytes4(msgData[:4]) == EXECUTE_SELECTOR) {
      address target;
      assembly {
        target := shr(96, calldataload(add(msgData.offset, 100)))
      }
      if (target == blockedTarget[account]) revert BlockedTarget(target);
    }
    return "";
  }

  function _postCheck(address, bytes calldata) internal override { }
}

contract Agreement_ZoneBehavior is ForkTestBase {
  bytes4 internal constant ERC1271_MAGIC = 0x1626ba7e;
  bytes4 internal constant ERC1271_FAILURE = 0xffffffff;

  function setUp() public override {
    super.setUp();
    _deployAll();
  }

  function _sign(uint256 pk, bytes32 hash) internal pure returns (bytes memory) {
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, hash);
    return abi.encodePacked(r, s, v);
  }

  function _baseZones() internal view returns (TZTypes.TZConfig[] memory zones) {
    zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);
  }

  function _createActiveAgreement(TZTypes.TZConfig[] memory zones) internal returns (Agreement agr) {
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

  function _createActiveAgreementWithClaimableMechanism() internal returns (Agreement agr) {
    TZTypes.TZConfig[] memory zones = _baseZones();
    zones[0].mechanisms = new TZTypes.TZMechanism[](1);
    zones[0].mechanisms[0] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Reward,
      moduleKind: TZTypes.TZModuleKind.External,
      module: address(0xBEEF),
      data: ""
    });
    return _createActiveAgreement(zones);
  }

  function _createActiveAgreementWithConstraint(address hook, bytes memory initData) internal returns (Agreement agr) {
    TZTypes.TZConfig[] memory zones = _baseZones();
    zones[0].mechanisms = new TZTypes.TZMechanism[](1);
    zones[0].mechanisms[0] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Constraint,
      moduleKind: TZTypes.TZModuleKind.ERC7579Hook,
      module: hook,
      data: initData
    });
    return _createActiveAgreement(zones);
  }

  function _deactivateZoneZero(Agreement agr) internal {
    vm.prank(partyA);
    agr.submitInput(AgreementTypes.CLAIM, abi.encode(uint256(0), bytes("claim")));

    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](1);
    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0, targetIndex: 0, actionType: AgreementTypes.DEACTIVATE, params: ""
    });

    vm.prank(adjudicator);
    agr.submitInput(AgreementTypes.ADJUDICATE, abi.encode(uint256(0), true, actions));
  }

  function _closeExpired(Agreement agr) internal {
    vm.warp(block.timestamp + Constants.DEFAULT_DEADLINE + 1);
    vm.prank(observer);
    agr.submitInput(AgreementTypes.FINALIZE, "");
  }

  function test_ZoneExecute_Succeeds_GivenActiveZoneHatWearer() public {
    Agreement agr = _createActiveAgreement(_baseZones());
    TrustZone zone = TrustZone(payable(agr.trustZones(0)));
    ZoneBehaviorTarget target = new ZoneBehaviorTarget();

    vm.prank(partyA);
    zone.execute(address(target), 0, abi.encodeCall(ZoneBehaviorTarget.ping, (42)));

    assertEq(target.callCount(), 1);
    assertEq(target.lastCaller(), address(zone));
  }

  function test_ZoneExecute_Reverts_GivenZoneHatDeactivated() public {
    Agreement agr = _createActiveAgreementWithClaimableMechanism();
    TrustZone zone = TrustZone(payable(agr.trustZones(0)));
    ZoneBehaviorTarget target = new ZoneBehaviorTarget();

    _deactivateZoneZero(agr);

    vm.prank(partyA);
    vm.expectRevert(ITrustZoneErrors.Unauthorized.selector);
    zone.execute(address(target), 0, abi.encodeCall(ZoneBehaviorTarget.ping, (7)));
  }

  function test_ZoneExecute_Reverts_GivenAgreementClosed() public {
    Agreement agr = _createActiveAgreement(_baseZones());
    TrustZone zone = TrustZone(payable(agr.trustZones(0)));
    ZoneBehaviorTarget target = new ZoneBehaviorTarget();

    _closeExpired(agr);

    vm.prank(partyA);
    vm.expectRevert(ITrustZoneErrors.Unauthorized.selector);
    zone.execute(address(target), 0, abi.encodeCall(ZoneBehaviorTarget.ping, (11)));
  }

  function test_ZoneIsValidSignature_ReturnsMagicValue_GivenActiveZoneHatWearer() public {
    (address signerA, uint256 signerPkA) = makeAddrAndKey("zone-signer-a");
    (address signerB,) = makeAddrAndKey("zone-signer-b");
    partyA = signerA;
    partyB = signerB;

    Agreement agr = _createActiveAgreement(_baseZones());
    TrustZone zone = TrustZone(payable(agr.trustZones(0)));
    bytes32 hash = keccak256("active-zone-signature");
    bytes memory signature = abi.encodePacked(address(hatValidator), _sign(signerPkA, hash));

    assertEq(zone.isValidSignature(hash, signature), ERC1271_MAGIC);
  }

  function test_ZoneIsValidSignature_Fails_GivenZoneHatDeactivated() public {
    (address signerA, uint256 signerPkA) = makeAddrAndKey("deactivated-zone-signer-a");
    (address signerB,) = makeAddrAndKey("deactivated-zone-signer-b");
    partyA = signerA;
    partyB = signerB;

    Agreement agr = _createActiveAgreementWithClaimableMechanism();
    TrustZone zone = TrustZone(payable(agr.trustZones(0)));
    bytes32 hash = keccak256("deactivated-zone-signature");
    bytes memory signature = abi.encodePacked(address(hatValidator), _sign(signerPkA, hash));

    _deactivateZoneZero(agr);

    assertEq(zone.isValidSignature(hash, signature), ERC1271_FAILURE);
  }

  function test_ZoneIsValidSignature_Fails_GivenAgreementClosed() public {
    (address signerA, uint256 signerPkA) = makeAddrAndKey("closed-zone-signer-a");
    (address signerB,) = makeAddrAndKey("closed-zone-signer-b");
    partyA = signerA;
    partyB = signerB;

    Agreement agr = _createActiveAgreement(_baseZones());
    TrustZone zone = TrustZone(payable(agr.trustZones(0)));
    bytes32 hash = keccak256("closed-zone-signature");
    bytes memory signature = abi.encodePacked(address(hatValidator), _sign(signerPkA, hash));

    _closeExpired(agr);

    assertEq(zone.isValidSignature(hash, signature), ERC1271_FAILURE);
  }

  function test_ConstraintHook_BlocksForbiddenExecution_GivenActivatedZone() public {
    SelectiveConstraintHook hook = new SelectiveConstraintHook();
    ZoneBehaviorTarget blockedTarget = new ZoneBehaviorTarget();
    Agreement agr =
      _createActiveAgreementWithConstraint(address(hook), abi.encode(address(hookMultiplexer), address(blockedTarget)));
    TrustZone zone = TrustZone(payable(agr.trustZones(0)));

    vm.prank(partyA);
    vm.expectRevert();
    zone.execute(address(blockedTarget), 0, abi.encodeCall(ZoneBehaviorTarget.ping, (99)));
  }

  function test_ConstraintHook_AllowsPermittedExecution_GivenActivatedZone() public {
    SelectiveConstraintHook hook = new SelectiveConstraintHook();
    ZoneBehaviorTarget blockedTarget = new ZoneBehaviorTarget();
    ZoneBehaviorTarget allowedTarget = new ZoneBehaviorTarget();
    Agreement agr =
      _createActiveAgreementWithConstraint(address(hook), abi.encode(address(hookMultiplexer), address(blockedTarget)));
    TrustZone zone = TrustZone(payable(agr.trustZones(0)));

    vm.prank(partyA);
    zone.execute(address(allowedTarget), 0, abi.encodeCall(ZoneBehaviorTarget.ping, (5)));

    assertEq(allowedTarget.callCount(), 1);
    assertEq(allowedTarget.lastCaller(), address(zone));
    assertEq(blockedTarget.callCount(), 0);
  }
}
