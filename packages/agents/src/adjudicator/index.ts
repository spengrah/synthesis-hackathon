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

        // Fetch directives for the agreement's trust zones
        let directives: { rule: string; severity: string }[] = [];
        try {
          const state = await ponder.getAgreementState(claim.agreementAddress);
          for (const tz of state.trustZones) {
            const zoneDirectives = await ponder.getZoneDirectives(tz);
            directives.push(
              ...zoneDirectives.map((d) => ({
                rule: d.rule,
                severity: d.severity ?? "low",
              })),
            );
          }
        } catch {
          // If we can't fetch directives, use empty list
          directives = [];
        }

        let evidence: Record<string, unknown> = {};
        try {
          evidence = JSON.parse(claim.evidence);
        } catch {
          evidence = { raw: claim.evidence };
        }

        // Enrich with Bonfires cross-tier evidence if available
        let bonfiresEvidence: Record<string, unknown> | undefined;
        if (bonfires) {
          try {
            const zoneAddr = (evidence as { zone?: string }).zone;
            if (zoneAddr) {
              const ctx = await bonfires.getAdjudicationContext({
                claimId: String(claimIdNum),
                agreementAddr: claim.agreementAddress,
                zoneAddr,
                claimTimestamp: claim.timestamp,
              });
              bonfiresEvidence = {
                tweetReceipts: ctx.receipts.episodes,
                disclosedEvidence: ctx.evidence.episodes,
                directives: ctx.directives.entities,
              };
            }
          } catch (err) {
            console.warn("Bonfires evidence query failed:", err);
          }
        }

        const ctx: ClaimContext = {
          claimId: claimIdNum,
          evidence,
          directives,
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
