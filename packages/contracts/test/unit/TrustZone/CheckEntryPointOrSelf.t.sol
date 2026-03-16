// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { TrustZoneBase } from "../../Base.t.sol";
import { ITrustZoneErrors } from "../../../src/interfaces/ITrustZone.sol";
import {
  ERC7579Utils,
  Mode,
  CallType,
  ExecType,
  ModeSelector,
  ModePayload
} from "@openzeppelin/contracts/account/utils/draft-ERC7579Utils.sol";

/// @notice Tests for _checkEntryPointOrSelf, exercised via execute(bytes32,bytes) which uses onlyEntryPointOrSelf.
contract TrustZone_checkEntryPointOrSelf is TrustZoneBase {
  address internal target;
  bytes internal callData;
  bytes32 internal singleMode;

  function setUp() public override {
    super.setUp();
    target = makeAddr("target");
    callData = abi.encodePacked(target, uint256(0), "");
    singleMode = Mode.unwrap(
      ERC7579Utils.encodeMode(
        ERC7579Utils.CALLTYPE_SINGLE,
        ERC7579Utils.EXECTYPE_DEFAULT,
        ModeSelector.wrap(bytes4(0)),
        ModePayload.wrap(bytes22(0))
      )
    );
  }

  function test_DoesNotRevert_WhenCallerIsEntryPoint() public {
    address ep = address(trustZone.entryPoint());
    vm.prank(ep);
    trustZone.execute(singleMode, callData);
  }

  function test_DoesNotRevert_WhenCallerIsHatWearer() public {
    // hatWearerA (== partyA) wears zoneHatA
    vm.prank(hatWearerA);
    trustZone.execute(singleMode, callData);
  }

  function test_RevertWhen_CallerIsUnauthorized() public {
    address nobody = makeAddr("nobody");
    vm.prank(nobody);
    vm.expectRevert(ITrustZoneErrors.Unauthorized.selector);
    trustZone.execute(singleMode, callData);
  }
}
