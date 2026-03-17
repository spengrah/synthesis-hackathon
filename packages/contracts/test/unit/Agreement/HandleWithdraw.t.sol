// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementHarnessBase } from "../../Base.t.sol";
import { IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { AgreementHarness } from "../../harness/AgreementHarness.sol";

contract Agreement_handleWithdraw is AgreementHarnessBase, IAgreementErrors, IAgreementEvents {
  function test_RevertIf_StateIsNotProposed() public {
    // Advance to NEGOTIATING
    harness.exposed_handleCounter(partyB, _defaultProposalPayload());

    vm.expectRevert(abi.encodeWithSelector(InvalidState.selector, AgreementTypes.NEGOTIATING, AgreementTypes.PROPOSED));
    harness.exposed_handleWithdraw(partyA);
  }

  function test_RevertIf_CallerIsNotProposer() public {
    // partyB tries to withdraw — only partyA (proposer) can
    vm.expectRevert(abi.encodeWithSelector(NotYourTurn.selector, partyB, partyA));
    harness.exposed_handleWithdraw(partyB);
  }

  function test_SetsStateToRejected() public {
    harness.exposed_handleWithdraw(partyA);

    assertEq(harness.currentState(), AgreementTypes.REJECTED);
  }

  function test_EmitsAgreementStateChanged() public {
    vm.expectEmit(true, true, false, true);
    emit AgreementStateChanged(AgreementTypes.PROPOSED, AgreementTypes.REJECTED);

    harness.exposed_handleWithdraw(partyA);
  }
}
