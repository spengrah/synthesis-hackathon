// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementHarnessBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";
import { AgreementHarness } from "../../harness/AgreementHarness.sol";

contract Agreement_acceptAndActivate is AgreementHarnessBase {
  function test_RevertIf_StateIsNotProposedOrNegotiating() public {
    _advanceToAccepted();
    vm.expectRevert(
      abi.encodeWithSelector(IAgreementErrors.InvalidState.selector, AgreementTypes.ACCEPTED, AgreementTypes.PROPOSED)
    );
    vm.prank(partyA);
    harness.acceptAndActivate(_defaultProposalPayload());
  }

  function test_RevertIf_CallerIsNotAuthorizedToAccept() public {
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.NotYourTurn.selector, partyA, partyB));
    vm.prank(partyA);
    harness.acceptAndActivate(_defaultProposalPayload());
  }

  function test_TransitionsDirectlyToActive() public {
    vm.prank(partyB);
    harness.acceptAndActivate(_defaultProposalPayload());
    assertEq(harness.currentState(), AgreementTypes.ACTIVE);
  }

  function test_DeploysTrustZones() public {
    vm.prank(partyB);
    harness.acceptAndActivate(_defaultProposalPayload());
    assertTrue(harness.trustZones(0) != address(0));
    assertTrue(harness.trustZones(1) != address(0));
  }

  function test_WorksFromNegotiatingState() public {
    _advanceToNegotiating();
    // After counter by partyB, turn is partyA
    vm.prank(partyA);
    harness.acceptAndActivate(_defaultProposalPayload());
    assertEq(harness.currentState(), AgreementTypes.ACTIVE);
  }

  // ---- Local advance helpers ----

  function _advanceToNegotiating() internal {
    harness.exposed_handleCounter(partyB, _defaultProposalPayload());
  }

  function _advanceToAccepted() internal {
    bytes memory payload = _defaultProposalPayload();
    harness.exposed_handleAccept(partyB, payload);
  }
}
