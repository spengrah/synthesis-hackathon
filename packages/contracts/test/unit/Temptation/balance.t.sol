// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { TemptationTestBase } from "./TemptationTestBase.sol";

contract Balance_Test is TemptationTestBase {
  function test_Balance_EmptyTemptation() public {
    _mockTokenBalance(address(temptation), 0);
    assertEq(temptation.balance(), 0);
  }

  function test_Balance_ReturnsTokenBalance() public {
    _mockTokenBalance(address(temptation), 5_000_000);
    assertEq(temptation.balance(), 5_000_000);
  }
}
