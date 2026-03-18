// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { Script, console2 } from "forge-std/Script.sol";

import { ResourceTokenRegistry } from "../src/ResourceTokenRegistry.sol";
import { HatValidator } from "../src/modules/HatValidator.sol";
import { TrustZone } from "../src/TrustZone.sol";
import { Agreement } from "../src/Agreement.sol";
import { AgreementRegistry } from "../src/AgreementRegistry.sol";

import { HookMultiPlexer } from "core-modules/HookMultiPlexer/HookMultiPlexer.sol";
import { MockRegistry } from "modulekit/module-bases/mocks/MockRegistry.sol";
import { IERC7484 } from "modulekit/module-bases/interfaces/IERC7484.sol";
import { HatsEligibilitiesChain } from "chain-modules/HatsEligibilitiesChain.sol";

/// @notice Single deploy script that orchestrates all contract deployments.
///         Outputs a deployments.json with all addresses.
contract DeployAll is Script {
  // Pre-deployed on Base mainnet
  address constant HATS = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;
  address constant IDENTITY_REGISTRY = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432;
  address constant REPUTATION_REGISTRY = 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63;
  address constant HATS_MODULE_FACTORY = 0x0a3f85fa597B6a967271286aA0724811acDF5CD9;

  function run() public {
    // Default to Anvil account 0 if no PRIVATE_KEY set
    uint256 deployerKey =
      vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
    address deployer = vm.addr(deployerKey);

    uint256 startNonce = vm.getNonce(deployer);

    // Predict AgreementRegistry address (deployed at nonce+7)
    // nonce+0: ResourceTokenRegistry
    // nonce+1: HatValidator
    // nonce+2: TrustZone
    // nonce+3: MockRegistry
    // nonce+4: HookMultiPlexer
    // nonce+5: HatsEligibilitiesChain
    // nonce+6: Agreement
    // nonce+7: AgreementRegistry
    address predictedRegistry = vm.computeCreateAddress(deployer, startNonce + 7);

    vm.startBroadcast(deployerKey);

    // nonce+0
    ResourceTokenRegistry rtr = new ResourceTokenRegistry(predictedRegistry);
    // nonce+1
    HatValidator hatValidator = new HatValidator(HATS);
    // nonce+2
    TrustZone trustZoneImpl = new TrustZone();
    // nonce+3
    MockRegistry mockRegistry = new MockRegistry();
    // nonce+4
    HookMultiPlexer hookMultiplexer = new HookMultiPlexer(IERC7484(address(mockRegistry)));
    // nonce+5
    HatsEligibilitiesChain eligibilitiesChainImpl = new HatsEligibilitiesChain("1.0.0");
    // nonce+6
    Agreement agreementImpl = new Agreement(
      HATS,
      address(rtr),
      IDENTITY_REGISTRY,
      REPUTATION_REGISTRY,
      address(trustZoneImpl),
      address(hookMultiplexer),
      address(hatValidator),
      HATS_MODULE_FACTORY,
      address(eligibilitiesChainImpl)
    );
    // nonce+7
    AgreementRegistry agreementRegistry = new AgreementRegistry(HATS, address(rtr), address(agreementImpl));

    vm.stopBroadcast();

    require(address(agreementRegistry) == predictedRegistry, "AgreementRegistry address mismatch");

    // Write deployments JSON
    string memory json = "deployments";
    vm.serializeAddress(json, "resourceTokenRegistry", address(rtr));
    vm.serializeAddress(json, "hatValidator", address(hatValidator));
    vm.serializeAddress(json, "trustZoneImpl", address(trustZoneImpl));
    vm.serializeAddress(json, "hookMultiplexer", address(hookMultiplexer));
    vm.serializeAddress(json, "eligibilitiesChainImpl", address(eligibilitiesChainImpl));
    vm.serializeAddress(json, "agreementImpl", address(agreementImpl));
    string memory output = vm.serializeAddress(json, "agreementRegistry", address(agreementRegistry));
    vm.writeJson(output, "./deployments.json");

    console2.log("ResourceTokenRegistry:", address(rtr));
    console2.log("HatValidator:", address(hatValidator));
    console2.log("TrustZone impl:", address(trustZoneImpl));
    console2.log("HookMultiPlexer:", address(hookMultiplexer));
    console2.log("EligibilitiesChain:", address(eligibilitiesChainImpl));
    console2.log("Agreement impl:", address(agreementImpl));
    console2.log("AgreementRegistry:", address(agreementRegistry));
  }
}
