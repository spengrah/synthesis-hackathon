// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementHarnessBase } from "../../Base.t.sol";
import { AgreementTypes } from "../../../src/lib/AgreementTypes.sol";
import { TZTypes } from "../../../src/lib/TZTypes.sol";
import { IAgreementErrors } from "../../../src/interfaces/IAgreement.sol";
import { AgreementHarness } from "../../harness/AgreementHarness.sol";
import { Defaults } from "../../helpers/Defaults.sol";
import { Constants } from "../../helpers/Constants.sol";

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

  function test_RevertIf_ActivateStepFails_FromProposed_RollsBackAtomically() public {
    bytes memory invalidPayload = _invalidActivationPayloadWithResourcesAndMechanisms();
    (AgreementHarness clone,) = _createHarnessCloneWithPayload(invalidPayload);

    vm.expectRevert(IAgreementErrors.InvalidZoneCount.selector);
    vm.prank(partyB);
    clone.acceptAndActivate(invalidPayload);

    assertEq(clone.currentState(), AgreementTypes.PROPOSED);
    assertEq(clone.trustZones(0), address(0));
    assertEq(clone.trustZones(1), address(0));
  }

  function test_RevertIf_ActivateStepFails_FromNegotiating_RollsBackAtomically() public {
    bytes memory invalidPayload = _invalidActivationPayloadWithResourcesAndMechanisms();
    (AgreementHarness clone,) = _createHarnessCloneWithPayload(invalidPayload);

    vm.prank(partyB);
    clone.submitInput(AgreementTypes.COUNTER, invalidPayload);

    vm.expectRevert(IAgreementErrors.InvalidZoneCount.selector);
    vm.prank(partyA);
    clone.acceptAndActivate(invalidPayload);

    assertEq(clone.currentState(), AgreementTypes.NEGOTIATING);
    assertEq(clone.turn(), partyA);
    assertEq(clone.trustZones(0), address(0));
    assertEq(clone.trustZones(1), address(0));
  }

  function test_RevertIf_ActivateStepFails_DoesNotMintResourcesOrRegisterMechanisms() public {
    bytes memory invalidPayload = _invalidActivationPayloadWithResourcesAndMechanisms();
    (AgreementHarness clone,) = _createHarnessCloneWithPayload(invalidPayload);

    vm.expectRevert(IAgreementErrors.InvalidZoneCount.selector);
    vm.prank(partyB);
    clone.acceptAndActivate(invalidPayload);

    assertEq(clone.mechanismCount(), 0);
    assertEq(registry.lastId(Defaults.PERMISSION_TYPE), 0);
    assertEq(registry.lastId(Defaults.DIRECTIVE_TYPE), 0);
    assertEq(clone.zoneHatIds(0), 0);
    assertEq(clone.zoneHatIds(1), 0);
  }

  // ---- Local advance helpers ----

  function _advanceToNegotiating() internal {
    harness.exposed_handleCounter(partyB, _defaultProposalPayload());
  }

  function _advanceToAccepted() internal {
    bytes memory payload = _defaultProposalPayload();
    harness.exposed_handleAccept(partyB, payload);
  }

  function _invalidActivationPayloadWithResourcesAndMechanisms() internal view returns (bytes memory) {
    TZTypes.TZConfig[] memory zones = new TZTypes.TZConfig[](1);
    zones[0] = Defaults.tzConfig(partyA, 0);

    zones[0].mechanisms = new TZTypes.TZMechanism[](1);
    zones[0].mechanisms[0] = TZTypes.TZMechanism({
      paramType: TZTypes.TZParamType.Reward,
      moduleKind: TZTypes.TZModuleKind.External,
      module: address(0xBEEF),
      data: hex"aa"
    });

    zones[0].resources = new TZTypes.TZResourceTokenConfig[](2);
    zones[0].resources[0] = Defaults.resourceTokenConfig(TZTypes.TZParamType.Permission, Defaults.permissionMetadata());
    zones[0].resources[1] = Defaults.resourceTokenConfig(TZTypes.TZParamType.Directive, Defaults.directiveMetadata());

    return abi.encode(Defaults.proposalData(zones, adjudicator, block.timestamp + Constants.DEFAULT_DEADLINE));
  }
}
