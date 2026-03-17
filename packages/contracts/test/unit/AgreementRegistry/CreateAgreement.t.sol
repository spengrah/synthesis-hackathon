// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { Vm } from "forge-std/Vm.sol";

import { AgreementRegistryBase } from "../../Base.t.sol";
import { IAgreementRegistryErrors, IAgreementRegistryEvents } from "../../../src/interfaces/IAgreementRegistry.sol";
import { IAgreement } from "../../../src/interfaces/IAgreement.sol";
import { Agreement } from "../../../src/Agreement.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";

contract AgreementRegistry_createAgreement is AgreementRegistryBase {
  bytes internal proposalPayload;

  function setUp() public override {
    super.setUp();
    proposalPayload = _defaultProposalPayload();
  }

  // ---- Revert cases ----

  function test_RevertIf_PartyBIsZeroAddress() public {
    vm.prank(partyA);
    vm.expectRevert(abi.encodeWithSelector(IAgreementRegistryErrors.InvalidParty.selector, address(0)));
    agreementRegistry.createAgreement(address(0), proposalPayload);
  }

  function test_RevertIf_PartiesIdentical() public {
    vm.prank(partyA);
    vm.expectRevert(IAgreementRegistryErrors.PartiesIdentical.selector);
    agreementRegistry.createAgreement(partyA, proposalPayload);
  }

  // ---- Happy path ----

  function test_CreatesAgreementLevelHat() public {
    vm.prank(partyA);
    address agreement = agreementRegistry.createAgreement(partyB, proposalPayload);

    uint256 hatId = agreementRegistry.agreementHatIds(agreement);
    assertTrue(hatId != 0, "hat ID should be non-zero");

    // The agreement should wear the hat
    assertTrue(hats.isWearerOfHat(agreement, hatId));
  }

  function test_DeploysAgreementClone() public {
    vm.prank(partyA);
    address agreement = agreementRegistry.createAgreement(partyB, proposalPayload);

    // Should be a valid contract
    assertTrue(agreement != address(0));
    assertTrue(agreement.code.length > 0, "clone should have code");
  }

  function test_UsesDeterministicSalt() public {
    vm.prank(partyA);
    address agreement = agreementRegistry.createAgreement(partyB, proposalPayload);

    uint256 hatId = agreementRegistry.agreementHatIds(agreement);
    bytes32 salt = keccak256(abi.encode(hatId, block.chainid));

    address predicted =
      Clones.predictDeterministicAddress(agreementRegistry.agreementImplementation(), salt, address(agreementRegistry));
    assertEq(agreement, predicted);
  }

  function test_MintsAgreementHatToClone() public {
    vm.prank(partyA);
    address agreement = agreementRegistry.createAgreement(partyB, proposalPayload);

    uint256 hatId = agreementRegistry.agreementHatIds(agreement);
    assertTrue(hats.isWearerOfHat(agreement, hatId));
  }

  function test_RegistersAgreementAsMinter() public {
    vm.prank(partyA);
    address agreement = agreementRegistry.createAgreement(partyB, proposalPayload);

    assertTrue(registry.isMinter(agreement));
  }

  function test_InitializesAgreement() public {
    vm.prank(partyA);
    address agreement = agreementRegistry.createAgreement(partyB, proposalPayload);

    IAgreement agr = IAgreement(agreement);
    assertEq(agr.parties(0), partyA);
    assertEq(agr.parties(1), partyB);
  }

  function test_StoresAgreementHatIdMapping() public {
    vm.prank(partyA);
    address agreement = agreementRegistry.createAgreement(partyB, proposalPayload);

    uint256 hatId = agreementRegistry.agreementHatIds(agreement);
    assertTrue(hatId != 0);
  }

  function test_SetsStateToProposed() public {
    vm.prank(partyA);
    address agreement = agreementRegistry.createAgreement(partyB, proposalPayload);

    assertEq(IAgreement(agreement).currentState(), AgreementTypes.PROPOSED);
  }

  function test_SetsTurnToPartyB() public {
    vm.prank(partyA);
    address agreement = agreementRegistry.createAgreement(partyB, proposalPayload);

    assertEq(IAgreement(agreement).turn(), partyB);
  }

  function test_EmitsAgreementCreated() public {
    vm.prank(partyA);
    // We can't predict the exact agreement address, so we just check the event is emitted
    // with the right indexed params. Use recordLogs.
    vm.recordLogs();
    address agreement = agreementRegistry.createAgreement(partyB, proposalPayload);

    uint256 hatId = agreementRegistry.agreementHatIds(agreement);

    // Check logs for AgreementCreated event
    Vm.Log[] memory logs = vm.getRecordedLogs();
    bytes32 eventSig = keccak256("AgreementCreated(address,address,uint256,address,address)");
    bool found = false;
    for (uint256 i = 0; i < logs.length; i++) {
      if (logs[i].topics[0] == eventSig) {
        // topics[1] = indexed agreement, topics[2] = indexed creator
        assertEq(address(uint160(uint256(logs[i].topics[1]))), agreement);
        assertEq(address(uint160(uint256(logs[i].topics[2]))), partyA);
        // Decode non-indexed: agreementHatId, partyA, partyB
        (uint256 emittedHatId, address emittedPartyA, address emittedPartyB) =
          abi.decode(logs[i].data, (uint256, address, address));
        assertEq(emittedHatId, hatId);
        assertEq(emittedPartyA, partyA);
        assertEq(emittedPartyB, partyB);
        found = true;
        break;
      }
    }
    assertTrue(found, "AgreementCreated event not found");
  }

  function test_ReturnsAgreementAddress() public {
    vm.prank(partyA);
    address agreement = agreementRegistry.createAgreement(partyB, proposalPayload);

    assertTrue(agreement != address(0));
    assertTrue(agreement.code.length > 0);
  }
}

contract AgreementRegistry_createAgreement_deterministic is AgreementRegistryBase {
  bytes internal proposalPayload;

  function setUp() public override {
    super.setUp();
    proposalPayload = _defaultProposalPayload();
  }

  function test_DeploysToDeterministicAddress() public {
    vm.prank(partyA);
    address agreement = agreementRegistry.createAgreement(partyB, proposalPayload);

    uint256 hatId = agreementRegistry.agreementHatIds(agreement);
    bytes32 salt = keccak256(abi.encode(hatId, block.chainid));

    address predicted =
      Clones.predictDeterministicAddress(agreementRegistry.agreementImplementation(), salt, address(agreementRegistry));
    assertEq(agreement, predicted);
  }

  function test_DifferentHatIdDeploysToDifferentAddress() public {
    vm.prank(partyA);
    address agreement1 = agreementRegistry.createAgreement(partyB, proposalPayload);

    // Create a second agreement (different parties to avoid identical check issues)
    address otherParty = makeAddr("otherParty");
    vm.prank(partyA);
    address agreement2 = agreementRegistry.createAgreement(otherParty, proposalPayload);

    assertTrue(agreement1 != agreement2, "different agreements should have different addresses");
  }
}

contract AgreementRegistry_agreementHatIds is AgreementRegistryBase {
  function test_ReturnsZero_GivenAgreementNotCreated() public {
    assertEq(agreementRegistry.agreementHatIds(makeAddr("nonexistent")), 0);
  }

  function test_ReturnsHatId_GivenAgreementCreated() public {
    bytes memory proposalPayload = _defaultProposalPayload();
    vm.prank(partyA);
    address agreement = agreementRegistry.createAgreement(partyB, proposalPayload);

    uint256 hatId = agreementRegistry.agreementHatIds(agreement);
    assertTrue(hatId != 0, "hat ID should be non-zero");
  }
}
