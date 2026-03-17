// SPDX-License-Identifier: MIT
pragma solidity >=0.8.28;

import { TZTypes } from "./TZTypes.sol";

/// @title AgreementTypes
/// @notice Agreement-specific types: proposal data, adjudication actions, and constants.
library AgreementTypes {
  // --------------------
  // Agreement states
  // --------------------

  bytes32 internal constant PROPOSED = keccak256("PROPOSED");
  bytes32 internal constant NEGOTIATING = keccak256("NEGOTIATING");
  bytes32 internal constant ACCEPTED = keccak256("ACCEPTED");
  bytes32 internal constant ACTIVE = keccak256("ACTIVE");
  bytes32 internal constant CLOSED = keccak256("CLOSED");
  bytes32 internal constant REJECTED = keccak256("REJECTED");

  // --------------------
  // Input IDs
  // --------------------

  bytes32 internal constant PROPOSE = keccak256("PROPOSE");
  bytes32 internal constant COUNTER = keccak256("COUNTER");
  bytes32 internal constant ACCEPT = keccak256("ACCEPT");
  bytes32 internal constant REJECT = keccak256("REJECT");
  bytes32 internal constant ACTIVATE = keccak256("ACTIVATE");
  bytes32 internal constant CLAIM = keccak256("CLAIM");
  bytes32 internal constant ADJUDICATE = keccak256("ADJUDICATE");
  bytes32 internal constant COMPLETE = keccak256("COMPLETE");
  bytes32 internal constant EXIT = keccak256("EXIT");
  bytes32 internal constant FINALIZE = keccak256("FINALIZE");

  // --------------------
  // Adjudication action types
  // --------------------

  bytes32 internal constant PENALIZE = keccak256("PENALIZE");
  bytes32 internal constant REWARD = keccak256("REWARD");
  bytes32 internal constant FEEDBACK = keccak256("FEEDBACK");
  bytes32 internal constant DEACTIVATE = keccak256("DEACTIVATE");
  bytes32 internal constant CLOSE = keccak256("CLOSE");

  // --------------------
  // Structs
  // --------------------

  /// @notice Full proposal terms. Submitted as calldata, hash stored onchain.
  struct ProposalData {
    string termsDocUri; // optional — "" if unused
    TZTypes.TZConfig[] zones;
    address adjudicator;
    uint256 deadline;
  }

  /// @notice Action to execute as part of an adjudication verdict.
  struct AdjudicationAction {
    uint256 mechanismIndex; // index in the agreement's mechanism registry
    bytes32 actionType; // PENALIZE, REWARD, FEEDBACK, DEACTIVATE, CLOSE
    bytes params; // action-specific parameters
  }
}
