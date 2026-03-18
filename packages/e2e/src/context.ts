import type { Address, WalletClient, PublicClient } from "viem";
import type { DeployedContracts } from "./deploy.js";

export interface DemoContext {
  contracts: DeployedContracts;
  clients: {
    deployer: WalletClient;
    partyA: WalletClient;
    partyB: WalletClient;
    adjudicator: WalletClient;
  };
  publicClient: PublicClient;
  ponderUrl: string;
  agreementAddress?: Address;
  // Future extensions:
  x402Url?: string;
  dataApiUrls?: { agentA: string; agentB: string };
  bonfireId?: string;
}
