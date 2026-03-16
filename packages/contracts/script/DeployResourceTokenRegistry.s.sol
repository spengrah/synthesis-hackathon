// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { Script, console2 } from "forge-std/Script.sol";
import { ResourceTokenRegistry } from "../src/ResourceTokenRegistry.sol";

contract DeployResourceTokenRegistry is Script {
  ResourceTokenRegistry public registry;

  bool internal _verbose = true;

  function prepare(bool verbose) public {
    _verbose = verbose;
  }

  function deployer() public returns (address) {
    uint256 privKey = vm.envUint("PRIVATE_KEY");
    return vm.rememberKey(privKey);
  }

  /// @dev Deploy ResourceTokenRegistry with the given owner.
  function execute(address _owner) public returns (ResourceTokenRegistry) {
    registry = new ResourceTokenRegistry(_owner);
    return registry;
  }

  function run() public virtual {
    vm.startBroadcast(deployer());
    execute(msg.sender);
    vm.stopBroadcast();

    if (_verbose) console2.log("ResourceTokenRegistry:", address(registry));
  }
}
