// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { TrustZoneBase } from "../../Base.t.sol";
import { TrustZone } from "../../../src/TrustZone.sol";
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";

contract TrustZone_hatValidator is TrustZoneBase {
  function test_ReturnsZero_GivenNotInitialized() public {
    bytes32 salt = keccak256("uninit-getter-test");
    TrustZone uninit = TrustZone(payable(Clones.cloneDeterministic(address(trustZoneImpl), salt)));
    assertEq(uninit.hatValidator(), address(0));
  }

  function test_ReturnsHatValidatorAddress_GivenInitialized() public view {
    assertEq(trustZone.hatValidator(), address(hatValidator));
  }
}
