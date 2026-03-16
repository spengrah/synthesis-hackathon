// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { TZTypes } from "../../src/lib/TZTypes.sol";
import { AgreementTypes } from "../../src/lib/AgreementTypes.sol";
import { Constants } from "./Constants.sol";

/// @notice Default struct builders for tests. Provides consistent test data across all test suites.
library Defaults {
  // --------------------
  // Resource token IDs
  // --------------------

  /// @dev Default metadata bytes for test minting.
  bytes internal constant DEFAULT_METADATA = "test metadata";

  /// @dev Permission token: type 0x01, namespace 0x00...01, id 0x01
  uint256 internal constant PERMISSION_TOKEN_ID = (0x01) | (uint256(1) << 8) | (uint256(1) << 72);

  /// @dev Responsibility token: type 0x02, namespace 0x00...01, id 0x01
  uint256 internal constant RESPONSIBILITY_TOKEN_ID = (0x02) | (uint256(1) << 8) | (uint256(1) << 72);

  /// @dev Directive token: type 0x03, namespace 0x00...01, id 0x01
  uint256 internal constant DIRECTIVE_TOKEN_ID = (0x03) | (uint256(1) << 8) | (uint256(1) << 72);

  /// @dev Invalid token: type 0x00 (not permission, responsibility, or directive)
  uint256 internal constant INVALID_TOKEN_ID = (0x00) | (uint256(1) << 8) | (uint256(1) << 72);

  // --------------------
  // Metadata
  // --------------------

  function permissionMetadata() internal pure returns (bytes memory) {
    return abi.encode("test-resource", uint256(10), uint256(3600));
  }

  function responsibilityMetadata() internal pure returns (bytes memory) {
    return abi.encode("test-obligation", "test-criteria", uint256(0));
  }

  function directiveMetadata() internal pure returns (bytes memory) {
    return abi.encode("test-rule", "moderate");
  }

  // --------------------
  // TZConfig builders
  // --------------------

  function tzConfig(address party, uint256 agentId) internal pure returns (TZTypes.TZConfig memory config) {
    config.party = party;
    config.agentId = agentId;
    config.hatMaxSupply = Constants.DEFAULT_HAT_MAX_SUPPLY;
    config.hatDetails = Constants.DEFAULT_HAT_DETAILS;
    // mechanisms and resources left empty — callers add as needed
  }

  function resourceTokenConfig(uint256 tokenId, bytes memory metadata)
    internal
    pure
    returns (TZTypes.TZResourceTokenConfig memory)
  {
    return TZTypes.TZResourceTokenConfig({ tokenId: tokenId, metadata: metadata });
  }

  // --------------------
  // ProposalData builders
  // --------------------

  function proposalData(TZTypes.TZConfig[] memory zones, address adjudicator, uint256 deadline)
    internal
    pure
    returns (AgreementTypes.ProposalData memory)
  {
    return AgreementTypes.ProposalData({
      termsDocHash: bytes32(0), termsDocUri: "", zones: zones, adjudicator: adjudicator, deadline: deadline
    });
  }
}
