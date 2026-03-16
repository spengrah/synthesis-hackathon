// SPDX-License-Identifier: MIT
pragma solidity >=0.8.28;

import { TZTypes } from "../lib/TZTypes.sol";
import { AgreementTypes } from "../lib/AgreementTypes.sol";

/// @title IAgreementErrors
/// @notice Errors for Agreement.
interface IAgreementErrors {
  error InvalidState(bytes32 current, bytes32 expected);
  error NotAParty(address caller);
  error NotYourTurn(address caller, address expected);
  error NotAdjudicator(address caller);
  error DeadlineNotReached(uint256 deadline, uint256 current);
  error DeadlineReached(uint256 deadline);
  error InvalidInput(bytes32 inputId);
  error InvalidMechanismIndex(uint256 index);
  error AgentIdVerificationFailed(uint256 agentId, address expectedOwner);
  error InvalidZoneCount();
  error AlreadySignaled(address caller);
  error InvalidClaimId(uint256 claimId);
}

/// @title IAgreementEvents
/// @notice Events for Agreement.
interface IAgreementEvents {
  // ---- Shodai-compatible ----

  event InputAccepted(bytes32 indexed fromState, bytes32 indexed toState, bytes32 indexed inputId, bytes payload);
  event AgreementStateChanged(bytes32 indexed fromState, bytes32 indexed toState);

  // ---- Negotiation ----

  event ProposalSubmitted(address indexed proposer, bytes32 termsHash, string termsUri);

  // ---- Activation ----

  event AgreementActivated(address indexed agreement, address[2] trustZones, uint256[2] zoneHatIds);
  event ZoneDeployed(
    address indexed agreement, address indexed trustZone, uint256 indexed zoneHatId, address party, uint256 agentId
  );
  event ResourceTokenAssigned(address indexed trustZone, uint256 indexed tokenId, uint8 tokenType);
  event MechanismRegistered(uint256 indexed mechanismIndex, uint8 paramType, address module, uint256 zoneIndex);

  // ---- Active ----

  event ClaimFiled(uint256 indexed claimId, uint256 indexed mechanismIndex, address indexed claimant, bytes evidence);
  event AdjudicationDelivered(uint256 indexed claimId, bool verdict, bytes32[] actionTypes);

  // ---- Close ----

  event CompletionSignaled(address indexed party, string feedbackURI, bytes32 feedbackHash);
  event ExitSignaled(address indexed party, string feedbackURI, bytes32 feedbackHash);
  event AgreementClosed(bytes32 indexed outcome);
  event ReputationFeedbackWritten(uint256 indexed agentId, string tag2, string feedbackURI, bytes32 feedbackHash);
}

/// @title IAgreement
/// @notice Agreement contract — state machine, zone manager, and mechanism router.
/// @dev All interactions flow through submitInput (Shodai-compatible).
///      Implements IHatsToggle for deadline-based zone auto-deactivation.
interface IAgreement is IAgreementErrors, IAgreementEvents {
  // ---- Shodai-compatible interface ----

  /// @notice Universal write interface. Routes to internal handlers based on inputId and current state.
  /// @param inputId The action being taken (PROPOSE, COUNTER, ACCEPT, REJECT, ACTIVATE, CLAIM, etc.).
  /// @param payload ABI-encoded data specific to the input type.
  function submitInput(bytes32 inputId, bytes calldata payload) external;

  /// @notice Current state of the agreement state machine.
  function currentState() external view returns (bytes32);

  /// @notice URI of the terms document (optional, set on accept). Shodai-compatible alias for termsUri.
  function docUri() external view returns (string memory);

  /// @notice Hash of the terms document (optional, set on accept). Shodai-compatible alias for termsHash.
  function docHash() external view returns (bytes32);

  // ---- Atomic shortcut ----

  /// @notice Accept and activate in one transaction. Convenience for demo.
  /// @dev Caller must be the party whose turn it is. State must be PROPOSED or NEGOTIATING.
  ///      Equivalent to submitInput(ACCEPT) + submitInput(ACTIVATE).
  /// @param proposalData ABI-encoded ProposalData (used for activation, terms already locked by accept).
  function acceptAndActivate(bytes calldata proposalData) external;

  // ---- IHatsToggle ----

  /// @notice Check if a zone hat should be active. Used by Hats Protocol for auto-deactivation.
  /// @dev Returns true only when state is ACTIVE and deadline has not passed.
  ///      Ensures zones go inert after deadline even before FINALIZE is called.
  /// @param hatId The zone hat to check.
  /// @return Whether the hat is active.
  function getHatStatus(uint256 hatId) external view returns (bool);

  // ---- Storage reads ----

  /// @notice The two parties to the agreement.
  function parties(uint256 index) external view returns (address);

  /// @notice Whose turn it is during negotiation.
  function turn() external view returns (address);

  /// @notice The agreement's outcome, set on close.
  function outcome() external view returns (bytes32);

  /// @notice The adjudicator address.
  function adjudicator() external view returns (address);

  /// @notice The agreement deadline (unix timestamp).
  function deadline() external view returns (uint256);

  /// @notice The TrustZone smart account addresses, set on activation.
  function trustZones(uint256 index) external view returns (address);

  /// @notice The zone hat IDs, set on activation.
  function zoneHatIds(uint256 index) external view returns (uint256);

  /// @notice The ERC-8004 agent IDs for each party (0 = no 8004).
  function agentIds(uint256 index) external view returns (uint256);

  /// @notice The locked terms hash.
  function termsHash() external view returns (bytes32);

  /// @notice The locked terms URI.
  function termsUri() external view returns (string memory);

  /// @notice Get a registered claimable mechanism by index.
  /// @dev Built during activation from TZConfig.mechanisms[] arrays.
  function mechanisms(uint256 index)
    external
    view
    returns (TZTypes.TZParamType paramType, address module, uint256 zoneIndex, bytes memory context);

  /// @notice Number of registered mechanisms.
  function mechanismCount() external view returns (uint256);

  /// @notice Whether a party has signaled completion.
  function completionSignaled(uint256 partyIndex) external view returns (bool);

  /// @notice Whether a party has signaled exit.
  function exitSignaled(uint256 partyIndex) external view returns (bool);

  /// @notice Number of claims filed.
  function claimCount() external view returns (uint256);
}
