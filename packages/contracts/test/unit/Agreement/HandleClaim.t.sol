// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementHarnessBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { TZTypes } from "../../../src/lib/TZTypes.sol";
import { IAgreement, IAgreementErrors, IAgreementEvents } from "../../../src/interfaces/IAgreement.sol";
import { AgreementHarness } from "../../harness/AgreementHarness.sol";
import { Defaults } from "../../helpers/Defaults.sol";
import { Constants } from "../../helpers/Constants.sol";

contract Agreement_handleClaim is AgreementHarnessBase {
  AgreementHarness internal activeHarness;

  function setUp() public override {
    super.setUp();
    activeHarness = _createActiveHarnessWithMechanisms();
  }

  function _createActiveHarnessWithMechanisms() internal returns (AgreementHarness) {
    // Build proposal with a mechanism
    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](2);
    zones[0] = Defaults.tzConfig(partyA, 0);
    zones[1] = Defaults.tzConfig(partyB, 0);

    // Add a dummy mechanism to zone 0
    TZTypes.TZMechanism[] memory mechs = new TZTypes.TZMechanism[](1);
    mechs[0] = TZTypes.TZMechanism({ paramType: TZTypes.TZParamType.Reward, module: address(0xdead), initData: "" });
    zones[0].mechanisms = mechs;

    AgreementTypes.ProposalData memory data =
      Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE);
    bytes memory payload = abi.encode(data);

    (AgreementHarness agr,) = _createHarnessCloneWithPayload(payload);

    // Accept with the same payload (hash must match)
    agr.exposed_handleAccept(partyB, payload);

    // Activate
    agr.exposed_handleActivate(partyA);

    return agr;
  }

  function test_RevertIf_StateIsNotActive() public {
    bytes memory proposalPayload = _defaultProposalPayload();
    (AgreementHarness newHarness,) = _createHarnessCloneWithPayload(proposalPayload);
    vm.expectRevert(
      abi.encodeWithSelector(IAgreementErrors.InvalidState.selector, AgreementTypes.PROPOSED, AgreementTypes.ACTIVE)
    );
    newHarness.exposed_handleClaim(partyA, abi.encode(uint256(0), bytes("evidence")));
  }

  function test_RevertIf_MechanismIndexIsOutOfBounds() public {
    vm.expectRevert(abi.encodeWithSelector(IAgreementErrors.InvalidMechanismIndex.selector, uint256(999)));
    activeHarness.exposed_handleClaim(partyA, abi.encode(uint256(999), bytes("evidence")));
  }

  function test_IncrementsClaimCount() public {
    assertEq(activeHarness.claimCount(), 0);
    activeHarness.exposed_handleClaim(partyA, abi.encode(uint256(0), bytes("evidence")));
    assertEq(activeHarness.claimCount(), 1);
  }

  function test_EmitsClaimFiled() public {
    vm.expectEmit(true, true, true, true);
    emit IAgreementEvents.ClaimFiled(0, 0, partyA, bytes("evidence"));
    activeHarness.exposed_handleClaim(partyA, abi.encode(uint256(0), bytes("evidence")));
  }
}
