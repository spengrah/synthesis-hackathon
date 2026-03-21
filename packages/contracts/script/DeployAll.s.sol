// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { Script, console2 } from "forge-std/Script.sol";

import { ResourceTokenRegistry } from "../src/ResourceTokenRegistry.sol";
import { HatValidator } from "../src/modules/HatValidator.sol";
import { TrustZone } from "../src/TrustZone.sol";
import { Agreement } from "../src/Agreement.sol";
import { AgreementRegistry } from "../src/AgreementRegistry.sol";
import { Temptation } from "../src/Temptation.sol";

import { HookMultiPlexer } from "core-modules/HookMultiPlexer/HookMultiPlexer.sol";
import { MockRegistry } from "modulekit/module-bases/mocks/MockRegistry.sol";
import { IERC7484 } from "modulekit/module-bases/interfaces/IERC7484.sol";
import { HatsEligibilitiesChain } from "chain-modules/HatsEligibilitiesChain.sol";

/// @notice Single deploy script that orchestrates all contract deployments.
///         Outputs a deployments.json with all addresses.
///
///         Reads ERC-8004 registry addresses from script/chains.json keyed by chain ID.
///         Hats Protocol addresses are deterministic and the same on all chains.
///
///         Environment variables:
///           PRIVATE_KEY — deployer private key (defaults to Anvil account 0)
contract DeployAll is Script {
  // Hats Protocol — deterministic, same address on all chains
  address constant HATS = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;
  address constant HATS_MODULE_FACTORY = 0x0a3f85fa597B6a967271286aA0724811acDF5CD9;

  function run() public {
    // Default to Anvil account 0 if no PRIVATE_KEY set
    uint256 deployerKey =
      vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
    address deployer = vm.addr(deployerKey);

    // Read chain-specific addresses from chains.json
    string memory chainsJson = vm.readFile("script/chains.json");
    string memory chainKey = string.concat(".", vm.toString(block.chainid));

    address identityRegistry = vm.parseJsonAddress(chainsJson, string.concat(chainKey, ".identityRegistry"));
    address reputationRegistry = vm.parseJsonAddress(chainsJson, string.concat(chainKey, ".reputationRegistry"));
    address usdc = vm.parseJsonAddress(chainsJson, string.concat(chainKey, ".usdc"));

    require(
      identityRegistry != address(0), "identityRegistry not configured for this chain -- update script/chains.json"
    );
    require(
      reputationRegistry != address(0), "reputationRegistry not configured for this chain -- update script/chains.json"
    );
    require(usdc != address(0), "usdc not configured for this chain -- update script/chains.json");

    console2.log("Chain ID:", block.chainid);
    console2.log("Deployer:", deployer);
    console2.log("IdentityRegistry:", identityRegistry);
    console2.log("ReputationRegistry:", reputationRegistry);

    uint256 startNonce = vm.getNonce(deployer);

    // Predict AgreementRegistry address (deployed at nonce+8)
    // nonce+0: ResourceTokenRegistry
    // nonce+1: HatValidator
    // nonce+2: TrustZone
    // nonce+3: MockRegistry
    // nonce+4: HookMultiPlexer
    // nonce+5: HatsEligibilitiesChain
    // nonce+6: Agreement
    // nonce+7: AgreementRegistry
    // nonce+8: Temptation
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
      identityRegistry,
      reputationRegistry,
      address(trustZoneImpl),
      address(hookMultiplexer),
      address(hatValidator),
      HATS_MODULE_FACTORY,
      address(eligibilitiesChainImpl)
    );
    // nonce+7
    AgreementRegistry agreementRegistry = new AgreementRegistry(HATS, address(rtr), address(agreementImpl));
    // nonce+8
    Temptation temptationVault = new Temptation(address(rtr), usdc);

    vm.stopBroadcast();

    require(address(agreementRegistry) == predictedRegistry, "AgreementRegistry address mismatch");

    // Write deployments JSON keyed by chain ID
    string memory inner = "inner";
    vm.serializeAddress(inner, "resourceTokenRegistry", address(rtr));
    vm.serializeAddress(inner, "hatValidator", address(hatValidator));
    vm.serializeAddress(inner, "trustZoneImpl", address(trustZoneImpl));
    vm.serializeAddress(inner, "hookMultiplexer", address(hookMultiplexer));
    vm.serializeAddress(inner, "eligibilitiesChainImpl", address(eligibilitiesChainImpl));
    vm.serializeAddress(inner, "agreementImpl", address(agreementImpl));
    vm.serializeAddress(inner, "agreementRegistry", address(agreementRegistry));
    string memory innerJson = vm.serializeAddress(inner, "temptationVault", address(temptationVault));

    // Merge into existing deployments.json (don't overwrite other chain entries)
    string memory keyPath = string.concat(".", vm.toString(block.chainid));
    try vm.readFile("./deployments.json") returns (string memory) {
      vm.writeJson(innerJson, "./deployments.json", keyPath);
    } catch {
      // File doesn't exist yet — write fresh
      string memory outer = "outer";
      string memory output = vm.serializeString(outer, vm.toString(block.chainid), innerJson);
      vm.writeJson(output, "./deployments.json");
    }

    console2.log("ResourceTokenRegistry:", address(rtr));
    console2.log("HatValidator:", address(hatValidator));
    console2.log("TrustZone impl:", address(trustZoneImpl));
    console2.log("HookMultiPlexer:", address(hookMultiplexer));
    console2.log("EligibilitiesChain:", address(eligibilitiesChainImpl));
    console2.log("Agreement impl:", address(agreementImpl));
    console2.log("AgreementRegistry:", address(agreementRegistry));
    console2.log("Temptation Vault:", address(temptationVault));
  }
}
