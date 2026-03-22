// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { IERC1271 } from "@openzeppelin/contracts/interfaces/IERC1271.sol";

/// @dev Mock ERC-1271 contract signer that always returns the valid magic value.
contract MockERC1271Signer is IERC1271 {
  function isValidSignature(bytes32, bytes memory) external pure override returns (bytes4) {
    return 0x1626ba7e;
  }
}

/// @dev Mock ERC-1271 contract signer that always returns an invalid magic value.
contract MockERC1271InvalidSigner is IERC1271 {
  function isValidSignature(bytes32, bytes memory) external pure override returns (bytes4) {
    return 0xdeadbeef;
  }
}
