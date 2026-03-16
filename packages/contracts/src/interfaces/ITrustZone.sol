// SPDX-License-Identifier: MIT
pragma solidity >=0.8.28;

/// @title ITrustZoneErrors
/// @notice Errors for TrustZone.
interface ITrustZoneErrors {
  error Unauthorized();
  error AlreadyInitialized();
}

/// @title ITrustZoneEvents
/// @notice Events for TrustZone.
interface ITrustZoneEvents {
  event TrustZoneInitialized(
    address indexed hatValidator, address indexed agreementExecutor, address indexed hookMultiplexer
  );
}

/// @title ITrustZone
/// @notice Trust Zone smart account — thin wrapper around OZ AccountERC7579HookedUpgradeable.
/// @dev Deployed as ERC-1167 minimal proxy clones by the Agreement contract.
///      Adds hat-based direct-call authorization and a convenience execute function.
///      All OZ 7579 functionality (installModule, execute(bytes32,bytes), executeFromExecutor,
///      isValidSignature, validateUserOp, etc.) is inherited, not redeclared here.
interface ITrustZone is ITrustZoneErrors, ITrustZoneEvents {
  /// @notice Initialize the TrustZone clone. Can only be called once.
  /// @dev Installs the three core modules: HatValidator (validator), agreement contract (executor),
  ///      and HookMultiPlexer (hook). Called by the Agreement contract during activation.
  /// @param _hatValidator HatValidator module address.
  /// @param _hatValidatorInitData ABI-encoded (hatsAddress, hatId).
  /// @param _agreementExecutor Agreement contract address (installed as executor module).
  /// @param _executorInitData Executor module init data.
  /// @param _hookMultiplexer HookMultiPlexer module address.
  /// @param _hookInitData Hook module init data.
  function initialize(
    address _hatValidator,
    bytes calldata _hatValidatorInitData,
    address _agreementExecutor,
    bytes calldata _executorInitData,
    address _hookMultiplexer,
    bytes calldata _hookInitData
  ) external;

  /// @notice Convenience function for agents to execute a single call.
  /// @dev Encodes as a 7579 single-call execution and invokes the inherited execute(bytes32, bytes).
  ///      Goes through the full OZ pipeline: _checkEntryPointOrSelf → hooks → execution.
  /// @param to Target address.
  /// @param value ETH value to send.
  /// @param data Calldata for the target.
  function execute(address to, uint256 value, bytes calldata data) external payable;

  /// @notice The HatValidator module address, used by _checkEntryPointOrSelf override.
  function hatValidator() external view returns (address);
}
