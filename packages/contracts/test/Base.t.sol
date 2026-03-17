// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { Test } from "forge-std/Test.sol";
import { IHats } from "hats-protocol/Interfaces/IHats.sol";

import { Constants } from "./helpers/Constants.sol";
import { Defaults } from "./helpers/Defaults.sol";
import { TestHelpers } from "./helpers/TestHelpers.sol";

import { ResourceTokenRegistry } from "../src/ResourceTokenRegistry.sol";
import { HatValidator } from "../src/modules/HatValidator.sol";
import { TrustZone } from "../src/TrustZone.sol";
import { Agreement } from "../src/Agreement.sol";
import { IAgreement, IAgreementErrors } from "../src/interfaces/IAgreement.sol";
import { IReputationRegistry } from "../src/interfaces/IERC8004.sol";
import { TZTypes } from "../src/lib/TZTypes.sol";
import { AgreementTypes } from "../src/lib/AgreementTypes.sol";

import { DeployResourceTokenRegistry } from "../script/DeployResourceTokenRegistry.s.sol";
import { DeployHatValidator } from "../script/DeployHatValidator.s.sol";
import { DeployTrustZone } from "../script/DeployTrustZone.s.sol";
import { DeployAgreement } from "../script/DeployAgreement.s.sol";
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";

import { HookMultiPlexer } from "core-modules/HookMultiPlexer/HookMultiPlexer.sol";
import { MockRegistry } from "modulekit/module-bases/mocks/MockRegistry.sol";
import { IERC7484 } from "modulekit/module-bases/interfaces/IERC7484.sol";

// ====================
// ForkTestBase
// ====================

/// @notice Base test contract. Forks Base mainnet and sets up real deployed dependencies.
///         Deployment helpers are defined here and called selectively by each contract-specific base.
abstract contract ForkTestBase is Test {
  // ---- Real deployed dependencies ----
  IHats internal hats = IHats(Constants.HATS);
  IReputationRegistry internal reputationRegistry = IReputationRegistry(Constants.REPUTATION_REGISTRY);
  address internal identityRegistry = Constants.IDENTITY_REGISTRY;

  // ---- Our contracts (set by deployment helpers) ----
  ResourceTokenRegistry internal registry;
  HatValidator internal hatValidator;
  TrustZone internal trustZoneImpl;
  Agreement internal agreementImpl;
  HookMultiPlexer internal hookMultiplexer;
  // AgreementRegistry internal agreementRegistry;

  // ---- Hat tree (set by _createHatTree) ----
  uint256 internal topHatId;
  uint256 internal agreementHatId;
  uint256 internal zoneHatA;
  uint256 internal zoneHatB;

  // ---- Test actors ----
  address internal partyA;
  address internal partyB;
  address internal adjudicator;
  address internal observer;
  address internal deployer;
  address internal hatWearerA;
  address internal hatWearerB;

  function setUp() public virtual {
    vm.createSelectFork("base", Constants.FORK_BLOCK);

    partyA = makeAddr("partyA");
    partyB = makeAddr("partyB");
    adjudicator = makeAddr("adjudicator");
    observer = makeAddr("observer");
    deployer = makeAddr("deployer");
    hatWearerA = partyA;
    hatWearerB = partyB;

    vm.deal(partyA, 100 ether);
    vm.deal(partyB, 100 ether);
    vm.deal(deployer, 100 ether);
  }

  // ====================
  // Deployment helpers
  // ====================

  /// @dev Deploy ResourceTokenRegistry using the deploy script. `deployer` becomes owner.
  function _deployResourceTokenRegistry() internal virtual {
    vm.startPrank(deployer);
    DeployResourceTokenRegistry deployScript = new DeployResourceTokenRegistry();
    registry = deployScript.execute(deployer);
    vm.stopPrank();
  }

  /// @dev Deploy HatValidator using the deploy script.
  function _deployHatValidator() internal virtual {
    vm.startPrank(deployer);
    DeployHatValidator deployScript = new DeployHatValidator();
    hatValidator = deployScript.execute(address(hats));
    vm.stopPrank();
  }

  /// @dev Deploy TrustZone implementation (used as clone source).
  function _deployTrustZoneImpl() internal {
    vm.startPrank(deployer);
    DeployTrustZone deployScript = new DeployTrustZone();
    trustZoneImpl = deployScript.execute();
    vm.stopPrank();
  }

  /// @dev Deploy HookMultiPlexer with a MockRegistry.
  function _deployHookMultiplexer() internal {
    vm.startPrank(deployer);
    MockRegistry mockRegistry = new MockRegistry();
    hookMultiplexer = new HookMultiPlexer(IERC7484(address(mockRegistry)));
    vm.stopPrank();
  }

  /// @dev Deploy Agreement implementation using the deploy script.
  ///      Requires registry, hatValidator, trustZoneImpl, and hookMultiplexer to be deployed first.
  function _deployAgreementImpl() internal {
    vm.startPrank(deployer);
    DeployAgreement deployScript = new DeployAgreement();
    agreementImpl = deployScript.execute(
      address(hats),
      address(registry),
      identityRegistry,
      address(reputationRegistry),
      address(trustZoneImpl),
      address(hookMultiplexer),
      address(hatValidator)
    );
    vm.stopPrank();
  }

  /// @dev Deploy AgreementRegistry and wire it to the other contracts.
  ///      Requires registry, hatValidator, and trustZoneImpl to be deployed first.
  function _deployAgreementRegistry() internal {
    vm.startPrank(deployer);
    // agreementRegistry = new AgreementRegistry(
    //   address(hats),
    //   address(registry),
    //   identityRegistry,
    //   address(reputationRegistry),
    //   address(trustZoneImpl)
    // );
    vm.stopPrank();
  }

  /// @dev Deploy all contracts and wire them together.
  function _deployAll() internal {
    _deployResourceTokenRegistry();
    _deployHatValidator();
    _deployTrustZoneImpl();
    _deployHookMultiplexer();
    _deployAgreementImpl();
    _deployAgreementRegistry();
  }

  // ====================
  // Hat tree helpers
  // ====================

  /// @dev Create a minimal hat tree: top hat -> agreement hat -> two zone hats.
  ///      Mints zone hats to partyA and partyB.
  function _createHatTree() internal {
    vm.startPrank(deployer);
    topHatId = hats.mintTopHat(deployer, "Trust Zones", "");
    agreementHatId = hats.createHat(topHatId, "Agreement #1", 1, deployer, deployer, true, "");
    zoneHatA = hats.createHat(agreementHatId, "Zone A", 1, deployer, deployer, true, "");
    zoneHatB = hats.createHat(agreementHatId, "Zone B", 1, deployer, deployer, true, "");
    hats.mintHat(zoneHatA, hatWearerA);
    hats.mintHat(zoneHatB, hatWearerB);
    vm.stopPrank();
  }

  /// @dev Create a single test hat under a new top hat. Returns (topHatId, childHatId).
  function _createSingleHat(address wearer) internal returns (uint256 _topHatId, uint256 childHatId) {
    vm.startPrank(deployer);
    _topHatId = hats.mintTopHat(deployer, "Test Top Hat", "");
    childHatId = hats.createHat(_topHatId, "Test Hat", 1, deployer, deployer, true, "");
    hats.mintHat(childHatId, wearer);
    vm.stopPrank();
  }

  // ====================
  // Minter helpers
  // ====================

  /// @dev Register an address as an authorized minter on the ResourceTokenRegistry.
  function _registerMinter(address minter) internal {
    vm.prank(deployer);
    registry.registerMinter(minter);
  }

  // ====================
  // Agreement helpers
  // ====================

  uint256 private _cloneNonce;

  /// @dev Create an agreement clone, initialize it, and return the clone address.
  ///      Creates a hat tree where the clone can create child hats.
  function _createAgreementClone(bytes memory proposalPayload)
    internal
    returns (Agreement agreementClone, uint256 _agreementHatId)
  {
    // Predict clone address (use nonce for uniqueness)
    bytes32 salt = keccak256(abi.encode("agreement-test", _cloneNonce++));
    address predicted = Clones.predictDeterministicAddress(address(agreementImpl), salt);

    // Create hat tree: topHat (deployer) -> agreementHat (clone as eligibility/toggle)
    // Transfer topHat to clone so it can create child zone hats (Hats requires admin wearer).
    vm.startPrank(deployer);
    topHatId = hats.mintTopHat(deployer, "Trust Zones", "");
    _agreementHatId = hats.createHat(topHatId, "Agreement #1", 10, predicted, predicted, true, "");
    hats.transferHat(topHatId, deployer, predicted);
    vm.stopPrank();

    // Deploy and initialize clone
    agreementClone = Agreement(Clones.cloneDeterministic(address(agreementImpl), salt));

    // Register clone as minter on ResourceTokenRegistry
    _registerMinter(address(agreementClone));

    // Initialize
    address[2] memory partiesArr = [partyA, partyB];
    agreementClone.initialize(partiesArr, _agreementHatId, proposalPayload);

    return (agreementClone, _agreementHatId);
  }

  // ====================
  // Agreement state helpers
  // ====================

  /// @dev Advance an agreement from PROPOSED to NEGOTIATING (partyB counters).
  function _advanceToNegotiating(IAgreement agreement) internal {
    bytes memory payload = _defaultProposalPayload();
    vm.prank(partyB);
    agreement.submitInput(AgreementTypes.COUNTER, payload);
  }

  /// @dev Advance an agreement to ACCEPTED (current turn party accepts).
  function _advanceToAccepted(IAgreement agreement) internal {
    address turnParty = agreement.turn();
    bytes memory payload = _defaultProposalPayload();
    // Need the terms hash to match
    // The payload we accept with must hash to the current termsHash
    // Since we initialized with _defaultProposalPayload, we can re-submit it
    vm.prank(turnParty);
    agreement.submitInput(AgreementTypes.ACCEPT, payload);
  }

  /// @dev Advance an agreement to ACTIVE (accept + activate).
  function _advanceToActive(IAgreement agreement) internal {
    _advanceToAccepted(agreement);
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.ACTIVATE, "");
  }

  // ====================
  // Default payload builders
  // ====================

  /// @dev Build a default ProposalData payload for tests.
  function _defaultProposalPayload() internal view returns (bytes memory) {
    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);
    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    return abi.encode(data);
  }

  /// @dev Build a default counter payload (same structure, different hash for distinction).
  function _defaultCounterPayload() internal view returns (bytes memory) {
    return _defaultProposalPayload(); // in practice would differ
  }

  /// @dev Build a default activate payload.
  function _defaultActivatePayload() internal view returns (bytes memory) {
    return _defaultProposalPayload();
  }

  // ====================
  // Assertion helpers
  // ====================

  /// @dev Get the party index (0 or 1) for an address. Reverts if not a party.
  function _partyIndex(address party) internal view returns (uint256) {
    if (party == partyA) return 0;
    if (party == partyB) return 1;
    revert("not a party");
  }
}

// ====================
// Contract-specific bases
// ====================

/// @notice Base for ResourceTokenRegistry unit tests.
/// @dev Does NOT require a fork — ResourceTokenRegistry has no external dependencies.
///      Uses the deploy script to ensure tests validate the actual deployment path.
abstract contract ResourceTokenRegistryBase is Test {
  ResourceTokenRegistry internal registry;

  address internal registryOwner = makeAddr("registryOwner");
  address internal minter = makeAddr("minter");
  address internal alice = makeAddr("alice");
  address internal bob = makeAddr("bob");
  address internal unauthorized = makeAddr("unauthorized");

  function setUp() public virtual {
    vm.startPrank(registryOwner);
    DeployResourceTokenRegistry deployScript = new DeployResourceTokenRegistry();
    registry = deployScript.execute(registryOwner);
    registry.registerMinter(minter);
    vm.stopPrank();
  }

  /// @dev Helper: mint a default token to `to` from `minter`. Returns the auto-generated token ID.
  function _mintDefault(address to, uint8 tokenType) internal returns (uint256) {
    vm.prank(minter);
    return registry.mint(to, tokenType, Defaults.DEFAULT_METADATA);
  }
}

/// @notice Base for HatValidator unit tests.
abstract contract HatValidatorBase is ForkTestBase {
  uint256 internal testHatId;

  function setUp() public virtual override {
    super.setUp();
    _deployHatValidator();
    (, testHatId) = _createSingleHat(hatWearerA);
  }
}

/// @notice Base for TrustZone unit tests.
abstract contract TrustZoneBase is ForkTestBase {
  TrustZone internal trustZone;
  address internal mockExecutor;

  function setUp() public virtual override {
    super.setUp();
    _deployHatValidator();
    _deployTrustZoneImpl();
    _createHatTree();

    // Deploy a mock executor module that reports isModuleType(2) = true
    mockExecutor = address(new MockExecutorModule());

    // Deploy and initialize a clone for testing
    bytes32 salt = keccak256("trustzone-test");
    trustZone = TrustZone(payable(Clones.cloneDeterministic(address(trustZoneImpl), salt)));

    // Initialize with zoneHatA (partyA is the hat wearer)
    trustZone.initialize(
      address(hatValidator),
      abi.encode(zoneHatA),
      mockExecutor,
      "",
      address(0), // no hook
      ""
    );

    // Fund the trust zone
    vm.deal(address(trustZone), 10 ether);
  }
}

import { IERC7579Module, MODULE_TYPE_EXECUTOR } from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";

/// @dev Minimal mock executor module for testing. Reports isModuleType(2)=true and no-ops on install/uninstall.
contract MockExecutorModule is IERC7579Module {
  function onInstall(bytes calldata) external override { }
  function onUninstall(bytes calldata) external override { }

  function isModuleType(uint256 moduleTypeId) external pure override returns (bool) {
    return moduleTypeId == MODULE_TYPE_EXECUTOR;
  }
}

/// @notice Base for Agreement unit tests.
abstract contract AgreementBase is ForkTestBase {
  Agreement internal agreement;
  uint256 internal agrmtHatId;

  function setUp() public virtual override {
    super.setUp();
    _deployAll();

    bytes memory proposalPayload = _defaultProposalPayload();
    (agreement, agrmtHatId) = _createAgreementClone(proposalPayload);
  }
}

/// @notice Base for Agreement unit tests using a harness to expose internals.
abstract contract AgreementHarnessBase is AgreementBase {
  function setUp() public virtual override {
    super.setUp();
    // Harness not needed since internal functions use private storage accessor.
    // Tests use public interface (submitInput, initialize, etc.)
  }
}

/// @notice Base for AgreementRegistry unit tests.
abstract contract AgreementRegistryBase is ForkTestBase {
  function setUp() public virtual override {
    super.setUp();
    _deployResourceTokenRegistry();
    _deployHatValidator();
    _deployTrustZoneImpl();
    _deployAgreementRegistry();
  }
}

/// @notice Base for integration tests. Full environment with all contracts deployed.
abstract contract IntegrationBase is ForkTestBase {
  function setUp() public virtual override {
    super.setUp();
    _deployAll();
    _createHatTree();
    _registerMinter(deployer); // for manual token minting in tests
  }

  /// @dev Create a fresh agreement between partyA and partyB with default terms.
  function _createDefaultAgreement() internal returns (address) {
    // vm.prank(partyA);
    // return agreementRegistry.createAgreement(partyB, _defaultProposalPayload());
    return address(0);
  }

  /// @dev Create an agreement and advance it to ACTIVE state.
  function _createActiveAgreement() internal returns (address) {
    address agr = _createDefaultAgreement();
    _advanceToActive(IAgreement(agr));
    return agr;
  }
}
