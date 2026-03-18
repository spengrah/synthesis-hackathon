// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { Test } from "forge-std/Test.sol";
import { Vault } from "../../src/Vault.sol";
import { IResourceTokenRegistry } from "../../src/interfaces/IResourceTokenRegistry.sol";

contract VaultTest is Test {
  Vault internal vault;
  address internal registry;
  address internal caller;
  address internal otherVault;

  uint256 internal constant TOKEN_ID = 1;
  uint256 internal constant MAX_AMOUNT = 5 ether;

  function setUp() public {
    registry = makeAddr("registry");
    caller = makeAddr("caller");
    otherVault = makeAddr("otherVault");

    vault = new Vault(registry);
  }

  // ─── Helpers
  // ──────────────────────────────────────────────────────

  /// @dev Mock REGISTRY.balanceOf to return `bal` for the given owner+id.
  function _mockBalanceOf(address owner, uint256 id, uint256 bal) internal {
    vm.mockCall(registry, abi.encodeCall(IResourceTokenRegistry.balanceOf, (owner, id)), abi.encode(bal));
  }

  /// @dev Mock REGISTRY.tokenMetadata to return encoded (vaultAddr, maxAmt).
  function _mockTokenMetadata(uint256 id, address vaultAddr, uint256 maxAmt) internal {
    vm.mockCall(
      registry, abi.encodeCall(IResourceTokenRegistry.tokenMetadata, (id)), abi.encode(abi.encode(vaultAddr, maxAmt))
    );
  }

  /// @dev Set up valid mocks for a successful withdrawal.
  function _mockValidWithdrawal() internal {
    _mockBalanceOf(caller, TOKEN_ID, 1);
    _mockTokenMetadata(TOKEN_ID, address(vault), MAX_AMOUNT);
  }

  // ─── deposit
  // ──────────────────────────────────────────────────────

  function test_deposit() public {
    vm.deal(caller, 1 ether);
    vm.prank(caller);
    vault.deposit{ value: 1 ether }();

    assertEq(vault.balance(), 1 ether);
  }

  function test_deposit_emitsEvent() public {
    vm.deal(caller, 1 ether);
    vm.expectEmit(true, false, false, true, address(vault));
    emit Vault.Deposited(caller, 1 ether);

    vm.prank(caller);
    vault.deposit{ value: 1 ether }();
  }

  function test_multipleDeposits() public {
    vm.deal(caller, 10 ether);

    vm.startPrank(caller);
    vault.deposit{ value: 1 ether }();
    vault.deposit{ value: 2 ether }();
    vault.deposit{ value: 3 ether }();
    vm.stopPrank();

    assertEq(vault.balance(), 6 ether);
  }

  // ─── receive
  // ──────────────────────────────────────────────────────

  function test_receive() public {
    vm.deal(caller, 1 ether);
    vm.prank(caller);
    (bool success,) = address(vault).call{ value: 1 ether }("");
    assertTrue(success);
    assertEq(vault.balance(), 1 ether);
  }

  // ─── withdraw happy path
  // ──────────────────────────────────────────

  function test_withdraw() public {
    // Fund vault
    vm.deal(address(vault), 10 ether);

    _mockValidWithdrawal();

    vm.prank(caller);
    vault.withdraw(1 ether, TOKEN_ID);

    assertEq(vault.balance(), 9 ether);
    assertEq(caller.balance, 1 ether);
  }

  function test_withdraw_emitsEvent() public {
    vm.deal(address(vault), 10 ether);
    _mockValidWithdrawal();

    vm.expectEmit(true, true, false, true, address(vault));
    emit Vault.Withdrawn(caller, 1 ether, TOKEN_ID);

    vm.prank(caller);
    vault.withdraw(1 ether, TOKEN_ID);
  }

  function test_withdraw_maxAmount() public {
    vm.deal(address(vault), 10 ether);
    _mockValidWithdrawal();

    vm.prank(caller);
    vault.withdraw(MAX_AMOUNT, TOKEN_ID);

    assertEq(vault.balance(), 5 ether);
    assertEq(caller.balance, MAX_AMOUNT);
  }

  // ─── withdraw reverts: NoPermissionToken
  // ──────────────────────────

  function test_withdraw_revertsWithNoPermissionToken() public {
    vm.deal(address(vault), 10 ether);
    _mockBalanceOf(caller, TOKEN_ID, 0);
    _mockTokenMetadata(TOKEN_ID, address(vault), MAX_AMOUNT);

    vm.expectRevert(Vault.NoPermissionToken.selector);
    vm.prank(caller);
    vault.withdraw(1 ether, TOKEN_ID);
  }

  // ─── withdraw reverts: ExceedsPermittedAmount ─────────────────────

  function test_withdraw_revertsWithExceedsPermittedAmount() public {
    vm.deal(address(vault), 10 ether);
    _mockValidWithdrawal();

    uint256 tooMuch = MAX_AMOUNT + 1;
    vm.expectRevert(abi.encodeWithSelector(Vault.ExceedsPermittedAmount.selector, tooMuch, MAX_AMOUNT));
    vm.prank(caller);
    vault.withdraw(tooMuch, TOKEN_ID);
  }

  // ─── withdraw reverts: InvalidVault
  // ───────────────────────────────

  function test_withdraw_revertsWithInvalidVault() public {
    vm.deal(address(vault), 10 ether);
    _mockBalanceOf(caller, TOKEN_ID, 1);
    _mockTokenMetadata(TOKEN_ID, otherVault, MAX_AMOUNT);

    vm.expectRevert(abi.encodeWithSelector(Vault.InvalidVault.selector, address(vault), otherVault));
    vm.prank(caller);
    vault.withdraw(1 ether, TOKEN_ID);
  }

  // ─── withdraw reverts: InsufficientBalance
  // ────────────────────────

  function test_withdraw_revertsWithInsufficientBalance() public {
    vm.deal(address(vault), 0.5 ether);
    _mockValidWithdrawal();

    vm.expectRevert(abi.encodeWithSelector(Vault.InsufficientBalance.selector, 1 ether, 0.5 ether));
    vm.prank(caller);
    vault.withdraw(1 ether, TOKEN_ID);
  }

  // ─── constructor / state
  // ──────────────────────────────────────────

  function test_constructor() public view {
    assertEq(address(vault.REGISTRY()), registry);
    assertEq(vault.owner(), address(this));
  }

  function test_balance_empty() public view {
    assertEq(vault.balance(), 0);
  }
}
