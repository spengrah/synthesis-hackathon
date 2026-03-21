// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { Temptation } from "../../../src/Temptation.sol";
import { TemptationTestBase } from "./TemptationTestBase.sol";

contract Deposit_Test is TemptationTestBase {
  function test_Deposit_TransfersTokens() public {
    uint256 amount = 1_000_000; // 1 USDC
    _mockTransferFrom(caller, address(temptation), amount);
    _mockTokenBalance(address(temptation), amount);

    vm.prank(caller);
    temptation.deposit(amount);

    assertEq(temptation.balance(), amount);
  }

  function test_Deposit_EmitsDepositedEvent() public {
    uint256 amount = 1_000_000;
    _mockTransferFrom(caller, address(temptation), amount);

    vm.expectEmit(true, false, false, true, address(temptation));
    emit Temptation.Deposited(caller, amount);

    vm.prank(caller);
    temptation.deposit(amount);
  }

  function test_Deposit_MultipleDepositsAccumulate() public {
    // Mock transferFrom for each deposit
    _mockTransferFrom(caller, address(temptation), 1_000_000);
    _mockTransferFrom(caller, address(temptation), 2_000_000);
    _mockTransferFrom(caller, address(temptation), 3_000_000);

    vm.startPrank(caller);
    temptation.deposit(1_000_000);
    temptation.deposit(2_000_000);
    temptation.deposit(3_000_000);
    vm.stopPrank();

    // Mock final balance check
    _mockTokenBalance(address(temptation), 6_000_000);
    assertEq(temptation.balance(), 6_000_000);
  }
}
