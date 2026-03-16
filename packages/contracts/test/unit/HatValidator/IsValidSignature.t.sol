// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { HatValidatorBase } from "../../Base.t.sol";

contract HatValidator_isValidSignatureWithSender is HatValidatorBase {
  bytes4 internal constant ERC1271_MAGIC_VALUE = 0x1626ba7e;
  bytes4 internal constant ERC1271_FAILURE = 0xffffffff;

  uint256 internal signerKey;
  address internal signer;

  function setUp() public override {
    super.setUp();
    (signer, signerKey) = makeAddrAndKey("signer");
  }

  function test_ReturnFailure_WhenNotInstalled() public {
    bytes32 hash = keccak256("test");
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, hash);
    bytes memory signature = abi.encodePacked(r, s, v);

    address account = makeAddr("account");
    bytes4 result = hatValidator.isValidSignatureWithSender(account, hash, signature);

    assertEq(result, ERC1271_FAILURE);
  }

  function test_ReturnMagicValue_WhenSignerWearsHat() public {
    // Create a hat and mint it to the signer
    (, uint256 signerHatId) = _createSingleHat(signer);

    address account = makeAddr("account");
    bytes memory data = abi.encode(signerHatId);
    vm.prank(account);
    hatValidator.onInstall(data);

    bytes32 hash = keccak256("test");
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, hash);
    bytes memory signature = abi.encodePacked(r, s, v);

    vm.prank(account);
    bytes4 result = hatValidator.isValidSignatureWithSender(account, hash, signature);

    assertEq(result, ERC1271_MAGIC_VALUE);
  }

  function test_ReturnFailure_WhenSignerDoesNotWearHat() public {
    address account = makeAddr("account");
    bytes memory data = abi.encode(testHatId);
    vm.prank(account);
    hatValidator.onInstall(data);

    // signer does not wear testHatId
    bytes32 hash = keccak256("test");
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, hash);
    bytes memory signature = abi.encodePacked(r, s, v);

    vm.prank(account);
    bytes4 result = hatValidator.isValidSignatureWithSender(account, hash, signature);

    assertEq(result, ERC1271_FAILURE);
  }
}
