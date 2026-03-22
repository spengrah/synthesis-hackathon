// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.28;

import { PackedUserOperation } from "@openzeppelin/contracts/interfaces/draft-IERC4337.sol";
import {
  IERC7579Module,
  IERC7579Validator,
  VALIDATION_SUCCESS,
  VALIDATION_FAILED,
  MODULE_TYPE_VALIDATOR
} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { IERC1271 } from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import { IHats } from "hats-protocol/Interfaces/IHats.sol";
import { IHatValidator } from "../interfaces/IHatValidator.sol";

/// @title HatValidator
/// @notice ERC-7579 validator module that gates authorization on Hats Protocol hat-wearing.
/// @dev Single deployment serves all TZ accounts via associated storage keyed by the installing account.
///      Hats Protocol address is set once at construction (immutable) since it's the same on every chain.
contract HatValidator is IHatValidator {
  IHats public immutable HATS;

  /// @dev Associated storage — only stores the hatId per account.
  mapping(address account => uint256) internal _hatIds;

  constructor(address _hats) {
    HATS = IHats(_hats);
  }

  // ---- Lifecycle ----

  /// @inheritdoc IERC7579Module
  function onInstall(bytes calldata data) external override {
    if (_hatIds[msg.sender] != 0) revert AlreadyInstalled(msg.sender);

    uint256 hatIdVal = abi.decode(data, (uint256));
    _hatIds[msg.sender] = hatIdVal;

    emit HatValidatorInstalled(msg.sender, address(HATS), hatIdVal);
  }

  /// @inheritdoc IERC7579Module
  function onUninstall(bytes calldata) external override {
    if (_hatIds[msg.sender] == 0) revert NotInstalled(msg.sender);

    delete _hatIds[msg.sender];

    emit HatValidatorUninstalled(msg.sender);
  }

  // ---- Module type ----

  /// @inheritdoc IERC7579Module
  function isModuleType(uint256 moduleTypeId) external pure override returns (bool) {
    return moduleTypeId == MODULE_TYPE_VALIDATOR;
  }

  // ---- Direct-call authorization ----

  /// @inheritdoc IHatValidator
  function isAuthorized(address account, address caller) external view override returns (bool) {
    uint256 id = _hatIds[account];
    if (id == 0) return false;
    return HATS.isWearerOfHat(caller, id);
  }

  // ---- ERC-4337 validation ----

  /// @inheritdoc IERC7579Validator
  function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash) external override returns (uint256) {
    uint256 id = _hatIds[msg.sender];
    if (id == 0) return VALIDATION_FAILED;

    // Try ECDSA recovery first (EOA signers)
    (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecoverCalldata(userOpHash, userOp.signature);
    if (err == ECDSA.RecoverError.NoError && HATS.isWearerOfHat(signer, id)) {
      return VALIDATION_SUCCESS;
    }

    // Fallback: contract signer (EIP-1271)
    // Format: first 20 bytes = signer address, remaining bytes = inner signature
    if (_isValidContractSignature(userOp.signature, userOpHash, id)) {
      return VALIDATION_SUCCESS;
    }

    return VALIDATION_FAILED;
  }

  // ---- ERC-1271 validation ----

  /// @inheritdoc IERC7579Validator
  function isValidSignatureWithSender(address, bytes32 hash, bytes calldata signature)
    external
    view
    override
    returns (bytes4)
  {
    uint256 id = _hatIds[msg.sender];
    if (id == 0) return bytes4(0xffffffff);

    // Try ECDSA recovery first (EOA signers)
    (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecoverCalldata(hash, signature);
    if (err == ECDSA.RecoverError.NoError && HATS.isWearerOfHat(signer, id)) {
      return bytes4(0x1626ba7e);
    }

    // Fallback: contract signer (EIP-1271)
    if (_isValidContractSignature(signature, hash, id)) {
      return bytes4(0x1626ba7e);
    }

    return bytes4(0xffffffff);
  }

  // ---- Internal helpers ----

  /// @dev Check if a signature uses the contract signer format and is valid.
  ///      Format: first 20 bytes = signer contract address, remaining bytes = inner signature for EIP-1271.
  /// @param signature The full signature bytes.
  /// @param hash The hash that was signed.
  /// @param id The hat ID the signer must wear.
  /// @return True if the contract signer is valid and wears the hat.
  function _isValidContractSignature(bytes calldata signature, bytes32 hash, uint256 id) internal view returns (bool) {
    if (signature.length < 20) return false;

    address signerContract = address(bytes20(signature[:20]));
    bytes calldata innerSignature = signature[20:];

    // Must be a contract and wear the hat
    if (signerContract.code.length == 0) return false;
    if (!HATS.isWearerOfHat(signerContract, id)) return false;

    // Validate via EIP-1271
    try IERC1271(signerContract).isValidSignature(hash, innerSignature) returns (bytes4 magic) {
      return magic == bytes4(0x1626ba7e);
    } catch {
      return false;
    }
  }

  // ---- Config reads ----

  /// @inheritdoc IHatValidator
  function hats(address) external view override returns (address) {
    return address(HATS);
  }

  /// @inheritdoc IHatValidator
  function hatId(address account) external view override returns (uint256) {
    return _hatIds[account];
  }

  /// @inheritdoc IHatValidator
  function isInstalledOn(address account) external view override returns (bool) {
    return _hatIds[account] != 0;
  }
}
