// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { Temptation } from "../../../src/Temptation.sol";
import { TemptationTestBase } from "./TemptationTestBase.sol";

contract Deposit_Test is TemptationTestBase {
  function test_Deposit_IncreasesBalance() public {
    vm.deal(caller, 1 ether);
    vm.prank(caller);
    temptation.deposit{ value: 1 ether }();

    assertEq(temptation.balance(), 1 ether);
  }

  function test_Deposit_EmitsDepositedEvent() public {
    vm.deal(caller, 1 ether);
    vm.expectEmit(true, false, false, true, address(temptation));
    emit Temptation.Deposited(caller, 1 ether);

    vm.prank(caller);
    temptation.deposit{ value: 1 ether }();
  }

  function test_Deposit_MultipleDepositsAccumulate() public {
    vm.deal(caller, 10 ether);

    vm.startPrank(caller);
    temptation.deposit{ value: 1 ether }();
    temptation.deposit{ value: 2 ether }();
    temptation.deposit{ value: 3 ether }();
    vm.stopPrank();

    assertEq(temptation.balance(), 6 ether);
  }
}
