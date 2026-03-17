// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { Script, console2 } from "forge-std/Script.sol";
import { Agreement } from "../src/Agreement.sol";

contract DeployAgreement is Script {
  Agreement public agreementImpl;

  bool internal _verbose = true;

  function prepare(bool verbose) public {
    _verbose = verbose;
  }

  function deployer() public returns (address) {
    uint256 privKey = vm.envUint("PRIVATE_KEY");
    return vm.rememberKey(privKey);
  }

  /// @dev Deploy Agreement implementation (clone source — not initialized).
  function execute(
    address hats,
    address resourceTokenRegistry,
    address identityRegistry,
    address reputationRegistry,
    address trustZoneImpl,
    address hookMultiplexer,
    address hatValidator
  ) public returns (Agreement) {
    agreementImpl = new Agreement(
      hats, resourceTokenRegistry, identityRegistry, reputationRegistry, trustZoneImpl, hookMultiplexer, hatValidator
    );
    return agreementImpl;
  }

  function run() public virtual {
    vm.startBroadcast(deployer());
    // Would need all addresses passed in — for now just a placeholder
    vm.stopBroadcast();

    if (_verbose) console2.log("Agreement impl:", address(agreementImpl));
  }
}
