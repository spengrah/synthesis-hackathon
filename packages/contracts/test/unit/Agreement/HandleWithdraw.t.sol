// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementBase } from "../../Base.t.sol";
import { IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { Agreement } from "../../../src/Agreement.sol";
import { IAgreement } from "../../../src/interfaces/IAgreement.sol";

contract Agreement_handleWithdraw is AgreementBase, IAgreementErrors, IAgreementEvents {
  function test_RevertIf_StateIsNotProposed() public {
    // Advance to NEGOTIATING
    _advanceToNegotiating(IAgreement(address(agreement)));

    vm.expectRevert(abi.encodeWithSelector(InvalidState.selector, AgreementTypes.NEGOTIATING, AgreementTypes.PROPOSED));
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.WITHDRAW, "");
  }

  function test_RevertIf_CallerIsNotProposer() public {
    // partyB tries to withdraw — only partyA (proposer) can
    vm.expectRevert(abi.encodeWithSelector(NotYourTurn.selector, partyB, partyA));
    vm.prank(partyB);
    agreement.submitInput(AgreementTypes.WITHDRAW, "");
  }

  function test_SetsStateToRejected() public {
    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.WITHDRAW, "");

    assertEq(agreement.currentState(), AgreementTypes.REJECTED);
  }

  function test_EmitsAgreementStateChanged() public {
    vm.expectEmit(true, true, false, true);
    emit AgreementStateChanged(AgreementTypes.PROPOSED, AgreementTypes.REJECTED);

    vm.prank(partyA);
    agreement.submitInput(AgreementTypes.WITHDRAW, "");
  }
}
