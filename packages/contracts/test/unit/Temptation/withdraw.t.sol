// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { Temptation } from "../../../src/Temptation.sol";
import { TemptationTestBase } from "./TemptationTestBase.sol";

contract Withdraw_Test is TemptationTestBase {
  // ─── Reverts
  // ──────────────────────────────────────────

  function test_RevertIf_NoPermissionToken() public {
    _mockTokenBalance(address(temptation), 10_000_000);
    _mockBalanceOf(caller, TOKEN_ID, 0);
    _mockTokenMetadata(TOKEN_ID, address(temptation), MAX_AMOUNT);

    vm.expectRevert(Temptation.NoPermissionToken.selector);
    vm.prank(caller);
    temptation.withdraw(1_000_000, TOKEN_ID);
  }

  function test_RevertIf_InvalidTemptation() public {
    _mockTokenBalance(address(temptation), 10_000_000);
    _mockBalanceOf(caller, TOKEN_ID, 1);
    _mockTokenMetadata(TOKEN_ID, otherTemptation, MAX_AMOUNT);

    vm.expectRevert(abi.encodeWithSelector(Temptation.InvalidTemptation.selector, address(temptation), otherTemptation));
    vm.prank(caller);
    temptation.withdraw(1_000_000, TOKEN_ID);
  }

  function test_RevertIf_ExceedsPermittedAmount() public {
    _mockValidWithdrawal(10_000_000);

    uint256 tooMuch = MAX_AMOUNT + 1;
    vm.expectRevert(abi.encodeWithSelector(Temptation.ExceedsPermittedAmount.selector, tooMuch, MAX_AMOUNT));
    vm.prank(caller);
    temptation.withdraw(tooMuch, TOKEN_ID);
  }

  function test_RevertIf_InsufficientBalance() public {
    _mockBalanceOf(caller, TOKEN_ID, 1);
    _mockTokenMetadata(TOKEN_ID, address(temptation), MAX_AMOUNT);
    _mockTokenBalance(address(temptation), 500_000); // 0.5 USDC

    vm.expectRevert(abi.encodeWithSelector(Temptation.InsufficientBalance.selector, 1_000_000, 500_000));
    vm.prank(caller);
    temptation.withdraw(1_000_000, TOKEN_ID);
  }

  function test_RevertIf_TokenIsNotPermissionType() public {
    _mockTokenBalance(address(temptation), 10_000_000);
    // Responsibility token type = 0x02, so token ID low byte = 0x02
    uint256 responsibilityTokenId = (1 << 8) | 0x02;
    _mockBalanceOf(caller, responsibilityTokenId, 1);

    vm.expectRevert(Temptation.NoPermissionToken.selector);
    vm.prank(caller);
    temptation.withdraw(1_000_000, responsibilityTokenId);
  }

  // ─── Happy path
  // ──────────────────────────────────────

  function test_Withdraw_TransfersTokens() public {
    _mockValidWithdrawal(10_000_000);
    _mockTransfer(caller, 1_000_000);

    vm.prank(caller);
    temptation.withdraw(1_000_000, TOKEN_ID);
  }

  function test_Withdraw_ReducesTemptationBalance() public {
    _mockValidWithdrawal(10_000_000);
    _mockTransfer(caller, 1_000_000);

    vm.prank(caller);
    temptation.withdraw(1_000_000, TOKEN_ID);

    _mockTokenBalance(address(temptation), 9_000_000);
    assertEq(temptation.balance(), 9_000_000);
  }

  function test_Withdraw_EmitsWithdrawnEvent() public {
    _mockValidWithdrawal(10_000_000);
    _mockTransfer(caller, 1_000_000);

    vm.expectEmit(true, true, false, true, address(temptation));
    emit Temptation.Withdrawn(caller, 1_000_000, TOKEN_ID);

    vm.prank(caller);
    temptation.withdraw(1_000_000, TOKEN_ID);
  }

  function test_Withdraw_MaxAmount() public {
    _mockValidWithdrawal(10_000_000);
    _mockTransfer(caller, MAX_AMOUNT);

    vm.prank(caller);
    temptation.withdraw(MAX_AMOUNT, TOKEN_ID);

    _mockTokenBalance(address(temptation), 5_000_000);
    assertEq(temptation.balance(), 5_000_000);
  }

  // ─── Expiry enforcement
  // ──────────────────────────────────────

  function test_RevertIf_PermissionExpired() public {
    vm.warp(1000);
    _mockTokenBalance(address(temptation), 10_000_000);
    _mockBalanceOf(caller, TOKEN_ID, 1);
    _mockTokenMetadataWithExpiry(TOKEN_ID, address(temptation), MAX_AMOUNT, block.timestamp - 1);

    vm.expectRevert(Temptation.PermissionExpired.selector);
    vm.prank(caller);
    temptation.withdraw(1_000_000, TOKEN_ID);
  }

  function test_Withdraw_AllowsZeroExpiry() public {
    _mockTokenBalance(address(temptation), 10_000_000);
    _mockBalanceOf(caller, TOKEN_ID, 1);
    _mockTokenMetadataWithExpiry(TOKEN_ID, address(temptation), MAX_AMOUNT, 0);
    _mockTransfer(caller, 1_000_000);

    vm.prank(caller);
    temptation.withdraw(1_000_000, TOKEN_ID);
  }

  // ─── Cumulative cap enforcement
  // ──────────────────────────────────────

  function test_RevertIf_CumulativeExceedsMax() public {
    _mockValidWithdrawal(10_000_000);
    _mockTransfer(caller, 3_000_000);

    // First withdrawal: 3 USDC (under 5 USDC cap)
    vm.prank(caller);
    temptation.withdraw(3_000_000, TOKEN_ID);

    // Second withdrawal: 3 USDC (cumulative 6 > 5 cap)
    vm.expectRevert(abi.encodeWithSelector(Temptation.ExceedsPermittedAmount.selector, 6_000_000, MAX_AMOUNT));
    vm.prank(caller);
    temptation.withdraw(3_000_000, TOKEN_ID);
  }

  function test_Withdraw_TracksCumulativeAmount() public {
    _mockValidWithdrawal(10_000_000);
    _mockTransfer(caller, 2_000_000);

    vm.prank(caller);
    temptation.withdraw(2_000_000, TOKEN_ID);
    assertEq(temptation.cumulativeWithdrawn(TOKEN_ID), 2_000_000);

    vm.prank(caller);
    temptation.withdraw(2_000_000, TOKEN_ID);
    assertEq(temptation.cumulativeWithdrawn(TOKEN_ID), 4_000_000);
  }
}
