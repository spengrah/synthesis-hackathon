// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { StdInvariant } from "forge-std/StdInvariant.sol";
import { Test } from "forge-std/Test.sol";

import { AgreementHarnessBase } from "../Base.t.sol";
import { AgreementHarness } from "../harness/AgreementHarness.sol";
import { IHats } from "hats-protocol/Interfaces/IHats.sol";
import { TrustZone } from "../../src/TrustZone.sol";
import { IHatValidator } from "../../src/interfaces/IHatValidator.sol";
import { AgreementTypes } from "../../src/lib/AgreementTypes.sol";
import { TZTypes } from "../../src/lib/TZTypes.sol";
import { Defaults } from "../helpers/Defaults.sol";
import { Constants } from "../helpers/Constants.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

contract AgreementInvariantMockMechanism {
  fallback() external payable { }

  receive() external payable { }
}

contract AgreementInvariantRevertingMechanism {
  fallback() external payable {
    revert("INVARIANT_REVERT");
  }

  receive() external payable {
    revert("INVARIANT_REVERT");
  }
}

contract AgreementInvariantExecuteTarget {
  uint256 public callCount;

  function ping() external {
    callCount++;
  }
}

contract AgreementInvariantMockIdentityRegistry {
  mapping(uint256 agentId => address owner) internal _owners;

  function setOwner(uint256 agentId, address owner) external {
    _owners[agentId] = owner;
  }

  function ownerOf(uint256 agentId) external view returns (address) {
    address owner = _owners[agentId];
    require(owner != address(0), "NO_OWNER");
    return owner;
  }
}

contract AgreementInvariantMockReputationRegistry {
  struct FeedbackRecord {
    uint256 agentId;
    string tag2;
    string endpoint;
    string feedbackURI;
    bytes32 feedbackHash;
  }

  FeedbackRecord[] internal _records;

  function giveFeedback(
    uint256 agentId,
    int128,
    uint8,
    string calldata,
    string calldata tag2,
    string calldata endpoint,
    string calldata feedbackURI,
    bytes32 feedbackHash
  ) external {
    _records.push(
      FeedbackRecord({
        agentId: agentId, tag2: tag2, endpoint: endpoint, feedbackURI: feedbackURI, feedbackHash: feedbackHash
      })
    );
  }

  function feedbackCount() external view returns (uint256) {
    return _records.length;
  }

  function feedback(uint256 index)
    external
    view
    returns (
      uint256 agentId,
      string memory tag2,
      string memory endpoint,
      string memory feedbackURI,
      bytes32 feedbackHash
    )
  {
    FeedbackRecord storage record = _records[index];
    return (record.agentId, record.tag2, record.endpoint, record.feedbackURI, record.feedbackHash);
  }
}

/// @dev Handler scaffold for Agreement invariants.
/// It drives a single agreement instance through valid and invalid inputs while tracking
/// enough ghost state to make core state-machine invariants implementable.
contract AgreementInvariantHandler is Test {
  IHats internal hats;
  AgreementHarness internal agreement;
  AgreementInvariantMockReputationRegistry internal reputationRegistry;
  AgreementInvariantExecuteTarget internal executeTarget;
  address internal partyA;
  address internal partyB;
  address internal adjudicator;
  address internal observer;
  address internal deployer;
  address[] internal _parties;
  address[] internal _outsiders;
  bytes internal proposalPayload;

  bytes32 internal _lastObservedState;
  bytes32 internal _lastObservedOutcome;
  uint256 internal _lastObservedClaimCount;

  bool internal _sawTerminalInputAccepted;
  bool internal _sawIllegalTransition;
  bool internal _sawOutcomeViolation;
  bool internal _activationSnapshotted;
  bool internal _sawActivationMutation;
  bool internal _sawMechanismCountMutation;
  bool internal _sawClaimCountDecrease;
  bool internal _sawSignalRegression;
  bool internal _sawFailedAdjudicationConsumeClaim;
  bool internal _sawUnauthorizedExecutionSuccess;
  bool internal _sawInactiveAuthoritySuccess;
  bool internal _sawCloseFeedbackRoutingMismatch;
  bool internal _sawCompositeRollbackViolation;

  address[2] internal _snapTrustZones;
  uint256[2] internal _snapZoneHatIds;
  uint256[2] internal _snapAgentIds;
  uint256 internal _snapDeadline;
  address internal _snapAdjudicator;
  uint256 internal _snapMechanismCount;

  bool[2] internal _lastCompletionSignaled;
  bool[2] internal _lastExitSignaled;
  bool[2] internal _explicitlyDeactivated;
  uint256[] internal _trackedAdjudicatedClaims;
  mapping(uint256 claimId => bool tracked) internal _trackedAdjudication;

  constructor(
    IHats _hats,
    AgreementHarness _agreement,
    AgreementInvariantMockReputationRegistry _reputationRegistry,
    AgreementInvariantExecuteTarget _executeTarget,
    address _partyA,
    address _partyB,
    address _adjudicator,
    address _observer,
    address _deployer,
    bytes memory _proposalPayload
  ) {
    hats = _hats;
    agreement = _agreement;
    reputationRegistry = _reputationRegistry;
    executeTarget = _executeTarget;
    partyA = _partyA;
    partyB = _partyB;
    adjudicator = _adjudicator;
    observer = _observer;
    deployer = _deployer;
    _parties.push(_partyA);
    _parties.push(_partyB);
    _outsiders.push(_adjudicator);
    _outsiders.push(_observer);
    _outsiders.push(_deployer);
    proposalPayload = _proposalPayload;

    _lastObservedState = agreement.currentState();
    _lastObservedOutcome = agreement.outcome();
    _lastObservedClaimCount = agreement.claimCount();
    _observeSignals();
  }

  function counter() external {
    _submit(partyB, AgreementTypes.COUNTER, proposalPayload);
  }

  function accept() external {
    _submit(agreement.turn(), AgreementTypes.ACCEPT, proposalPayload);
  }

  function reject() external {
    _submit(agreement.turn(), AgreementTypes.REJECT, "");
  }

  function withdraw() external {
    _submit(partyA, AgreementTypes.WITHDRAW, "");
  }

  function setUp_() external {
    _submit(partyA, AgreementTypes.SET_UP, "");
  }

  function activate() external {
    _submit(partyA, AgreementTypes.ACTIVATE, "");
  }

  function claim() external {
    _submit(partyA, AgreementTypes.CLAIM, abi.encode(uint256(0), bytes("invariant-evidence")));
  }

  function complete(uint8 partySeed) external {
    address caller = _partyFromSeed(partySeed);
    bytes memory payload = abi.encode("ipfs://complete", keccak256("complete"));
    uint256 beforeCount = reputationRegistry.feedbackCount();
    bool success = _submit(caller, AgreementTypes.COMPLETE, payload);
    if (success && agreement.currentState() == AgreementTypes.CLOSED) {
      _validateCloseFeedbackWrites(beforeCount, keccak256("COMPLETED"));
    }
  }

  function exitSignal(uint8 partySeed) external {
    address caller = _partyFromSeed(partySeed);
    bytes memory payload = abi.encode("ipfs://exit", keccak256("exit"));
    uint256 beforeCount = reputationRegistry.feedbackCount();
    bool success = _submit(caller, AgreementTypes.EXIT, payload);
    if (success && agreement.currentState() == AgreementTypes.CLOSED) {
      _validateCloseFeedbackWrites(beforeCount, keccak256("EXITED"));
    }
  }

  function finalize(uint32 extraSeconds) external {
    uint256 deadline = agreement.deadline();
    if (deadline != 0) {
      vm.warp(deadline + 1 + uint256(extraSeconds % 1 days));
    }
    uint256 beforeCount = reputationRegistry.feedbackCount();
    bool success = _submit(partyA, AgreementTypes.FINALIZE, "");
    if (success && agreement.currentState() == AgreementTypes.CLOSED) {
      _validateCloseFeedbackWrites(beforeCount, keccak256("EXPIRED"));
    }
  }

  function adjudicateReward(uint256 claimSeed, bool closeAgreement) external {
    (uint256 claimId, bool ok) = _openClaimFromSeed(claimSeed);
    if (!ok) return;

    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](closeAgreement ? 2 : 1);

    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0,
      targetIndex: 0,
      actionType: AgreementTypes.REWARD,
      params: abi.encodeWithSignature("reward(address,uint256)", partyA, 1)
    });

    if (closeAgreement) {
      actions[1] = AgreementTypes.AdjudicationAction({
        mechanismIndex: 0, targetIndex: 0, actionType: AgreementTypes.CLOSE, params: ""
      });
    }

    uint256 beforeCount = reputationRegistry.feedbackCount();
    bool success = _submit(adjudicator, AgreementTypes.ADJUDICATE, abi.encode(claimId, true, actions));
    if (!success) return;

    _trackAdjudicatedClaim(claimId);
    if (closeAgreement && agreement.currentState() == AgreementTypes.CLOSED) {
      _validateCloseFeedbackWrites(beforeCount, keccak256("ADJUDICATED"));
    }
  }

  function adjudicateDeactivate(uint256 claimSeed, uint8 targetSeed, bool closeAgreement) external {
    (uint256 claimId, bool ok) = _openClaimFromSeed(claimSeed);
    if (!ok) return;

    uint256 targetIndex = targetSeed % 2;
    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](closeAgreement ? 2 : 1);

    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0, targetIndex: targetIndex, actionType: AgreementTypes.DEACTIVATE, params: ""
    });

    if (closeAgreement) {
      actions[1] = AgreementTypes.AdjudicationAction({
        mechanismIndex: 0, targetIndex: targetIndex, actionType: AgreementTypes.CLOSE, params: ""
      });
    }

    uint256 beforeCount = reputationRegistry.feedbackCount();
    bool success = _submit(adjudicator, AgreementTypes.ADJUDICATE, abi.encode(claimId, true, actions));
    if (success && !closeAgreement) {
      _explicitlyDeactivated[targetIndex] = true;
    }
    if (!success) return;

    _trackAdjudicatedClaim(claimId);
    if (closeAgreement && agreement.currentState() == AgreementTypes.CLOSED) {
      _validateCloseFeedbackWrites(beforeCount, keccak256("ADJUDICATED"));
    }
  }

  function adjudicateFeedback(uint256 claimSeed, uint8 targetSeed) external {
    (uint256 claimId, bool ok) = _openClaimFromSeed(claimSeed);
    if (!ok) return;

    AgreementTypes.AdjudicationAction[] memory actions = new AgreementTypes.AdjudicationAction[](1);
    actions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0,
      targetIndex: targetSeed % 2,
      actionType: AgreementTypes.FEEDBACK,
      params: abi.encode("ipfs://adjudicated-feedback", keccak256("adjudicated-feedback"))
    });

    bool success = _submit(adjudicator, AgreementTypes.ADJUDICATE, abi.encode(claimId, true, actions));
    if (success) {
      _trackAdjudicatedClaim(claimId);
    }
    _checkForZeroAgentWrites();
  }

  function probeWearerExecution(uint8 zoneSeed) external {
    if (!agreementActivated()) return;

    uint256 zoneIndex = zoneSeed % 2;
    address trustZoneAddr = agreement.trustZones(zoneIndex);
    uint256 hatId = agreement.zoneHatIds(zoneIndex);

    if (trustZoneAddr == address(0) || hatId == 0) return;

    address wearer = _parties[zoneIndex];
    bool hatActive = agreement.getHatStatus(hatId);
    bool isWearing = hats.isWearerOfHat(wearer, hatId);

    vm.prank(wearer);
    try TrustZone(payable(trustZoneAddr)).execute(address(executeTarget), 0, abi.encodeCall(executeTarget.ping, ())) {
      // Execution succeeded — violation if hat is not active
      if (!hatActive) {
        _sawInactiveAuthoritySuccess = true;
      }
    } catch (bytes memory) {
      // Execution failed — violation only if hat is active AND wearer actually wears it
      // (in READY state, hat is active but not yet worn, so failure is expected)
      if (hatActive && isWearing) {
        _sawInactiveAuthoritySuccess = true;
      }
    }
  }

  function probeUnauthorizedExecution(uint8 zoneSeed, uint8 outsiderSeed) external {
    if (!agreementActivated()) return;

    uint256 zoneIndex = zoneSeed % 2;
    address trustZoneAddr = agreement.trustZones(zoneIndex);
    if (trustZoneAddr == address(0)) return;

    address outsider = _outsiderFromSeed(outsiderSeed);
    vm.prank(outsider);
    try TrustZone(payable(trustZoneAddr)).execute(address(executeTarget), 0, abi.encodeCall(executeTarget.ping, ())) {
      _sawUnauthorizedExecutionSuccess = true;
    } catch (bytes memory) { }
  }

  function probeFailedAdjudicationRetry(uint256 claimSeed) external {
    if (agreement.currentState() != AgreementTypes.ACTIVE) return;

    (uint256 claimId, bool ok) = _openClaimFromSeed(claimSeed);
    if (!ok) return;

    bytes32 stateBefore = agreement.currentState();
    bytes32 outcomeBefore = agreement.outcome();
    uint256 claimCountBefore = agreement.claimCount();
    uint256 beforeCount = reputationRegistry.feedbackCount();
    bool hat0Before = _zoneHatStatus(0);
    bool hat1Before = _zoneHatStatus(1);

    AgreementTypes.AdjudicationAction[] memory failingActions = new AgreementTypes.AdjudicationAction[](1);
    failingActions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 1,
      targetIndex: 0,
      actionType: AgreementTypes.REWARD,
      params: abi.encodeWithSignature("reward(address,uint256)", partyA, 1)
    });

    bool failedAsExpected = !_submit(adjudicator, AgreementTypes.ADJUDICATE, abi.encode(claimId, true, failingActions));
    if (!failedAsExpected) {
      _sawCompositeRollbackViolation = true;
      return;
    }

    if (
      agreement.currentState() != stateBefore || agreement.outcome() != outcomeBefore
        || agreement.claimCount() != claimCountBefore || reputationRegistry.feedbackCount() != beforeCount
        || _zoneHatStatus(0) != hat0Before || _zoneHatStatus(1) != hat1Before
    ) {
      _sawCompositeRollbackViolation = true;
      return;
    }

    AgreementTypes.AdjudicationAction[] memory validActions = new AgreementTypes.AdjudicationAction[](1);
    validActions[0] = AgreementTypes.AdjudicationAction({
      mechanismIndex: 0,
      targetIndex: 0,
      actionType: AgreementTypes.REWARD,
      params: abi.encodeWithSignature("reward(address,uint256)", partyA, 1)
    });

    bool retrySuccess = _submit(adjudicator, AgreementTypes.ADJUDICATE, abi.encode(claimId, true, validActions));
    if (!retrySuccess) {
      _sawFailedAdjudicationConsumeClaim = true;
      return;
    }

    _trackAdjudicatedClaim(claimId);
  }

  function lastObservedState() external view returns (bytes32) {
    return _lastObservedState;
  }

  function lastObservedOutcome() external view returns (bytes32) {
    return _lastObservedOutcome;
  }

  function sawTerminalInputAccepted() external view returns (bool) {
    return _sawTerminalInputAccepted;
  }

  function sawIllegalTransition() external view returns (bool) {
    return _sawIllegalTransition;
  }

  function sawOutcomeViolation() external view returns (bool) {
    return _sawOutcomeViolation;
  }

  function activationSnapshotted() external view returns (bool) {
    return _activationSnapshotted;
  }

  function sawActivationMutation() external view returns (bool) {
    return _sawActivationMutation;
  }

  function sawMechanismCountMutation() external view returns (bool) {
    return _sawMechanismCountMutation;
  }

  function sawClaimCountDecrease() external view returns (bool) {
    return _sawClaimCountDecrease;
  }

  function sawSignalRegression() external view returns (bool) {
    return _sawSignalRegression;
  }

  function sawFailedAdjudicationConsumeClaim() external view returns (bool) {
    return _sawFailedAdjudicationConsumeClaim;
  }

  function sawUnauthorizedExecutionSuccess() external view returns (bool) {
    return _sawUnauthorizedExecutionSuccess;
  }

  function sawInactiveAuthoritySuccess() external view returns (bool) {
    return _sawInactiveAuthoritySuccess;
  }

  function sawCloseFeedbackRoutingMismatch() external view returns (bool) {
    return _sawCloseFeedbackRoutingMismatch;
  }

  function sawCompositeRollbackViolation() external view returns (bool) {
    return _sawCompositeRollbackViolation;
  }

  function trackedTrustZone(uint256 index) external view returns (address) {
    return _snapTrustZones[index];
  }

  function trackedZoneHat(uint256 index) external view returns (uint256) {
    return _snapZoneHatIds[index];
  }

  function explicitlyDeactivated(uint256 index) external view returns (bool) {
    return _explicitlyDeactivated[index];
  }

  function trackedAdjudicatedCount() external view returns (uint256) {
    return _trackedAdjudicatedClaims.length;
  }

  function trackedAdjudicatedClaim(uint256 index) external view returns (uint256) {
    return _trackedAdjudicatedClaims[index];
  }

  function agreementActivated() public view returns (bool) {
    bytes32 state = agreement.currentState();
    return state == AgreementTypes.READY || state == AgreementTypes.ACTIVE || state == AgreementTypes.CLOSED;
  }

  function _submit(address caller, bytes32 inputId, bytes memory payload) internal returns (bool success) {
    bytes32 fromState = agreement.currentState();

    vm.prank(caller);
    try agreement.submitInput(inputId, payload) {
      success = true;
    } catch { }

    _observe(fromState, success);
  }

  function _observe(bytes32 fromState, bool success) internal {
    bytes32 state = agreement.currentState();
    bytes32 outcome = agreement.outcome();
    uint256 claimCount = agreement.claimCount();

    if (success && _isTerminal(fromState)) {
      _sawTerminalInputAccepted = true;
    }

    if (success && !_isAllowedTransition(fromState, state)) {
      _sawIllegalTransition = true;
    }

    if (
      (state == AgreementTypes.CLOSED && outcome == bytes32(0))
        || (state != AgreementTypes.CLOSED && outcome != bytes32(0))
    ) {
      _sawOutcomeViolation = true;
    }

    if (_lastObservedOutcome != bytes32(0) && outcome != _lastObservedOutcome) {
      _sawOutcomeViolation = true;
    }

    if (claimCount < _lastObservedClaimCount) {
      _sawClaimCountDecrease = true;
    }

    if ((state == AgreementTypes.ACTIVE || state == AgreementTypes.CLOSED) && !_activationSnapshotted) {
      _snapshotActivationArtifacts();
    } else if (_activationSnapshotted) {
      _checkActivationArtifacts();
    }

    _checkSignalMonotonicity();

    _lastObservedState = state;
    _lastObservedOutcome = outcome;
    _lastObservedClaimCount = claimCount;
  }

  function _snapshotActivationArtifacts() internal {
    _activationSnapshotted = true;
    _snapTrustZones[0] = agreement.trustZones(0);
    _snapTrustZones[1] = agreement.trustZones(1);
    _snapZoneHatIds[0] = agreement.zoneHatIds(0);
    _snapZoneHatIds[1] = agreement.zoneHatIds(1);
    _snapAgentIds[0] = agreement.agentIds(0);
    _snapAgentIds[1] = agreement.agentIds(1);
    _snapDeadline = agreement.deadline();
    _snapAdjudicator = agreement.adjudicator();
    _snapMechanismCount = agreement.mechanismCount();
  }

  function _checkActivationArtifacts() internal {
    if (
      agreement.trustZones(0) != _snapTrustZones[0] || agreement.trustZones(1) != _snapTrustZones[1]
        || agreement.zoneHatIds(0) != _snapZoneHatIds[0] || agreement.zoneHatIds(1) != _snapZoneHatIds[1]
        || agreement.agentIds(0) != _snapAgentIds[0] || agreement.agentIds(1) != _snapAgentIds[1]
        || agreement.deadline() != _snapDeadline || agreement.adjudicator() != _snapAdjudicator
    ) {
      _sawActivationMutation = true;
    }

    if (agreement.mechanismCount() != _snapMechanismCount) {
      _sawMechanismCountMutation = true;
    }
  }

  function _observeSignals() internal {
    _lastCompletionSignaled[0] = agreement.completionSignaled(0);
    _lastCompletionSignaled[1] = agreement.completionSignaled(1);
    _lastExitSignaled[0] = agreement.exitSignaled(0);
    _lastExitSignaled[1] = agreement.exitSignaled(1);
  }

  function _checkSignalMonotonicity() internal {
    bool completion0 = agreement.completionSignaled(0);
    bool completion1 = agreement.completionSignaled(1);
    bool exit0 = agreement.exitSignaled(0);
    bool exit1 = agreement.exitSignaled(1);

    if ((_lastCompletionSignaled[0] && !completion0) || (_lastCompletionSignaled[1] && !completion1)) {
      _sawSignalRegression = true;
    }

    if ((_lastExitSignaled[0] && !exit0) || (_lastExitSignaled[1] && !exit1)) {
      _sawSignalRegression = true;
    }

    _lastCompletionSignaled[0] = completion0;
    _lastCompletionSignaled[1] = completion1;
    _lastExitSignaled[0] = exit0;
    _lastExitSignaled[1] = exit1;
  }

  function _isTerminal(bytes32 state) internal pure returns (bool) {
    return state == AgreementTypes.CLOSED || state == AgreementTypes.REJECTED;
  }

  function _isAllowedTransition(bytes32 fromState, bytes32 toState) internal pure returns (bool) {
    if (fromState == toState) return true;
    if (fromState == AgreementTypes.PROPOSED) {
      return
        toState == AgreementTypes.NEGOTIATING || toState == AgreementTypes.ACCEPTED
          || toState == AgreementTypes.REJECTED;
    }
    if (fromState == AgreementTypes.NEGOTIATING) {
      return
        toState == AgreementTypes.NEGOTIATING || toState == AgreementTypes.ACCEPTED
          || toState == AgreementTypes.REJECTED;
    }
    if (fromState == AgreementTypes.ACCEPTED) {
      return toState == AgreementTypes.READY;
    }
    if (fromState == AgreementTypes.READY) {
      return toState == AgreementTypes.ACTIVE;
    }
    if (fromState == AgreementTypes.ACTIVE) {
      return toState == AgreementTypes.ACTIVE || toState == AgreementTypes.CLOSED;
    }
    return false;
  }

  function _partyFromSeed(uint8 seed) internal view returns (address) {
    return _parties[seed % _parties.length];
  }

  function _outsiderFromSeed(uint8 seed) internal view returns (address) {
    return _outsiders[seed % _outsiders.length];
  }

  function _openClaimFromSeed(uint256 seed) internal view returns (uint256 claimId, bool ok) {
    uint256 claimCount = agreement.claimCount();
    if (claimCount == 0) return (0, false);

    uint256 start = seed % claimCount;
    for (uint256 offset = 0; offset < claimCount; offset++) {
      claimId = (start + offset) % claimCount;
      if (!_trackedAdjudication[claimId]) {
        return (claimId, true);
      }
    }

    return (0, false);
  }

  function _trackAdjudicatedClaim(uint256 claimId) internal {
    if (_trackedAdjudication[claimId]) return;
    _trackedAdjudication[claimId] = true;
    _trackedAdjudicatedClaims.push(claimId);
  }

  function _checkForZeroAgentWrites() internal {
    uint256 count = reputationRegistry.feedbackCount();
    for (uint256 i = 0; i < count; i++) {
      (uint256 agentId,,,,) = reputationRegistry.feedback(i);
      if (agentId == 0) {
        _sawCloseFeedbackRoutingMismatch = true;
      }
    }
  }

  function _validateCloseFeedbackWrites(uint256 beforeCount, bytes32 expectedOutcome) internal {
    uint256 afterCount = reputationRegistry.feedbackCount();
    uint256 expectedWrites = _expectedCloseWriteCount();
    if (afterCount != beforeCount + expectedWrites) {
      _sawCloseFeedbackRoutingMismatch = true;
      return;
    }

    string memory endpoint = Strings.toHexString(uint160(address(agreement)), 20);
    bytes32 expectedOutcomeHash = _expectedOutcomeHash(expectedOutcome);

    for (uint256 i = beforeCount; i < afterCount; i++) {
      (
        uint256 agentId,
        string memory tag2,
        string memory recordedEndpoint,
        string memory feedbackURI,
        bytes32 feedbackHash
      ) = reputationRegistry.feedback(i);

      if (agentId == 0) {
        _sawCloseFeedbackRoutingMismatch = true;
      }

      if (keccak256(bytes(tag2)) != expectedOutcomeHash) {
        _sawCloseFeedbackRoutingMismatch = true;
      }

      if (keccak256(bytes(recordedEndpoint)) != keccak256(bytes(endpoint))) {
        _sawCloseFeedbackRoutingMismatch = true;
      }

      if (expectedOutcome == keccak256("COMPLETED")) {
        if (
          keccak256(bytes(feedbackURI)) != keccak256(bytes("ipfs://complete")) || feedbackHash != keccak256("complete")
        ) {
          _sawCloseFeedbackRoutingMismatch = true;
        }
      } else if (expectedOutcome == keccak256("EXITED")) {
        if (keccak256(bytes(feedbackURI)) != keccak256(bytes("ipfs://exit")) || feedbackHash != keccak256("exit")) {
          _sawCloseFeedbackRoutingMismatch = true;
        }
      } else {
        if (
          keccak256(bytes(feedbackURI)) != keccak256(bytes(endpoint))
            || feedbackHash != keccak256(abi.encodePacked(endpoint))
        ) {
          _sawCloseFeedbackRoutingMismatch = true;
        }
      }
    }

    _checkForZeroAgentWrites();
  }

  function _expectedCloseWriteCount() internal view returns (uint256 count) {
    if (agreement.agentIds(0) != 0) count++;
    if (agreement.agentIds(1) != 0) count++;
  }

  function _expectedOutcomeHash(bytes32 outcome) internal pure returns (bytes32) {
    if (outcome == keccak256("COMPLETED")) return keccak256("COMPLETED");
    if (outcome == keccak256("EXITED")) return keccak256("EXITED");
    if (outcome == keccak256("EXPIRED")) return keccak256("EXPIRED");
    if (outcome == keccak256("ADJUDICATED")) return keccak256("ADJUDICATED");
    return bytes32(0);
  }

  function _zoneHatStatus(uint256 zoneIndex) internal view returns (bool) {
    uint256 hatId = agreement.zoneHatIds(zoneIndex);
    if (hatId == 0) return false;
    return agreement.getHatStatus(hatId);
  }

  function _invalidActivatePayload() internal view returns (bytes memory) {
    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](1);
    zones[0] = Defaults.tzConfig(partyA, 0);

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    return abi.encode(data);
  }
}

contract Agreement_Invariants is StdInvariant, AgreementHarnessBase {
  AgreementHarness internal invariantAgreement;
  AgreementInvariantHandler internal handler;
  AgreementInvariantMockMechanism internal rewardMechanism;
  AgreementInvariantRevertingMechanism internal revertingMechanism;
  AgreementInvariantExecuteTarget internal executeTarget;
  AgreementInvariantMockIdentityRegistry internal identityRegistryMock;
  AgreementInvariantMockReputationRegistry internal reputationRegistryMock;
  address[] internal _targetedSenders;

  uint256 internal constant INVARIANT_AGENT_ID_A = 111;
  uint256 internal constant EXPECTED_PERMISSION_ID = (uint256(1) << 8) | 0x01;
  uint256 internal constant EXPECTED_DIRECTIVE_ID = (uint256(1) << 8) | 0x03;

  function setUp() public override {
    super.setUp();

    _installExternalMocks();

    rewardMechanism = new AgreementInvariantMockMechanism();
    revertingMechanism = new AgreementInvariantRevertingMechanism();
    executeTarget = new AgreementInvariantExecuteTarget();

    bytes memory payload = _buildInvariantProposalPayload();
    (invariantAgreement, agrmtHatId) = _createHarnessClone(payload);

    handler = new AgreementInvariantHandler(
      hats,
      invariantAgreement,
      reputationRegistryMock,
      executeTarget,
      partyA,
      partyB,
      adjudicator,
      observer,
      deployer,
      payload
    );

    targetContract(address(handler));
    _configureTargetSenders();

    bytes4[] memory selectors = new bytes4[](15);
    selectors[0] = AgreementInvariantHandler.counter.selector;
    selectors[1] = AgreementInvariantHandler.accept.selector;
    selectors[2] = AgreementInvariantHandler.reject.selector;
    selectors[3] = AgreementInvariantHandler.withdraw.selector;
    selectors[4] = AgreementInvariantHandler.setUp_.selector;
    selectors[5] = AgreementInvariantHandler.activate.selector;
    selectors[6] = AgreementInvariantHandler.claim.selector;
    selectors[7] = AgreementInvariantHandler.complete.selector;
    selectors[8] = AgreementInvariantHandler.exitSignal.selector;
    selectors[9] = AgreementInvariantHandler.finalize.selector;
    selectors[10] = AgreementInvariantHandler.adjudicateDeactivate.selector;
    selectors[11] = AgreementInvariantHandler.adjudicateReward.selector;
    selectors[12] = AgreementInvariantHandler.adjudicateFeedback.selector;
    selectors[13] = AgreementInvariantHandler.probeWearerExecution.selector;
    selectors[14] = AgreementInvariantHandler.probeUnauthorizedExecution.selector;
    targetSelector(FuzzSelector({ addr: address(handler), selectors: selectors }));

    bytes4[] memory moreSelectors = new bytes4[](1);
    moreSelectors[0] = AgreementInvariantHandler.probeFailedAdjudicationRetry.selector;
    targetSelector(FuzzSelector({ addr: address(handler), selectors: moreSelectors }));
  }

  function _configureTargetSenders() internal {
    _targetedSenders.push(partyA);
    _targetedSenders.push(partyB);
    _targetedSenders.push(adjudicator);
    _targetedSenders.push(observer);
    _targetedSenders.push(deployer);

    for (uint256 i = 0; i < _targetedSenders.length; i++) {
      targetSender(_targetedSenders[i]);
    }
  }

  function _installExternalMocks() internal {
    AgreementInvariantMockIdentityRegistry identityImpl = new AgreementInvariantMockIdentityRegistry();
    vm.etch(Constants.IDENTITY_REGISTRY, address(identityImpl).code);
    identityRegistryMock = AgreementInvariantMockIdentityRegistry(Constants.IDENTITY_REGISTRY);
    identityRegistryMock.setOwner(INVARIANT_AGENT_ID_A, partyA);

    AgreementInvariantMockReputationRegistry reputationImpl = new AgreementInvariantMockReputationRegistry();
    vm.etch(Constants.REPUTATION_REGISTRY, address(reputationImpl).code);
    vm.store(Constants.REPUTATION_REGISTRY, bytes32(0), bytes32(0));
    reputationRegistryMock = AgreementInvariantMockReputationRegistry(Constants.REPUTATION_REGISTRY);
  }

  function invariant_TerminalStatesRejectFurtherInputs() public view {
    assertFalse(handler.sawTerminalInputAccepted(), "terminal state accepted a subsequent input");
  }

  function invariant_StateTransitionsFollowGraph() public view {
    assertFalse(handler.sawIllegalTransition(), "observed illegal Agreement state transition");
  }

  function invariant_OutcomeIsZeroUntilClosed_AndImmutableAfterClose() public view {
    assertFalse(handler.sawOutcomeViolation(), "outcome violated closed/non-closed consistency");
  }

  function invariant_ActivationArtifactsAreImmutableAfterActivation() public view {
    assertFalse(handler.sawActivationMutation(), "activation artifacts mutated after activation");
  }

  function invariant_MechanismRegistryIsFrozenAfterActivation() public view {
    assertFalse(handler.sawMechanismCountMutation(), "mechanism registry mutated after activation");
  }

  function invariant_ClaimCountIsMonotonic() public view {
    assertFalse(handler.sawClaimCountDecrease(), "claimCount decreased");
  }

  function invariant_AdjudicatedClaimsAreSubsetOfFiledClaims() public view {
    uint256 trackedCount = handler.trackedAdjudicatedCount();
    uint256 claimCount = invariantAgreement.claimCount();

    for (uint256 i = 0; i < trackedCount; i++) {
      assertLt(handler.trackedAdjudicatedClaim(i), claimCount, "adjudicated claim escaped filed-claim set");
    }
  }

  function invariant_RevertedAdjudicationDoesNotConsumeClaim() public view {
    assertFalse(handler.sawFailedAdjudicationConsumeClaim(), "failed adjudication consumed a claim");
  }

  function invariant_CompletionAndExitSignalsAreMonotonic() public view {
    assertFalse(handler.sawSignalRegression(), "completion/exit signals regressed");
  }

  function invariant_ClosedAgreementHasInactiveZoneHats() public view {
    if (invariantAgreement.currentState() != AgreementTypes.CLOSED || !handler.activationSnapshotted()) return;

    for (uint256 i = 0; i < 2; i++) {
      uint256 hatId = handler.trackedZoneHat(i);
      if (hatId != 0) {
        assertFalse(invariantAgreement.getHatStatus(hatId), "closed agreement left a zone hat active");
      }
    }
  }

  function invariant_ExplicitlyDeactivatedHatNeverBecomesActiveAgain() public view {
    for (uint256 i = 0; i < 2; i++) {
      if (!handler.explicitlyDeactivated(i)) continue;
      uint256 hatId = handler.trackedZoneHat(i);
      if (hatId != 0) {
        assertFalse(invariantAgreement.getHatStatus(hatId), "explicitly deactivated hat became active again");
      }
    }
  }

  function invariant_ZoneValidatorTracksZoneHat() public view {
    if (!handler.activationSnapshotted()) return;

    for (uint256 i = 0; i < 2; i++) {
      address trustZoneAddr = handler.trackedTrustZone(i);
      uint256 hatId = handler.trackedZoneHat(i);
      if (trustZoneAddr == address(0) || hatId == 0) continue;

      address validator = TrustZone(payable(trustZoneAddr)).hatValidator();
      assertEq(IHatValidator(validator).hatId(trustZoneAddr), hatId, "zone validator lost the zone hat binding");
    }
  }

  function invariant_InactiveZoneCannotAuthorize() public view {
    assertFalse(handler.sawInactiveAuthoritySuccess(), "inactive zone wearer retained execution authority");
  }

  function invariant_OnlyAuthorizedCallersCanExecute() public view {
    assertFalse(handler.sawUnauthorizedExecutionSuccess(), "non-authorized actor executed through a TrustZone");
  }

  function invariant_CloseNeverDeletesZoneButAlwaysKillsAuthority() public view {
    if (invariantAgreement.currentState() != AgreementTypes.CLOSED || !handler.activationSnapshotted()) return;

    for (uint256 i = 0; i < 2; i++) {
      uint256 hatId = handler.trackedZoneHat(i);
      assertTrue(handler.trackedTrustZone(i) != address(0), "close deleted a trust zone address");
      if (hatId != 0) {
        assertFalse(invariantAgreement.getHatStatus(hatId), "close preserved authority");
      }
    }
  }

  function invariant_MintedZoneResourcesAreAgreementCreated() public view {
    if (!handler.activationSnapshotted()) return;

    assertEq(registry.creator(EXPECTED_PERMISSION_ID), address(invariantAgreement), "zone resource creator mismatch");
    assertEq(registry.creator(EXPECTED_DIRECTIVE_ID), address(invariantAgreement), "zone resource creator mismatch");
  }

  function invariant_MechanismZoneIndexIsAlwaysValid() public view {
    uint256 count = invariantAgreement.mechanismCount();
    for (uint256 i = 0; i < count; i++) {
      (,,, uint256 zoneIndex,) = invariantAgreement.mechanisms(i);
      assertLt(zoneIndex, 2, "registered mechanism has invalid zone index");
    }
  }

  function invariant_NoReputationWriteForZeroAgentId() public view {
    uint256 feedbackCount = reputationRegistryMock.feedbackCount();
    for (uint256 i = 0; i < feedbackCount; i++) {
      (uint256 agentId,,,,) = reputationRegistryMock.feedback(i);
      assertTrue(agentId != 0, "reputation feedback was written for agentId=0");
    }
  }

  function invariant_CloseFeedbackRoutingMatchesOutcome() public view {
    assertFalse(handler.sawCloseFeedbackRoutingMismatch(), "close feedback routing drifted from outcome semantics");
  }

  function invariant_RevertedCompositeActionsLeaveNoPartialState() public view {
    assertFalse(handler.sawCompositeRollbackViolation(), "reverted composite action leaked partial state");
  }

  function _buildInvariantProposalPayload() internal view returns (bytes memory) {
    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, INVARIANT_AGENT_ID_A);
    zones[1] = Defaults.tzConfig(partyB, 0);

    TZTypes.TZMechanism[] memory mechs = new TZTypes.TZMechanism[](2);
    mechs[0] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Reward,
      moduleKind: TZTypes.TZModuleKind.External,
      module: address(rewardMechanism),
      data: ""
    });
    mechs[1] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Reward,
      moduleKind: TZTypes.TZModuleKind.External,
      module: address(revertingMechanism),
      data: ""
    });
    zones[0].mechanisms = mechs;

    TZTypes.TZResourceTokenConfig[] memory zone0Resources = new TZTypes.TZResourceTokenConfig[](1);
    zone0Resources[0] = TZTypes.TZResourceTokenConfig({
      tokenType: TZTypes.TZParamType.Permission, metadata: Defaults.permissionMetadata()
    });
    zones[0].resources = zone0Resources;

    TZTypes.TZResourceTokenConfig[] memory zone1Resources = new TZTypes.TZResourceTokenConfig[](1);
    zone1Resources[0] = TZTypes.TZResourceTokenConfig({
      tokenType: TZTypes.TZParamType.Directive, metadata: Defaults.directiveMetadata()
    });
    zones[1].resources = zone1Resources;

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    return abi.encode(data);
  }
}
