// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { ResourceTokenRegistryBase } from "../../Base.t.sol";
import {
  IResourceTokenRegistryErrors,
  IResourceTokenRegistryEvents
} from "../../../src/interfaces/IResourceTokenRegistry.sol";
import { Defaults } from "../../helpers/Defaults.sol";

contract Transfer_Test is ResourceTokenRegistryBase {
  function setUp() public override {
    super.setUp();
    _mintDefault(alice, Defaults.PERMISSION_TOKEN_ID);
  }

  // ─── transfer
  // ──────────────────────────────────────────────────────────────

  function test_Transfer_RevertIf_CallerIsNotCreator() public {
    vm.prank(alice);
    vm.expectRevert(IResourceTokenRegistryErrors.NotTokenCreator.selector);
    registry.transfer(bob, Defaults.PERMISSION_TOKEN_ID, 1);
  }

  function test_Transfer_RevertIf_InsufficientBalance() public {
    // minter is creator but has 0 balance for this token
    vm.prank(minter);
    vm.expectRevert(
      abi.encodeWithSelector(
        IResourceTokenRegistryErrors.InsufficientBalance.selector, minter, Defaults.PERMISSION_TOKEN_ID
      )
    );
    registry.transfer(alice, Defaults.PERMISSION_TOKEN_ID, 1);
  }

  function test_Transfer_RevertIf_ReceiverAlreadyHasBalance() public {
    // Minter needs balance to attempt transfer, and bob already has balance
    _mintDefault(minter, Defaults.RESPONSIBILITY_TOKEN_ID);
    _mintDefault(bob, Defaults.RESPONSIBILITY_TOKEN_ID);

    vm.prank(minter);
    vm.expectRevert(IResourceTokenRegistryErrors.BalanceExceedsMax.selector);
    registry.transfer(bob, Defaults.RESPONSIBILITY_TOKEN_ID, 1);
  }

  function test_Transfer_MovesToken() public {
    // creator (minter) calls transfer — but transfer uses msg.sender as the sender
    // so the creator needs to hold the token. Let's mint to minter first.
    _mintDefault(minter, Defaults.RESPONSIBILITY_TOKEN_ID);

    vm.prank(minter);
    registry.transfer(bob, Defaults.RESPONSIBILITY_TOKEN_ID, 1);

    assertEq(registry.balanceOf(minter, Defaults.RESPONSIBILITY_TOKEN_ID), 0);
    assertEq(registry.balanceOf(bob, Defaults.RESPONSIBILITY_TOKEN_ID), 1);
  }

  function test_Transfer_EmitsTransferEvent() public {
    _mintDefault(minter, Defaults.RESPONSIBILITY_TOKEN_ID);

    vm.prank(minter);
    vm.expectEmit(true, true, true, true);
    emit IResourceTokenRegistryEvents.Transfer(minter, minter, bob, Defaults.RESPONSIBILITY_TOKEN_ID, 1);
    registry.transfer(bob, Defaults.RESPONSIBILITY_TOKEN_ID, 1);
  }

  // ─── transferFrom
  // ──────────────────────────────────────────────────────────

  function test_TransferFrom_RevertIf_CallerIsNotCreator() public {
    vm.prank(unauthorized);
    vm.expectRevert(IResourceTokenRegistryErrors.NotTokenCreator.selector);
    registry.transferFrom(alice, bob, Defaults.PERMISSION_TOKEN_ID, 1);
  }

  function test_TransferFrom_RevertIf_InsufficientBalance() public {
    vm.prank(minter);
    vm.expectRevert(
      abi.encodeWithSelector(
        IResourceTokenRegistryErrors.InsufficientBalance.selector, bob, Defaults.PERMISSION_TOKEN_ID
      )
    );
    registry.transferFrom(bob, alice, Defaults.PERMISSION_TOKEN_ID, 1);
  }

  function test_TransferFrom_RevertIf_ReceiverAlreadyHasBalance() public {
    _mintDefault(bob, Defaults.PERMISSION_TOKEN_ID);

    // Now both alice and bob have the token; try to transfer from alice to bob
    vm.prank(minter);
    vm.expectRevert(IResourceTokenRegistryErrors.BalanceExceedsMax.selector);
    registry.transferFrom(alice, bob, Defaults.PERMISSION_TOKEN_ID, 1);
  }

  function test_TransferFrom_MovesToken() public {
    vm.prank(minter);
    registry.transferFrom(alice, bob, Defaults.PERMISSION_TOKEN_ID, 1);

    assertEq(registry.balanceOf(alice, Defaults.PERMISSION_TOKEN_ID), 0);
    assertEq(registry.balanceOf(bob, Defaults.PERMISSION_TOKEN_ID), 1);
  }

  function test_TransferFrom_EmitsTransferEvent() public {
    vm.prank(minter);
    vm.expectEmit(true, true, true, true);
    emit IResourceTokenRegistryEvents.Transfer(minter, alice, bob, Defaults.PERMISSION_TOKEN_ID, 1);
    registry.transferFrom(alice, bob, Defaults.PERMISSION_TOKEN_ID, 1);
  }
}
