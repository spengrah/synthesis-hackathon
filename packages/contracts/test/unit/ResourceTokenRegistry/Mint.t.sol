// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { ResourceTokenRegistryBase } from "../../Base.t.sol";
import {
  IResourceTokenRegistryErrors,
  IResourceTokenRegistryEvents
} from "../../../src/interfaces/IResourceTokenRegistry.sol";
import { Defaults } from "../../helpers/Defaults.sol";
import { TestHelpers } from "../../helpers/TestHelpers.sol";

contract Mint_Test is ResourceTokenRegistryBase {
  function test_RevertIf_CallerIsNotMinter() public {
    vm.prank(unauthorized);
    vm.expectRevert(IResourceTokenRegistryErrors.NotAuthorizedMinter.selector);
    registry.mint(alice, Defaults.PERMISSION_TOKEN_ID, Defaults.DEFAULT_METADATA);
  }

  function test_RevertIf_RecipientAlreadyHasBalance() public {
    _mintDefault(alice, Defaults.PERMISSION_TOKEN_ID);

    vm.prank(minter);
    vm.expectRevert(IResourceTokenRegistryErrors.BalanceExceedsMax.selector);
    registry.mint(alice, Defaults.PERMISSION_TOKEN_ID, Defaults.DEFAULT_METADATA);
  }

  function test_MintWhenMetadataAlreadySetAndDiffers_IgnoresNewMetadata() public {
    _mintDefault(alice, Defaults.PERMISSION_TOKEN_ID);

    // Implementation ignores metadata on subsequent mints of existing token IDs (no revert)
    vm.prank(minter);
    registry.mint(bob, Defaults.PERMISSION_TOKEN_ID, "different metadata");

    assertEq(registry.balanceOf(bob, Defaults.PERMISSION_TOKEN_ID), 1);
    // Original metadata is preserved
    assertEq(registry.tokenMetadata(Defaults.PERMISSION_TOKEN_ID), Defaults.DEFAULT_METADATA);
  }

  function test_MintWhenMetadataAlreadySetAndMatches() public {
    _mintDefault(alice, Defaults.PERMISSION_TOKEN_ID);

    vm.prank(minter);
    registry.mint(bob, Defaults.PERMISSION_TOKEN_ID, Defaults.DEFAULT_METADATA);

    assertEq(registry.balanceOf(bob, Defaults.PERMISSION_TOKEN_ID), 1);
    assertEq(registry.tokenMetadata(Defaults.PERMISSION_TOKEN_ID), Defaults.DEFAULT_METADATA);
  }

  function test_MintFreshToken_SetsBalance() public {
    _mintDefault(alice, Defaults.PERMISSION_TOKEN_ID);
    assertEq(registry.balanceOf(alice, Defaults.PERMISSION_TOKEN_ID), 1);
  }

  function test_MintFreshToken_SetsCreator() public {
    _mintDefault(alice, Defaults.PERMISSION_TOKEN_ID);
    assertEq(registry.creator(Defaults.PERMISSION_TOKEN_ID), minter);
  }

  function test_MintFreshToken_StoresMetadata() public {
    _mintDefault(alice, Defaults.PERMISSION_TOKEN_ID);
    assertEq(registry.tokenMetadata(Defaults.PERMISSION_TOKEN_ID), Defaults.DEFAULT_METADATA);
  }

  function test_MintFreshToken_EmitsTransferEvent() public {
    vm.prank(minter);
    vm.expectEmit(true, true, true, true);
    emit IResourceTokenRegistryEvents.Transfer(minter, address(0), alice, Defaults.PERMISSION_TOKEN_ID, 1);
    registry.mint(alice, Defaults.PERMISSION_TOKEN_ID, Defaults.DEFAULT_METADATA);
  }

  function testFuzz_MintWithVariousTokenIds(uint248 base) public {
    vm.assume(base > 0);
    uint256 id = TestHelpers.makeTokenId(base, 0x01);

    vm.prank(minter);
    registry.mint(alice, id, Defaults.DEFAULT_METADATA);

    assertEq(registry.balanceOf(alice, id), 1);
    assertEq(registry.creator(id), minter);
  }

  function testFuzz_MintToVariousAddresses(address to) public {
    vm.assume(to != address(0));

    vm.prank(minter);
    registry.mint(to, Defaults.PERMISSION_TOKEN_ID, Defaults.DEFAULT_METADATA);

    assertEq(registry.balanceOf(to, Defaults.PERMISSION_TOKEN_ID), 1);
  }
}
