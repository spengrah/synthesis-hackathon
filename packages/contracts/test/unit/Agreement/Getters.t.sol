// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementHarnessBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { TZTypes } from "../../../src/lib/TZTypes.sol";
import { IAgreementErrors } from "../../../src/interfaces/IAgreement.sol";
import { AgreementHarness } from "../../harness/AgreementHarness.sol";
import { Defaults } from "../../helpers/Defaults.sol";
import { Constants } from "../../helpers/Constants.sol";

contract Agreement_getters is AgreementHarnessBase {
  function test_DocHash_ReturnsTermsHash() public {
    assertEq(harness.docHash(), harness.termsHash());
  }

  function test_TermsUri_ReturnsStoredTermsUri() public {
    string memory termsUri = "ipfs://agreement-terms";
    bytes memory payload = _proposalPayloadWithTermsUri(termsUri);

    (AgreementHarness clone,) = _createHarnessCloneWithPayload(payload);
    assertEq(clone.termsUri(), termsUri);
    assertEq(clone.docUri(), termsUri);
  }

  function test_Mechanisms_RevertIf_IndexOutOfBounds() public {
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.InvalidMechanismIndex.selector, uint256(0)));
    harness.mechanisms(0);
  }

  function test_GetWearerStatus_ReturnsTrueTrue() public {
    (bool eligible, bool standing) = harness.getWearerStatus(address(0xBEEF), 123);
    assertTrue(eligible);
    assertTrue(standing);
  }

  function test_OnUninstall_IsNoOp() public {
    bytes32 beforeState = harness.currentState();
    harness.onUninstall("");
    assertEq(harness.currentState(), beforeState);
  }

  function _proposalPayloadWithTermsUri(string memory termsUri) internal view returns (bytes memory) {
    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);

    AgreementTypes.ProposalData memory data = AgreementTypes.ProposalData({
      termsDocUri: termsUri,
      zones: zones,
      adjudicator: adjudicator,
      deadline: block.timestamp + Constants.DEFAULT_DEADLINE
    });

    return abi.encode(data);
  }
}
