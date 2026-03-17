// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementHarnessBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { IAgreementErrors } from "../../../src/interfaces/IAgreement.sol";

contract Agreement_submitInput is AgreementHarnessBase {
  function test_RevertIf_InputIdUnknown() public {
    bytes32 unknownInput = keccak256("UNKNOWN_INPUT");

    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.InvalidInput.selector, unknownInput));
    vm.prank(partyB);
    harness.submitInput(unknownInput, "");
  }

  function test_RevertIf_StateIsClosed() public {
    _advanceToActive();
    vm.warp(harness.deadline() + 1);
    harness.submitInput(AgreementTypes.FINALIZE, "");

    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.InvalidState.selector, AgreementTypes.CLOSED, bytes32(0)));
    vm.prank(partyA);
    harness.submitInput(AgreementTypes.COUNTER, _defaultProposalPayload());
  }

  function test_RevertIf_StateIsRejected() public {
    vm.prank(partyB);
    harness.submitInput(AgreementTypes.REJECT, "");

    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.InvalidState.selector, AgreementTypes.REJECTED, bytes32(0)));
    vm.prank(partyA);
    harness.submitInput(AgreementTypes.ACCEPT, _defaultProposalPayload());
  }

  function _advanceToAccepted() internal {
    bytes memory payload = _defaultProposalPayload();
    vm.prank(partyB);
    harness.submitInput(AgreementTypes.ACCEPT, payload);
  }

  function _advanceToActive() internal {
    _advanceToAccepted();
    vm.prank(partyA);
    harness.submitInput(AgreementTypes.ACTIVATE, "");
  }
}
