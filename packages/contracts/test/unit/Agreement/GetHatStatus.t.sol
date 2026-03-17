// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";

contract Agreement_getHatStatus is AgreementBase {
  function test_ReturnsFalse_GivenStateIsNotActive() public view {
    // State is PROPOSED
    assertFalse(agreement.getHatStatus(0));
  }

  function test_ReturnsFalse_GivenStateIsActiveAndDeadlineHasPassed() public {
    _advanceToActive(agreement);
    vm.warp(agreement.deadline() + 1);
    assertFalse(agreement.getHatStatus(0));
  }

  function test_ReturnsTrue_GivenStateIsActiveAndDeadlineHasNotPassed() public {
    _advanceToActive(agreement);
    assertTrue(agreement.getHatStatus(0));
  }

  function test_ReturnsFalse_GivenStateIsClosed() public {
    _advanceToActive(agreement);
    vm.warp(agreement.deadline() + 1);
    agreement.submitInput(AgreementTypes.FINALIZE, "");
    assertFalse(agreement.getHatStatus(0));
  }
}
