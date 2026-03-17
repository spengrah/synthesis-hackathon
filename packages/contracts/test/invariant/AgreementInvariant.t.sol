// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { StdInvariant } from "forge-std/StdInvariant.sol";
import { Test } from "forge-std/Test.sol";

import { AgreementHarnessBase } from "../Base.t.sol";
import { AgreementHarness } from "../harness/AgreementHarness.sol";
import { TrustZone } from "../../src/TrustZone.sol";
import { IHatValidator } from "../../src/interfaces/IHatValidator.sol";
import { AgreementTypes } from "../../src/lib/AgreementTypes.sol";
import { TZTypes } from "../../src/lib/TZTypes.sol";
import { Defaults } from "../helpers/Defaults.sol";
import { Constants } from "../helpers/Constants.sol";

contract AgreementInvariantMockMechanism {
  fallback() external payable { }

  receive() external payable { }
}

/// @dev Handler scaffold for Agreement invariants.
/// It drives a single agreement instance through valid and invalid inputs while tracking
/// enough ghost state to make core state-machine invariants implementable.
contract AgreementInvariantHandler is Test {
  AgreementHarness internal agreement;
  address internal partyA;
  address internal partyB;
  address internal adjudicator;
  address[] internal _parties;
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

  address[2] internal _snapTrustZones;
  uint256[2] internal _snapZoneHatIds;
  uint256[2] internal _snapAgentIds;
  uint256 internal _snapDeadline;
  address internal _snapAdjudicator;
  uint256 internal _snapMechanismCount;

  bool[2] internal _lastCompletionSignaled;
  bool[2] internal _lastExitSignaled;
  bool[2] internal _explicitlyDeactivated;

  constructor(
    AgreementHarness _agreement,
    address _partyA,
    address _partyB,
    address _adjudicator,
    bytes memory _proposalPayload
  ) {
    agreement = _agreement;
    partyA = _partyA;
    partyB = _partyB;
    adjudicator = _adjudicator;
    _parties.push(_partyA);
    _parties.push(_partyB);
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

  function activate() external {
    _submit(partyA, AgreementTypes.ACTIVATE, "");
  }

  function claim() external {
    _submit(partyA, AgreementTypes.CLAIM, abi.encode(uint256(0), bytes("invariant-evidence")));
  }

  function complete(uint8 partySeed) external {
    address caller = _partyFromSeed(partySeed);
    bytes memory payload = abi.encode("ipfs://complete", keccak256("complete"));
    _submit(caller, AgreementTypes.COMPLETE, payload);
  }

  function exitSignal(uint8 partySeed) external {
    address caller = _partyFromSeed(partySeed);
    bytes memory payload = abi.encode("ipfs://exit", keccak256("exit"));
    _submit(caller, AgreementTypes.EXIT, payload);
  }

  function finalize(uint32 extraSeconds) external {
    uint256 deadline = agreement.deadline();
    if (deadline != 0) {
      vm.warp(deadline + 1 + uint256(extraSeconds % 1 days));
    }
    _submit(partyA, AgreementTypes.FINALIZE, "");
  }

  function adjudicateReward(bool closeAgreement) external {
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

    _submit(adjudicator, AgreementTypes.ADJUDICATE, abi.encode(uint256(0), true, actions));
  }

  function adjudicateDeactivate(uint8 targetSeed, bool closeAgreement) external {
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

    bool success = _submit(adjudicator, AgreementTypes.ADJUDICATE, abi.encode(uint256(0), true, actions));
    if (success && !closeAgreement) {
      _explicitlyDeactivated[targetIndex] = true;
    }
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

  function trackedTrustZone(uint256 index) external view returns (address) {
    return _snapTrustZones[index];
  }

  function trackedZoneHat(uint256 index) external view returns (uint256) {
    return _snapZoneHatIds[index];
  }

  function explicitlyDeactivated(uint256 index) external view returns (bool) {
    return _explicitlyDeactivated[index];
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
}

contract Agreement_Invariants is StdInvariant, AgreementHarnessBase {
  AgreementHarness internal invariantAgreement;
  AgreementInvariantHandler internal handler;
  AgreementInvariantMockMechanism internal rewardMechanism;
  address[] internal _targetedSenders;

  uint256 internal constant EXPECTED_PERMISSION_ID = (uint256(1) << 8) | 0x01;
  uint256 internal constant EXPECTED_DIRECTIVE_ID = (uint256(1) << 8) | 0x03;

  function setUp() public override {
    super.setUp();

    rewardMechanism = new AgreementInvariantMockMechanism();

    bytes memory payload = _buildInvariantProposalPayload();
    (invariantAgreement, agrmtHatId) = _createHarnessClone(payload);

    handler = new AgreementInvariantHandler(invariantAgreement, partyA, partyB, adjudicator, payload);

    targetContract(address(handler));
    _configureTargetSenders();

    bytes4[] memory selectors = new bytes4[](10);
    selectors[0] = AgreementInvariantHandler.counter.selector;
    selectors[1] = AgreementInvariantHandler.accept.selector;
    selectors[2] = AgreementInvariantHandler.reject.selector;
    selectors[3] = AgreementInvariantHandler.withdraw.selector;
    selectors[4] = AgreementInvariantHandler.activate.selector;
    selectors[5] = AgreementInvariantHandler.claim.selector;
    selectors[6] = AgreementInvariantHandler.complete.selector;
    selectors[7] = AgreementInvariantHandler.exitSignal.selector;
    selectors[8] = AgreementInvariantHandler.finalize.selector;
    selectors[9] = AgreementInvariantHandler.adjudicateDeactivate.selector;
    targetSelector(FuzzSelector({ addr: address(handler), selectors: selectors }));

    bytes4[] memory moreSelectors = new bytes4[](1);
    moreSelectors[0] = AgreementInvariantHandler.adjudicateReward.selector;
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

  function invariant_AdjudicatedClaimsAreSubsetOfFiledClaims() public {
    vm.skip(true, "TODO: requires a handler-side adjudication ledger or event-derived claim tracking");
  }

  function invariant_RevertedAdjudicationDoesNotConsumeClaim() public {
    vm.skip(true, "TODO: requires a negative-path adjudication handler that retries the same claimId");
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

  function invariant_InactiveZoneCannotAuthorize() public {
    vm.skip(true, "TODO: requires a dedicated authorized signer and direct execute/signature probes");
  }

  function invariant_OnlyAuthorizedCallersCanExecute() public {
    vm.skip(true, "TODO: requires TrustZone authority probes driven by a separate actor handler");
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

  function invariant_NoReputationWriteForZeroAgentId() public {
    vm.skip(true, "TODO: requires a mockable reputation registry and call ledger");
  }

  function invariant_CloseFeedbackRoutingMatchesOutcome() public {
    vm.skip(true, "TODO: requires outcome-aware feedback capture against a mock registry");
  }

  function invariant_RevertedCompositeActionsLeaveNoPartialState() public {
    vm.skip(true, "TODO: requires dedicated rollback probes for acceptAndActivate and failed adjudication");
  }

  function _buildInvariantProposalPayload() internal view returns (bytes memory) {
    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);

    TZTypes.TZMechanism[] memory mechs = new TZTypes.TZMechanism[](1);
    mechs[0] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Reward,
      moduleKind: TZTypes.TZModuleKind.External,
      module: address(rewardMechanism),
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
