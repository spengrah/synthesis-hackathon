// SPDX-License-Identifier: MIT
pragma solidity >=0.8.28;

/// @title IAgreementRegistryErrors
/// @notice Errors for AgreementRegistry.
interface IAgreementRegistryErrors {
  error InvalidParty(address party);
  error PartiesIdentical();
}

/// @title IAgreementRegistryEvents
/// @notice Events for AgreementRegistry.
interface IAgreementRegistryEvents {
  event AgreementCreated(
    address indexed agreement, address indexed creator, uint256 agreementHatId, address partyA, address partyB
  );
}

/// @title IAgreementRegistry
/// @notice Factory + Hats tree manager for Trust Zone agreements.
/// @dev Wears the Trust Zones top hat. Deploys agreement contracts, creates agreement-level hats,
///      and registers new agreements as authorized minters on the ResourceTokenRegistry.
interface IAgreementRegistry is IAgreementRegistryErrors, IAgreementRegistryEvents {
  /// @notice Deploy a new agreement contract. msg.sender is partyA (the initial proposer).
  /// @dev Deploys via CREATE2 (deterministic address). Creates an agreement-level hat as a child of
  ///      the top hat, transfers hat admin to the new agreement, and registers the agreement as
  ///      an authorized minter on the ResourceTokenRegistry.
  /// @param partyB The counterparty.
  /// @param proposalData ABI-encoded initial ProposalData submitted by msg.sender (partyA).
  /// @return agreement The deployed agreement contract address.
  function createAgreement(address partyB, bytes calldata proposalData) external returns (address agreement);

  /// @notice Look up the agreement-level hat ID for a deployed agreement.
  /// @param agreement The agreement contract address.
  /// @return The hat ID (0 if not found).
  function agreementHatIds(address agreement) external view returns (uint256);

  /// @notice The Hats Protocol contract address.
  function hats() external view returns (address);

  /// @notice The Trust Zones top hat ID (worn by this registry).
  function topHatId() external view returns (uint256);

  /// @notice The ResourceTokenRegistry address.
  function resourceTokenRegistry() external view returns (address);

  /// @notice The ERC-8004 IdentityRegistry address.
  function identityRegistry() external view returns (address);

  /// @notice The ERC-8004 ReputationRegistry address.
  function reputationRegistry() external view returns (address);

  /// @notice The TrustZone implementation address (used for ERC-1167 clones).
  function trustZoneImplementation() external view returns (address);
}
