// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "forge-std/interfaces/IERC20.sol";

import { ForkTestBase } from "../Base.t.sol";
import { Agreement } from "../../src/Agreement.sol";
import { TrustZone } from "../../src/TrustZone.sol";
import { ITrustZoneErrors } from "../../src/interfaces/ITrustZone.sol";
import { AgreementTypes } from "../../src/lib/AgreementTypes.sol";
import { TZTypes } from "../../src/lib/TZTypes.sol";
import { Defaults } from "../helpers/Defaults.sol";
import { Constants } from "../helpers/Constants.sol";
import { SpendingLimitHook } from "../../lib/experimental-modules/src/SpendingLimitHook/SpendingLimitHook.sol";
import { HookMultiPlexerLib } from "core-modules/HookMultiPlexer/HookMultiPlexerLib.sol";

contract HookMintableERC20 is ERC20 {
  constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) { }

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }
}

contract Agreement_HookModulesIntegration is ForkTestBase {
  HookMintableERC20 internal token;
  SpendingLimitHook internal spendingLimitHook;

  function setUp() public override {
    super.setUp();
    _deployAll();

    token = new HookMintableERC20("Mock Token", "MOCK");
    spendingLimitHook = new SpendingLimitHook();
  }

  function _proposalWithZones(TZTypes.TZConfig[] memory zones) internal view returns (bytes memory) {
    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    return abi.encode(data);
  }

  function _createActiveAgreement(TZTypes.TZConfig[] memory zones) internal returns (Agreement agr) {
    bytes memory payload = _proposalWithZones(zones);
    (agr,) = _createAgreementClone(payload);

    vm.prank(partyB);
    agr.submitInput(AgreementTypes.ACCEPT, payload);

    vm.prank(partyA);
    agr.submitInput(AgreementTypes.SET_UP, "");

    vm.prank(partyA);
    agr.submitInput(AgreementTypes.ACTIVATE, "");
  }

  function _spendingLimitData(uint256 limit) internal view returns (bytes memory) {
    SpendingLimitHook.TokenConfig[] memory configs = new SpendingLimitHook.TokenConfig[](1);
    configs[0] = SpendingLimitHook.TokenConfig({ token: address(token), limit: limit });
    return abi.encode(configs);
  }

  function _syncMultiplexerScopedLimit(uint256 limit) internal {
    SpendingLimitHook.TokenConfig[] memory configs = new SpendingLimitHook.TokenConfig[](1);
    configs[0] = SpendingLimitHook.TokenConfig({ token: address(token), limit: limit });

    vm.prank(address(hookMultiplexer));
    spendingLimitHook.setSpendingLimits(configs);
  }

  function _baseZones() internal view returns (TZTypes.TZConfig[] memory zones) {
    zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);
  }

  function test_ActivateWithSpendingLimitHook_AllowsInLimitTransferAndBlocksOverflow() public {
    TZTypes.TZConfig[] memory zones = _baseZones();
    zones[0].mechanisms = new TZTypes.TZMechanism[](1);
    zones[0].mechanisms[0] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Constraint,
      moduleKind: TZTypes.TZModuleKind.ERC7579Hook,
      module: address(spendingLimitHook),
      data: _spendingLimitData(1 ether)
    });

    Agreement agr = _createActiveAgreement(zones);
    TrustZone zone = TrustZone(payable(agr.trustZones(0)));
    assertTrue(spendingLimitHook.isInitialized(address(zone)));

    // SpendingLimitHook keys runtime checks off msg.sender, and with HookMultiPlexer in front
    // the effective caller during preCheck is the multiplexer rather than the zone account.
    // Mirror the config into that scope so the real hook can be exercised through the current stack.
    _syncMultiplexerScopedLimit(1 ether);

    token.mint(address(zone), 2 ether);

    address recipient = makeAddr("hook-recipient");
    uint256 firstTransfer = 0.6 ether;
    uint256 secondTransfer = 0.5 ether;

    vm.prank(partyA);
    zone.execute(address(token), 0, abi.encodeCall(IERC20.transfer, (recipient, firstTransfer)));

    assertEq(token.balanceOf(recipient), firstTransfer);
    assertEq(token.balanceOf(address(zone)), 2 ether - firstTransfer);

    vm.prank(partyA);
    vm.expectRevert(
      abi.encodeWithSelector(HookMultiPlexerLib.SubHookPreCheckError.selector, address(spendingLimitHook))
    );
    zone.execute(address(token), 0, abi.encodeCall(IERC20.transfer, (recipient, secondTransfer)));

    assertEq(token.balanceOf(recipient), firstTransfer);
    assertEq(token.balanceOf(address(zone)), 2 ether - firstTransfer);
  }

  function test_ActivateWithMalformedSpendingLimitData_Reverts() public {
    TZTypes.TZConfig[] memory zones = _baseZones();
    zones[0].mechanisms = new TZTypes.TZMechanism[](1);
    zones[0].mechanisms[0] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Constraint,
      moduleKind: TZTypes.TZModuleKind.ERC7579Hook,
      module: address(spendingLimitHook),
      data: hex"deadbeef"
    });

    bytes memory payload = _proposalWithZones(zones);
    (Agreement agr,) = _createAgreementClone(payload);

    vm.prank(partyB);
    agr.submitInput(AgreementTypes.ACCEPT, payload);

    vm.prank(partyA);
    vm.expectRevert();
    agr.submitInput(AgreementTypes.SET_UP, "");

    assertEq(agr.currentState(), AgreementTypes.ACCEPTED);
    assertEq(agr.trustZones(0), address(0));
    assertEq(agr.trustZones(1), address(0));
    assertEq(agr.mechanismCount(), 0);
  }

  function test_ActivateWithMixedZoneHookConfig_RollsBackAtomically() public {
    TZTypes.TZConfig[] memory zones = _baseZones();

    zones[0].mechanisms = new TZTypes.TZMechanism[](1);
    zones[0].mechanisms[0] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Constraint,
      moduleKind: TZTypes.TZModuleKind.ERC7579Hook,
      module: address(spendingLimitHook),
      data: _spendingLimitData(1 ether)
    });

    zones[1].mechanisms = new TZTypes.TZMechanism[](1);
    zones[1].mechanisms[0] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Constraint,
      moduleKind: TZTypes.TZModuleKind.ERC7579Hook,
      module: address(spendingLimitHook),
      data: hex"01"
    });

    bytes memory payload = _proposalWithZones(zones);
    (Agreement agr,) = _createAgreementClone(payload);

    vm.prank(partyB);
    agr.submitInput(AgreementTypes.ACCEPT, payload);

    vm.prank(partyA);
    vm.expectRevert();
    agr.submitInput(AgreementTypes.SET_UP, "");

    assertEq(agr.currentState(), AgreementTypes.ACCEPTED);
    assertEq(agr.trustZones(0), address(0));
    assertEq(agr.trustZones(1), address(0));
    assertEq(agr.zoneHatIds(0), 0);
    assertEq(agr.zoneHatIds(1), 0);
    assertEq(agr.mechanismCount(), 0);
  }
}
