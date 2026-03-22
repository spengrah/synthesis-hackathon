// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { HatValidatorBase } from "../../Base.t.sol";
import { PackedUserOperation } from "@openzeppelin/contracts/interfaces/draft-IERC4337.sol";
import { VALIDATION_SUCCESS, VALIDATION_FAILED } from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";
import { MockERC1271Signer, MockERC1271InvalidSigner } from "../../mocks/MockERC1271Signer.sol";

contract HatValidator_validateUserOp is HatValidatorBase {
  uint256 internal signerKey;
  address internal signer;

  function setUp() public override {
    super.setUp();
    (signer, signerKey) = makeAddrAndKey("signer");
  }

  function _buildUserOp(bytes memory signature) internal pure returns (PackedUserOperation memory) {
    return PackedUserOperation({
      sender: address(0),
      nonce: 0,
      initCode: "",
      callData: "",
      accountGasLimits: bytes32(0),
      preVerificationGas: 0,
      gasFees: bytes32(0),
      paymasterAndData: "",
      signature: signature
    });
  }

  // ---- EOA signer tests (existing behavior) ----

  function test_ReturnValidationFailed_WhenNotInstalled() public {
    bytes32 userOpHash = keccak256("test");
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, userOpHash);
    PackedUserOperation memory userOp = _buildUserOp(abi.encodePacked(r, s, v));

    address account = makeAddr("account");
    vm.prank(account);
    uint256 result = hatValidator.validateUserOp(userOp, userOpHash);

    assertEq(result, VALIDATION_FAILED);
  }

  function test_ReturnSuccess_WhenSignerWearsHat() public {
    // Create a hat and mint it to the signer
    (, uint256 signerHatId) = _createSingleHat(signer);

    address account = makeAddr("account");
    bytes memory data = abi.encode(signerHatId);
    vm.prank(account);
    hatValidator.onInstall(data);

    bytes32 userOpHash = keccak256("test");
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, userOpHash);
    PackedUserOperation memory userOp = _buildUserOp(abi.encodePacked(r, s, v));

    vm.prank(account);
    uint256 result = hatValidator.validateUserOp(userOp, userOpHash);

    assertEq(result, VALIDATION_SUCCESS);
  }

  function test_ReturnValidationFailed_WhenSignerDoesNotWearHat() public {
    address account = makeAddr("account");
    bytes memory data = abi.encode(testHatId);
    vm.prank(account);
    hatValidator.onInstall(data);

    // signer does not wear testHatId (hatWearerA does)
    bytes32 userOpHash = keccak256("test");
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, userOpHash);
    PackedUserOperation memory userOp = _buildUserOp(abi.encodePacked(r, s, v));

    vm.prank(account);
    uint256 result = hatValidator.validateUserOp(userOp, userOpHash);

    assertEq(result, VALIDATION_FAILED);
  }

  // ---- Contract signer tests (EIP-1271 fallback) ----

  function test_ReturnSuccess_WhenContractSignerWearsHatAndReturnsValidMagic() public {
    // Deploy a mock ERC-1271 contract signer
    MockERC1271Signer contractSigner = new MockERC1271Signer();

    // Create a hat and mint it to the contract signer
    (, uint256 signerHatId) = _createSingleHat(address(contractSigner));

    // Install the validator on an account with the hat
    address account = makeAddr("account");
    vm.prank(account);
    hatValidator.onInstall(abi.encode(signerHatId));

    bytes32 userOpHash = keccak256("test");
    bytes memory innerSignature = hex"deadbeef";

    // Build signature: 20-byte address prefix + inner signature
    bytes memory signature = abi.encodePacked(address(contractSigner), innerSignature);
    PackedUserOperation memory userOp = _buildUserOp(signature);

    vm.prank(account);
    uint256 result = hatValidator.validateUserOp(userOp, userOpHash);

    assertEq(result, VALIDATION_SUCCESS);
  }

  function test_ReturnValidationFailed_WhenContractSignerDoesNotWearHat() public {
    // Deploy a mock ERC-1271 contract signer (valid signatures, but doesn't wear the hat)
    MockERC1271Signer contractSigner = new MockERC1271Signer();

    // Install the validator with testHatId (worn by hatWearerA, NOT the contract signer)
    address account = makeAddr("account");
    vm.prank(account);
    hatValidator.onInstall(abi.encode(testHatId));

    bytes32 userOpHash = keccak256("test");
    bytes memory innerSignature = hex"deadbeef";
    bytes memory signature = abi.encodePacked(address(contractSigner), innerSignature);
    PackedUserOperation memory userOp = _buildUserOp(signature);

    vm.prank(account);
    uint256 result = hatValidator.validateUserOp(userOp, userOpHash);

    assertEq(result, VALIDATION_FAILED);
  }

  function test_ReturnValidationFailed_WhenContractSignerReturnsInvalidMagic() public {
    // Deploy a mock that returns an invalid magic value
    MockERC1271InvalidSigner contractSigner = new MockERC1271InvalidSigner();

    // Create a hat and mint it to the contract signer
    (, uint256 signerHatId) = _createSingleHat(address(contractSigner));

    address account = makeAddr("account");
    vm.prank(account);
    hatValidator.onInstall(abi.encode(signerHatId));

    bytes32 userOpHash = keccak256("test");
    bytes memory innerSignature = hex"deadbeef";
    bytes memory signature = abi.encodePacked(address(contractSigner), innerSignature);
    PackedUserOperation memory userOp = _buildUserOp(signature);

    vm.prank(account);
    uint256 result = hatValidator.validateUserOp(userOp, userOpHash);

    assertEq(result, VALIDATION_FAILED);
  }

  function test_ReturnValidationFailed_WhenSignerAddressIsNotContract() public {
    // Use an EOA address as the "contract signer" — has no code
    address fakeContractSigner = makeAddr("fakeContractSigner");

    // Create a hat and mint it to the fake signer
    (, uint256 signerHatId) = _createSingleHat(fakeContractSigner);

    address account = makeAddr("account");
    vm.prank(account);
    hatValidator.onInstall(abi.encode(signerHatId));

    bytes32 userOpHash = keccak256("test");
    bytes memory innerSignature = hex"deadbeef";
    bytes memory signature = abi.encodePacked(fakeContractSigner, innerSignature);
    PackedUserOperation memory userOp = _buildUserOp(signature);

    vm.prank(account);
    uint256 result = hatValidator.validateUserOp(userOp, userOpHash);

    assertEq(result, VALIDATION_FAILED);
  }

  function test_ReturnValidationFailed_WhenSignatureTooShortForAddress() public {
    address account = makeAddr("account");
    vm.prank(account);
    hatValidator.onInstall(abi.encode(testHatId));

    bytes32 userOpHash = keccak256("test");
    // 19 bytes — too short to extract a 20-byte address
    bytes memory signature = hex"01020304050607080910111213141516171819";
    PackedUserOperation memory userOp = _buildUserOp(signature);

    vm.prank(account);
    uint256 result = hatValidator.validateUserOp(userOp, userOpHash);

    assertEq(result, VALIDATION_FAILED);
  }
}
