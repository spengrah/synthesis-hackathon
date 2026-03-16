// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.28;

import {
  AccountERC7579HookedUpgradeable
} from "@openzeppelin/contracts-upgradeable/account/extensions/draft-AccountERC7579HookedUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {
  MODULE_TYPE_VALIDATOR,
  MODULE_TYPE_EXECUTOR,
  MODULE_TYPE_HOOK
} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";
import {
  ERC7579Utils,
  Mode,
  CallType,
  ExecType,
  ModeSelector,
  ModePayload
} from "@openzeppelin/contracts/account/utils/draft-ERC7579Utils.sol";
import { HatValidator } from "./modules/HatValidator.sol";
import { ITrustZone } from "./interfaces/ITrustZone.sol";

/// @title TrustZone
/// @notice Trust Zone smart account — thin wrapper around OZ AccountERC7579HookedUpgradeable.
/// @dev Deployed as ERC-1167 minimal proxy clones by the Agreement contract.
///      Adds hat-based direct-call authorization and a convenience execute function.
contract TrustZone is ITrustZone, AccountERC7579HookedUpgradeable {
  /// @custom:storage-location erc7201:trustzones.storage.TrustZone
  struct TrustZoneStorage {
    address _hatValidator;
  }

  // keccak256(abi.encode(uint256(keccak256("trustzones.storage.TrustZone")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant TRUST_ZONE_STORAGE_LOCATION =
    0x5301ab931b9411405dfdc57cd1f3c4b4426df03a73ed0ea628e1e3a250da1300;

  function _getTrustZoneStorage() private pure returns (TrustZoneStorage storage $) {
    assembly {
      $.slot := TRUST_ZONE_STORAGE_LOCATION
    }
  }

  /// @dev Disable initializers on the implementation contract.
  constructor() {
    _disableInitializers();
  }

  /// @inheritdoc ITrustZone
  function initialize(
    address hatValidatorAddr,
    bytes calldata hatValidatorInitData,
    address agreementExecutor,
    bytes calldata executorInitData,
    address hookMultiplexer,
    bytes calldata hookInitData
  ) external initializer {
    _getTrustZoneStorage()._hatValidator = hatValidatorAddr;

    _installModule(MODULE_TYPE_VALIDATOR, hatValidatorAddr, hatValidatorInitData);
    _installModule(MODULE_TYPE_EXECUTOR, agreementExecutor, executorInitData);
    if (hookMultiplexer != address(0)) {
      _installModule(MODULE_TYPE_HOOK, hookMultiplexer, hookInitData);
    }

    emit TrustZoneInitialized(hatValidatorAddr, agreementExecutor, hookMultiplexer);
  }

  /// @inheritdoc ITrustZone
  function execute(address to, uint256 value, bytes calldata data) external payable onlyEntryPointOrSelf {
    bytes32 mode = Mode.unwrap(
      ERC7579Utils.encodeMode(
        ERC7579Utils.CALLTYPE_SINGLE,
        ERC7579Utils.EXECTYPE_DEFAULT,
        ModeSelector.wrap(bytes4(0)),
        ModePayload.wrap(bytes22(0))
      )
    );
    // Self-call to go through the external boundary (memory → calldata) and hooks.
    // Auth already checked by onlyEntryPointOrSelf above; address(this) passes the inner check.
    this.execute(mode, abi.encodePacked(to, value, data));
  }

  /// @inheritdoc ITrustZone
  function hatValidator() external view returns (address) {
    TrustZoneStorage storage $ = _getTrustZoneStorage();
    return $._hatValidator;
  }

  /// @dev Extends OZ access control to authorize hat-wearers via HatValidator.
  function _checkEntryPointOrSelf() internal view override {
    if (msg.sender == address(entryPoint())) return;
    if (msg.sender == address(this)) return;
    TrustZoneStorage storage $ = _getTrustZoneStorage();
    if (HatValidator($._hatValidator).isAuthorized(address(this), msg.sender)) return;
    revert Unauthorized();
  }
}
