// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.28;

import { IResourceTokenRegistry } from "./interfaces/IResourceTokenRegistry.sol";

contract ResourceTokenRegistry is IResourceTokenRegistry {
  mapping(address owner => mapping(uint256 id => uint256)) internal _balances;
  mapping(uint256 id => address) public creator;
  mapping(uint256 id => bytes) internal _metadata;
  mapping(address => bool) public isMinter;
  address public owner;

  constructor(address _owner) {
    owner = _owner;
  }

  // ─── ERC-6909 reads
  // ──────────────────────────────────────────────────────────

  function balanceOf(address _owner, uint256 id) external view returns (uint256) {
    return _balances[_owner][id];
  }

  function allowance(address, address, uint256) external pure returns (uint256) {
    return 0;
  }

  function isOperator(address, address) external pure returns (bool) {
    return false;
  }

  // ─── ERC-6909 writes (restricted)
  // ────────────────────────────────────────────

  function transfer(address receiver, uint256 id, uint256 amount) external returns (bool) {
    if (msg.sender != creator[id]) revert NotTokenCreator();
    if (_balances[msg.sender][id] < amount) revert InsufficientBalance(msg.sender, id);
    if (_balances[receiver][id] + amount > 1) revert BalanceExceedsMax();

    _balances[msg.sender][id] -= amount;
    _balances[receiver][id] += amount;

    emit Transfer(msg.sender, msg.sender, receiver, id, amount);
    return true;
  }

  function transferFrom(address sender, address receiver, uint256 id, uint256 amount) external returns (bool) {
    if (msg.sender != creator[id]) revert NotTokenCreator();
    if (_balances[sender][id] < amount) revert InsufficientBalance(sender, id);
    if (_balances[receiver][id] + amount > 1) revert BalanceExceedsMax();

    _balances[sender][id] -= amount;
    _balances[receiver][id] += amount;

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

  function mint(address to, uint256 id, bytes calldata metadata) external {
    if (!isMinter[msg.sender]) revert NotAuthorizedMinter();
    if (_balances[to][id] != 0) revert BalanceExceedsMax();

    if (creator[id] == address(0)) {
      // First mint of this token ID — set creator and metadata permanently
      creator[id] = msg.sender;
      _metadata[id] = metadata;
      emit TokenCreated(id, msg.sender, metadata);
    }

    _balances[to][id] = 1;
    emit Transfer(msg.sender, address(0), to, id, 1);
  }

  function burn(address from, uint256 id) external {
    if (msg.sender != creator[id]) revert NotTokenCreator();
    if (_balances[from][id] == 0) revert InsufficientBalance(from, id);

    _balances[from][id] = 0;
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
