// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";

contract Agreement_close is AgreementBase {
  function setUp() public override {
    super.setUp();
    _advanceToActive(agreement);
  }

  function test_SetsStateToClosed() public {
    vm.warp(agreement.deadline() + 1);
    agreement.submitInput(AgreementTypes.FINALIZE, "");
    assertEq(agreement.currentState(), AgreementTypes.CLOSED);
  }

  function test_StoresOutcome() public {
    vm.warp(agreement.deadline() + 1);
    agreement.submitInput(AgreementTypes.FINALIZE, "");
    assertEq(agreement.outcome(), keccak256("EXPIRED"));
  }

  function test_DeactivatesZoneHats() public {
    // Verify hats are active before close
    uint256 hatId0 = agreement.zoneHatIds(0);
    uint256 hatId1 = agreement.zoneHatIds(1);

    vm.warp(agreement.deadline() + 1);
    agreement.submitInput(AgreementTypes.FINALIZE, "");

    // After close, getHatStatus should return false
    assertFalse(agreement.getHatStatus(hatId0));
    assertFalse(agreement.getHatStatus(hatId1));
  }

  function test_EmitsAgreementClosed() public {
    vm.warp(agreement.deadline() + 1);
    vm.expectEmit(true, false, false, false);
    emit IAgreementEvents.AgreementClosed(keccak256("EXPIRED"));
    agreement.submitInput(AgreementTypes.FINALIZE, "");
  }

  function test_EmitsAgreementStateChanged() public {
    vm.warp(agreement.deadline() + 1);
    vm.expectEmit(true, true, false, false);
    emit IAgreementEvents.AgreementStateChanged(AgreementTypes.ACTIVE, AgreementTypes.CLOSED);
    agreement.submitInput(AgreementTypes.FINALIZE, "");
  }

  function test_ClosedViaComplete_StoresCompletedOutcome() public {
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.COMPLETE, abi.encode("ipfs://a", bytes32(uint256(1))));
    vm.prank(partyB);
    agreement.submitInput(AgreementTypes.COMPLETE, abi.encode("ipfs://b", bytes32(uint256(2))));

    assertEq(agreement.outcome(), keccak256("COMPLETED"));
  }

  function test_ClosedViaExit_StoresExitedOutcome() public {
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.EXIT, abi.encode("ipfs://a", bytes32(uint256(1))));
    vm.prank(partyB);
    agreement.submitInput(AgreementTypes.EXIT, abi.encode("ipfs://b", bytes32(uint256(2))));

    assertEq(agreement.outcome(), keccak256("EXITED"));
  }
}
