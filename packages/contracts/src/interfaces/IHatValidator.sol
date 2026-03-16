// SPDX-License-Identifier: MIT
pragma solidity >=0.8.28;

import { IERC7579Validator } from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";

/// @title IHatValidatorErrors
/// @notice Errors for HatValidator.
interface IHatValidatorErrors {
  error NotWearingHat(address caller, uint256 hatId);
  error AlreadyInstalled(address account);
  error NotInstalled(address account);
}

/// @title IHatValidatorEvents
/// @notice Events for HatValidator.
interface IHatValidatorEvents {
  event HatValidatorInstalled(address indexed account, address indexed hats, uint256 indexed hatId);
  event HatValidatorUninstalled(address indexed account);
}

/// @title IHatValidator
/// @notice ERC-7579 validator module that gates authorization on Hats Protocol hat-wearing.
/// @dev Single deployment serves all TZ accounts via associated storage keyed by the installing account.
///      All three auth paths (direct call, ERC-4337, ERC-1271) converge on hats.isWearerOfHat().
interface IHatValidator is IERC7579Validator, IHatValidatorErrors, IHatValidatorEvents {
  // ---- Direct-call authorization ----

  /// @notice Check if a caller is authorized to act on behalf of a given account.
  /// @dev Called by TZAccount._checkEntryPointOrSelf(). Reads the config for `account`.
  /// @param account The TZ account being acted upon.
  /// @param caller The address attempting to act.
  /// @return True if the caller wears the hat associated with the account.
  function isAuthorized(address account, address caller) external view returns (bool);

  // ---- Config reads ----

  /// @notice Get the Hats Protocol address configured for an account.
  /// @param account The TZ account to query.
  /// @return The IHats contract address.
  function hats(address account) external view returns (address);

  /// @notice Get the hat ID configured for an account.
  /// @param account The TZ account to query.
  /// @return The hat ID that authorizes actions on this account.
  function hatId(address account) external view returns (uint256);

  /// @notice Check if this module is installed on a given account.
  /// @param account The TZ account to query.
  /// @return True if onInstall has been called by this account.
  function isInstalledOn(address account) external view returns (bool);
}
