import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Address } from "viem";
import { ANVIL_RPC_URL } from "./constants.js";

export interface DeployedContracts {
  resourceTokenRegistry: Address;
  hatValidator: Address;
  trustZoneImpl: Address;
  hookMultiplexer: Address;
  eligibilitiesChainImpl: Address;
  agreementImpl: Address;
  agreementRegistry: Address;
}

const CONTRACTS_DIR = resolve(import.meta.dirname, "../../contracts");
const DEPLOYMENTS_PATH = resolve(CONTRACTS_DIR, "deployments.json");

export function deploy(rpcUrl: string = ANVIL_RPC_URL): DeployedContracts {
  console.log("Deploying contracts via DeployAll script...");

  execSync(
    `FOUNDRY_PROFILE=deploy forge script script/DeployAll.s.sol --broadcast --rpc-url ${rpcUrl}`,
    { cwd: CONTRACTS_DIR, stdio: "pipe" },
  );

  const raw = readFileSync(DEPLOYMENTS_PATH, "utf-8");
  const json = JSON.parse(raw) as Record<string, string>;

  const contracts: DeployedContracts = {
    resourceTokenRegistry: json.resourceTokenRegistry as Address,
    hatValidator: json.hatValidator as Address,
    trustZoneImpl: json.trustZoneImpl as Address,
    hookMultiplexer: json.hookMultiplexer as Address,
    eligibilitiesChainImpl: json.eligibilitiesChainImpl as Address,
    agreementImpl: json.agreementImpl as Address,
    agreementRegistry: json.agreementRegistry as Address,
  };

  console.log("Contracts deployed:", contracts);
  return contracts;
}
