// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementHarnessBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";
import { AgreementHarness } from "../../harness/AgreementHarness.sol";

contract Agreement_close is AgreementHarnessBase {
  function setUp() public override {
    super.setUp();
    _advanceToActive();
  }

  function test_SetsStateToClosed() public {
    vm.warp(harness.deadline() + 1);
    harness.exposed_handleFinalize();
    assertEq(harness.currentState(), AgreementTypes.CLOSED);
  }

  function test_StoresOutcome() public {
    vm.warp(harness.deadline() + 1);
    harness.exposed_handleFinalize();
    assertEq(harness.outcome(), keccak256("EXPIRED"));
  }

  function test_DeactivatesZoneHats() public {
    // Verify hats are active before close
    uint256 hatId0 = harness.zoneHatIds(0);
    uint256 hatId1 = harness.zoneHatIds(1);

    vm.warp(harness.deadline() + 1);
    harness.exposed_handleFinalize();

    // After close, getHatStatus should return false
    assertFalse(harness.getHatStatus(hatId0));
    assertFalse(harness.getHatStatus(hatId1));
  }

  function test_EmitsAgreementClosed() public {
    vm.warp(harness.deadline() + 1);
    vm.expectEmit(true, false, false, false);
    emit IAgreementEvents.AgreementClosed(keccak256("EXPIRED"));
    harness.exposed_handleFinalize();
  }

  function test_EmitsAgreementStateChanged() public {
    vm.warp(harness.deadline() + 1);
    vm.expectEmit(true, true, false, false);
    emit IAgreementEvents.AgreementStateChanged(AgreementTypes.ACTIVE, AgreementTypes.CLOSED);
    harness.exposed_handleFinalize();
  }

  function test_ClosedViaComplete_StoresCompletedOutcome() public {
    harness.exposed_handleComplete(partyA, abi.encode("ipfs://a", bytes32(uint256(1))));
    harness.exposed_handleComplete(partyB, abi.encode("ipfs://b", bytes32(uint256(2))));

    assertEq(harness.outcome(), keccak256("COMPLETED"));
  }

  function test_ClosedViaExit_StoresExitedOutcome() public {
    harness.exposed_handleExit(partyA, abi.encode("ipfs://a", bytes32(uint256(1))));
    harness.exposed_handleExit(partyB, abi.encode("ipfs://b", bytes32(uint256(2))));

    assertEq(harness.outcome(), keccak256("EXITED"));
  }

  // ---- Local advance helpers ----

  function _advanceToAccepted() internal {
    bytes memory payload = _defaultProposalPayload();
    harness.exposed_handleAccept(partyB, payload);
  }

  function _advanceToActive() internal {
    _advanceToAccepted();
    harness.exposed_handleActivate(partyA);
  }
}
