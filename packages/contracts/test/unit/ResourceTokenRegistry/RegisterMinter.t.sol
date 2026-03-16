// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { ResourceTokenRegistryBase } from "../../Base.t.sol";
import {
  IResourceTokenRegistryErrors,
  IResourceTokenRegistryEvents
} from "../../../src/interfaces/IResourceTokenRegistry.sol";

contract RegisterMinter_Test is ResourceTokenRegistryBase {
  function test_RevertIf_CallerIsNotOwner() public {
    vm.prank(unauthorized);
    vm.expectRevert(IResourceTokenRegistryErrors.NotOwner.selector);
    registry.registerMinter(alice);
  }

  function test_RegisterMinter_SetsIsMinter() public {
    vm.prank(registryOwner);
    registry.registerMinter(alice);

    assertTrue(registry.isMinter(alice));
  }

  function test_RegisterMinter_EmitsMinterRegisteredEvent() public {
    vm.prank(registryOwner);
    vm.expectEmit(true, false, false, false);
    emit IResourceTokenRegistryEvents.MinterRegistered(alice);
    registry.registerMinter(alice);
  }

  function testFuzz_RegisterMinter(address newMinter) public {
    vm.prank(registryOwner);
    registry.registerMinter(newMinter);

    assertTrue(registry.isMinter(newMinter));
  }
}
