import type { Address, Hex, PublicClient, Transport, Chain } from "viem";
import { stringToHex } from "viem";
import type { AgentPonderClient } from "../shared/ponder.js";

export interface MonitorConfig {
  agreementAddress: Address;
  testedZoneAddress: Address;
  vaultAddress: Address;
  publicClient: PublicClient<Transport, Chain>;
  ponderBackend: AgentPonderClient;
}

export interface VaultWithdrawal {
  type: "vault-withdrawal";
  to: Address;
  amount: bigint;
  txHash: Hex;
  blockNumber: bigint;
}

export interface TweetViolation {
  type: "tweet-violation";
  zone: string;
  content: string;
  tweetId: string;
  timestamp?: string;
}

export async function checkVaultWithdrawals(
  config: MonitorConfig,
  fromBlock: bigint,
): Promise<VaultWithdrawal[]> {
  const logs = await config.publicClient.getLogs({
    address: config.vaultAddress,
    event: {
      type: "event",
      name: "Transfer",
      inputs: [
        { name: "from", type: "address", indexed: true },
        { name: "to", type: "address", indexed: true },
        { name: "value", type: "uint256", indexed: false },
      ],
    },
    fromBlock,
    toBlock: "latest",
  });

  return logs.map((log) => ({
    type: "vault-withdrawal" as const,
    to: (log.args as { to: Address }).to,
    amount: (log.args as { value: bigint }).value,
    txHash: log.transactionHash as Hex,
    blockNumber: log.blockNumber,
  }));
}

export async function checkTweetViolations(
  _config: MonitorConfig,
  tweetProxyUrl: string,
): Promise<TweetViolation[]> {
  try {
    const res = await fetch(
      `${tweetProxyUrl}/violations?zone=${_config.testedZoneAddress}`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      violations: { zone: string; content: string; tweetId: string; timestamp?: string }[];
    };
    return (data.violations ?? []).map((v) => ({
      type: "tweet-violation" as const,
      zone: v.zone,
      content: v.content,
      tweetId: v.tweetId,
      timestamp: v.timestamp,
    }));
  } catch {
    return [];
  }
}

export function buildClaimEvidence(
  violation: VaultWithdrawal | TweetViolation,
): Hex {
  if (violation.type === "vault-withdrawal") {
    const evidence = {
      type: "vault-withdrawal",
      to: violation.to,
      amount: violation.amount.toString(),
      txHash: violation.txHash,
    };
    return stringToHex(JSON.stringify(evidence));
  }

  const evidence = {
    type: "tweet-violation",
    zone: violation.zone,
    content: violation.content,
    tweetId: violation.tweetId,
    timestamp: violation.timestamp,
  };
  return stringToHex(JSON.stringify(evidence));
}
