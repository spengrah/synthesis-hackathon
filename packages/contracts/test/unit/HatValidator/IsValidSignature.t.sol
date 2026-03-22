// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { HatValidatorBase } from "../../Base.t.sol";
import { MockERC1271Signer, MockERC1271InvalidSigner } from "../../mocks/MockERC1271Signer.sol";

contract HatValidator_isValidSignatureWithSender is HatValidatorBase {
  bytes4 internal constant ERC1271_MAGIC_VALUE = 0x1626ba7e;
  bytes4 internal constant ERC1271_FAILURE = 0xffffffff;

  uint256 internal signerKey;
  address internal signer;

  function setUp() public override {
    super.setUp();
    (signer, signerKey) = makeAddrAndKey("signer");
  }

  // ---- EOA signer tests (existing behavior) ----

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

  // ---- Contract signer tests (EIP-1271 fallback) ----

  function test_ReturnMagicValue_WhenContractSignerWearsHatAndReturnsValidMagic() public {
    MockERC1271Signer contractSigner = new MockERC1271Signer();
    (, uint256 signerHatId) = _createSingleHat(address(contractSigner));

    address account = makeAddr("account");
    vm.prank(account);
    hatValidator.onInstall(abi.encode(signerHatId));

    bytes32 hash = keccak256("test");
    bytes memory innerSignature = hex"deadbeef";
    bytes memory signature = abi.encodePacked(address(contractSigner), innerSignature);

    vm.prank(account);
    bytes4 result = hatValidator.isValidSignatureWithSender(account, hash, signature);

    assertEq(result, ERC1271_MAGIC_VALUE);
  }

  function test_ReturnFailure_WhenContractSignerDoesNotWearHat() public {
    MockERC1271Signer contractSigner = new MockERC1271Signer();

    address account = makeAddr("account");
    vm.prank(account);
    hatValidator.onInstall(abi.encode(testHatId));

    bytes32 hash = keccak256("test");
    bytes memory innerSignature = hex"deadbeef";
    bytes memory signature = abi.encodePacked(address(contractSigner), innerSignature);

    vm.prank(account);
    bytes4 result = hatValidator.isValidSignatureWithSender(account, hash, signature);

    assertEq(result, ERC1271_FAILURE);
  }

  function test_ReturnFailure_WhenContractSignerReturnsInvalidMagic() public {
    MockERC1271InvalidSigner contractSigner = new MockERC1271InvalidSigner();
    (, uint256 signerHatId) = _createSingleHat(address(contractSigner));

    address account = makeAddr("account");
    vm.prank(account);
    hatValidator.onInstall(abi.encode(signerHatId));

    bytes32 hash = keccak256("test");
    bytes memory innerSignature = hex"deadbeef";
    bytes memory signature = abi.encodePacked(address(contractSigner), innerSignature);

    vm.prank(account);
    bytes4 result = hatValidator.isValidSignatureWithSender(account, hash, signature);

    assertEq(result, ERC1271_FAILURE);
  }

  function test_ReturnFailure_WhenSignerAddressIsNotContract() public {
    address fakeContractSigner = makeAddr("fakeContractSigner");
    (, uint256 signerHatId) = _createSingleHat(fakeContractSigner);

    address account = makeAddr("account");
    vm.prank(account);
    hatValidator.onInstall(abi.encode(signerHatId));

    bytes32 hash = keccak256("test");
    bytes memory innerSignature = hex"deadbeef";
    bytes memory signature = abi.encodePacked(fakeContractSigner, innerSignature);

    vm.prank(account);
    bytes4 result = hatValidator.isValidSignatureWithSender(account, hash, signature);

    assertEq(result, ERC1271_FAILURE);
  }

  function test_ReturnFailure_WhenSignatureTooShortForAddress() public {
    address account = makeAddr("account");
    vm.prank(account);
    hatValidator.onInstall(abi.encode(testHatId));

    bytes32 hash = keccak256("test");
    // 19 bytes — too short for a 20-byte address prefix
    bytes memory signature = hex"01020304050607080910111213141516171819";

    vm.prank(account);
    bytes4 result = hatValidator.isValidSignatureWithSender(account, hash, signature);

    assertEq(result, ERC1271_FAILURE);
  }
}
