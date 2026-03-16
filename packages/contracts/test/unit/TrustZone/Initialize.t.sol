// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { TrustZoneBase } from "../../Base.t.sol";
import { TrustZone } from "../../../src/TrustZone.sol";
import { ITrustZoneEvents } from "../../../src/interfaces/ITrustZone.sol";
import { MODULE_TYPE_VALIDATOR, MODULE_TYPE_EXECUTOR } from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract TrustZone_initialize is TrustZoneBase {
  function test_RevertWhen_AlreadyInitialized() public {
    // trustZone was already initialized in setUp, so calling again should revert
    vm.expectRevert(Initializable.InvalidInitialization.selector);
    trustZone.initialize(address(hatValidator), abi.encode(zoneHatA), mockExecutor, "", address(0), "");
  }

  function test_StoresHatValidatorAddress() public view {
    assertEq(trustZone.hatValidator(), address(hatValidator));
  }

  function test_InstallsHatValidatorAsValidatorModule() public view {
    assertTrue(trustZone.isModuleInstalled(MODULE_TYPE_VALIDATOR, address(hatValidator), ""));
  }

  function test_InstallsAgreementContractAsExecutorModule() public view {
    assertTrue(trustZone.isModuleInstalled(MODULE_TYPE_EXECUTOR, mockExecutor, ""));
  }

  function test_EmitsTrustZoneInitialized() public {
    // Deploy a fresh uninitialised clone to capture the event
    bytes32 salt = keccak256("init-event-test");
    TrustZone fresh = TrustZone(payable(Clones.cloneDeterministic(address(trustZoneImpl), salt)));

    vm.expectEmit(true, true, true, true);
    emit ITrustZoneEvents.TrustZoneInitialized(address(hatValidator), mockExecutor, address(0));

    fresh.initialize(address(hatValidator), abi.encode(zoneHatB), mockExecutor, "", address(0), "");
  }
}
