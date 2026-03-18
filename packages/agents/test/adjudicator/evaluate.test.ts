import { describe, it, expect } from "vitest";
import {
  evaluateClaim,
  type ClaimContext,
  type Verdict,
  type GenerateObjectFn,
} from "../../src/adjudicator/evaluate.js";
import { mapVerdictToActions } from "../../src/adjudicator/actions.js";
import { CLOSE, PENALIZE } from "@trust-zones/sdk";
import type { LLMClient } from "../../src/shared/llm.js";

// Mock LLM client — not used since we mock generateObject
const mockLlm: LLMClient = {
  provider: (() => "mock-model") as unknown as LLMClient["provider"],
  model: "test-model",
};

function createMockGenerate(response: Verdict): GenerateObjectFn {
  return async () => ({ object: response });
}

describe("evaluateClaim", () => {
  const directives = [
    { rule: "Do not withdraw any ETH from the vault", severity: "severe" },
    { rule: "Always attribute @synthesis_md hackathon", severity: "severe" },
  ];

  it("detects vault violation", async () => {
    const ctx: ClaimContext = {
      claimId: 1,
      evidence: {
        type: "vault-withdrawal",
        to: "0x1234",
        amount: "1000000000000000000",
      },
      directives,
      vaultEvents: [
        {
          to: "0x1234",
          amount: "1000000000000000000",
          txHash: "0xabc",
        },
      ],
    };

    const expectedVerdict: Verdict = {
      violated: true,
      violatedDirectives: [0],
      reasoning: "The agent withdrew ETH from the vault in violation of directive 0.",
      actions: ["CLOSE"],
    };

    const generate = createMockGenerate(expectedVerdict);
    const result = await evaluateClaim(ctx, mockLlm, generate);

    expect(result.violated).toBe(true);
    expect(result.violatedDirectives).toContain(0);
    expect(result.actions).toContain("CLOSE");
  });

  it("detects tweet violation", async () => {
    const ctx: ClaimContext = {
      claimId: 2,
      evidence: {
        type: "tweet-violation",
        content: "Buy my NFT collection!",
      },
      directives,
      tweetReceipts: [
        {
          zone: "0x5678",
          content: "Buy my NFT collection!",
          tweetId: "12345",
        },
      ],
    };

    const expectedVerdict: Verdict = {
      violated: true,
      violatedDirectives: [1],
      reasoning: "The tweet does not attribute @synthesis_md hackathon.",
      actions: ["PENALIZE"],
    };

    const generate = createMockGenerate(expectedVerdict);
    const result = await evaluateClaim(ctx, mockLlm, generate);

    expect(result.violated).toBe(true);
    expect(result.violatedDirectives).toContain(1);
  });

  it("returns no violation for compliant behavior", async () => {
    const ctx: ClaimContext = {
      claimId: 3,
      evidence: { type: "check", message: "routine compliance check" },
      directives,
    };

    const expectedVerdict: Verdict = {
      violated: false,
      violatedDirectives: [],
      reasoning: "No evidence of any directive violation.",
      actions: [],
    };

    const generate = createMockGenerate(expectedVerdict);
    const result = await evaluateClaim(ctx, mockLlm, generate);

    expect(result.violated).toBe(false);
    expect(result.violatedDirectives).toHaveLength(0);
    expect(result.actions).toHaveLength(0);
  });
});

describe("mapVerdictToActions", () => {
  it("returns empty array for no violation", () => {
    const verdict: Verdict = {
      violated: false,
      violatedDirectives: [],
      reasoning: "All good.",
      actions: [],
    };
    expect(mapVerdictToActions(verdict)).toHaveLength(0);
  });

  it("maps CLOSE action correctly", () => {
    const verdict: Verdict = {
      violated: true,
      violatedDirectives: [0],
      reasoning: "Vault violation.",
      actions: ["CLOSE"],
    };
    const actions = mapVerdictToActions(verdict);
    expect(actions).toHaveLength(1);
    expect(actions[0].actionType).toBe(CLOSE);
    expect(actions[0].mechanismIndex).toBe(0n);
    expect(actions[0].targetIndex).toBe(0n);
    expect(actions[0].params).toBe("0x");
  });

  it("maps PENALIZE action correctly", () => {
    const verdict: Verdict = {
      violated: true,
      violatedDirectives: [1],
      reasoning: "Tweet violation.",
      actions: ["PENALIZE"],
    };
    const actions = mapVerdictToActions(verdict);
    expect(actions).toHaveLength(1);
    expect(actions[0].actionType).toBe(PENALIZE);
  });

  it("maps multiple actions", () => {
    const verdict: Verdict = {
      violated: true,
      violatedDirectives: [0, 1],
      reasoning: "Multiple violations.",
      actions: ["CLOSE", "PENALIZE"],
    };
    const actions = mapVerdictToActions(verdict);
    expect(actions).toHaveLength(2);
    expect(actions[0].actionType).toBe(CLOSE);
    expect(actions[1].actionType).toBe(PENALIZE);
  });
});
