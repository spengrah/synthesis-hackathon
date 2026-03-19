// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

library Constants {
  // --------------------
  // Fork
  // --------------------

  uint256 internal constant FORK_BLOCK = 43_454_644;

  // --------------------
  // Hats Protocol (deployed on Base mainnet)
  // --------------------

  address internal constant HATS = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;

  // --------------------
  // ERC-8004 (deployed on Base mainnet)
  // --------------------

  address internal constant IDENTITY_REGISTRY = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432;
  address internal constant REPUTATION_REGISTRY = 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63;

  // --------------------
  // Resource token type prefixes
  // --------------------

  uint8 internal constant PERMISSION_PREFIX = 0x01;
  uint8 internal constant RESPONSIBILITY_PREFIX = 0x02;
  uint8 internal constant DIRECTIVE_PREFIX = 0x03;

  // --------------------
  // Hats Module Factory (deployed on Base mainnet)
  // --------------------

  address internal constant HATS_MODULE_FACTORY = 0x0a3f85fa597B6a967271286aA0724811acDF5CD9;

  // --------------------
  // Test values
  // --------------------

  uint256 internal constant DEFAULT_DEADLINE = 7 days;
  uint32 internal constant DEFAULT_MAX_ACTORS = 1;
  string internal constant DEFAULT_DESCRIPTION = "Test Zone Hat";
}
