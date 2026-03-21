// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IResourceTokenRegistry } from "./interfaces/IResourceTokenRegistry.sol";

/// @title Temptation
/// @notice ERC-20 holder with permission-token-gated withdrawal.
/// @dev Withdrawals require the caller to hold a permission token whose metadata
///      encodes the standard format: `(string resource, uint256 value, bytes32 period, uint256 expiry, bytes params)`
///      where params contains `abi.encode(address temptation)`.
contract Temptation {
  using SafeERC20 for IERC20;

  // ─── Errors
  // ───────────────────────────────────────────────────────

  error NoPermissionToken();
  error ExceedsPermittedAmount(uint256 requested, uint256 permitted);
  error InvalidTemptation(address expected, address actual);
  error InsufficientBalance(uint256 requested, uint256 available);
  error PermissionExpired();

  // ─── Events
  // ───────────────────────────────────────────────────────

  event Deposited(address indexed from, uint256 amount);
  event Withdrawn(address indexed to, uint256 amount, uint256 indexed permissionTokenId);

  // ─── State
  // ────────────────────────────────────────────────────────

  IResourceTokenRegistry public immutable REGISTRY;
  IERC20 public immutable TOKEN;
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

  constructor(address registry, address token) {
    REGISTRY = IResourceTokenRegistry(registry);
    TOKEN = IERC20(token);
    owner = msg.sender;
  }

  // ─── External functions
  // ───────────────────────────────────────────

  /// @notice Deposit tokens into the temptation contract.
  /// @param amount The amount of tokens to deposit.
  function deposit(uint256 amount) external {
    TOKEN.safeTransferFrom(msg.sender, address(this), amount);
    emit Deposited(msg.sender, amount);
  }

  /// @notice Withdraw tokens. Caller must hold the given permission token.
  /// @param amount The amount of tokens to withdraw.
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
    uint256 bal = TOKEN.balanceOf(address(this));
    if (amount > bal) {
      revert InsufficientBalance(amount, bal);
    }

    // 6. Transfer tokens
    TOKEN.safeTransfer(msg.sender, amount);

    emit Withdrawn(msg.sender, amount, permissionTokenId);
  }

  /// @notice Returns the contract's token balance.
  function balance() external view returns (uint256) {
    return TOKEN.balanceOf(address(this));
  }
}
