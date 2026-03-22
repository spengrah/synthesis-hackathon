import { encodeAbiParameters, keccak256, toHex, type Hex } from "viem";
import { CLOSE, PENALIZE, FEEDBACK, type AdjudicationAction } from "@trust-zones/sdk";
import type { Verdict } from "./evaluate.js";

export interface FeedbackContext {
  agreementAddress: string;
  claimId: number;
  directives: { tokenId: bigint }[];
  responsibilities: { tokenId: bigint }[];
  /** Index of the party being adjudicated (0 or 1) */
  targetIndex: number;
}

export function mapVerdictToActions(
  verdict: Verdict,
  feedbackCtx?: FeedbackContext,
): AdjudicationAction[] {
  if (!verdict.violated) return [];

  const actions: AdjudicationAction[] = verdict.actions.map((action) => {
    const actionType = action === "CLOSE" ? CLOSE : PENALIZE;
    return {
      mechanismIndex: 0n,
      targetIndex: 0n,
      actionType,
      params: "0x" as Hex,
    };
  });

  // Ensure CLOSE is always included when violated (LLM sometimes omits it)
  if (!actions.some((a) => a.actionType === CLOSE)) {
    actions.push({
      mechanismIndex: 0n,
      targetIndex: 0n,
      actionType: CLOSE,
      params: "0x" as Hex,
    });
  }

  // Add FEEDBACK action with structured content
  if (feedbackCtx) {
    // Map violated directive indices to token IDs
    const responsibilityCount = feedbackCtx.responsibilities.length;
    const violatedDirectiveTokenIds = verdict.violatedDirectives
      .filter((i) => i >= responsibilityCount)
      .map((i) => {
        const d = feedbackCtx.directives[i - responsibilityCount];
        return d ? d.tokenId.toString() : undefined;
      })
      .filter(Boolean) as string[];

    const unfulfilledResponsibilityTokenIds = verdict.violatedDirectives
      .filter((i) => i < responsibilityCount)
      .map((i) => {
        const r = feedbackCtx.responsibilities[i];
        return r ? r.tokenId.toString() : undefined;
      })
      .filter(Boolean) as string[];

    const feedbackContent = JSON.stringify({
      outcome: "FAILED",
      agreement: feedbackCtx.agreementAddress,
      claimId: feedbackCtx.claimId,
      violatedDirectives: violatedDirectiveTokenIds,
      unfulfilledResponsibilities: unfulfilledResponsibilityTokenIds,
    });

    const feedbackURI = `data:application/json,${encodeURIComponent(feedbackContent)}`;
    const feedbackHash = keccak256(toHex(feedbackContent));

    actions.push({
      mechanismIndex: 0n,
      targetIndex: BigInt(feedbackCtx.targetIndex),
      actionType: FEEDBACK,
      params: encodeAbiParameters(
        [{ type: "string" }, { type: "bytes32" }],
        [feedbackURI, feedbackHash],
      ),
    });
  }

  return actions;
}
