// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { ResourceTokenRegistryBase } from "../../Base.t.sol";
import { IResourceTokenRegistryErrors } from "../../../src/interfaces/IResourceTokenRegistry.sol";

contract Approve_Test is ResourceTokenRegistryBase {
  function test_Approve_RevertsWithApprovalsDisabled() public {
    vm.prank(alice);
    vm.expectRevert(IResourceTokenRegistryErrors.ApprovalsDisabled.selector);
    registry.approve(bob, 1, 1);
  }

  function test_SetOperator_RevertsWithApprovalsDisabled() public {
    vm.prank(alice);
    vm.expectRevert(IResourceTokenRegistryErrors.ApprovalsDisabled.selector);
    registry.setOperator(bob, true);
  }

  function testFuzz_Approve_AlwaysReverts(address spender, uint256 id, uint256 amount) public {
    vm.prank(alice);
    vm.expectRevert(IResourceTokenRegistryErrors.ApprovalsDisabled.selector);
    registry.approve(spender, id, amount);
  }

  function testFuzz_SetOperator_AlwaysReverts(address operator, bool approved) public {
    vm.prank(alice);
    vm.expectRevert(IResourceTokenRegistryErrors.ApprovalsDisabled.selector);
    registry.setOperator(operator, approved);
  }

  function test_Allowance_AlwaysReturnsZero() public view {
    assertEq(registry.allowance(alice, bob, 1), 0);
  }

  function test_IsOperator_AlwaysReturnsFalse() public view {
    assertFalse(registry.isOperator(alice, bob));
  }
}
