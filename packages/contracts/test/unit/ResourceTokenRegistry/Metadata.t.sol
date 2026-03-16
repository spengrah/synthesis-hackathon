// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { ResourceTokenRegistryBase } from "../../Base.t.sol";
import { Defaults } from "../../helpers/Defaults.sol";

contract Metadata_Test is ResourceTokenRegistryBase {
  function test_TokenMetadata_ReturnsStoredMetadata() public {
    uint256 id = _mintDefault(alice, Defaults.PERMISSION_TYPE);
    assertEq(registry.tokenMetadata(id), Defaults.DEFAULT_METADATA);
  }

  function test_TokenMetadata_ReturnsEmptyForUnmintedToken() public view {
    assertEq(registry.tokenMetadata(Defaults.PERMISSION_TOKEN_ID), "");
  }

  function test_Creator_ReturnsCreatorAddress() public {
    uint256 id = _mintDefault(alice, Defaults.PERMISSION_TYPE);
    assertEq(registry.creator(id), minter);
  }

  function test_Creator_ReturnsZeroForUnmintedToken() public view {
    assertEq(registry.creator(Defaults.PERMISSION_TOKEN_ID), address(0));
  }
}
