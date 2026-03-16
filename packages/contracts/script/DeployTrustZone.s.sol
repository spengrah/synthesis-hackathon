// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { Script, console2 } from "forge-std/Script.sol";
import { TrustZone } from "../src/TrustZone.sol";

contract DeployTrustZone is Script {
  TrustZone public trustZoneImpl;

  bool internal _verbose = true;

  function prepare(bool verbose) public {
    _verbose = verbose;
  }

  function deployer() public returns (address) {
    uint256 privKey = vm.envUint("PRIVATE_KEY");
    return vm.rememberKey(privKey);
  }

  /// @dev Deploy TrustZone implementation (clone source — not initialized).
  function execute() public returns (TrustZone) {
    trustZoneImpl = new TrustZone();
    return trustZoneImpl;
  }

  function run() public virtual {
    vm.startBroadcast(deployer());
    execute();
    vm.stopBroadcast();

    if (_verbose) console2.log("TrustZone impl:", address(trustZoneImpl));
  }
}
