// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { ForkTestBase } from "../Base.t.sol";
import { Agreement } from "../../src/Agreement.sol";
import { AgreementTypes } from "../../src/lib/AgreementTypes.sol";
import { TZTypes } from "../../src/lib/TZTypes.sol";
import { Defaults } from "../helpers/Defaults.sol";
import { Constants } from "../helpers/Constants.sol";
import { StakingEligibility } from "../../lib/staking-eligibility/src/StakingEligibility.sol";
import { HatsEligibilitiesChain } from "../../lib/chain-modules/src/HatsEligibilitiesChain.sol";

contract HatsMintableERC20 is ERC20 {
  constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) { }

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }
}

contract Agreement_HatsModulesIntegration is ForkTestBase {
  StakingEligibility internal stakingEligibilityImpl;

  function setUp() public override {
    super.setUp();
    _deployAll();
    stakingEligibilityImpl = new StakingEligibility("1.0.0");
  }

  function _baseZones() internal view returns (TZTypes.TZConfig[] memory zones) {
    zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);
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

  function _stakingMechanism(uint248 minStake, bytes memory initData)
    internal
    view
    returns (TZTypes.TZMechanism memory mechanism)
  {
    mechanism = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Eligibility,
      moduleKind: TZTypes.TZModuleKind.HatsModule,
      module: address(stakingEligibilityImpl),
      data: initData.length == 0
        ? abi.encode(bytes(""), abi.encode(minStake, uint256(0), uint256(0), uint256(0)))
        : initData
    });
  }

  function _materializeToken(address tokenAddr) internal returns (HatsMintableERC20 materialized) {
    vm.etch(tokenAddr, type(HatsMintableERC20).runtimeCode);
    materialized = HatsMintableERC20(tokenAddr);
  }

  function test_ActivateWithStakingEligibility_AllowsStakeBasedEligibilityFlip() public {
    TZTypes.TZConfig[] memory zones = _baseZones();
    zones[0].mechanisms = new TZTypes.TZMechanism[](1);
    zones[0].mechanisms[0] = _stakingMechanism(0, "");

    Agreement agr = _createActiveAgreement(zones);
    uint256 zoneHatId = agr.zoneHatIds(0);
    address eligibility = hats.getHatEligibilityModule(zoneHatId);
    address tokenAddr = address(StakingEligibility(eligibility).TOKEN());
    HatsMintableERC20 token = _materializeToken(tokenAddr);

    assertTrue(eligibility != address(0));
    assertTrue(eligibility != address(stakingEligibilityImpl));
    assertEq(StakingEligibility(eligibility).IMPLEMENTATION(), address(stakingEligibilityImpl));
    assertEq(StakingEligibility(eligibility).hatId(), zoneHatId);
    assertTrue(tokenAddr != address(0));

    assertTrue(hats.isEligible(partyA, zoneHatId));
    assertTrue(hats.isInGoodStanding(partyA, zoneHatId));

    vm.prank(address(agr));
    StakingEligibility(eligibility).changeMinStake(1 ether);

    assertFalse(hats.isEligible(partyA, zoneHatId));
    assertTrue(hats.isInGoodStanding(partyA, zoneHatId));

    token.mint(partyA, 1 ether);
    vm.prank(partyA);
    token.approve(eligibility, 1 ether);
    vm.prank(partyA);
    StakingEligibility(eligibility).stake(1 ether);

    assertTrue(hats.isEligible(partyA, zoneHatId));
    assertTrue(hats.isInGoodStanding(partyA, zoneHatId));
  }

  function test_ActivateWithTwoStakingEligibilityModules_InstallsChain_AndRequiresBothStakes() public {
    TZTypes.TZConfig[] memory zones = _baseZones();
    zones[0].mechanisms = new TZTypes.TZMechanism[](2);
    zones[0].mechanisms[0] = _stakingMechanism(0, "");
    zones[0].mechanisms[1] = _stakingMechanism(0, "");

    Agreement agr = _createActiveAgreement(zones);
    uint256 zoneHatId = agr.zoneHatIds(0);
    address eligibility = hats.getHatEligibilityModule(zoneHatId);

    assertTrue(eligibility != address(0));
    assertTrue(eligibility != address(stakingEligibilityImpl));
    assertEq(HatsEligibilitiesChain(eligibility).IMPLEMENTATION(), address(eligibilitiesChainImpl));

    uint256[] memory clauseLengths = HatsEligibilitiesChain(eligibility).CONJUNCTION_CLAUSE_LENGTHS();
    address[] memory modules = HatsEligibilitiesChain(eligibility).MODULES();

    assertEq(HatsEligibilitiesChain(eligibility).NUM_CONJUNCTION_CLAUSES(), 1);
    assertEq(clauseLengths.length, 1);
    assertEq(clauseLengths[0], 2);
    assertEq(modules.length, 2);
    assertTrue(modules[0] != address(0));
    assertTrue(modules[1] != address(0));
    assertTrue(modules[0] != modules[1]);

    address tokenAddr0 = address(StakingEligibility(modules[0]).TOKEN());
    address tokenAddr1 = address(StakingEligibility(modules[1]).TOKEN());
    HatsMintableERC20 token0 = _materializeToken(tokenAddr0);
    HatsMintableERC20 token1 = tokenAddr1 == tokenAddr0 ? token0 : _materializeToken(tokenAddr1);

    assertTrue(hats.isEligible(partyA, zoneHatId));
    assertTrue(hats.isInGoodStanding(partyA, zoneHatId));

    vm.prank(address(agr));
    StakingEligibility(modules[0]).changeMinStake(1 ether);
    vm.prank(address(agr));
    StakingEligibility(modules[1]).changeMinStake(1 ether);

    assertFalse(hats.isEligible(partyA, zoneHatId));
    assertTrue(hats.isInGoodStanding(partyA, zoneHatId));

    token0.mint(partyA, 1 ether);
    if (tokenAddr1 != tokenAddr0) token1.mint(partyA, 1 ether);
    else token0.mint(partyA, 1 ether);
    vm.prank(partyA);
    token0.approve(modules[0], type(uint256).max);
    vm.prank(partyA);
    token1.approve(modules[1], type(uint256).max);

    vm.prank(partyA);
    StakingEligibility(modules[0]).stake(1 ether);

    assertFalse(hats.isEligible(partyA, zoneHatId));
    assertTrue(hats.isInGoodStanding(partyA, zoneHatId));

    vm.prank(partyA);
    StakingEligibility(modules[1]).stake(1 ether);

    assertTrue(hats.isEligible(partyA, zoneHatId));
    assertTrue(hats.isInGoodStanding(partyA, zoneHatId));
  }

  function test_ActivateWithMalformedStakingEligibilityData_Reverts() public {
    TZTypes.TZConfig[] memory zones = _baseZones();

    zones[0].mechanisms = new TZTypes.TZMechanism[](1);
    zones[0].mechanisms[0] = _stakingMechanism(0, "");

    zones[1].mechanisms = new TZTypes.TZMechanism[](1);
    zones[1].mechanisms[0] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Eligibility,
      moduleKind: TZTypes.TZModuleKind.HatsModule,
      module: address(stakingEligibilityImpl),
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
