// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { Script, console2 } from "forge-std/Script.sol";
import { AgreementRegistry } from "../src/AgreementRegistry.sol";

contract DeployAgreementRegistry is Script {
  AgreementRegistry public agreementRegistry;

  bool internal _verbose = true;

  function prepare(bool verbose) public {
    _verbose = verbose;
  }

  function deployer() public returns (address) {
    uint256 privKey = vm.envUint("PRIVATE_KEY");
    return vm.rememberKey(privKey);
  }

  /// @dev Deploy AgreementRegistry.
  function execute(address _hats, address _resourceTokenRegistry, address _agreementImplementation)
    public
    returns (AgreementRegistry)
  {
    agreementRegistry = new AgreementRegistry(_hats, _resourceTokenRegistry, _agreementImplementation);
    return agreementRegistry;
  }

  function run() public virtual {
    vm.startBroadcast(deployer());
    // Would need all addresses passed in — for now just a placeholder
    vm.stopBroadcast();

    if (_verbose) console2.log("AgreementRegistry:", address(agreementRegistry));
  }
}
