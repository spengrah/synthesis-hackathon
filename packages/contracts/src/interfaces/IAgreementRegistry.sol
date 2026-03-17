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
/// @dev Wears the Trust Zones top hat. Deploys agreement clones, creates agreement-level hats,
///      and registers new agreements as authorized minters on the ResourceTokenRegistry.
interface IAgreementRegistry is IAgreementRegistryErrors, IAgreementRegistryEvents {
  /// @notice Deploy a new agreement contract. msg.sender is partyA (the initial proposer).
  /// @dev Creates an agreement-level hat (child of top hat), mints it to the new agreement,
  ///      deploys an Agreement clone via Clones.cloneDeterministic (salt = keccak256(agreementHatId, chainId)),
  ///      registers the agreement as an authorized minter on ResourceTokenRegistry,
  ///      and initializes the agreement with parties + proposalData.
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

  /// @notice The Agreement implementation address (used for ERC-1167 clones).
  function agreementImplementation() external view returns (address);
}
