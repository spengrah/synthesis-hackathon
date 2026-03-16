// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { Script, console2 } from "forge-std/Script.sol";
import { HatValidator } from "../src/modules/HatValidator.sol";

contract DeployHatValidator is Script {
  HatValidator public hatValidator;

  bool internal _verbose = true;
  address public HATS = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;

  function prepare(bool verbose) public {
    _verbose = verbose;
  }

  function deployer() public returns (address) {
    uint256 privKey = vm.envUint("PRIVATE_KEY");
    return vm.rememberKey(privKey);
  }

  /// @dev Deploy HatValidator with the given Hats Protocol address.
  function execute(address _hats) public returns (HatValidator) {
    hatValidator = new HatValidator(_hats);
    return hatValidator;
  }

  function run() public virtual {
    vm.startBroadcast(deployer());
    execute(HATS);
    vm.stopBroadcast();

    if (_verbose) console2.log("HatValidator:", address(hatValidator));
  }
}
