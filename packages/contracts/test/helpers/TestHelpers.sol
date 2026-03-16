// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

/// @notice Utility functions shared across all test suites.
library TestHelpers {
  /// @dev Extract the type prefix (bits 0-7) from a resource token ID.
  function tokenTypeOf(uint256 id) internal pure returns (uint8) {
    return uint8(id & 0xFF);
  }

  /// @dev Build a token ID from a base value and a type prefix.
  function makeTokenId(uint256 base, uint8 typePrefix) internal pure returns (uint256) {
    return (base << 8) | typePrefix;
  }

  /// @dev Compute a deterministic salt for TrustZone clone deployment.
  function cloneSalt(address agreement, uint256 zoneIndex) internal pure returns (bytes32) {
    return keccak256(abi.encode(agreement, zoneIndex));
  }
}
