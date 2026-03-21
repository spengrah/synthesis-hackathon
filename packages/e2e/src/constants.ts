import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import type { Address, Hex } from "viem";

// ---- Chain configs ----

export interface ChainConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  identityRegistry: Address;
  reputationRegistry: Address;
  usdc: Address;
  hats: Address;
  hatsModuleFactory: Address;
  stakingEligibility: Address;
  /** True when running against Anvil (cheatcodes available) */
  isLocal: boolean;
  /** Block number when contracts were first deployed (for Ponder start block) */
  deployBlock?: number;
}

// Hats addresses are the same on all chains (deterministic deployment)
const HATS_COMMON = {
  hats: "0x3bc1A0Ad72417f2d411118085256fC53CBdDd137" as Address,
  hatsModuleFactory: "0x0a3f85fa597B6a967271286aA0724811acDF5CD9" as Address,
  stakingEligibility: "0x9E01030aF633Be5a439DF122F2eEf750b44B8aC7" as Address,
};

const CHAIN_CONFIGS: Record<number, Omit<ChainConfig, "rpcUrl">> = {
  // Anvil fork of Base mainnet
  31337: {
    name: "Anvil",
    chainId: 31337,
    identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as Address,
    reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as Address,
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address,
    isLocal: true,
    ...HATS_COMMON,
  },
  // Base mainnet
  8453: {
    name: "Base",
    chainId: 8453,
    identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as Address,
    reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as Address,
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address,
    isLocal: false,
    ...HATS_COMMON,
  },
  // Base Sepolia
  84532: {
    name: "Base Sepolia",
    chainId: 84532,
    identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e" as Address,
    reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713" as Address,
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address,
    isLocal: false,
    deployBlock: 39151830,
    ...HATS_COMMON,
  },
};

export function getChainConfig(chainId: number, rpcUrl: string): ChainConfig {
  const base = CHAIN_CONFIGS[chainId];
  if (!base) throw new Error(`No chain config for chainId ${chainId}`);
  return { ...base, rpcUrl };
}

// ---- Agent accounts ----

export interface AgentAccount {
  address: Address;
  privateKey: Hex;
}

export interface AgentAccounts {
  temptee: AgentAccount;
  counterparty: AgentAccount;
  adjudicator: AgentAccount;
}

/** Load agent keys from .env.agents (testnet) or generate fresh (Anvil). */
export function loadAgentAccounts(): AgentAccounts | null {
  const envPath = resolve(import.meta.dirname, "../../../.env.agents");
  try {
    loadEnv({ path: envPath });
  } catch {
    return null;
  }

  const tempteeKey = process.env.TEMPTEE_PRIVATE_KEY as Hex | undefined;
  const counterpartyKey = process.env.COUNTERPARTY_PRIVATE_KEY as Hex | undefined;
  const adjudicatorKey = process.env.ADJUDICATOR_PRIVATE_KEY as Hex | undefined;

  if (!tempteeKey || !counterpartyKey || !adjudicatorKey) return null;

  // Derive addresses from keys
  const { privateKeyToAccount } = require("viem/accounts");
  return {
    temptee: { address: privateKeyToAccount(tempteeKey).address, privateKey: tempteeKey },
    counterparty: { address: privateKeyToAccount(counterpartyKey).address, privateKey: counterpartyKey },
    adjudicator: { address: privateKeyToAccount(adjudicatorKey).address, privateKey: adjudicatorKey },
  };
}

// ---- Legacy exports (for tests that haven't migrated) ----

export const ANVIL_ACCOUNTS = {
  deployer: {
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as Address,
    privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex,
  },
  partyA: {
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Address,
    privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex,
  },
  partyB: {
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as Address,
    privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex,
  },
  adjudicator: {
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906" as Address,
    privateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" as Hex,
  },
} as const;

export const PRE_DEPLOYED = {
  hats: HATS_COMMON.hats,
  hatsModuleFactory: HATS_COMMON.hatsModuleFactory,
  identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as Address,
  reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as Address,
  stakingEligibility: HATS_COMMON.stakingEligibility,
} as const;

export const FORK_BLOCK = 43_454_644;
export const ANVIL_RPC_URL = "http://127.0.0.1:8545";
export const PONDER_PORT = 42069;
export const PONDER_URL = `http://localhost:${PONDER_PORT}/graphql`;
export const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
