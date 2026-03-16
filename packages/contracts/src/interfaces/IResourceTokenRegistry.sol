// SPDX-License-Identifier: MIT
pragma solidity >=0.8.28;

/// @title IResourceTokenRegistryErrors
/// @notice Errors for ResourceTokenRegistry.
interface IResourceTokenRegistryErrors {
  error NotAuthorizedMinter();
  error NotTokenCreator();
  error NotOwner();
  error BalanceExceedsMax();
  error InsufficientBalance(address from, uint256 id);
  error ApprovalsDisabled();
}

/// @title IResourceTokenRegistryEvents
/// @notice Events for ResourceTokenRegistry.
interface IResourceTokenRegistryEvents {
  /// @notice Emitted on any balance change (mint, burn, transfer). ERC-6909 standard.
  event Transfer(address caller, address indexed sender, address indexed receiver, uint256 indexed id, uint256 amount);

  /// @notice Emitted when a new token ID is created (first mint).
  event TokenCreated(uint256 indexed tokenId, address indexed creator, bytes metadata);

  /// @notice Emitted when a new minter is registered.
  event MinterRegistered(address indexed minter);
}

/// @title IResourceTokenRegistry
/// @notice ERC-6909 registry for Trust Zone resource tokens (permissions, responsibilities, directives).
/// @dev Non-transferable except by creator. Max balance of 1 per holder per token ID.
///      Metadata is immutable — set on first mint. Holders have no transfer or approval authority.
///      Resource tokens are delegated assets: the creator (agreement contract) retains control.
interface IResourceTokenRegistry is IResourceTokenRegistryErrors, IResourceTokenRegistryEvents {
  // ---- ERC-6909 reads ----

  /// @notice Get the balance of a token for an owner. Always 0 or 1.
  function balanceOf(address owner, uint256 id) external view returns (uint256);

  /// @notice Get the allowance for a spender. Always 0 (approvals disabled).
  function allowance(address owner, address spender, uint256 id) external view returns (uint256);

  /// @notice Check if an operator is approved. Always false (approvals disabled).
  function isOperator(address owner, address operator) external view returns (bool);

  // ---- ERC-6909 transfers (restricted) ----

  /// @notice Transfer a token. Only callable by the token's creator.
  /// @param receiver The address to transfer to.
  /// @param id The token ID.
  /// @param amount Must be 1.
  /// @return success True if the transfer succeeds.
  function transfer(address receiver, uint256 id, uint256 amount) external returns (bool);

  /// @notice Transfer a token from a specific sender. Only callable by the token's creator.
  /// @param sender The address to transfer from.
  /// @param receiver The address to transfer to.
  /// @param id The token ID.
  /// @param amount Must be 1.
  /// @return success True if the transfer succeeds.
  function transferFrom(address sender, address receiver, uint256 id, uint256 amount) external returns (bool);

  /// @notice Disabled. Reverts unconditionally. Holders have no transfer authority.
  function approve(address spender, uint256 id, uint256 amount) external returns (bool);

  /// @notice Disabled. Reverts unconditionally. Holders have no operator authority.
  function setOperator(address operator, bool approved) external returns (bool);

  // ---- Minting / burning ----

  /// @notice Mint a resource token to an address.
  /// @dev Only callable by authorized minters (agreement contracts).
  ///      First mint of a token ID sets its creator and metadata permanently.
  ///      Reverts if the recipient already holds this token ID (max balance = 1).
  /// @param to The recipient address.
  /// @param id The token ID (type prefix in bits 0-7).
  /// @param metadata ABI-encoded metadata. Ignored if token ID already exists.
  function mint(address to, uint256 id, bytes calldata metadata) external;

  /// @notice Burn a resource token from an address.
  /// @dev Only callable by the token's creator (the agreement contract that first minted it).
  /// @param from The address to burn from.
  /// @param id The token ID.
  function burn(address from, uint256 id) external;

  // ---- Minter registration ----

  /// @notice Register an address as an authorized minter.
  /// @dev Only callable by the registry owner.
  /// @param minter The address to authorize.
  function registerMinter(address minter) external;

  /// @notice Check if an address is an authorized minter.
  function isMinter(address minter) external view returns (bool);

  // ---- Metadata ----

  /// @notice Get the immutable metadata for a token ID.
  /// @param id The token ID.
  /// @return metadata ABI-encoded metadata, set on first mint.
  function tokenMetadata(uint256 id) external view returns (bytes memory);

  /// @notice Get the creator (first minter) of a token ID.
  /// @param id The token ID.
  /// @return The creator address.
  function creator(uint256 id) external view returns (address);

  // ---- Token ID helpers ----

  /// @notice Extract the type prefix from a token ID (bits 0-7).
  /// @return The type byte (0x01 permission, 0x02 responsibility, 0x03 directive).
  function tokenType(uint256 id) external pure returns (uint8);

  /// @notice Check if a token ID is a permission token (0x01).
  function isPermission(uint256 id) external pure returns (bool);

  /// @notice Check if a token ID is a responsibility token (0x02).
  function isResponsibility(uint256 id) external pure returns (bool);

  /// @notice Check if a token ID is a directive token (0x03).
  function isDirective(uint256 id) external pure returns (bool);

  // ---- Admin ----

  /// @notice The registry owner (typically the AgreementRegistry or deployer).
  function owner() external view returns (address);
}
