// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.28;

import { IResourceTokenRegistry } from "./interfaces/IResourceTokenRegistry.sol";

contract ResourceTokenRegistry is IResourceTokenRegistry {
  // ─── Storage
  // ───────────────────────────────────────────────────────────────

  /// @dev Balance is always 0 or 1, so bool is sufficient.
  mapping(address holder => mapping(uint256 id => bool)) internal _held;
  mapping(uint256 id => address) public creator;
  mapping(uint256 id => bytes) internal _metadata;
  mapping(address => bool) public isMinter;
  mapping(uint8 => uint256) public lastId;
  address public owner;

  constructor(address _owner) {
    owner = _owner;
  }

  // ─── Internal checks
  // ──────────────────────────────────────────────────────

  function _checkIsMinter() internal view {
    if (!isMinter[msg.sender]) revert NotAuthorizedMinter();
  }

  function _checkIsCreator(uint256 id) internal view {
    if (msg.sender != creator[id]) revert NotTokenCreator();
  }

  function _checkIsHeld(address holder, uint256 id) internal view {
    if (!_held[holder][id]) revert InsufficientBalance(holder, id);
  }

  function _checkNotHeld(address holder, uint256 id) internal view {
    if (_held[holder][id]) revert BalanceExceedsMax();
  }

  function _checkValidTokenType(uint8 _tokenType) internal pure {
    if (_tokenType < 0x01 || _tokenType > 0x03) revert InvalidTokenType(_tokenType);
  }

  // ─── ERC-6909 reads
  // ────────────────────────────────────────────────────────

  function balanceOf(address _owner, uint256 id) external view returns (uint256) {
    return _held[_owner][id] ? 1 : 0;
  }

  function allowance(address, address, uint256) external pure returns (uint256) {
    return 0;
  }

  function isOperator(address, address) external pure returns (bool) {
    return false;
  }

  // ─── ERC-6909 writes (restricted)
  // ──────────────────────────────────────────

  function transfer(address receiver, uint256 id, uint256 amount) external returns (bool) {
    _checkIsCreator(id);
    _checkIsHeld(msg.sender, id);
    _checkNotHeld(receiver, id);

    _held[msg.sender][id] = false;
    _held[receiver][id] = true;

    emit Transfer(msg.sender, msg.sender, receiver, id, amount);
    return true;
  }

  function transferFrom(address sender, address receiver, uint256 id, uint256 amount) external returns (bool) {
    _checkIsCreator(id);
    _checkIsHeld(sender, id);
    _checkNotHeld(receiver, id);

    _held[sender][id] = false;
    _held[receiver][id] = true;

    emit Transfer(msg.sender, sender, receiver, id, amount);
    return true;
  }

  function approve(address, uint256, uint256) external pure returns (bool) {
    revert ApprovalsDisabled();
  }

  function setOperator(address, bool) external pure returns (bool) {
    revert ApprovalsDisabled();
  }

  // ─── Minting / burning
  // ─────────────────────────────────────────────────────

  function mint(address to, uint8 _tokenType, bytes calldata metadata) external returns (uint256 id) {
    _checkIsMinter();
    _checkValidTokenType(_tokenType);

    // Auto-generate token ID: (++counter << 8) | typePrefix
    id = (++lastId[_tokenType] << 8) | _tokenType;

    _checkNotHeld(to, id);

    creator[id] = msg.sender;
    _metadata[id] = metadata;
    _held[to][id] = true;

    emit TokenCreated(id, msg.sender, _tokenType, metadata);
    emit Transfer(msg.sender, address(0), to, id, 1);
  }

  function burn(address from, uint256 id) external {
    _checkIsCreator(id);
    _checkIsHeld(from, id);

    _held[from][id] = false;
    emit Transfer(msg.sender, from, address(0), id, 1);
  }

  // ─── Minter registration
  // ──────────────────────────────────────────────────

  function registerMinter(address minterAddr) external {
    if (msg.sender != owner) revert NotOwner();
    isMinter[minterAddr] = true;
    emit MinterRegistered(minterAddr);
  }

  // ─── Metadata reads
  // ────────────────────────────────────────────────────────

  function tokenMetadata(uint256 id) external view returns (bytes memory) {
    return _metadata[id];
  }

  // ─── Token type helpers
  // ────────────────────────────────────────────────────

  function tokenType(uint256 id) external pure returns (uint8) {
    return uint8(id & 0xFF);
  }

  function isPermission(uint256 id) external pure returns (bool) {
    return uint8(id & 0xFF) == 0x01;
  }

  function isResponsibility(uint256 id) external pure returns (bool) {
    return uint8(id & 0xFF) == 0x02;
  }

  function isDirective(uint256 id) external pure returns (bool) {
    return uint8(id & 0xFF) == 0x03;
  }
}
