import type { Hex, Address } from "viem";
import {
  encodeCounter,
  encodeClaim,
  encodeComplete,
  decodeProposalData,
  AgreementABI,
} from "@trust-zones/sdk";
import {
  compile,
  decompile,
  createDefaultRegistry,
  BASE_MAINNET_CONFIG,
} from "@trust-zones/compiler";
import { createChainClients } from "../shared/chain.js";
import { createLLMClient, type LLMConfig } from "../shared/llm.js";
import { createAgentPonderClient } from "../shared/ponder.js";
import {
  buildCounterProposal,
  determineWithdrawalLimit,
} from "./negotiate.js";
import {
  checkVaultWithdrawals,
  checkTweetViolations,
  buildClaimEvidence,
  type MonitorConfig,
} from "./monitor.js";
import { createCliEvaluateTweets, type EvaluateTweetsFn } from "./evaluate-tweets.js";

export interface CounterpartyConfig {
  rpcUrl: string;
  ponderUrl: string;
  privateKey: Hex;
  adjudicatorAddress: Address;
  vaultAddress: Address;
  tweetProxyUrl: string;
  llm?: LLMConfig;
  pollIntervalMs?: number;
}

export async function startCounterparty(
  config: CounterpartyConfig,
): Promise<{ stop: () => void }> {
  const chain = createChainClients(config.rpcUrl, config.privateKey);
  const ponder = createAgentPonderClient(config.ponderUrl);
  const llm = config.llm ? createLLMClient(config.llm) : null;
  const pollInterval = config.pollIntervalMs ?? 10_000;
  const registry = createDefaultRegistry();

  const evaluateTweets = createCliEvaluateTweets();
  let running = true;
  let lastCheckedBlock = 0n;

  // Loop 1: Watch for new proposals where this agent is partyB
  async function watchProposals() {
    try {
      const proposals = await ponder.getProposedAgreementsForParty(
        chain.account.address,
      );

      for (const agreement of proposals) {
        if (!running) break;

        // Get the latest proposal
        const sorted = [...agreement.proposals].sort(
          (a, b) => b.sequence - a.sequence,
        );
        const latest = sorted[0];
        if (!latest) continue;

        // Skip if we were the proposer of the latest round
        if (
          latest.proposerAddress.toLowerCase() ===
          chain.account.address.toLowerCase()
        ) {
          continue;
        }

        // Decode the proposal to evaluate it
        let proposalData;
        try {
          proposalData = decodeProposalData(latest.rawProposalData as Hex);
        } catch {
          console.error(
            `Failed to decode proposal for agreement ${agreement.id}`,
          );
          continue;
        }

        // Build a counter-proposal
        const testedAgent = agreement.parties.find(
          (p) =>
            p.address.toLowerCase() !== chain.account.address.toLowerCase(),
        );
        if (!testedAgent) continue;

        const reputation = { count: 0 }; // TODO: fetch from reputation registry
        const stakeAmount = 1_000_000n;
        const withdrawalLimit = determineWithdrawalLimit(
          reputation,
          stakeAmount,
        );

        const counterDoc = buildCounterProposal({
          testedAgent: testedAgent.address,
          counterparty: chain.account.address,
          adjudicator: config.adjudicatorAddress,
          withdrawalLimit,
          stakeAmount,
          deadline: Math.floor(Date.now() / 1000) + 86400,
          termsDocUri: proposalData.termsDocUri,
        });

        const counterProposal = compile(
          counterDoc,
          BASE_MAINNET_CONFIG,
          registry,
        );
        const { inputId, payload } = encodeCounter(counterProposal);

        const txHash = await chain.wallet.writeContract({
          address: agreement.id,
          abi: AgreementABI,
          functionName: "submitInput",
          args: [inputId, payload],
          chain: null,
        });

        console.log(
          `Submitted counter-proposal for agreement ${agreement.id}, tx=${txHash}`,
        );
      }
    } catch (err) {
      console.error("Counterparty proposal watch error:", err);
    }
  }

  // Loop 2: Watch active agreements for violations
  async function watchViolations() {
    try {
      const agreements = await ponder.getActiveAgreementsForParty(
        chain.account.address,
      );

      for (const agreement of agreements) {
        if (!running) break;

        // Find the tested agent's zone
        const testedZone = agreement.zones.find(
          (z) =>
            z.actorAddress.toLowerCase() !==
            chain.account.address.toLowerCase(),
        );
        if (!testedZone) continue;

        const monitorConfig: MonitorConfig = {
          agreementAddress: agreement.id,
          testedZoneAddress: testedZone.id,
          vaultAddress: config.vaultAddress,
          publicClient: chain.public,
          ponderBackend: ponder,
        };

        // Check vault withdrawals
        const withdrawals = await checkVaultWithdrawals(
          monitorConfig,
          lastCheckedBlock,
        );

        for (const withdrawal of withdrawals) {
          const evidence = buildClaimEvidence(withdrawal);
          const { inputId, payload } = encodeClaim(0, evidence);

          const txHash = await chain.wallet.writeContract({
            address: agreement.id,
            abi: AgreementABI,
            functionName: "submitInput",
            args: [inputId, payload],
            chain: null,
          });

          console.log(
            `Filed vault claim for agreement ${agreement.id}, tx=${txHash}`,
          );
        }

        // Check tweet violations — fetch zone's rules for LLM evaluation
        const zoneDetails = await ponder.getZoneDetails(testedZone.id);
        const responsibilities = (zoneDetails.responsibilities ?? []).map((r: { obligation: string; criteria?: string }) => ({
          obligation: r.obligation,
          criteria: r.criteria ?? undefined,
        }));
        const directives = (zoneDetails.directives ?? []).map((d: { rule: string; severity?: string }) => ({
          rule: d.rule,
          severity: d.severity ?? "low",
        }));

        const tweetViolations = await checkTweetViolations(
          monitorConfig,
          config.tweetProxyUrl,
          responsibilities,
          directives,
          evaluateTweets,
        );

        for (const violation of tweetViolations) {
          const evidence = buildClaimEvidence(violation);
          const { inputId, payload } = encodeClaim(0, evidence);

          const txHash = await chain.wallet.writeContract({
            address: agreement.id,
            abi: AgreementABI,
            functionName: "submitInput",
            args: [inputId, payload],
            chain: null,
          });

          console.log(
            `Filed tweet claim for agreement ${agreement.id}, tx=${txHash}`,
          );
        }
      }

      // Update last checked block
      const currentBlock = await chain.public.getBlockNumber();
      lastCheckedBlock = currentBlock;
    } catch (err) {
      console.error("Counterparty violation watch error:", err);
    }
  }

  // Start both loops
  const loop = async () => {
    while (running) {
      await watchProposals();
      await watchViolations();
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  };

  const loopPromise = loop();

  return {
    stop: () => {
      running = false;
    },
  };
}

export {
  buildCounterProposal,
  determineWithdrawalLimit,
  STANDARD_TWEET_DIRECTIVES,
  VAULT_DIRECTIVE,
} from "./negotiate.js";
export {
  checkVaultWithdrawals,
  checkTweetViolations,
  buildClaimEvidence,
} from "./monitor.js";
export type { VaultWithdrawal, TweetViolation, MonitorConfig } from "./monitor.js";
export { createCliEvaluateTweets } from "./evaluate-tweets.js";
export type { TweetEvaluation, TweetEvaluationContext, EvaluateTweetsFn } from "./evaluate-tweets.js";
export { TweetProxy, createTweetProxyFromEnv } from "./tweet-proxy.js";
export type { TweetProxyConfig, TweetRecord } from "./tweet-proxy.js";
