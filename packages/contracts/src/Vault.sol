// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.28;

import { IResourceTokenRegistry } from "./interfaces/IResourceTokenRegistry.sol";

/// @title Vault
/// @notice Simple ETH holder with permission-token-gated withdrawal.
/// @dev Withdrawals require the caller to hold a permission token whose metadata
///      encodes `(address vault, uint256 maxAmount)` matching this vault.
contract Vault {
  // ─── Errors
  // ───────────────────────────────────────────────────────

  error NoPermissionToken();
  error ExceedsPermittedAmount(uint256 requested, uint256 permitted);
  error InvalidVault(address expected, address actual);
  error InsufficientBalance(uint256 requested, uint256 available);
  error TransferFailed();

  // ─── Events
  // ───────────────────────────────────────────────────────

  event Deposited(address indexed from, uint256 amount);
  event Withdrawn(address indexed to, uint256 amount, uint256 indexed permissionTokenId);

  // ─── State
  // ────────────────────────────────────────────────────────

  IResourceTokenRegistry public immutable REGISTRY;
  address public owner;

  // ─── Reentrancy lock
  // ──────────────────────────────────────────────

  uint256 private constant _NOT_ENTERED = 1;
  uint256 private constant _ENTERED = 2;
  uint256 private _status = _NOT_ENTERED;

  modifier nonReentrant() {
    require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
    _status = _ENTERED;
    _;
    _status = _NOT_ENTERED;
  }

  // ─── Constructor
  // ──────────────────────────────────────────────────

  constructor(address registry) {
    REGISTRY = IResourceTokenRegistry(registry);
    owner = msg.sender;
  }

  // ─── External functions
  // ───────────────────────────────────────────

  /// @notice Deposit ETH into the vault.
  function deposit() external payable {
    emit Deposited(msg.sender, msg.value);
  }

  /// @notice Withdraw ETH from the vault. Caller must hold the given permission token.
  /// @param amount The amount of ETH to withdraw.
  /// @param permissionTokenId The permission token ID authorising the withdrawal.
  function withdraw(uint256 amount, uint256 permissionTokenId) external nonReentrant {
    // 1. Caller holds the permission token
    if (REGISTRY.balanceOf(msg.sender, permissionTokenId) == 0) {
      revert NoPermissionToken();
    }

    // 2. Decode metadata: (address vault, uint256 maxAmount)
    bytes memory metadata = REGISTRY.tokenMetadata(permissionTokenId);
    (address vault, uint256 maxAmount) = abi.decode(metadata, (address, uint256));

    // 3. Token is for THIS vault
    if (vault != address(this)) {
      revert InvalidVault(address(this), vault);
    }

    // 4. Enforce cap
    if (amount > maxAmount) {
      revert ExceedsPermittedAmount(amount, maxAmount);
    }

    // 5. Sufficient balance
    if (amount > address(this).balance) {
      revert InsufficientBalance(amount, address(this).balance);
    }

    // 6. Transfer ETH
    (bool success,) = msg.sender.call{ value: amount }("");
    if (!success) {
      revert TransferFailed();
    }

    emit Withdrawn(msg.sender, amount, permissionTokenId);
  }

  /// @notice Returns the vault's ETH balance.
  function balance() external view returns (uint256) {
    return address(this).balance;
  }

  /// @notice Allow the vault to receive ETH directly.
  receive() external payable {
    emit Deposited(msg.sender, msg.value);
  }
}
