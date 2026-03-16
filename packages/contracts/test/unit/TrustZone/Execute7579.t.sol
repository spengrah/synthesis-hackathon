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
import { Execution } from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";

/// @dev Simple counter for 7579 execute tests.
contract Counter {
  uint256 public count;

  function increment() external payable {
    count++;
  }

  receive() external payable { }
}

contract TrustZone_execute_7579 is TrustZoneBase {
  Counter internal counter;
  bytes32 internal singleMode;
  bytes32 internal batchMode;

  function setUp() public override {
    super.setUp();
    counter = new Counter();

    singleMode = Mode.unwrap(
      ERC7579Utils.encodeMode(
        ERC7579Utils.CALLTYPE_SINGLE,
        ERC7579Utils.EXECTYPE_DEFAULT,
        ModeSelector.wrap(bytes4(0)),
        ModePayload.wrap(bytes22(0))
      )
    );

    batchMode = Mode.unwrap(
      ERC7579Utils.encodeMode(
        ERC7579Utils.CALLTYPE_BATCH,
        ERC7579Utils.EXECTYPE_DEFAULT,
        ModeSelector.wrap(bytes4(0)),
        ModePayload.wrap(bytes22(0))
      )
    );
  }

  function test_SingleCall_WhenCallerIsEntryPoint() public {
    address ep = address(trustZone.entryPoint());
    bytes memory callData = abi.encodePacked(address(counter), uint256(0), abi.encodeCall(Counter.increment, ()));

    vm.prank(ep);
    trustZone.execute(singleMode, callData);

    assertEq(counter.count(), 1);
  }

  function test_BatchCall_WhenCallerIsEntryPoint() public {
    address ep = address(trustZone.entryPoint());

    Execution[] memory batch = new Execution[](3);
    for (uint256 i = 0; i < 3; i++) {
      batch[i] = Execution({ target: address(counter), value: 0, callData: abi.encodeCall(Counter.increment, ()) });
    }
    bytes memory callData = abi.encode(batch);

    vm.prank(ep);
    trustZone.execute(batchMode, callData);

    assertEq(counter.count(), 3);
  }

  function test_SingleCall_WhenCallerWearsHat() public {
    bytes memory callData = abi.encodePacked(address(counter), uint256(0), abi.encodeCall(Counter.increment, ()));

    vm.prank(hatWearerA);
    trustZone.execute(singleMode, callData);

    assertEq(counter.count(), 1);
  }

  function test_RevertWhen_CallerIsUnauthorized() public {
    address nobody = makeAddr("nobody");
    bytes memory callData = abi.encodePacked(address(counter), uint256(0), abi.encodeCall(Counter.increment, ()));

    vm.prank(nobody);
    vm.expectRevert(ITrustZoneErrors.Unauthorized.selector);
    trustZone.execute(singleMode, callData);
  }
}
