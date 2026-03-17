// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementHarnessBase } from "../../Base.t.sol";
import { Agreement } from "../../../src/Agreement.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";
import { AgreementHarness } from "../../harness/AgreementHarness.sol";
import { Vm } from "forge-std/Vm.sol";

/// @notice Tests for Agreement_handlePropose (tested via initialize -- propose happens at init).
contract Agreement_handlePropose is AgreementHarnessBase {
  function test_StoresTermsHashFromProposalData() public view {
    bytes memory payload = _defaultProposalPayload();
    assertEq(harness.termsHash(), keccak256(payload));
  }

  function test_StoresTermsUriFromProposalData() public view {
    assertEq(harness.docUri(), "");
  }

  function test_SetsTurnToTheOtherParty() public view {
    assertEq(harness.turn(), partyB);
  }

  function test_SetsStateToProposed() public view {
    assertEq(harness.currentState(), AgreementTypes.PROPOSED);
  }

  function test_EmitsProposalSubmitted() public {
    bytes memory proposalPayload = _defaultProposalPayload();
    vm.recordLogs();
    _createHarnessCloneWithPayload(proposalPayload);

    Vm.Log[] memory logs = vm.getRecordedLogs();
    bool found = false;
    bytes32 expectedSig = IAgreementEvents.ProposalSubmitted.selector;
    for (uint256 i = 0; i < logs.length; i++) {
      if (logs[i].topics.length > 0 && logs[i].topics[0] == expectedSig) {
        found = true;
        // topic[1] is indexed proposer
        assertEq(logs[i].topics[1], bytes32(uint256(uint160(partyA))));
        break;
      }
    }
    assertTrue(found, "ProposalSubmitted event not found");
  }

  function test_EmitsAgreementStateChanged() public {
    bytes memory proposalPayload = _defaultProposalPayload();
    vm.recordLogs();
    _createHarnessCloneWithPayload(proposalPayload);

    Vm.Log[] memory logs = vm.getRecordedLogs();
    bool found = false;
    bytes32 expectedSig = IAgreementEvents.AgreementStateChanged.selector;
    for (uint256 i = 0; i < logs.length; i++) {
      if (logs[i].topics.length > 0 && logs[i].topics[0] == expectedSig) {
        // topic[1] = fromState (bytes32(0))
        // topic[2] = toState (PROPOSED)
        if (logs[i].topics[1] == bytes32(0) && logs[i].topics[2] == AgreementTypes.PROPOSED) {
          found = true;
          break;
        }
      }
    }
    assertTrue(found, "AgreementStateChanged event not found");
  }
}
