// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.28;

import { IResourceTokenRegistry } from "./interfaces/IResourceTokenRegistry.sol";

/// @title Temptation
/// @notice Simple ETH holder with permission-token-gated withdrawal.
/// @dev Withdrawals require the caller to hold a permission token whose metadata
///      encodes the standard format: `(string resource, uint256 value, bytes32 period, uint256 expiry, bytes params)`
///      where params contains `abi.encode(address temptation)`.
contract Temptation {
  // ─── Errors
  // ───────────────────────────────────────────────────────

  error NoPermissionToken();
  error ExceedsPermittedAmount(uint256 requested, uint256 permitted);
  error InvalidTemptation(address expected, address actual);
  error InsufficientBalance(uint256 requested, uint256 available);
  error TransferFailed();
  error PermissionExpired();

  // ─── Events
  // ───────────────────────────────────────────────────────

  event Deposited(address indexed from, uint256 amount);
  event Withdrawn(address indexed to, uint256 amount, uint256 indexed permissionTokenId);

  // ─── State
  // ────────────────────────────────────────────────────────

  IResourceTokenRegistry public immutable REGISTRY;
  address public owner;
  mapping(uint256 => uint256) public cumulativeWithdrawn;

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
    // 0. Token must be a Permission type (0x01 encoded in low byte of token ID)
    if (permissionTokenId & 0xFF != 1) revert NoPermissionToken();

    // 1. Caller holds the permission token
    if (REGISTRY.balanceOf(msg.sender, permissionTokenId) == 0) {
      revert NoPermissionToken();
    }

    // 2. Decode metadata: (string resource, uint256 maxAmount, bytes32 period, uint256 expiry, bytes params)
    bytes memory metadata = REGISTRY.tokenMetadata(permissionTokenId);
    (, // string resource (unused)
      uint256 maxAmount,, // bytes32 period (unused)
      uint256 expiry,
      bytes memory params
    ) = abi.decode(metadata, (string, uint256, bytes32, uint256, bytes));

    // 2b. Check expiry (0 = no expiry per spec)
    if (expiry != 0 && block.timestamp > expiry) {
      revert PermissionExpired();
    }

    address temptationAddr = abi.decode(params, (address));

    // 3. Token is for THIS temptation
    if (temptationAddr != address(this)) {
      revert InvalidTemptation(address(this), temptationAddr);
    }

    // 4. Enforce cumulative cap
    cumulativeWithdrawn[permissionTokenId] += amount;
    if (cumulativeWithdrawn[permissionTokenId] > maxAmount) {
      revert ExceedsPermittedAmount(cumulativeWithdrawn[permissionTokenId], maxAmount);
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
