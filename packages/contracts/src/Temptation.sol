// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.28;

import { IResourceTokenRegistry } from "./interfaces/IResourceTokenRegistry.sol";

/// @title Temptation
/// @notice Simple ETH holder with permission-token-gated withdrawal.
/// @dev Withdrawals require the caller to hold a permission token whose metadata
///      encodes `(address temptation, uint256 maxAmount)` matching this contract.
contract Temptation {
  // ─── Errors
  // ───────────────────────────────────────────────────────

  error NoPermissionToken();
  error ExceedsPermittedAmount(uint256 requested, uint256 permitted);
  error InvalidTemptation(address expected, address actual);
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

  /// @notice Deposit ETH into the temptation contract.
  function deposit() external payable {
    emit Deposited(msg.sender, msg.value);
  }

  /// @notice Withdraw ETH. Caller must hold the given permission token.
  /// @param amount The amount of ETH to withdraw.
  /// @param permissionTokenId The permission token ID authorising the withdrawal.
  function withdraw(uint256 amount, uint256 permissionTokenId) external nonReentrant {
    // 1. Caller holds the permission token
    if (REGISTRY.balanceOf(msg.sender, permissionTokenId) == 0) {
      revert NoPermissionToken();
    }

    // 2. Decode metadata: (address temptation, uint256 maxAmount)
    bytes memory metadata = REGISTRY.tokenMetadata(permissionTokenId);
    (address temptation, uint256 maxAmount) = abi.decode(metadata, (address, uint256));

    // 3. Token is for THIS temptation
    if (temptation != address(this)) {
      revert InvalidTemptation(address(this), temptation);
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

  /// @notice Returns the contract's ETH balance.
  function balance() external view returns (uint256) {
    return address(this).balance;
  }

  /// @notice Allow the contract to receive ETH directly.
  receive() external payable {
    emit Deposited(msg.sender, msg.value);
  }
}
