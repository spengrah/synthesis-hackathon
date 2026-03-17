// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { Agreement } from "../../src/Agreement.sol";

/// @title AgreementHarness
/// @notice Exposes Agreement internal functions as public for testing.
contract AgreementHarness is Agreement {
  constructor(
    address _hats,
    address _resourceTokenRegistry,
    address _identityRegistry,
    address _reputationRegistry,
    address _trustZoneImpl,
    address _hookMultiplexer,
    address _hatValidator
  )
    Agreement(
      _hats,
      _resourceTokenRegistry,
      _identityRegistry,
      _reputationRegistry,
      _trustZoneImpl,
      _hookMultiplexer,
      _hatValidator
    )
  { }

  // Note: internal handlers use `AgreementStorage storage $` which is private to access.
  // We can only test them through the public interface (submitInput, initialize, etc.)
  // The harness is kept for potential future internal function exposure.
}
