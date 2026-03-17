// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.28;

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC7579Module, MODULE_TYPE_EXECUTOR } from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";
import { IHats } from "hats-protocol/Interfaces/IHats.sol";

import { IAgreement, IAgreementErrors, IAgreementEvents } from "./interfaces/IAgreement.sol";
import { IReputationRegistry } from "./interfaces/IERC8004.sol";
import { ITrustZone } from "./interfaces/ITrustZone.sol";
import { ResourceTokenRegistry } from "./ResourceTokenRegistry.sol";
import { TZTypes } from "./lib/TZTypes.sol";
import { AgreementTypes } from "./lib/AgreementTypes.sol";
import { SigHookInit } from "core-modules/HookMultiPlexer/DataTypes.sol";

/// @title Agreement
/// @notice State machine, zone manager, and mechanism router.
/// @dev Deployed as ERC-1167 minimal proxy clones. All interactions flow through submitInput.
///      Implements IHatsToggle for deadline-based zone auto-deactivation.
///      Implements IERC7579Module so it can be installed as an executor on TrustZone accounts.
contract Agreement is IAgreement, Initializable, IERC7579Module {
  // ---- Immutables (set in implementation constructor) ----

  IHats public immutable HATS;
  ResourceTokenRegistry public immutable RESOURCE_TOKEN_REGISTRY;
  address public immutable IDENTITY_REGISTRY;
  IReputationRegistry public immutable REPUTATION_REGISTRY;
  address public immutable TRUST_ZONE_IMPL;
  address public immutable HOOK_MULTIPLEXER;
  address public immutable HAT_VALIDATOR;

  // ---- ERC-7201 namespaced storage ----

  /// @custom:storage-location erc7201:trustzones.storage.Agreement
  struct AgreementStorage {
    bytes32 _currentState;
    bytes32 _outcome;
    bytes32 _termsHash;
    string _termsUri;
    address[2] _parties;
    address _turn;
    uint256 _agreementHatId;
    // Activation
    address[2] _trustZones;
    uint256[2] _zoneHatIds;
    uint256[2] _agentIds;
    address _adjudicator;
    uint256 _deadline;
    // Mechanisms
    ClaimableMechanism[] _mechanisms;
    // Two-step close signals
    bool[2] _completionSignaled;
    bool[2] _exitSignaled;
    string[2] _completionFeedbackURI;
    bytes32[2] _completionFeedbackHash;
    string[2] _exitFeedbackURI;
    bytes32[2] _exitFeedbackHash;
    // Claims
    uint256 _claimCount;
    // Stored proposal data (set on accept, used on activate)
    bytes _storedProposalData;
  }

  struct ClaimableMechanism {
    TZTypes.TZParamType paramType;
    address module;
    uint256 zoneIndex;
    bytes context;
  }

  // keccak256(abi.encode(uint256(keccak256("trustzones.storage.Agreement")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant AGREEMENT_STORAGE_LOCATION =
    0x35099ba0645760c2ebdf7249e75393d3ff233e4a967e209c19bb914b50439a00;

  function _getAgreementStorage() private pure returns (AgreementStorage storage $) {
    assembly {
      $.slot := AGREEMENT_STORAGE_LOCATION
    }
  }

  // ---- Constructor ----

  constructor(
    address _hats,
    address _resourceTokenRegistry,
    address _identityRegistry,
    address _reputationRegistry,
    address _trustZoneImpl,
    address _hookMultiplexer,
    address _hatValidator
  ) {
    HATS = IHats(_hats);
    RESOURCE_TOKEN_REGISTRY = ResourceTokenRegistry(_resourceTokenRegistry);
    IDENTITY_REGISTRY = _identityRegistry;
    REPUTATION_REGISTRY = IReputationRegistry(_reputationRegistry);
    TRUST_ZONE_IMPL = _trustZoneImpl;
    HOOK_MULTIPLEXER = _hookMultiplexer;
    HAT_VALIDATOR = _hatValidator;
    _disableInitializers();
  }

  // ---- Initialize ----

  /// @notice Initialize a new agreement clone.
  /// @param parties The two parties to the agreement.
  /// @param _agreementHatId The hat ID for this agreement (parent of zone hats).
  /// @param proposalData ABI-encoded initial proposal.
  function initialize(address[2] calldata parties, uint256 _agreementHatId, bytes calldata proposalData)
    external
    initializer
  {
    AgreementStorage storage $ = _getAgreementStorage();
    $._parties = parties;
    $._agreementHatId = _agreementHatId;

    // Process initial proposal
    _handlePropose($, parties[0], proposalData);
  }

  // ---- Shodai-compatible interface ----

  /// @inheritdoc IAgreement
  function submitInput(bytes32 inputId, bytes calldata payload) external {
    AgreementStorage storage $ = _getAgreementStorage();
    bytes32 state = $._currentState;

    // Terminal states reject all inputs
    if (state == AgreementTypes.CLOSED || state == AgreementTypes.REJECTED) {
      revert InvalidState(state, bytes32(0));
    }

    bytes32 fromState = state;
    bytes32 toState;

    if (inputId == AgreementTypes.COUNTER) {
      toState = _handleCounter($, msg.sender, payload);
    } else if (inputId == AgreementTypes.ACCEPT) {
      toState = _handleAccept($, msg.sender, payload);
    } else if (inputId == AgreementTypes.REJECT) {
      toState = _handleReject($, msg.sender);
    } else if (inputId == AgreementTypes.ACTIVATE) {
      toState = _handleActivate($, msg.sender);
    } else if (inputId == AgreementTypes.CLAIM) {
      toState = _handleClaim($, msg.sender, payload);
    } else if (inputId == AgreementTypes.ADJUDICATE) {
      toState = _handleAdjudicate($, msg.sender, payload);
    } else if (inputId == AgreementTypes.COMPLETE) {
      toState = _handleComplete($, msg.sender, payload);
    } else if (inputId == AgreementTypes.EXIT) {
      toState = _handleExit($, msg.sender, payload);
    } else if (inputId == AgreementTypes.FINALIZE) {
      toState = _handleFinalize($);
    } else {
      revert InvalidInput(inputId);
    }

    emit InputAccepted(fromState, toState, inputId, payload);
  }

  /// @inheritdoc IAgreement
  function currentState() external view returns (bytes32) {
    return _getAgreementStorage()._currentState;
  }

  /// @inheritdoc IAgreement
  function docUri() external view returns (string memory) {
    return _getAgreementStorage()._termsUri;
  }

  /// @inheritdoc IAgreement
  function docHash() external view returns (bytes32) {
    return _getAgreementStorage()._termsHash;
  }

  // ---- Atomic shortcut ----

  /// @inheritdoc IAgreement
  function acceptAndActivate(bytes calldata proposalData) external {
    AgreementStorage storage $ = _getAgreementStorage();
    bytes32 state = $._currentState;

    if (state != AgreementTypes.PROPOSED && state != AgreementTypes.NEGOTIATING) {
      revert InvalidState(state, AgreementTypes.PROPOSED);
    }

    bytes32 fromState = state;

    // Accept
    bytes32 acceptedState = _handleAccept($, msg.sender, proposalData);
    emit InputAccepted(fromState, acceptedState, AgreementTypes.ACCEPT, proposalData);

    // Activate
    bytes32 activeState = _handleActivate($, msg.sender);
    emit InputAccepted(acceptedState, activeState, AgreementTypes.ACTIVATE, "");
  }

  // ---- IHatsToggle ----

  /// @inheritdoc IAgreement
  function getHatStatus(uint256) external view returns (bool) {
    AgreementStorage storage $ = _getAgreementStorage();
    bytes32 state = $._currentState;
    // Active: hat is live and deadline has not passed
    if (state == AgreementTypes.ACTIVE) return block.timestamp < $._deadline;
    // During activation (ACCEPTED state): hats need to be active to mint
    if (state == AgreementTypes.ACCEPTED) return true;
    // All other states (CLOSED, REJECTED, etc.): inactive
    return false;
  }

  // ---- Storage reads ----

  /// @inheritdoc IAgreement
  function parties(uint256 index) external view returns (address) {
    return _getAgreementStorage()._parties[index];
  }

  /// @inheritdoc IAgreement
  function turn() external view returns (address) {
    return _getAgreementStorage()._turn;
  }

  /// @inheritdoc IAgreement
  function outcome() external view returns (bytes32) {
    return _getAgreementStorage()._outcome;
  }

  /// @inheritdoc IAgreement
  function adjudicator() external view returns (address) {
    return _getAgreementStorage()._adjudicator;
  }

  /// @inheritdoc IAgreement
  function deadline() external view returns (uint256) {
    return _getAgreementStorage()._deadline;
  }

  /// @inheritdoc IAgreement
  function trustZones(uint256 index) external view returns (address) {
    return _getAgreementStorage()._trustZones[index];
  }

  /// @inheritdoc IAgreement
  function zoneHatIds(uint256 index) external view returns (uint256) {
    return _getAgreementStorage()._zoneHatIds[index];
  }

  /// @inheritdoc IAgreement
  function agentIds(uint256 index) external view returns (uint256) {
    return _getAgreementStorage()._agentIds[index];
  }

  /// @inheritdoc IAgreement
  function termsHash() external view returns (bytes32) {
    return _getAgreementStorage()._termsHash;
  }

  /// @inheritdoc IAgreement
  function termsUri() external view returns (string memory) {
    return _getAgreementStorage()._termsUri;
  }

  /// @inheritdoc IAgreement
  function mechanisms(uint256 index)
    external
    view
    returns (TZTypes.TZParamType paramType, address module, uint256 zoneIndex, bytes memory context)
  {
    AgreementStorage storage $ = _getAgreementStorage();
    if (index >= $._mechanisms.length) revert InvalidMechanismIndex(index);
    ClaimableMechanism storage m = $._mechanisms[index];
    return (m.paramType, m.module, m.zoneIndex, m.context);
  }

  /// @inheritdoc IAgreement
  function mechanismCount() external view returns (uint256) {
    return _getAgreementStorage()._mechanisms.length;
  }

  /// @inheritdoc IAgreement
  function completionSignaled(uint256 partyIndex) external view returns (bool) {
    return _getAgreementStorage()._completionSignaled[partyIndex];
  }

  /// @inheritdoc IAgreement
  function exitSignaled(uint256 partyIndex) external view returns (bool) {
    return _getAgreementStorage()._exitSignaled[partyIndex];
  }

  /// @inheritdoc IAgreement
  function claimCount() external view returns (uint256) {
    return _getAgreementStorage()._claimCount;
  }

  // ---- IHatsEligibility ----

  /// @notice Check if a wearer is eligible and in good standing.
  /// @dev Always returns (true, true) — eligibility is not gated at the hat level for hackathon.
  function getWearerStatus(address, uint256) external pure returns (bool eligible, bool standing) {
    return (true, true);
  }

  // ---- IERC7579Module (executor module interface) ----

  function onInstall(bytes calldata) external override { }

  function onUninstall(bytes calldata) external override { }

  function isModuleType(uint256 moduleTypeId) external pure override returns (bool) {
    return moduleTypeId == MODULE_TYPE_EXECUTOR;
  }

  // ---- Internal handlers ----

  function _handlePropose(AgreementStorage storage $, address proposer, bytes calldata payload) internal {
    bytes32 fromState = $._currentState; // bytes32(0)

    // Store terms hash and URI from proposal
    AgreementTypes.ProposalData memory data = abi.decode(payload, (AgreementTypes.ProposalData));
    $._termsHash = keccak256(payload);
    $._termsUri = data.termsDocUri;

    // Set turn to the other party (parties[1])
    $._turn = $._parties[1];

    // Set state
    $._currentState = AgreementTypes.PROPOSED;

    emit ProposalSubmitted(proposer, $._termsHash, payload);
    emit AgreementStateChanged(fromState, AgreementTypes.PROPOSED);
  }

  function _handleCounter(AgreementStorage storage $, address caller, bytes calldata payload)
    internal
    returns (bytes32 toState)
  {
    bytes32 state = $._currentState;
    if (state != AgreementTypes.PROPOSED && state != AgreementTypes.NEGOTIATING) {
      revert InvalidState(state, AgreementTypes.PROPOSED);
    }

    // Auth: must be the party whose turn it is
    if (caller != $._turn) revert NotYourTurn(caller, $._turn);

    // Overwrite terms
    AgreementTypes.ProposalData memory data = abi.decode(payload, (AgreementTypes.ProposalData));
    $._termsHash = keccak256(payload);
    $._termsUri = data.termsDocUri;

    // Flip turn
    $._turn = caller == $._parties[0] ? $._parties[1] : $._parties[0];

    // State transition
    if (state == AgreementTypes.PROPOSED) {
      toState = AgreementTypes.NEGOTIATING;
      $._currentState = toState;
      emit AgreementStateChanged(state, toState);
    } else {
      toState = AgreementTypes.NEGOTIATING;
      // No state change event — already in NEGOTIATING
    }

    emit ProposalSubmitted(caller, $._termsHash, payload);
  }

  function _handleAccept(AgreementStorage storage $, address caller, bytes calldata payload)
    internal
    returns (bytes32)
  {
    bytes32 state = $._currentState;
    if (state != AgreementTypes.PROPOSED && state != AgreementTypes.NEGOTIATING) {
      revert InvalidState(state, AgreementTypes.PROPOSED);
    }

    // Auth: must be the party whose turn it is
    if (caller != $._turn) revert NotYourTurn(caller, $._turn);

    // Verify terms hash matches
    if (keccak256(payload) != $._termsHash) revert InvalidInput(AgreementTypes.ACCEPT);

    // Store the full proposal data for activation
    $._storedProposalData = payload;

    // Transition to ACCEPTED
    $._currentState = AgreementTypes.ACCEPTED;
    emit AgreementStateChanged(state, AgreementTypes.ACCEPTED);

    return AgreementTypes.ACCEPTED;
  }

  function _handleReject(AgreementStorage storage $, address caller) internal returns (bytes32) {
    bytes32 state = $._currentState;
    if (state != AgreementTypes.PROPOSED && state != AgreementTypes.NEGOTIATING) {
      revert InvalidState(state, AgreementTypes.PROPOSED);
    }

    // Auth: in PROPOSED, only the other party; in NEGOTIATING, either party
    if (state == AgreementTypes.PROPOSED) {
      if (caller != $._parties[1]) revert NotYourTurn(caller, $._parties[1]);
    } else {
      if (caller != $._parties[0] && caller != $._parties[1]) revert NotAParty(caller);
    }

    $._currentState = AgreementTypes.REJECTED;
    emit AgreementStateChanged(state, AgreementTypes.REJECTED);

    return AgreementTypes.REJECTED;
  }

  function _handleActivate(AgreementStorage storage $, address caller) internal returns (bytes32) {
    bytes32 state = $._currentState;
    if (state != AgreementTypes.ACCEPTED) revert InvalidState(state, AgreementTypes.ACCEPTED);

    // Auth: either party
    if (caller != $._parties[0] && caller != $._parties[1]) revert NotAParty(caller);

    // Decode stored proposal data
    AgreementTypes.ProposalData memory data = abi.decode($._storedProposalData, (AgreementTypes.ProposalData));

    if (data.zones.length != 2) revert InvalidZoneCount();

    // Store config
    $._adjudicator = data.adjudicator;
    $._deadline = data.deadline;

    // Build empty hook init data
    bytes memory hookInitData =
      abi.encode(new address[](0), new address[](0), new address[](0), new SigHookInit[](0), new SigHookInit[](0));

    // Deploy zones
    for (uint256 i = 0; i < 2; i++) {
      TZTypes.TZConfig memory zone = data.zones[i];

      // Verify agentId if set
      if (zone.agentId != 0) {
        address owner = IERC721(IDENTITY_REGISTRY).ownerOf(zone.agentId);
        if (owner != zone.party) revert AgentIdVerificationFailed(zone.agentId, zone.party);
      }

      // Create zone hat (child of agreement hat)
      // Hats Protocol requires non-zero eligibility and toggle addresses
      uint256 zoneHatId = HATS.createHat(
        $._agreementHatId,
        zone.hatDetails,
        zone.hatMaxSupply,
        address(this), // eligibility: this agreement for hackathon
        address(this), // toggle: this agreement
        true, // mutable
        "" // imageURI
      );

      // Mint zone hat to party
      HATS.mintHat(zoneHatId, zone.party);

      // Deploy TrustZone clone
      bytes32 salt = keccak256(abi.encode(address(this), i));
      address trustZoneAddr = Clones.cloneDeterministic(TRUST_ZONE_IMPL, salt);

      // Initialize TrustZone
      ITrustZone(trustZoneAddr)
        .initialize(
          HAT_VALIDATOR,
          abi.encode(zoneHatId),
          address(this), // agreement as executor
          "", // executor init data
          HOOK_MULTIPLEXER,
          hookInitData
        );

      // Register mechanisms
      for (uint256 j = 0; j < zone.mechanisms.length; j++) {
        TZTypes.TZMechanism memory mech = zone.mechanisms[j];
        uint256 mechIndex = $._mechanisms.length;
        $._mechanisms
          .push(
            ClaimableMechanism({ paramType: mech.paramType, module: mech.module, zoneIndex: i, context: mech.initData })
          );
        emit MechanismRegistered(mechIndex, uint8(mech.paramType), mech.module, i);
      }

      // Mint resource tokens
      for (uint256 j = 0; j < zone.resources.length; j++) {
        TZTypes.TZResourceTokenConfig memory res = zone.resources[j];
        uint256 tokenId = RESOURCE_TOKEN_REGISTRY.mint(trustZoneAddr, uint8(res.tokenType), res.metadata);
        emit ResourceTokenAssigned(trustZoneAddr, tokenId, uint8(res.tokenType));
      }

      // Store zone data
      $._trustZones[i] = trustZoneAddr;
      $._zoneHatIds[i] = zoneHatId;
      $._agentIds[i] = zone.agentId;

      emit ZoneDeployed(address(this), trustZoneAddr, zoneHatId, zone.party, zone.agentId);
    }

    // Transition to ACTIVE
    $._currentState = AgreementTypes.ACTIVE;
    emit AgreementActivated(address(this), $._trustZones, $._zoneHatIds);
    emit AgreementStateChanged(state, AgreementTypes.ACTIVE);

    return AgreementTypes.ACTIVE;
  }

  function _handleClaim(AgreementStorage storage $, address caller, bytes calldata payload) internal returns (bytes32) {
    bytes32 state = $._currentState;
    if (state != AgreementTypes.ACTIVE) revert InvalidState(state, AgreementTypes.ACTIVE);

    // Auth: either party (hackathon simplification)
    if (caller != $._parties[0] && caller != $._parties[1]) revert NotAParty(caller);

    (uint256 mechanismIndex, bytes memory evidence) = abi.decode(payload, (uint256, bytes));
    if (mechanismIndex >= $._mechanisms.length) revert InvalidMechanismIndex(mechanismIndex);

    uint256 claimId = $._claimCount++;
    emit ClaimFiled(claimId, mechanismIndex, caller, evidence);

    return AgreementTypes.ACTIVE;
  }

  function _handleAdjudicate(AgreementStorage storage $, address caller, bytes calldata payload)
    internal
    returns (bytes32)
  {
    bytes32 state = $._currentState;
    if (state != AgreementTypes.ACTIVE) revert InvalidState(state, AgreementTypes.ACTIVE);

    if (caller != $._adjudicator) revert NotAdjudicator(caller);

    (uint256 claimId, bool verdict, AgreementTypes.AdjudicationAction[] memory actions) =
      abi.decode(payload, (uint256, bool, AgreementTypes.AdjudicationAction[]));

    if (claimId >= $._claimCount) revert InvalidClaimId(claimId);

    bytes32[] memory actionTypes = new bytes32[](actions.length);
    bool shouldClose = false;

    for (uint256 i = 0; i < actions.length; i++) {
      AgreementTypes.AdjudicationAction memory action = actions[i];
      actionTypes[i] = action.actionType;

      if (action.actionType == AgreementTypes.PENALIZE || action.actionType == AgreementTypes.REWARD) {
        if (action.mechanismIndex >= $._mechanisms.length) revert InvalidMechanismIndex(action.mechanismIndex);
        ClaimableMechanism storage mech = $._mechanisms[action.mechanismIndex];
        // Raw calldata forwarding to the mechanism module
        (bool success,) = mech.module.call(action.params);
        if (!success) revert InvalidInput(action.actionType);
      } else if (action.actionType == AgreementTypes.FEEDBACK) {
        // Decode params and call reputation registry
        (uint256 agentId, string memory feedbackURI, bytes32 feedbackHash) =
          abi.decode(action.params, (uint256, string, bytes32));
        REPUTATION_REGISTRY.giveFeedback(
          agentId,
          0,
          0,
          "trust-zone-agreement",
          "ADJUDICATED",
          Strings.toHexString(uint160(address(this)), 20),
          feedbackURI,
          feedbackHash
        );
      } else if (action.actionType == AgreementTypes.DEACTIVATE) {
        uint256 zoneIdx = action.mechanismIndex; // reusing mechanismIndex as zoneIndex for DEACTIVATE
        if (zoneIdx >= 2) revert InvalidMechanismIndex(zoneIdx);
        HATS.setHatStatus($._zoneHatIds[zoneIdx], false);
      } else if (action.actionType == AgreementTypes.CLOSE) {
        shouldClose = true;
      }
    }

    emit AdjudicationDelivered(claimId, verdict, actionTypes);

    if (shouldClose) {
      _close($, keccak256("ADJUDICATED"));
      return AgreementTypes.CLOSED;
    }

    return AgreementTypes.ACTIVE;
  }

  function _handleComplete(AgreementStorage storage $, address caller, bytes calldata payload)
    internal
    returns (bytes32)
  {
    bytes32 state = $._currentState;
    if (state != AgreementTypes.ACTIVE) revert InvalidState(state, AgreementTypes.ACTIVE);

    uint256 partyIdx = _partyIndex($, caller);

    if ($._completionSignaled[partyIdx]) revert AlreadySignaled(caller);

    (string memory feedbackURI, bytes32 feedbackHash) = abi.decode(payload, (string, bytes32));

    $._completionSignaled[partyIdx] = true;
    $._completionFeedbackURI[partyIdx] = feedbackURI;
    $._completionFeedbackHash[partyIdx] = feedbackHash;

    emit CompletionSignaled(caller, feedbackURI, feedbackHash);

    // Check if both parties have signaled
    uint256 otherIdx = partyIdx == 0 ? 1 : 0;
    if ($._completionSignaled[otherIdx]) {
      _close($, keccak256("COMPLETED"));
      return AgreementTypes.CLOSED;
    }

    return AgreementTypes.ACTIVE;
  }

  function _handleExit(AgreementStorage storage $, address caller, bytes calldata payload) internal returns (bytes32) {
    bytes32 state = $._currentState;
    if (state != AgreementTypes.ACTIVE) revert InvalidState(state, AgreementTypes.ACTIVE);

    uint256 partyIdx = _partyIndex($, caller);

    if ($._exitSignaled[partyIdx]) revert AlreadySignaled(caller);

    (string memory feedbackURI, bytes32 feedbackHash) = abi.decode(payload, (string, bytes32));

    $._exitSignaled[partyIdx] = true;
    $._exitFeedbackURI[partyIdx] = feedbackURI;
    $._exitFeedbackHash[partyIdx] = feedbackHash;

    emit ExitSignaled(caller, feedbackURI, feedbackHash);

    // Check if both parties have signaled
    uint256 otherIdx = partyIdx == 0 ? 1 : 0;
    if ($._exitSignaled[otherIdx]) {
      _close($, keccak256("EXITED"));
      return AgreementTypes.CLOSED;
    }

    return AgreementTypes.ACTIVE;
  }

  function _handleFinalize(AgreementStorage storage $) internal returns (bytes32) {
    bytes32 state = $._currentState;
    if (state != AgreementTypes.ACTIVE) revert InvalidState(state, AgreementTypes.ACTIVE);

    if (block.timestamp < $._deadline) revert DeadlineNotReached($._deadline, block.timestamp);

    _close($, keccak256("EXPIRED"));
    return AgreementTypes.CLOSED;
  }

  // ---- Internal close ----

  function _close(AgreementStorage storage $, bytes32 _outcome) internal {
    bytes32 fromState = $._currentState;

    $._currentState = AgreementTypes.CLOSED;
    $._outcome = _outcome;

    // Deactivate zone hats
    for (uint256 i = 0; i < 2; i++) {
      if ($._zoneHatIds[i] != 0) {
        HATS.setHatStatus($._zoneHatIds[i], false);
      }
    }

    // Determine outcome string for reputation feedback
    string memory outcomeStr;
    if (_outcome == keccak256("COMPLETED")) outcomeStr = "COMPLETED";
    else if (_outcome == keccak256("EXITED")) outcomeStr = "EXITED";
    else if (_outcome == keccak256("EXPIRED")) outcomeStr = "EXPIRED";
    else if (_outcome == keccak256("ADJUDICATED")) outcomeStr = "ADJUDICATED";

    string memory endpoint = Strings.toHexString(uint160(address(this)), 20);

    // Write 8004 reputation for each party with agentId != 0
    for (uint256 i = 0; i < 2; i++) {
      if ($._agentIds[i] != 0) {
        uint256 otherIdx = i == 0 ? 1 : 0;
        string memory feedbackURI;
        bytes32 feedbackHash;

        // Use counterparty's feedback
        if (_outcome == keccak256("COMPLETED")) {
          feedbackURI = $._completionFeedbackURI[otherIdx];
          feedbackHash = $._completionFeedbackHash[otherIdx];
        } else if (_outcome == keccak256("EXITED")) {
          feedbackURI = $._exitFeedbackURI[otherIdx];
          feedbackHash = $._exitFeedbackHash[otherIdx];
        }

        REPUTATION_REGISTRY.giveFeedback(
          $._agentIds[i], 0, 0, "trust-zone-agreement", outcomeStr, endpoint, feedbackURI, feedbackHash
        );

        emit ReputationFeedbackWritten($._agentIds[i], outcomeStr, feedbackURI, feedbackHash);
      }
    }

    emit AgreementClosed(_outcome);
    emit AgreementStateChanged(fromState, AgreementTypes.CLOSED);
  }

  // ---- Internal helpers ----

  function _partyIndex(AgreementStorage storage $, address caller) internal view returns (uint256) {
    if (caller == $._parties[0]) return 0;
    if (caller == $._parties[1]) return 1;
    revert NotAParty(caller);
  }
}
