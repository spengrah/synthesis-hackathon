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
  chainId?: number;
  /** AI SDK LLM config — provide this OR generate, not both */
  llm?: LLMConfig;
  /** Direct generate function — bypasses AI SDK, use for claude-cli or mocks */
  generate?: GenerateObjectFn;
  pollIntervalMs?: number;
  bonfiresUrl?: string;
  bonfiresApiKey?: string;
  bonfireId?: string;
}

export async function startAdjudicator(
  config: AdjudicatorConfig,
): Promise<{ stop: () => void }> {
  const chain = createChainClients(config.rpcUrl, config.privateKey, config.chainId);
  const ponder = createAgentPonderClient(config.ponderUrl);
  const pollInterval = config.pollIntervalMs ?? 10_000;

  // LLM: use provided generate function, or construct one from AI SDK config
  const llm = config.llm ? createLLMClient(config.llm) : { provider: (() => "injected") as any, model: "injected" };
  const generate: GenerateObjectFn = config.generate ?? (async (opts) => {
    return generateObject({
      model: opts.model,
      schema: opts.schema,
      system: opts.system,
      prompt: opts.prompt,
      mode: "json",
    });
  });

  // Optional Bonfires integration for cross-tier evidence queries
  const bonfires = config.bonfiresUrl && config.bonfiresApiKey && config.bonfireId
    ? createAdjudicatorQueries(new BonfiresClient({
        apiUrl: config.bonfiresUrl,
        apiKey: config.bonfiresApiKey,
        bonfireId: config.bonfireId,
      }))
    : null;

  let running = true;

  async function tick() {
    try {
      const claims = await ponder.getUnadjudicatedClaims(
        chain.account.address,
      );
      if (claims.length > 0) {
        console.log(`[adjudicator] Found ${claims.length} unadjudicated claim(s)`);
      }

      for (const claim of claims) {
        if (!running) break;

        const claimIdNum = Number(claim.id.split(":").pop() ?? "0");

        // Fetch directives and responsibilities for the agreement's trust zones
        const directives: { rule: string; severity: string; tokenId: bigint }[] = [];
        const responsibilities: { obligation: string; criteria?: string; tokenId: bigint }[] = [];
        try {
          const state = await ponder.getAgreementState(claim.agreementAddress);
          const zones = state.trustZones.filter((tz) => tz !== "0x0000000000000000000000000000000000000000");
          for (const tz of zones) {
            const zoneDetails = await ponder.getZoneDetails(tz);
            directives.push(
              ...zoneDetails.directives.map((d) => ({
                rule: d.rule,
                severity: d.severity ?? "low",
                tokenId: d.tokenId,
              })),
            );
            responsibilities.push(
              ...zoneDetails.responsibilities.map((r) => ({
                obligation: r.obligation,
                criteria: r.criteria ?? undefined,
                tokenId: r.tokenId,
              })),
            );
          }
        } catch (err) {
          console.warn(`Adjudicator: failed to fetch zone details for ${claim.agreementAddress}, will retry next tick:`, err);
          continue;
        }

        if (directives.length === 0 && responsibilities.length === 0) {
          console.warn(`Adjudicator: no directives or responsibilities for ${claim.agreementAddress}, will retry next tick`);
          continue;
        }

        let parsed: Record<string, unknown> = {};
        try {
          // Evidence is hex-encoded JSON — decode it
          const evidenceStr = claim.evidence.startsWith("0x")
            ? Buffer.from(claim.evidence.slice(2), "hex").toString("utf-8")
            : claim.evidence;
          parsed = JSON.parse(evidenceStr);
        } catch {
          parsed = { raw: claim.evidence };
        }

        // Extract typed evidence fields from decoded JSON
        // Evidence may contain vaultEvents array or a single withdrawal object
        let vaultEvents: { to: string; amount: string; txHash: string }[] | undefined;
        if (Array.isArray(parsed.vaultEvents)) {
          vaultEvents = parsed.vaultEvents as { to: string; amount: string; txHash: string }[];
        } else if (parsed.withdrawal && typeof parsed.withdrawal === "object") {
          const w = parsed.withdrawal as { zone?: string; to?: string; amount: string; txHash: string };
          vaultEvents = [{ to: w.zone ?? w.to ?? "", amount: w.amount, txHash: w.txHash }];
        }
        // Evidence may contain tweets array or a single tweet object
        let tweets: { zone: string; content: string; tweetId: string }[] | undefined;
        if (Array.isArray(parsed.tweets)) {
          tweets = parsed.tweets as { zone: string; content: string; tweetId: string }[];
        } else if (Array.isArray(parsed.violations)) {
          // Tweet violation evidence has a violations array
          tweets = (parsed.violations as { tweetId: string; content?: string; zone?: string }[]).map((v) => ({
            zone: v.zone ?? (parsed.zone as string) ?? "",
            content: v.content ?? "",
            tweetId: v.tweetId,
          }));
        }

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
          const actions = mapVerdictToActions(verdict, {
            agreementAddress: claim.agreementAddress,
            claimId: claimIdNum,
            directives,
            responsibilities,
            targetIndex: 0, // TODO: determine which party violated from evidence
          });
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
