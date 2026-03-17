// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";

contract Agreement_acceptAndActivate is AgreementBase {
  function test_RevertIf_StateIsNotProposedOrNegotiating() public {
    _advanceToAccepted(agreement);
    vm.expectRevert(
      abi.encodeWithSelector(IAgreementErrors.InvalidState.selector, AgreementTypes.ACCEPTED, AgreementTypes.PROPOSED)
    );
    vm.prank(partyA);
    agreement.acceptAndActivate(_defaultProposalPayload());
  }

  function test_RevertIf_CallerIsNotAuthorizedToAccept() public {
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.NotYourTurn.selector, partyA, partyB));
    vm.prank(partyA);
    agreement.acceptAndActivate(_defaultProposalPayload());
  }

  function test_TransitionsDirectlyToActive() public {
    vm.prank(partyB);
    agreement.acceptAndActivate(_defaultProposalPayload());
    assertEq(agreement.currentState(), AgreementTypes.ACTIVE);
  }

  function test_DeploysTrustZones() public {
    vm.prank(partyB);
    agreement.acceptAndActivate(_defaultProposalPayload());
    assertTrue(agreement.trustZones(0) != address(0));
    assertTrue(agreement.trustZones(1) != address(0));
  }

  function test_WorksFromNegotiatingState() public {
    _advanceToNegotiating(agreement);
    // After counter by partyB, turn is partyA
    vm.prank(partyA);
    agreement.acceptAndActivate(_defaultProposalPayload());
    assertEq(agreement.currentState(), AgreementTypes.ACTIVE);
  }
}
