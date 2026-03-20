// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { Temptation } from "../../../src/Temptation.sol";
import { TemptationTestBase } from "./TemptationTestBase.sol";

contract Withdraw_Test is TemptationTestBase {
  // ─── Reverts
  // ──────────────────────────────────────────

  function test_RevertIf_NoPermissionToken() public {
    vm.deal(address(temptation), 10 ether);
    _mockBalanceOf(caller, TOKEN_ID, 0);
    _mockTokenMetadata(TOKEN_ID, address(temptation), MAX_AMOUNT);

    vm.expectRevert(Temptation.NoPermissionToken.selector);
    vm.prank(caller);
    temptation.withdraw(1 ether, TOKEN_ID);
  }

  function test_RevertIf_InvalidTemptation() public {
    vm.deal(address(temptation), 10 ether);
    _mockBalanceOf(caller, TOKEN_ID, 1);
    _mockTokenMetadata(TOKEN_ID, otherTemptation, MAX_AMOUNT);

    vm.expectRevert(abi.encodeWithSelector(Temptation.InvalidTemptation.selector, address(temptation), otherTemptation));
    vm.prank(caller);
    temptation.withdraw(1 ether, TOKEN_ID);
  }

  function test_RevertIf_ExceedsPermittedAmount() public {
    vm.deal(address(temptation), 10 ether);
    _mockValidWithdrawal();

    uint256 tooMuch = MAX_AMOUNT + 1;
    vm.expectRevert(abi.encodeWithSelector(Temptation.ExceedsPermittedAmount.selector, tooMuch, MAX_AMOUNT));
    vm.prank(caller);
    temptation.withdraw(tooMuch, TOKEN_ID);
  }

  function test_RevertIf_InsufficientBalance() public {
    vm.deal(address(temptation), 0.5 ether);
    _mockValidWithdrawal();

    vm.expectRevert(abi.encodeWithSelector(Temptation.InsufficientBalance.selector, 1 ether, 0.5 ether));
    vm.prank(caller);
    temptation.withdraw(1 ether, TOKEN_ID);
  }

  function test_RevertIf_TokenIsNotPermissionType() public {
    vm.deal(address(temptation), 10 ether);
    // Responsibility token type = 0x02, so token ID low byte = 0x02
    uint256 responsibilityTokenId = (1 << 8) | 0x02;
    _mockBalanceOf(caller, responsibilityTokenId, 1);

    vm.expectRevert(Temptation.NoPermissionToken.selector);
    vm.prank(caller);
    temptation.withdraw(1 ether, responsibilityTokenId);
  }

  // ─── Happy path
  // ──────────────────────────────────────

  function test_Withdraw_TransfersETH() public {
    vm.deal(address(temptation), 10 ether);
    _mockValidWithdrawal();

    vm.prank(caller);
    temptation.withdraw(1 ether, TOKEN_ID);

    assertEq(caller.balance, 1 ether);
  }

  function test_Withdraw_ReducesTemptationBalance() public {
    vm.deal(address(temptation), 10 ether);
    _mockValidWithdrawal();

    vm.prank(caller);
    temptation.withdraw(1 ether, TOKEN_ID);

    assertEq(temptation.balance(), 9 ether);
  }

  function test_Withdraw_EmitsWithdrawnEvent() public {
    vm.deal(address(temptation), 10 ether);
    _mockValidWithdrawal();

    vm.expectEmit(true, true, false, true, address(temptation));
    emit Temptation.Withdrawn(caller, 1 ether, TOKEN_ID);

    vm.prank(caller);
    temptation.withdraw(1 ether, TOKEN_ID);
  }

  function test_Withdraw_MaxAmount() public {
    vm.deal(address(temptation), 10 ether);
    _mockValidWithdrawal();

    vm.prank(caller);
    temptation.withdraw(MAX_AMOUNT, TOKEN_ID);

    assertEq(temptation.balance(), 5 ether);
    assertEq(caller.balance, MAX_AMOUNT);
  }

  // ─── Expiry enforcement
  // ──────────────────────────────────────

  function test_RevertIf_PermissionExpired() public {
    vm.warp(1000);
    vm.deal(address(temptation), 10 ether);
    _mockBalanceOf(caller, TOKEN_ID, 1);
    _mockTokenMetadataWithExpiry(TOKEN_ID, address(temptation), MAX_AMOUNT, block.timestamp - 1);

    vm.expectRevert(Temptation.PermissionExpired.selector);
    vm.prank(caller);
    temptation.withdraw(1 ether, TOKEN_ID);
  }

  function test_Withdraw_AllowsZeroExpiry() public {
    vm.deal(address(temptation), 10 ether);
    _mockBalanceOf(caller, TOKEN_ID, 1);
    _mockTokenMetadataWithExpiry(TOKEN_ID, address(temptation), MAX_AMOUNT, 0);

    vm.prank(caller);
    temptation.withdraw(1 ether, TOKEN_ID);

    assertEq(caller.balance, 1 ether);
  }

  // ─── Cumulative cap enforcement
  // ──────────────────────────────────────

  function test_RevertIf_CumulativeExceedsMax() public {
    vm.deal(address(temptation), 10 ether);
    _mockValidWithdrawal();

    // First withdrawal: 3 ether (under 5 ether cap)
    vm.prank(caller);
    temptation.withdraw(3 ether, TOKEN_ID);

    // Second withdrawal: 3 ether (cumulative 6 > 5 cap)
    vm.expectRevert(abi.encodeWithSelector(Temptation.ExceedsPermittedAmount.selector, 6 ether, MAX_AMOUNT));
    vm.prank(caller);
    temptation.withdraw(3 ether, TOKEN_ID);
  }

  function test_Withdraw_TracksCumulativeAmount() public {
    vm.deal(address(temptation), 10 ether);
    _mockValidWithdrawal();

    vm.prank(caller);
    temptation.withdraw(2 ether, TOKEN_ID);
    assertEq(temptation.cumulativeWithdrawn(TOKEN_ID), 2 ether);

    vm.prank(caller);
    temptation.withdraw(2 ether, TOKEN_ID);
    assertEq(temptation.cumulativeWithdrawn(TOKEN_ID), 4 ether);
  }
}
