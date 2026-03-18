// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { TemptationTestBase } from "./TemptationTestBase.sol";

contract Constructor_Test is TemptationTestBase {
  function test_Constructor_SetsRegistry() public view {
    assertEq(address(temptation.REGISTRY()), registry);
  }

  function test_Constructor_SetsOwner() public view {
    assertEq(temptation.owner(), address(this));
  }
}
