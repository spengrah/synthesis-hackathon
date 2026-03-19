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

  /// @dev First auto-generated permission token ID: (1 << 8) | 0x01
  uint256 internal constant PERMISSION_TOKEN_ID = (uint256(1) << 8) | 0x01;

  /// @dev First auto-generated responsibility token ID: (1 << 8) | 0x02
  uint256 internal constant RESPONSIBILITY_TOKEN_ID = (uint256(1) << 8) | 0x02;

  /// @dev First auto-generated directive token ID: (1 << 8) | 0x03
  uint256 internal constant DIRECTIVE_TOKEN_ID = (uint256(1) << 8) | 0x03;

  /// @dev Invalid token: type 0x00 (not permission, responsibility, or directive)
  uint256 internal constant INVALID_TOKEN_ID = (uint256(1) << 8) | 0x00;

  // Token type constants
  uint8 internal constant PERMISSION_TYPE = 0x01;
  uint8 internal constant RESPONSIBILITY_TYPE = 0x02;
  uint8 internal constant DIRECTIVE_TYPE = 0x03;

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
    config.maxActors = Constants.DEFAULT_MAX_ACTORS;
    config.description = Constants.DEFAULT_DESCRIPTION;
    // mechanisms and resources left empty — callers add as needed
  }

  function resourceTokenConfig(TZTypes.TZParamType _tokenType, bytes memory metadata)
    internal
    pure
    returns (TZTypes.TZResourceTokenConfig memory)
  {
    return TZTypes.TZResourceTokenConfig({ tokenType: _tokenType, metadata: metadata });
  }

  // --------------------
  // ProposalData builders
  // --------------------

  function proposalData(TZTypes.TZConfig[] memory zones, address adjudicator, uint256 deadline)
    internal
    pure
    returns (AgreementTypes.ProposalData memory)
  {
    return AgreementTypes.ProposalData({ termsDocUri: "", zones: zones, adjudicator: adjudicator, deadline: deadline });
  }
}
