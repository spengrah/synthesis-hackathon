// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { Test } from "forge-std/Test.sol";

import { Temptation } from "../../src/Temptation.sol";
import { ResourceTokenRegistry } from "../../src/ResourceTokenRegistry.sol";
import { ERC20Mock } from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/// @notice Integration tests for Temptation contract with a real ResourceTokenRegistry.
///         Permission tokens are minted with real metadata — no vm.mockCall.
contract TemptationIntegrationTest is Test {
  Temptation internal temptation;
  ResourceTokenRegistry internal rtr;
  ERC20Mock internal usdc;

  address internal owner;
  address internal agent; // simulates a TZ account / zone smart account

  uint256 internal constant MAX_WITHDRAWAL = 5_000_000; // 5 USDC (6 decimals)
  uint8 internal constant PERMISSION_TYPE = 0x01;

  function setUp() public {
    owner = makeAddr("owner");
    agent = makeAddr("agent");

    // Deploy mock USDC
    usdc = new ERC20Mock();

    // Deploy RTR with this test contract as owner (so we can register minters)
    vm.prank(owner);
    rtr = new ResourceTokenRegistry(owner);

    // Deploy Temptation with real RTR and token
    vm.prank(owner);
    temptation = new Temptation(address(rtr), address(usdc));

    // Fund the temptation contract with 10 USDC
    usdc.mint(address(temptation), 10_000_000);

    // Register this test contract as a minter (so we can mint permission tokens)
    vm.prank(owner);
    rtr.registerMinter(address(this));
  }

  // ---- Helpers ----

  /// @dev Mint a permission token with standard format metadata to the given holder.
  function _mintTemptationPermission(address holder, address temptationAddr, uint256 maxAmount)
    internal
    returns (uint256 tokenId)
  {
    bytes memory metadata =
      abi.encode("vault-withdraw", maxAmount, bytes32("total"), uint256(0), abi.encode(temptationAddr));
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
    (, uint256 decodedMax,,, bytes memory params) = abi.decode(metadata, (string, uint256, bytes32, uint256, bytes));
    address decodedAddr = abi.decode(params, (address));
    assertEq(decodedAddr, address(temptation));
    assertEq(decodedMax, MAX_WITHDRAWAL);

    // Agent withdraws 1 USDC
    uint256 agentBalBefore = usdc.balanceOf(agent);
    vm.prank(agent);
    temptation.withdraw(1_000_000, tokenId);

    assertEq(usdc.balanceOf(agent), agentBalBefore + 1_000_000);
    assertEq(temptation.balance(), 9_000_000);
  }

  function test_Withdraw_ExactMaxAmount() public {
    uint256 tokenId = _mintTemptationPermission(agent, address(temptation), MAX_WITHDRAWAL);

    vm.prank(agent);
    temptation.withdraw(MAX_WITHDRAWAL, tokenId);

    assertEq(temptation.balance(), 5_000_000);
  }

  // ====================
  // Revert: wrong temptation address in metadata
  // ====================

  function test_RevertIf_TokenMetadataPointsToWrongTemptation() public {
    address wrongTemptation = makeAddr("wrongTemptation");
    uint256 tokenId = _mintTemptationPermission(agent, wrongTemptation, MAX_WITHDRAWAL);

    vm.prank(agent);
    vm.expectRevert(abi.encodeWithSelector(Temptation.InvalidTemptation.selector, address(temptation), wrongTemptation));
    temptation.withdraw(1_000_000, tokenId);
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
    temptation.withdraw(1_000_000, tokenId);
  }

  // ====================
  // Multiple agents, multiple tokens
  // ====================

  function test_MultipleAgents_IndependentPermissions() public {
    address agentA = makeAddr("agentA");
    address agentB = makeAddr("agentB");

    // Different max amounts for different agents
    uint256 tokenA = _mintTemptationPermission(agentA, address(temptation), 2_000_000);
    uint256 tokenB = _mintTemptationPermission(agentB, address(temptation), 3_000_000);

    // Agent A can withdraw up to 2 USDC
    vm.prank(agentA);
    temptation.withdraw(2_000_000, tokenA);

    // Agent B can withdraw up to 3 USDC
    vm.prank(agentB);
    temptation.withdraw(3_000_000, tokenB);

    assertEq(temptation.balance(), 5_000_000); // 10 - 2 - 3

    // Agent A can't use Agent B's token
    vm.prank(agentA);
    vm.expectRevert(Temptation.NoPermissionToken.selector);
    temptation.withdraw(1_000_000, tokenB);
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
    emit Temptation.Withdrawn(agent, 1_000_000, tokenId);

    vm.prank(agent);
    temptation.withdraw(1_000_000, tokenId);
  }
}
