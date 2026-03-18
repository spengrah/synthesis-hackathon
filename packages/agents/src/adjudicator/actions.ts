import { CLOSE, PENALIZE, type AdjudicationAction } from "@trust-zones/sdk";
import type { Verdict } from "./evaluate.js";

export function mapVerdictToActions(verdict: Verdict): AdjudicationAction[] {
  if (!verdict.violated) return [];

  return verdict.actions.map((action) => {
    const actionType = action === "CLOSE" ? CLOSE : PENALIZE;
    return {
      mechanismIndex: 0n,
      targetIndex: 0n,
      actionType,
      params: "0x" as `0x${string}`,
    };
  });
}
