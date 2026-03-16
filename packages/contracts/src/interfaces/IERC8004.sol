// SPDX-License-Identifier: MIT
pragma solidity >=0.8.28;

/// @title IReputationRegistry
/// @notice Minimal interface for ERC-8004 ReputationRegistry — only the functions Agreement needs.
/// @dev Full spec: https://eips.ethereum.org/EIPS/eip-8004
interface IReputationRegistry {
  /// @notice Submit feedback for an agent.
  /// @param agentId The agent's ERC-8004 identity token ID.
  /// @param value Numeric feedback value (signed fixed-point).
  /// @param valueDecimals Decimal precision for the value.
  /// @param tag1 Primary category tag.
  /// @param tag2 Secondary category tag.
  /// @param endpoint Context reference (e.g., agreement contract address).
  /// @param feedbackURI URI pointing to detailed feedback (e.g., IPFS).
  /// @param feedbackHash Hash of the feedback content.
  function giveFeedback(
    uint256 agentId,
    int128 value,
    uint8 valueDecimals,
    string calldata tag1,
    string calldata tag2,
    string calldata endpoint,
    string calldata feedbackURI,
    bytes32 feedbackHash
  ) external;
}
