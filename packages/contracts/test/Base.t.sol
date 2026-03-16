// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { Test } from "forge-std/Test.sol";
import { IHats } from "hats-protocol/Interfaces/IHats.sol";

import { Constants } from "./helpers/Constants.sol";
import { Defaults } from "./helpers/Defaults.sol";
import { TestHelpers } from "./helpers/TestHelpers.sol";

import { IReputationRegistry } from "../src/interfaces/IERC8004.sol";
import { TZTypes } from "../src/lib/TZTypes.sol";
import { AgreementTypes } from "../src/lib/AgreementTypes.sol";

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
  // ResourceTokenRegistry internal registry;
  // HatValidator internal hatValidator;
  // TrustZone internal trustZoneImpl;
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

  /// @dev Deploy ResourceTokenRegistry with `deployer` as owner.
  function _deployResourceTokenRegistry() internal {
    vm.startPrank(deployer);
    // registry = new ResourceTokenRegistry();
    vm.stopPrank();
  }

  /// @dev Deploy HatValidator (single instance, shared across accounts).
  function _deployHatValidator() internal {
    vm.startPrank(deployer);
    // hatValidator = new HatValidator();
    vm.stopPrank();
  }

  /// @dev Deploy TrustZone implementation (used as clone source).
  function _deployTrustZoneImpl() internal {
    vm.startPrank(deployer);
    // trustZoneImpl = new TrustZone();
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
    _deployAgreementRegistry();
  }

  // ====================
  // Hat tree helpers
  // ====================

  /// @dev Create a minimal hat tree: top hat → agreement hat → two zone hats.
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
    // registry.registerMinter(minter);
  }

  // ====================
  // Agreement state helpers
  // ====================

  /// @dev Advance an agreement from PROPOSED to NEGOTIATING (partyB counters).
  function _advanceToNegotiating(address agreement) internal {
    // vm.prank(partyB);
    // IAgreement(agreement).submitInput(AgreementTypes.COUNTER, _defaultCounterPayload());
  }

  /// @dev Advance an agreement to ACCEPTED (current turn party accepts).
  function _advanceToAccepted(address agreement) internal {
    // address turnParty = IAgreement(agreement).turn();
    // vm.prank(turnParty);
    // IAgreement(agreement).submitInput(AgreementTypes.ACCEPT, "");
  }

  /// @dev Advance an agreement to ACTIVE (accept + activate).
  function _advanceToActive(address agreement) internal {
    _advanceToAccepted(agreement);
    // vm.prank(partyA);
    // IAgreement(agreement).submitInput(AgreementTypes.ACTIVATE, _defaultActivatePayload());
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
abstract contract ResourceTokenRegistryBase is ForkTestBase {
  address internal minter;

  function setUp() public virtual override {
    super.setUp();
    minter = makeAddr("minter");
    _deployResourceTokenRegistry();
    _registerMinter(minter);
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
  function setUp() public virtual override {
    super.setUp();
    _deployHatValidator();
    _deployTrustZoneImpl();
    _createHatTree();
    // Deploy and initialize a clone for testing:
    // trustZone = TrustZone(Clones.cloneDeterministic(address(trustZoneImpl), salt));
    // trustZone.initialize(hatValidator, ..., agreement, ..., hookMultiplexer, ...);
  }
}

/// @notice Base for Agreement unit tests.
abstract contract AgreementBase is ForkTestBase {
  function setUp() public virtual override {
    super.setUp();
    _deployAll();
    _createHatTree();
    // Create agreement via registry:
    // vm.prank(partyA);
    // agreement = agreementRegistry.createAgreement(partyB, _defaultProposalPayload());
  }
}

/// @notice Base for Agreement unit tests using a harness to expose internals.
abstract contract AgreementHarnessBase is AgreementBase {
  function setUp() public virtual override {
    super.setUp();
    // Override: deploy AgreementHarness instead of Agreement
    // agreementHarness = new AgreementHarness(...);
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
    address agreement = _createDefaultAgreement();
    _advanceToActive(agreement);
    return agreement;
  }
}
