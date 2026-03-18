// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { Temptation } from "../../../src/Temptation.sol";
import { TemptationTestBase } from "./TemptationTestBase.sol";

contract Receive_Test is TemptationTestBase {
  function test_Receive_AcceptsDirectTransfer() public {
    vm.deal(caller, 1 ether);
    vm.prank(caller);
    (bool success,) = address(temptation).call{ value: 1 ether }("");
    assertTrue(success);
  }

  function test_Receive_IncreasesBalance() public {
    vm.deal(caller, 1 ether);
    vm.prank(caller);
    (bool success,) = address(temptation).call{ value: 1 ether }("");
    assertTrue(success);
    assertEq(temptation.balance(), 1 ether);
  }

  function test_Receive_EmitsDepositedEvent() public {
    vm.deal(caller, 1 ether);
    vm.expectEmit(true, false, false, true, address(temptation));
    emit Temptation.Deposited(caller, 1 ether);

    vm.prank(caller);
    (bool success,) = address(temptation).call{ value: 1 ether }("");
    assertTrue(success);
  }
}
