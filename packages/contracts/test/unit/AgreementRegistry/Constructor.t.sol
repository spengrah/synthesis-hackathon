// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { AgreementRegistryBase } from "../../Base.t.sol";

contract AgreementRegistry_constructor is AgreementRegistryBase {
  function test_StoresHatsAddress() public view {
    assertEq(agreementRegistry.hats(), address(hats));
  }

  function test_StoresTopHatId() public view {
    uint256 id = agreementRegistry.topHatId();
    assertTrue(id != 0, "topHatId should be non-zero");
    // The registry should be wearing the top hat
    assertTrue(hats.isWearerOfHat(address(agreementRegistry), id));
  }

  function test_StoresResourceTokenRegistryAddress() public view {
    assertEq(agreementRegistry.resourceTokenRegistry(), address(registry));
  }

  function test_StoresAgreementImplementationAddress() public view {
    assertEq(agreementRegistry.agreementImplementation(), address(agreementImpl));
  }
}
