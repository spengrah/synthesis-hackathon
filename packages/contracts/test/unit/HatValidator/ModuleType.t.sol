// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { HatValidatorBase } from "../../Base.t.sol";

contract HatValidator_isModuleType is HatValidatorBase {
  function test_ReturnTrue_WhenTypeIdIs1() public view {
    assertTrue(hatValidator.isModuleType(1));
  }

  function test_ReturnFalse_WhenTypeIdIsNot1() public view {
    assertFalse(hatValidator.isModuleType(0));
    assertFalse(hatValidator.isModuleType(2));
    assertFalse(hatValidator.isModuleType(3));
    assertFalse(hatValidator.isModuleType(4));
    assertFalse(hatValidator.isModuleType(type(uint256).max));
  }
}

contract HatValidator_hats is HatValidatorBase {
  function test_AlwaysReturnImmutableHatsAddress() public {
    address account = makeAddr("account");
    assertEq(hatValidator.hats(account), address(hats));
  }
}

contract HatValidator_hatId is HatValidatorBase {
  function test_ReturnZero_WhenNotInstalled() public {
    address account = makeAddr("account");
    assertEq(hatValidator.hatId(account), 0);
  }

  function test_ReturnConfiguredHatId_WhenInstalled() public {
    address account = makeAddr("account");
    vm.prank(account);
    hatValidator.onInstall(abi.encode(testHatId));

    assertEq(hatValidator.hatId(account), testHatId);
  }
}

contract HatValidator_isInstalledOn is HatValidatorBase {
  function test_ReturnFalse_WhenNotInstalled() public {
    address account = makeAddr("account");
    assertFalse(hatValidator.isInstalledOn(account));
  }

  function test_ReturnTrue_WhenInstalled() public {
    address account = makeAddr("account");
    vm.prank(account);
    hatValidator.onInstall(abi.encode(testHatId));

    assertTrue(hatValidator.isInstalledOn(account));
  }
}
