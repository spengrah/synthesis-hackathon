// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { HatValidatorBase } from "../../Base.t.sol";
import { PackedUserOperation } from "@openzeppelin/contracts/interfaces/draft-IERC4337.sol";
import { VALIDATION_SUCCESS, VALIDATION_FAILED } from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";

contract HatValidator_validateUserOp is HatValidatorBase {
  uint256 internal signerKey;
  address internal signer;

  function setUp() public override {
    super.setUp();
    (signer, signerKey) = makeAddrAndKey("signer");
  }

  function _buildUserOp(bytes memory signature) internal view returns (PackedUserOperation memory) {
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
}
