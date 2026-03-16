// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { HatValidatorBase } from "../../Base.t.sol";

contract HatValidator_isAuthorized is HatValidatorBase {
  function test_ReturnFalse_WhenNotInstalled() public {
    address account = makeAddr("account");
    assertFalse(hatValidator.isAuthorized(account, hatWearerA));
  }

  function test_ReturnTrue_WhenCallerWearsHat() public {
    address account = makeAddr("account");
    bytes memory data = abi.encode(testHatId);

    vm.prank(account);
    hatValidator.onInstall(data);

    assertTrue(hatValidator.isAuthorized(account, hatWearerA));
  }

  function test_ReturnFalse_WhenCallerDoesNotWearHat() public {
    address account = makeAddr("account");
    bytes memory data = abi.encode(testHatId);

    vm.prank(account);
    hatValidator.onInstall(data);

    address nonWearer = makeAddr("nonWearer");
    assertFalse(hatValidator.isAuthorized(account, nonWearer));
  }
}
