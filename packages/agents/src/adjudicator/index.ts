import { generateObject } from "ai";
import type { Hex, Address } from "viem";
import {
  encodeAdjudicate,
  AgreementABI,
} from "@trust-zones/sdk";
import { createChainClients } from "../shared/chain.js";
import { createLLMClient, type LLMConfig } from "../shared/llm.js";
import { createAgentPonderClient } from "../shared/ponder.js";
import { evaluateClaim, verdictSchema, type ClaimContext, type GenerateObjectFn } from "./evaluate.js";
import { mapVerdictToActions } from "./actions.js";
import { BonfiresClient, createAdjudicatorQueries } from "@trust-zones/bonfires";

export interface AdjudicatorConfig {
  rpcUrl: string;
  ponderUrl: string;
  privateKey: Hex;
  llm: LLMConfig;
  pollIntervalMs?: number;
  bonfiresUrl?: string;
  bonfiresApiKey?: string;
  bonfireId?: string;
}

export async function startAdjudicator(
  config: AdjudicatorConfig,
): Promise<{ stop: () => void }> {
  const chain = createChainClients(config.rpcUrl, config.privateKey);
  const ponder = createAgentPonderClient(config.ponderUrl);
  const llm = createLLMClient(config.llm);
  const pollInterval = config.pollIntervalMs ?? 10_000;

  // Optional Bonfires integration for cross-tier evidence queries
  const bonfires = config.bonfiresUrl && config.bonfiresApiKey && config.bonfireId
    ? createAdjudicatorQueries(new BonfiresClient({
        apiUrl: config.bonfiresUrl,
        apiKey: config.bonfiresApiKey,
        bonfireId: config.bonfireId,
      }))
    : null;

  let running = true;

  const generate: GenerateObjectFn = async (opts) => {
    return generateObject({
      model: opts.model,
      schema: opts.schema,
      system: opts.system,
      prompt: opts.prompt,
    });
  };

  async function tick() {
    try {
      const claims = await ponder.getUnadjudicatedClaims(
        chain.account.address,
      );

      for (const claim of claims) {
        if (!running) break;

        const claimIdNum = Number(claim.id.split(":").pop() ?? "0");

        // Fetch directives and responsibilities for the agreement's trust zones
        let directives: { rule: string; severity: string }[] = [];
        let responsibilities: { obligation: string; criteria?: string }[] = [];
        try {
          const state = await ponder.getAgreementState(claim.agreementAddress);
          for (const tz of state.trustZones) {
            const zoneDetails = await ponder.getZoneDetails(tz);
            directives.push(
              ...zoneDetails.directives.map((d) => ({
                rule: d.rule,
                severity: d.severity ?? "low",
              })),
            );
            responsibilities.push(
              ...zoneDetails.responsibilities.map((r) => ({
                obligation: r.obligation,
                criteria: r.criteria ?? undefined,
              })),
            );
          }
        } catch {
          directives = [];
          responsibilities = [];
        }

        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(claim.evidence);
        } catch {
          parsed = { raw: claim.evidence };
        }

        // Extract typed evidence fields from decoded JSON
        const vaultEvents = Array.isArray(parsed.vaultEvents) ? parsed.vaultEvents as { to: string; amount: string; txHash: string }[] : undefined;
        const tweets = Array.isArray(parsed.tweets) ? parsed.tweets as { zone: string; content: string; tweetId: string }[] : undefined;

        // Enrich with Bonfires cross-tier evidence if available
        let bonfiresEvidence: Record<string, unknown> | undefined;
        if (bonfires) {
          try {
            const zoneAddr = (parsed.zone as string) ?? tweets?.[0]?.zone;
            if (zoneAddr) {
              const bfCtx = await bonfires.getAdjudicationContext({
                claimId: String(claimIdNum),
                agreementAddr: claim.agreementAddress,
                zoneAddr,
                claimTimestamp: claim.timestamp,
              });
              bonfiresEvidence = {
                tweetReceipts: bfCtx.receipts.episodes,
                disclosedEvidence: bfCtx.evidence.episodes,
                directives: bfCtx.directives.entities,
              };
            }
          } catch (err) {
            console.warn("Bonfires evidence query failed:", err);
          }
        }

        const ctx: ClaimContext = {
          claimId: claimIdNum,
          responsibilities,
          directives,
          vaultEvents,
          tweets,
          bonfiresEvidence,
        };

        const verdict = await evaluateClaim(ctx, llm, generate);

        if (verdict.violated) {
          const actions = mapVerdictToActions(verdict);
          const { inputId, payload } = encodeAdjudicate(claimIdNum, actions);

          const txHash = await chain.wallet.writeContract({
            address: claim.agreementAddress,
            abi: AgreementABI,
            functionName: "submitInput",
            args: [inputId, payload],
            chain: null,
          });

          console.log(
            `Adjudicated claim ${claimIdNum}: violated=true, tx=${txHash}`,
          );
        } else {
          console.log(
            `Adjudicated claim ${claimIdNum}: violated=false, no action`,
          );
        }
      }
    } catch (err) {
      console.error("Adjudicator tick error:", err);
    }
  }

  // Start polling loop
  const loop = async () => {
    while (running) {
      await tick();
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

export { evaluateClaim } from "./evaluate.js";
export { mapVerdictToActions } from "./actions.js";
export type { ClaimContext, Verdict, GenerateObjectFn } from "./evaluate.js";
