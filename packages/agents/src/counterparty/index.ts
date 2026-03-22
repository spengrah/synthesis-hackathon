import type { Hex, Address } from "viem";
import { generateObject } from "ai";
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
  evaluateProposal,
} from "./negotiate.js";
import {
  checkVaultWithdrawals,
  checkTweetViolations,
  buildClaimEvidence,
  type MonitorConfig,
} from "./monitor.js";
import { createCliEvaluateTweets, type EvaluateTweetsFn } from "./evaluate-tweets.js";
import { BonfiresClient, createReceiptLogger } from "@trust-zones/bonfires";

export interface CounterpartyConfig {
  rpcUrl: string;
  ponderUrl: string;
  privateKey: Hex;
  chainId?: number;
  adjudicatorAddress: Address;
  vaultAddress: Address;
  tweetProxyUrl: string;
  llm?: LLMConfig;
  /** Direct tweet evaluation function — bypasses createCliEvaluateTweets */
  evaluateTweets?: EvaluateTweetsFn;
  pollIntervalMs?: number;
  bonfiresUrl?: string;
  bonfiresApiKey?: string;
  bonfireId?: string;
  usdc?: Address;
}

export async function startCounterparty(
  config: CounterpartyConfig,
): Promise<{ stop: () => void }> {
  console.log(`[counterparty] v2 starting (usdc=${config.usdc ?? "default"}, chainId=${config.chainId ?? "default"})`);
  const chain = createChainClients(config.rpcUrl, config.privateKey, config.chainId);
  const ponder = createAgentPonderClient(config.ponderUrl);
  const llm = config.llm ? createLLMClient(config.llm) : null;
  const pollInterval = config.pollIntervalMs ?? 10_000;
  const registry = createDefaultRegistry();

  const evaluateTweets = config.evaluateTweets ?? createCliEvaluateTweets();
  let running = true;
  let lastCheckedTimestamp = 0n;

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

        const testedAgent = agreement.parties.find(
          (p) =>
            p.address.toLowerCase() !== chain.account.address.toLowerCase(),
        );
        if (!testedAgent) continue;

        const usdc = config.usdc ?? ("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address);

        const testedZone = proposalData.zones.find(
          (z) => z.party.toLowerCase() === testedAgent.address.toLowerCase(),
        );
        const testedAgentId = testedZone ? Number(testedZone.agentId) : 0;

        let withdrawalLimit: bigint;
        let stakeAmount: bigint;
        let deadline: number;

        if (llm) {
          const decompiled = decompile(proposalData, BASE_MAINNET_CONFIG, registry);
          try {
            const evaluation = await evaluateProposal(decompiled, llm, generateObject);
            if (!evaluation.shouldCounter) {
              console.log(`LLM decided not to counter proposal for ${agreement.id}: ${evaluation.reasoning}`);
              continue;
            }
            withdrawalLimit = BigInt(evaluation.withdrawalLimit);
            stakeAmount = BigInt(evaluation.stakeAmount);
            deadline = evaluation.deadline;
            console.log(`LLM evaluation: ${evaluation.reasoning}`);
          } catch (err) {
            console.error("LLM evaluation failed, falling back to hardcoded logic:", err);
            const reputation = { count: 0 };
            withdrawalLimit = determineWithdrawalLimit(reputation);
            stakeAmount = 1_000_000n;
            deadline = Math.floor(Date.now() / 1000) + 86400;
          }
        } else {
          const reputation = { count: 0 };
          withdrawalLimit = determineWithdrawalLimit(reputation);
          stakeAmount = 1_000_000n;
          deadline = Math.floor(Date.now() / 1000) + 86400;
        }

        const counterDoc = buildCounterProposal({
          testedAgent: testedAgent.address,
          counterparty: chain.account.address,
          adjudicator: config.adjudicatorAddress,
          temptationAddress: config.vaultAddress,
          withdrawalLimit,
          stakeAmount,
          deadline,
          termsDocUri: proposalData.termsDocUri,
          testedAgentId,
          usdc,
        });

        const compilerConfig = {
          ...BASE_MAINNET_CONFIG,
          modules: {
            ...BASE_MAINNET_CONFIG.modules,
            staking: "0x9E01030aF633Be5a439DF122F2eEf750b44B8aC7" as Address,
          },
        };

        const counterProposal = compile(
          counterDoc,
          compilerConfig,
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
          lastCheckedTimestamp,
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
        const responsibilities = (zoneDetails.responsibilities ?? []).map((r) => ({
          obligation: r.obligation,
          criteria: r.criteria ?? undefined,
        }));
        const directives = (zoneDetails.directives ?? []).map((d) => ({
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

      lastCheckedTimestamp = BigInt(Math.floor(Date.now() / 1000));
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
  evaluateProposal,
  TWEET_DIRECTIVE,
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
