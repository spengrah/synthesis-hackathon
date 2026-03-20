// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { Agreement } from "../../src/Agreement.sol";
import { TZTypes } from "../../src/lib/TZTypes.sol";

/// @title AgreementHarness
/// @notice Exposes Agreement internal functions as public for testing.
///         Each exposed_ function gets the storage pointer and forwards to the internal handler.
contract AgreementHarness is Agreement {
  constructor(
    address _hats,
    address _resourceTokenRegistry,
    address _identityRegistry,
    address _reputationRegistry,
    address _trustZoneImpl,
    address _hookMultiplexer,
    address _hatValidator,
    address _hatsModuleFactory,
    address _eligibilitiesChainImpl
  )
    Agreement(
      _hats,
      _resourceTokenRegistry,
      _identityRegistry,
      _reputationRegistry,
      _trustZoneImpl,
      _hookMultiplexer,
      _hatValidator,
      _hatsModuleFactory,
      _eligibilitiesChainImpl
    )
  { }

  // ---- State machine handlers ----

  function exposed_handleCounter(address caller, bytes calldata payload) external returns (bytes32) {
    AgreementStorage storage $ = _getAgreementStorage();
    return _handleCounter($, caller, payload);
  }

  function exposed_handleAccept(address caller, bytes calldata payload) external returns (bytes32) {
    AgreementStorage storage $ = _getAgreementStorage();
    return _handleAccept($, caller, payload);
  }

  function exposed_handleReject(address caller) external returns (bytes32) {
    AgreementStorage storage $ = _getAgreementStorage();
    return _handleReject($, caller);
  }

  function exposed_handleWithdraw(address caller) external returns (bytes32) {
    AgreementStorage storage $ = _getAgreementStorage();
    return _handleWithdraw($, caller);
  }

  function exposed_handleActivate(address caller) external returns (bytes32) {
    AgreementStorage storage $ = _getAgreementStorage();
    return _handleActivate($, caller);
  }

  function exposed_handleClaim(address caller, bytes calldata payload) external returns (bytes32) {
    AgreementStorage storage $ = _getAgreementStorage();
    return _handleClaim($, caller, payload);
  }

  function exposed_handleAdjudicate(address caller, bytes calldata payload) external returns (bytes32) {
    AgreementStorage storage $ = _getAgreementStorage();
    return _handleAdjudicate($, caller, payload);
  }

  function exposed_handleComplete(address caller, bytes calldata payload) external returns (bytes32) {
    AgreementStorage storage $ = _getAgreementStorage();
    return _handleComplete($, caller, payload);
  }

  function exposed_handleExit(address caller, bytes calldata payload) external returns (bytes32) {
    AgreementStorage storage $ = _getAgreementStorage();
    return _handleExit($, caller, payload);
  }

  function exposed_handleFinalize(address caller) external returns (bytes32) {
    AgreementStorage storage $ = _getAgreementStorage();
    return _handleFinalize($, caller);
  }

  // ---- Setup + Activation internals ----

  function exposed_handleSetUp(address caller) external returns (bytes32) {
    AgreementStorage storage $ = _getAgreementStorage();
    return _handleSetUp($, caller);
  }

  function exposed_setUpZone(TZTypes.TZConfig memory zone, uint256 zoneIndex) external {
    AgreementStorage storage $ = _getAgreementStorage();
    _setUpZone($, zone, zoneIndex);
  }

  function exposed_verifyAgentId(TZTypes.TZConfig memory zone) external view {
    _verifyAgentId(zone);
  }

  function exposed_collectConstraintHooks(TZTypes.TZMechanism[] memory mechs) external pure returns (address[] memory) {
    return _collectConstraintHooks(mechs);
  }

  // ---- Close internals ----

  function exposed_close(bytes32 _outcome) external {
    AgreementStorage storage $ = _getAgreementStorage();
    _close($, _outcome);
  }

  function exposed_writeReputationFeedback(bytes32 _outcome) external {
    AgreementStorage storage $ = _getAgreementStorage();
    _writeReputationFeedback($, _outcome);
  }

  function exposed_deactivateZoneHats() external {
    AgreementStorage storage $ = _getAgreementStorage();
    _deactivateZoneHats($);
  }
}
