// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { TemptationTestBase } from "./TemptationTestBase.sol";

contract Balance_Test is TemptationTestBase {
  function test_Balance_EmptyTemptation() public view {
    assertEq(temptation.balance(), 0);
  }

  function test_Balance_ReturnsETHBalance() public {
    vm.deal(address(temptation), 5 ether);
    assertEq(temptation.balance(), 5 ether);
  }
}
