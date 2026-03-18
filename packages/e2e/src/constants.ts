import type { Address, Hex } from "viem";

// Anvil deterministic accounts (well-known private keys)
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

// Pre-deployed on Base mainnet (available on fork)
export const PRE_DEPLOYED = {
  hats: "0x3bc1A0Ad72417f2d411118085256fC53CBdDd137" as Address,
  hatsModuleFactory: "0x0a3f85fa597B6a967271286aA0724811acDF5CD9" as Address,
  identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as Address,
  reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as Address,
  stakingEligibility: "0x9E01030aF633Be5a439DF122F2eEf750b44B8aC7" as Address,
} as const;

export const FORK_BLOCK = 43_454_644;
export const ANVIL_RPC_URL = "http://127.0.0.1:8545";
export const PONDER_PORT = 42069;
export const PONDER_URL = `http://localhost:${PONDER_PORT}/graphql`;

// USDC on Base
export const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
