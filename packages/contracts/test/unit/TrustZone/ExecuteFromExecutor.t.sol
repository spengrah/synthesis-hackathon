// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { TrustZoneBase } from "../../Base.t.sol";
import { TrustZone } from "../../../src/TrustZone.sol";
import {
  IERC7579Module,
  IERC7579Execution,
  MODULE_TYPE_EXECUTOR
} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";
import {
  ERC7579Utils,
  Mode,
  CallType,
  ExecType,
  ModeSelector,
  ModePayload
} from "@openzeppelin/contracts/account/utils/draft-ERC7579Utils.sol";

/// @dev Counter used by executor tests.
contract ExecutorCounter {
  uint256 public count;

  function increment() external payable {
    count++;
  }
}

/// @dev A calling executor that invokes executeFromExecutor on the TrustZone.
contract CallingExecutor is IERC7579Module {
  function onInstall(bytes calldata) external override { }
  function onUninstall(bytes calldata) external override { }

  function isModuleType(uint256 moduleTypeId) external pure override returns (bool) {
    return moduleTypeId == MODULE_TYPE_EXECUTOR;
  }

  function callExecuteFromExecutor(address account, bytes32 mode, bytes calldata executionCalldata) external {
    IERC7579Execution(account).executeFromExecutor(mode, executionCalldata);
  }
}

contract TrustZone_executeFromExecutor is TrustZoneBase {
  CallingExecutor internal callingExecutor;
  ExecutorCounter internal counter;
  bytes32 internal singleMode;

  function setUp() public override {
    super.setUp();
    counter = new ExecutorCounter();
    callingExecutor = new CallingExecutor();

    singleMode = Mode.unwrap(
      ERC7579Utils.encodeMode(
        ERC7579Utils.CALLTYPE_SINGLE,
        ERC7579Utils.EXECTYPE_DEFAULT,
        ModeSelector.wrap(bytes4(0)),
        ModePayload.wrap(bytes22(0))
      )
    );

    // Install the calling executor via the hat wearer
    vm.prank(hatWearerA);
    trustZone.installModule(MODULE_TYPE_EXECUTOR, address(callingExecutor), "");
  }

  function test_RevertWhen_CallerIsNotInstalledExecutor() public {
    address notInstalled = makeAddr("notInstalled");
    bytes memory callData =
      abi.encodePacked(address(counter), uint256(0), abi.encodeCall(ExecutorCounter.increment, ()));

    vm.prank(notInstalled);
    vm.expectRevert();
    trustZone.executeFromExecutor(singleMode, callData);
  }

  function test_ExecutesCall_WhenCallerIsInstalledExecutor() public {
    bytes memory callData =
      abi.encodePacked(address(counter), uint256(0), abi.encodeCall(ExecutorCounter.increment, ()));

    callingExecutor.callExecuteFromExecutor(address(trustZone), singleMode, callData);

    assertEq(counter.count(), 1);
  }
}
