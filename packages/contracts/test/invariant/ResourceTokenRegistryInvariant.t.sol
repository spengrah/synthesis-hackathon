// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { StdInvariant } from "forge-std/StdInvariant.sol";
import { Test } from "forge-std/Test.sol";

import { ResourceTokenRegistryBase } from "../Base.t.sol";
import { ResourceTokenRegistry } from "../../src/ResourceTokenRegistry.sol";

contract ResourceTokenRegistryInvariantHandler is Test {
  ResourceTokenRegistry internal registry;
  address internal owner;

  address[] internal _actors;
  address[] internal _knownMinters;
  mapping(address actor => bool) internal _isKnownMinter;

  uint256[] internal _trackedIds;
  address[] internal _trackedCreators;
  bytes32[] internal _trackedMetadataHashes;
  address[] internal _trackedHolders;

  bool internal _sawLastIdDecrease;
  bool internal _sawUnauthorizedMutationSuccess;
  bool internal _sawApprovalUnexpectedSuccess;

  uint256[4] internal _lastSeenIdByType;

  constructor(
    ResourceTokenRegistry _registry,
    address _owner,
    address _minter,
    address _alice,
    address _bob,
    address _unauthorized
  ) {
    registry = _registry;
    owner = _owner;

    _actors.push(_owner);
    _actors.push(_minter);
    _actors.push(_alice);
    _actors.push(_bob);
    _actors.push(_unauthorized);

    _trackMinter(_minter);
    _captureLastIds();
  }

  function registerMinter(uint8 actorSeed) external {
    address actor = _actorFromSeed(actorSeed);

    vm.prank(owner);
    try registry.registerMinter(actor) {
      _trackMinter(actor);
    } catch { }

    _captureLastIds();
  }

  function mint(uint8 minterSeed, uint8 tokenTypeSeed, uint8 recipientSeed) external {
    address chosenMinter = _knownMinters[minterSeed % _knownMinters.length];
    uint8 tokenType = uint8(bound(uint256(tokenTypeSeed), 1, 3));
    address recipient = _actorFromSeed(recipientSeed);
    bytes memory metadata = abi.encode("invariant-metadata", chosenMinter, tokenType, _trackedIds.length);

    vm.prank(chosenMinter);
    try registry.mint(recipient, tokenType, metadata) returns (uint256 id) {
      _trackedIds.push(id);
      _trackedCreators.push(chosenMinter);
      _trackedMetadataHashes.push(keccak256(metadata));
      _trackedHolders.push(recipient);
    } catch { }

    _captureLastIds();
  }

  function transfer(uint256 trackedIndexSeed, uint8 receiverSeed) external {
    if (_trackedIds.length == 0) return;

    uint256 trackedIndex = trackedIndexSeed % _trackedIds.length;
    uint256 id = _trackedIds[trackedIndex];
    address holder = _trackedHolders[trackedIndex];
    address receiver = _actorFromSeed(receiverSeed);

    if (holder == address(0) || receiver == holder) return;

    vm.prank(_trackedCreators[trackedIndex]);
    try registry.transfer(receiver, id, 1) {
      _trackedHolders[trackedIndex] = receiver;
    } catch { }

    _captureLastIds();
  }

  function transferFrom(uint256 trackedIndexSeed, uint8 receiverSeed) external {
    if (_trackedIds.length == 0) return;

    uint256 trackedIndex = trackedIndexSeed % _trackedIds.length;
    uint256 id = _trackedIds[trackedIndex];
    address holder = _trackedHolders[trackedIndex];
    address receiver = _actorFromSeed(receiverSeed);

    if (holder == address(0) || receiver == holder) return;

    vm.prank(_trackedCreators[trackedIndex]);
    try registry.transferFrom(holder, receiver, id, 1) {
      _trackedHolders[trackedIndex] = receiver;
    } catch { }

    _captureLastIds();
  }

  function burn(uint256 trackedIndexSeed) external {
    if (_trackedIds.length == 0) return;

    uint256 trackedIndex = trackedIndexSeed % _trackedIds.length;
    uint256 id = _trackedIds[trackedIndex];
    address holder = _trackedHolders[trackedIndex];

    if (holder == address(0)) return;

    vm.prank(_trackedCreators[trackedIndex]);
    try registry.burn(holder, id) {
      _trackedHolders[trackedIndex] = address(0);
    } catch { }

    _captureLastIds();
  }

  function attemptUnauthorizedTransfer(uint256 trackedIndexSeed, uint8 receiverSeed) external {
    if (_trackedIds.length == 0) return;

    uint256 trackedIndex = trackedIndexSeed % _trackedIds.length;
    uint256 id = _trackedIds[trackedIndex];
    address receiver = _actorFromSeed(receiverSeed);
    address unauthorized = _actors[_actors.length - 1];

    vm.prank(unauthorized);
    try registry.transfer(receiver, id, 1) {
      _sawUnauthorizedMutationSuccess = true;
    } catch { }

    _captureLastIds();
  }

  function attemptUnauthorizedBurn(uint256 trackedIndexSeed) external {
    if (_trackedIds.length == 0) return;

    uint256 trackedIndex = trackedIndexSeed % _trackedIds.length;
    uint256 id = _trackedIds[trackedIndex];
    address holder = _trackedHolders[trackedIndex];
    address unauthorized = _actors[_actors.length - 1];

    vm.prank(unauthorized);
    try registry.burn(holder, id) {
      _sawUnauthorizedMutationSuccess = true;
    } catch { }

    _captureLastIds();
  }

  function attemptApprove(uint8 actorSeed, uint256 trackedIndexSeed, uint256 amount) external {
    address actor = _actorFromSeed(actorSeed);
    uint256 id = _trackedIds.length == 0 ? 1 : _trackedIds[trackedIndexSeed % _trackedIds.length];

    vm.prank(actor);
    try registry.approve(owner, id, amount) {
      _sawApprovalUnexpectedSuccess = true;
    } catch { }
  }

  function attemptSetOperator(uint8 actorSeed, bool approved) external {
    address actor = _actorFromSeed(actorSeed);

    vm.prank(actor);
    try registry.setOperator(owner, approved) {
      _sawApprovalUnexpectedSuccess = true;
    } catch { }
  }

  function trackedCount() external view returns (uint256) {
    return _trackedIds.length;
  }

  function trackedId(uint256 index) external view returns (uint256) {
    return _trackedIds[index];
  }

  function trackedCreator(uint256 index) external view returns (address) {
    return _trackedCreators[index];
  }

  function trackedMetadataHash(uint256 index) external view returns (bytes32) {
    return _trackedMetadataHashes[index];
  }

  function trackedHolder(uint256 index) external view returns (address) {
    return _trackedHolders[index];
  }

  function actorCount() external view returns (uint256) {
    return _actors.length;
  }

  function actor(uint256 index) external view returns (address) {
    return _actors[index];
  }

  function knownMinterCount() external view returns (uint256) {
    return _knownMinters.length;
  }

  function knownMinter(uint256 index) external view returns (address) {
    return _knownMinters[index];
  }

  function sawLastIdDecrease() external view returns (bool) {
    return _sawLastIdDecrease;
  }

  function sawUnauthorizedMutationSuccess() external view returns (bool) {
    return _sawUnauthorizedMutationSuccess;
  }

  function sawApprovalUnexpectedSuccess() external view returns (bool) {
    return _sawApprovalUnexpectedSuccess;
  }

  function _trackMinter(address actor) internal {
    if (_isKnownMinter[actor]) return;
    _isKnownMinter[actor] = true;
    _knownMinters.push(actor);
  }

  function _actorFromSeed(uint8 seed) internal view returns (address) {
    return _actors[seed % _actors.length];
  }

  function _captureLastIds() internal {
    for (uint8 tokenType = 1; tokenType <= 3; tokenType++) {
      uint256 current = registry.lastId(tokenType);
      if (current < _lastSeenIdByType[tokenType]) {
        _sawLastIdDecrease = true;
      }
      _lastSeenIdByType[tokenType] = current;
    }
  }
}

contract ResourceTokenRegistry_Invariants is StdInvariant, ResourceTokenRegistryBase {
  ResourceTokenRegistryInvariantHandler internal handler;

  function setUp() public override {
    super.setUp();

    handler = new ResourceTokenRegistryInvariantHandler(registry, registryOwner, minter, alice, bob, unauthorized);

    _targetKnownSenders();
    targetContract(address(handler));

    bytes4[] memory selectors = new bytes4[](8);
    selectors[0] = ResourceTokenRegistryInvariantHandler.registerMinter.selector;
    selectors[1] = ResourceTokenRegistryInvariantHandler.mint.selector;
    selectors[2] = ResourceTokenRegistryInvariantHandler.transfer.selector;
    selectors[3] = ResourceTokenRegistryInvariantHandler.transferFrom.selector;
    selectors[4] = ResourceTokenRegistryInvariantHandler.burn.selector;
    selectors[5] = ResourceTokenRegistryInvariantHandler.attemptUnauthorizedTransfer.selector;
    selectors[6] = ResourceTokenRegistryInvariantHandler.attemptUnauthorizedBurn.selector;
    selectors[7] = ResourceTokenRegistryInvariantHandler.attemptApprove.selector;
    targetSelector(FuzzSelector({ addr: address(handler), selectors: selectors }));

    bytes4[] memory extraSelectors = new bytes4[](1);
    extraSelectors[0] = ResourceTokenRegistryInvariantHandler.attemptSetOperator.selector;
    targetSelector(FuzzSelector({ addr: address(handler), selectors: extraSelectors }));
  }

  function _targetKnownSenders() internal {
    uint256 actorCount = handler.actorCount();
    for (uint256 i = 0; i < actorCount; i++) {
      targetSender(handler.actor(i));
    }
  }

  function invariant_BalancePerHolderPerIdIsBinary() public view {
    uint256 trackedCount = handler.trackedCount();
    uint256 actorCount = handler.actorCount();

    for (uint256 i = 0; i < trackedCount; i++) {
      uint256 id = handler.trackedId(i);
      for (uint256 j = 0; j < actorCount; j++) {
        uint256 balance = registry.balanceOf(handler.actor(j), id);
        assertTrue(balance == 0 || balance == 1, "balance escaped binary semantics");
      }
    }
  }

  function invariant_AtMostOneHolderExistsPerTokenId() public view {
    uint256 trackedCount = handler.trackedCount();
    uint256 actorCount = handler.actorCount();

    for (uint256 i = 0; i < trackedCount; i++) {
      uint256 id = handler.trackedId(i);
      uint256 holders;
      for (uint256 j = 0; j < actorCount; j++) {
        holders += registry.balanceOf(handler.actor(j), id);
      }
      assertLe(holders, 1, "multiple holders observed for the same token ID");
    }
  }

  function invariant_TokenIdEncodingMatchesHelpers() public view {
    uint256 trackedCount = handler.trackedCount();
    for (uint256 i = 0; i < trackedCount; i++) {
      uint256 id = handler.trackedId(i);
      uint8 tokenType = registry.tokenType(id);

      assertEq(tokenType, uint8(id & 0xFF), "tokenType no longer matches low-byte encoding");

      uint256 helperTruths;
      if (registry.isPermission(id)) helperTruths++;
      if (registry.isResponsibility(id)) helperTruths++;
      if (registry.isDirective(id)) helperTruths++;

      assertEq(helperTruths, 1, "token helper methods drifted out of mutual exclusivity");
    }
  }

  function invariant_CreatorIsImmutableAfterMint() public view {
    uint256 trackedCount = handler.trackedCount();
    for (uint256 i = 0; i < trackedCount; i++) {
      assertEq(registry.creator(handler.trackedId(i)), handler.trackedCreator(i), "creator mutated after mint");
    }
  }

  function invariant_MetadataIsImmutableAfterMint() public view {
    uint256 trackedCount = handler.trackedCount();
    for (uint256 i = 0; i < trackedCount; i++) {
      assertEq(
        keccak256(registry.tokenMetadata(handler.trackedId(i))),
        handler.trackedMetadataHash(i),
        "metadata mutated after mint"
      );
    }
  }

  function invariant_TransferPreservesCreatorAndMetadata() public view {
    uint256 trackedCount = handler.trackedCount();
    for (uint256 i = 0; i < trackedCount; i++) {
      uint256 id = handler.trackedId(i);
      assertEq(registry.creator(id), handler.trackedCreator(i), "transfer changed creator");
      assertEq(keccak256(registry.tokenMetadata(id)), handler.trackedMetadataHash(i), "transfer changed metadata");
    }
  }

  function invariant_BurnClearsPossessionButNotIdentity() public view {
    uint256 trackedCount = handler.trackedCount();
    uint256 actorCount = handler.actorCount();

    for (uint256 i = 0; i < trackedCount; i++) {
      uint256 id = handler.trackedId(i);
      if (handler.trackedHolder(i) != address(0)) continue;

      uint256 liveHolders;
      for (uint256 j = 0; j < actorCount; j++) {
        liveHolders += registry.balanceOf(handler.actor(j), id);
      }

      assertEq(liveHolders, 0, "burned token still had a holder");
      assertEq(registry.creator(id), handler.trackedCreator(i), "burn changed creator");
      assertEq(keccak256(registry.tokenMetadata(id)), handler.trackedMetadataHash(i), "burn changed metadata");
    }
  }

  function invariant_LastIdCountersAreMonotonic() public view {
    assertFalse(handler.sawLastIdDecrease(), "lastId counter decreased");
  }

  function invariant_IsMinterIsMonotonic() public view {
    uint256 minterCount = handler.knownMinterCount();
    for (uint256 i = 0; i < minterCount; i++) {
      assertTrue(registry.isMinter(handler.knownMinter(i)), "registered minter lost authorization");
    }
  }

  function invariant_OwnerIsImmutable() public view {
    assertEq(registry.owner(), registryOwner, "registry owner changed");
  }

  function invariant_NonCreatorsCannotMoveOrBurn() public view {
    assertFalse(handler.sawUnauthorizedMutationSuccess(), "non-creator mutation unexpectedly succeeded");
  }

  function invariant_ApprovalsSurfaceIsStateless() public view {
    assertFalse(handler.sawApprovalUnexpectedSuccess(), "approval surface unexpectedly succeeded");
    assertEq(registry.allowance(alice, bob, 1), 0, "allowance read stopped being a hard zero");
    assertFalse(registry.isOperator(alice, bob), "isOperator stopped being a hard false");
  }
}
