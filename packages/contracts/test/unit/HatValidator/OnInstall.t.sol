// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { HatValidatorBase } from "../../Base.t.sol";
import { IHatValidatorErrors, IHatValidatorEvents } from "../../../src/interfaces/IHatValidator.sol";
import { Constants } from "../../helpers/Constants.sol";

contract HatValidator_onInstall is HatValidatorBase, IHatValidatorErrors, IHatValidatorEvents {
  function test_StoreHatId() public {
    address account = makeAddr("account");
    bytes memory data = abi.encode(testHatId);

    vm.prank(account);
    hatValidator.onInstall(data);

    assertEq(hatValidator.hatId(account), testHatId);
  }

  function test_EmitHatValidatorInstalled() public {
    address account = makeAddr("account");
    bytes memory data = abi.encode(testHatId);

    vm.expectEmit(true, true, true, true);
    emit HatValidatorInstalled(account, address(hats), testHatId);

    vm.prank(account);
    hatValidator.onInstall(data);
  }

  function test_RevertIf_AlreadyInstalled() public {
    address account = makeAddr("account");
    bytes memory data = abi.encode(testHatId);

    vm.prank(account);
    hatValidator.onInstall(data);

    vm.expectRevert(abi.encodeWithSelector(AlreadyInstalled.selector, account));
    vm.prank(account);
    hatValidator.onInstall(data);
  }
}

contract HatValidator_onUninstall is HatValidatorBase, IHatValidatorErrors, IHatValidatorEvents {
  function test_ClearConfig() public {
    address account = makeAddr("account");
    bytes memory data = abi.encode(testHatId);

    vm.prank(account);
    hatValidator.onInstall(data);

    vm.prank(account);
    hatValidator.onUninstall("");

    assertEq(hatValidator.hatId(account), 0);
    assertFalse(hatValidator.isInstalledOn(account));
  }

  function test_EmitHatValidatorUninstalled() public {
    address account = makeAddr("account");
    bytes memory data = abi.encode(testHatId);

    vm.prank(account);
    hatValidator.onInstall(data);

    vm.expectEmit(true, true, true, true);
    emit HatValidatorUninstalled(account);

    vm.prank(account);
    hatValidator.onUninstall("");
  }

  function test_RevertIf_NotInstalled() public {
    address account = makeAddr("account");

    vm.expectRevert(abi.encodeWithSelector(NotInstalled.selector, account));
    vm.prank(account);
    hatValidator.onUninstall("");
  }
}
