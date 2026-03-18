// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { Test } from "forge-std/Test.sol";

import { Temptation } from "../../src/Temptation.sol";
import { ResourceTokenRegistry } from "../../src/ResourceTokenRegistry.sol";

/// @notice Integration tests for Temptation contract with a real ResourceTokenRegistry.
///         Permission tokens are minted with real metadata — no vm.mockCall.
contract TemptationIntegrationTest is Test {
  Temptation internal temptation;
  ResourceTokenRegistry internal rtr;

  address internal owner;
  address internal agent; // simulates a TZ account / zone smart account

  uint256 internal constant MAX_WITHDRAWAL = 5 ether;
  uint8 internal constant PERMISSION_TYPE = 0x01;

  function setUp() public {
    owner = makeAddr("owner");
    agent = makeAddr("agent");

    // Deploy RTR with this test contract as owner (so we can register minters)
    vm.prank(owner);
    rtr = new ResourceTokenRegistry(owner);

    // Deploy Temptation with real RTR
    vm.prank(owner);
    temptation = new Temptation(address(rtr));

    // Fund the temptation contract
    vm.deal(address(temptation), 10 ether);

    // Register this test contract as a minter (so we can mint permission tokens)
    vm.prank(owner);
    rtr.registerMinter(address(this));
  }

  // ---- Helpers ----

  /// @dev Mint a permission token with temptation metadata to the given holder.
  function _mintTemptationPermission(address holder, address temptationAddr, uint256 maxAmount)
    internal
    returns (uint256 tokenId)
  {
    bytes memory metadata = abi.encode(temptationAddr, maxAmount);
    tokenId = rtr.mint(holder, PERMISSION_TYPE, metadata);
  }

  // ====================
  // Happy path: withdraw with real permission token
  // ====================

  function test_Withdraw_WithRealPermissionToken() public {
    // Mint permission token to agent with correct temptation address and max amount
    uint256 tokenId = _mintTemptationPermission(agent, address(temptation), MAX_WITHDRAWAL);

    // Verify token was minted correctly
    assertEq(rtr.balanceOf(agent, tokenId), 1);
    bytes memory metadata = rtr.tokenMetadata(tokenId);
    (address decodedAddr, uint256 decodedMax) = abi.decode(metadata, (address, uint256));
    assertEq(decodedAddr, address(temptation));
    assertEq(decodedMax, MAX_WITHDRAWAL);

    // Agent withdraws
    uint256 agentBalBefore = agent.balance;
    vm.prank(agent);
    temptation.withdraw(1 ether, tokenId);

    assertEq(agent.balance, agentBalBefore + 1 ether);
    assertEq(temptation.balance(), 9 ether);
  }

  function test_Withdraw_ExactMaxAmount() public {
    uint256 tokenId = _mintTemptationPermission(agent, address(temptation), MAX_WITHDRAWAL);

    vm.prank(agent);
    temptation.withdraw(MAX_WITHDRAWAL, tokenId);

    assertEq(temptation.balance(), 5 ether);
  }

  // ====================
  // Revert: wrong temptation address in metadata
  // ====================

  function test_RevertIf_TokenMetadataPointsToWrongTemptation() public {
    address wrongTemptation = makeAddr("wrongTemptation");
    uint256 tokenId = _mintTemptationPermission(agent, wrongTemptation, MAX_WITHDRAWAL);

    vm.prank(agent);
    vm.expectRevert(abi.encodeWithSelector(Temptation.InvalidTemptation.selector, address(temptation), wrongTemptation));
    temptation.withdraw(1 ether, tokenId);
  }

  // ====================
  // Revert: exceeds max amount from real metadata
  // ====================

  function test_RevertIf_ExceedsMaxFromRealMetadata() public {
    uint256 tokenId = _mintTemptationPermission(agent, address(temptation), MAX_WITHDRAWAL);

    vm.prank(agent);
    vm.expectRevert(
      abi.encodeWithSelector(Temptation.ExceedsPermittedAmount.selector, MAX_WITHDRAWAL + 1, MAX_WITHDRAWAL)
    );
    temptation.withdraw(MAX_WITHDRAWAL + 1, tokenId);
  }

  // ====================
  // Revert: caller doesn't hold the token
  // ====================

  function test_RevertIf_CallerDoesNotHoldToken() public {
    // Mint to agent, but call from a different address
    uint256 tokenId = _mintTemptationPermission(agent, address(temptation), MAX_WITHDRAWAL);
    address stranger = makeAddr("stranger");

    vm.prank(stranger);
    vm.expectRevert(Temptation.NoPermissionToken.selector);
    temptation.withdraw(1 ether, tokenId);
  }

  // ====================
  // Multiple agents, multiple tokens
  // ====================

  function test_MultipleAgents_IndependentPermissions() public {
    address agentA = makeAddr("agentA");
    address agentB = makeAddr("agentB");

    // Different max amounts for different agents
    uint256 tokenA = _mintTemptationPermission(agentA, address(temptation), 2 ether);
    uint256 tokenB = _mintTemptationPermission(agentB, address(temptation), 3 ether);

    // Agent A can withdraw up to 2 ETH
    vm.prank(agentA);
    temptation.withdraw(2 ether, tokenA);

    // Agent B can withdraw up to 3 ETH
    vm.prank(agentB);
    temptation.withdraw(3 ether, tokenB);

    assertEq(temptation.balance(), 5 ether); // 10 - 2 - 3

    // Agent A can't use Agent B's token
    vm.prank(agentA);
    vm.expectRevert(Temptation.NoPermissionToken.selector);
    temptation.withdraw(1 ether, tokenB);
  }

  // ====================
  // Edge case: zero max amount
  // ====================

  function test_RevertIf_ZeroMaxAmount_AnyWithdrawal() public {
    uint256 tokenId = _mintTemptationPermission(agent, address(temptation), 0);

    vm.prank(agent);
    vm.expectRevert(abi.encodeWithSelector(Temptation.ExceedsPermittedAmount.selector, 1, 0));
    temptation.withdraw(1, tokenId);
  }

  function test_ZeroMaxAmount_ZeroWithdrawal() public {
    uint256 tokenId = _mintTemptationPermission(agent, address(temptation), 0);

    // Withdrawing 0 should succeed (0 <= 0)
    vm.prank(agent);
    temptation.withdraw(0, tokenId);
  }

  // ====================
  // Events with real tokens
  // ====================

  function test_Withdraw_EmitsEventWithRealTokenId() public {
    uint256 tokenId = _mintTemptationPermission(agent, address(temptation), MAX_WITHDRAWAL);

    vm.expectEmit(true, true, false, true, address(temptation));
    emit Temptation.Withdrawn(agent, 1 ether, tokenId);

    vm.prank(agent);
    temptation.withdraw(1 ether, tokenId);
  }
}
