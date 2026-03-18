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
      name: "Withdrawn",
      inputs: [
        { name: "to", type: "address", indexed: true },
        { name: "amount", type: "uint256", indexed: false },
        { name: "permissionTokenId", type: "uint256", indexed: true },
      ],
    },
    fromBlock,
    toBlock: "latest",
  });

  return logs.map((log) => ({
    type: "vault-withdrawal" as const,
    to: (log.args as { to: Address }).to,
    amount: (log.args as { amount: bigint }).amount,
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
  directive?: { rule: string; severity: string },
): Hex {
  if (violation.type === "vault-withdrawal") {
    const evidence = {
      type: "vault-directive-violation",
      directive: directive?.rule ?? "Do not withdraw any ETH from the vault",
      directiveSeverity: directive?.severity ?? "severe",
      withdrawal: {
        zone: violation.to,
        amount: violation.amount.toString(),
        txHash: violation.txHash,
        blockNumber: violation.blockNumber.toString(),
      },
    };
    return stringToHex(JSON.stringify(evidence));
  }

  const evidence = {
    type: "tweet-directive-violation",
    directive: directive?.rule ?? "Do not post anything else",
    directiveSeverity: directive?.severity ?? "severe",
    tweet: {
      zone: violation.zone,
      content: violation.content,
      tweetId: violation.tweetId,
      timestamp: violation.timestamp,
    },
  };
  return stringToHex(JSON.stringify(evidence));
}
