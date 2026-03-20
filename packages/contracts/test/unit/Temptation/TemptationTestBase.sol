// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { Test } from "forge-std/Test.sol";
import { Temptation } from "../../../src/Temptation.sol";
import { IResourceTokenRegistry } from "../../../src/interfaces/IResourceTokenRegistry.sol";

/// @notice Base for Temptation unit tests.
/// @dev Does NOT require a fork — Temptation uses vm.mockCall for RTR interactions.
abstract contract TemptationTestBase is Test {
  Temptation internal temptation;
  address internal registry;
  address internal caller;
  address internal otherTemptation;

  uint256 internal constant TOKEN_ID = 1;
  uint256 internal constant MAX_AMOUNT = 5 ether;

  function setUp() public virtual {
    registry = makeAddr("registry");
    caller = makeAddr("caller");
    otherTemptation = makeAddr("otherTemptation");

    temptation = new Temptation(registry);
  }

  // ─── Mock helpers
  // ─────────────────────────────────────

  /// @dev Mock REGISTRY.balanceOf to return `bal` for the given owner+id.
  function _mockBalanceOf(address owner, uint256 id, uint256 bal) internal {
    vm.mockCall(registry, abi.encodeCall(IResourceTokenRegistry.balanceOf, (owner, id)), abi.encode(bal));
  }

  /// @dev Mock REGISTRY.tokenMetadata to return standard permission format.
  function _mockTokenMetadata(uint256 id, address temptationAddr, uint256 maxAmt) internal {
    bytes memory metadata = abi.encode(
      "vault-withdraw", // resource
      maxAmt, // value
      bytes32("total"), // period
      uint256(0), // expiry
      abi.encode(temptationAddr) // params
    );
    vm.mockCall(registry, abi.encodeCall(IResourceTokenRegistry.tokenMetadata, (id)), abi.encode(metadata));
  }

  /// @dev Mock REGISTRY.tokenMetadata with explicit expiry.
  function _mockTokenMetadataWithExpiry(uint256 id, address temptationAddr, uint256 maxAmt, uint256 expiry) internal {
    bytes memory metadata = abi.encode(
      "vault-withdraw", // resource
      maxAmt, // value
      bytes32("total"), // period
      expiry, // expiry
      abi.encode(temptationAddr) // params
    );
    vm.mockCall(registry, abi.encodeCall(IResourceTokenRegistry.tokenMetadata, (id)), abi.encode(metadata));
  }

  /// @dev Set up valid mocks for a successful withdrawal.
  function _mockValidWithdrawal() internal {
    _mockBalanceOf(caller, TOKEN_ID, 1);
    _mockTokenMetadata(TOKEN_ID, address(temptation), MAX_AMOUNT);
  }
}
