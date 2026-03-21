import { createConfig } from "@ponder/core";
import { http, parseAbiItem } from "viem";
import { agreementRegistryAbi } from "./abis/AgreementRegistryAbi";
import { agreementAbi } from "./abis/AgreementAbi";
import { resourceTokenRegistryAbi } from "./abis/ResourceTokenRegistryAbi";
import { temptationAbi } from "./abis/TemptationAbi";

// Configurable via env vars — defaults are placeholders for development
const AGREEMENT_REGISTRY = (process.env.PONDER_AGREEMENT_REGISTRY ?? "0x0000000000000000000000000000000000000001") as `0x${string}`;
const RESOURCE_TOKEN_REGISTRY = (process.env.PONDER_RESOURCE_TOKEN_REGISTRY ?? "0x0000000000000000000000000000000000000002") as `0x${string}`;
const TEMPTATION_VAULT = (process.env.PONDER_TEMPTATION_VAULT ?? "0x0000000000000000000000000000000000000003") as `0x${string}`;
const START_BLOCK = Number(process.env.PONDER_START_BLOCK ?? 0);
const CHAIN_ID = Number(process.env.PONDER_CHAIN_ID ?? 8453);

export default createConfig({
  networks: {
    base: {
      chainId: CHAIN_ID,
      transport: http(process.env.PONDER_RPC_URL ?? "http://127.0.0.1:8545"),
    },
  },
  contracts: {
    AgreementRegistry: {
      network: "base",
      abi: agreementRegistryAbi,
      address: AGREEMENT_REGISTRY,
      startBlock: START_BLOCK,
    },
    Agreement: {
      network: "base",
      abi: agreementAbi,
      factory: {
        address: AGREEMENT_REGISTRY,
        event: parseAbiItem(
          "event AgreementCreated(address indexed agreement, address indexed creator, uint256 agreementHatId, address partyA, address partyB)"
        ),
        parameter: "agreement",
      },
      startBlock: START_BLOCK,
    },
    ResourceTokenRegistry: {
      network: "base",
      abi: resourceTokenRegistryAbi,
      address: RESOURCE_TOKEN_REGISTRY,
      startBlock: START_BLOCK,
    },
    Temptation: {
      network: "base",
      abi: temptationAbi,
      address: TEMPTATION_VAULT,
      startBlock: START_BLOCK,
    },
  },
});
