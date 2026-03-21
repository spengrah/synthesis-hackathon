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
  temptationVault: Address;
}

const CONTRACTS_DIR = resolve(import.meta.dirname, "../../contracts");
const DEPLOYMENTS_PATH = resolve(CONTRACTS_DIR, "deployments.json");

/** Deploy contracts via forge script (Anvil only). */
export function deploy(rpcUrl: string = ANVIL_RPC_URL): DeployedContracts {
  console.log("Deploying contracts via DeployAll script...");

  // Explicitly unset PRIVATE_KEY so the script uses the Anvil default key
  execSync(
    `FOUNDRY_PROFILE=deploy PRIVATE_KEY= forge script script/DeployAll.s.sol --broadcast --rpc-url ${rpcUrl}`,
    { cwd: CONTRACTS_DIR, stdio: "pipe" },
  );

  return readDeployments();
}

/** Read existing deployments from deployments.json for a specific chain ID. */
export function readDeployments(chainId?: number): DeployedContracts {
  const raw = readFileSync(DEPLOYMENTS_PATH, "utf-8");
  const json = JSON.parse(raw) as Record<string, any>;

  // Support both keyed-by-chainId and flat formats
  let data: Record<string, any>;
  if (chainId && json[String(chainId)]) {
    data = json[String(chainId)];
  } else if (json.agreementRegistry) {
    // Flat format (legacy)
    data = json;
  } else {
    // Keyed format — pick the first (and likely only) entry
    const firstKey = Object.keys(json)[0];
    data = json[firstKey];
  }

  const contracts: DeployedContracts = {
    resourceTokenRegistry: data.resourceTokenRegistry as Address,
    hatValidator: data.hatValidator as Address,
    trustZoneImpl: data.trustZoneImpl as Address,
    hookMultiplexer: data.hookMultiplexer as Address,
    eligibilitiesChainImpl: data.eligibilitiesChainImpl as Address,
    agreementImpl: data.agreementImpl as Address,
    agreementRegistry: data.agreementRegistry as Address,
    temptationVault: data.temptationVault as Address,
  };

  console.log("Contracts loaded:", contracts);
  return contracts;
}
