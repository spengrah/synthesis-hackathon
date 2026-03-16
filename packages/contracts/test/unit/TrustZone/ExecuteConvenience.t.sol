// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { TrustZoneBase } from "../../Base.t.sol";
import { ITrustZoneErrors } from "../../../src/interfaces/ITrustZone.sol";

/// @dev Simple mock target that records calls.
contract MockTarget {
  address public lastCaller;
  uint256 public lastValue;
  bytes public lastData;
  uint256 public callCount;

  function doSomething(uint256 x) external payable {
    lastCaller = msg.sender;
    lastValue = msg.value;
    lastData = msg.data;
    callCount++;
  }

  receive() external payable { }
}

contract TrustZone_execute_convenience is TrustZoneBase {
  MockTarget internal mockTarget;

  function setUp() public override {
    super.setUp();
    mockTarget = new MockTarget();
  }

  function test_ExecutesCallOnTarget_WhenCallerIsEntryPoint() public {
    address ep = address(trustZone.entryPoint());
    bytes memory data = abi.encodeCall(MockTarget.doSomething, (42));

    vm.prank(ep);
    trustZone.execute(address(mockTarget), 0, data);

    assertEq(mockTarget.callCount(), 1);
    assertEq(mockTarget.lastCaller(), address(trustZone));
  }

  function test_ExecutesCallOnTarget_WhenCallerWearsHat() public {
    bytes memory data = abi.encodeCall(MockTarget.doSomething, (99));

    vm.prank(hatWearerA);
    trustZone.execute(address(mockTarget), 0, data);

    assertEq(mockTarget.callCount(), 1);
    assertEq(mockTarget.lastCaller(), address(trustZone));
  }

  function test_ForwardsEthValue_WhenCallerWearsHat() public {
    bytes memory data = abi.encodeCall(MockTarget.doSomething, (1));
    uint256 sendValue = 1 ether;

    vm.prank(hatWearerA);
    trustZone.execute{ value: 0 }(address(mockTarget), sendValue, data);

    assertEq(mockTarget.lastValue(), sendValue);
    assertEq(address(mockTarget).balance, sendValue);
  }

  function test_RevertWhen_CallerIsUnauthorized() public {
    address nobody = makeAddr("nobody");
    bytes memory data = abi.encodeCall(MockTarget.doSomething, (1));

    vm.prank(nobody);
    vm.expectRevert(ITrustZoneErrors.Unauthorized.selector);
    trustZone.execute(address(mockTarget), 0, data);
  }
}
