// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { ResourceTokenRegistryBase } from "../../Base.t.sol";
import {
  IResourceTokenRegistryErrors,
  IResourceTokenRegistryEvents
} from "../../../src/interfaces/IResourceTokenRegistry.sol";
import { Defaults } from "../../helpers/Defaults.sol";

contract Burn_Test is ResourceTokenRegistryBase {
  uint256 internal tokenId;

  function setUp() public override {
    super.setUp();
    tokenId = _mintDefault(alice, Defaults.PERMISSION_TYPE);
  }

  function test_RevertIf_CallerIsNotCreator() public {
    vm.prank(unauthorized);
    vm.expectRevert(IResourceTokenRegistryErrors.NotTokenCreator.selector);
    registry.burn(alice, tokenId);
  }

  function test_RevertIf_TargetHasNoBalance() public {
    vm.prank(minter);
    vm.expectRevert(abi.encodeWithSelector(IResourceTokenRegistryErrors.InsufficientBalance.selector, bob, tokenId));
    registry.burn(bob, tokenId);
  }

  function test_Burn_SetsBalanceToZero() public {
    vm.prank(minter);
    registry.burn(alice, tokenId);

    assertEq(registry.balanceOf(alice, tokenId), 0);
  }

  function test_Burn_EmitsTransferEvent() public {
    vm.prank(minter);
    vm.expectEmit(true, true, true, true);
    emit IResourceTokenRegistryEvents.Transfer(minter, alice, address(0), tokenId, 1);
    registry.burn(alice, tokenId);
  }
}
