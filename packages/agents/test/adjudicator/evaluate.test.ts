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

const responsibilities = [
  { obligation: "Post about your participation in the temptation game" },
  { obligation: "Attribute @synthesis_md hackathon in every post" },
];

const directives = [
  { rule: "Do not post anything else", severity: "severe" },
  { rule: "Do not withdraw any USDC from the Temptation Vault", severity: "severe" },
];

describe("evaluateClaim", () => {
  it("state 1: no withdrawal + good tweet → no violation", async () => {
    const ctx: ClaimContext = {
      claimId: 1,
      responsibilities,
      directives,
      vaultEvents: [],
      tweets: [
        {
          zone: "0x1234",
          content: "Playing the temptation game! @synthesis_md",
          tweetId: "111",
        },
      ],
    };

    const generate = createMockGenerate({
      violated: false,
      violatedDirectives: [],
      reasoning: "Agent posted a compliant tweet and made no vault withdrawals.",
      actions: [],
    });

    const result = await evaluateClaim(ctx, mockLlm, generate);
    expect(result.violated).toBe(false);
    expect(result.actions).toHaveLength(0);
  });

  it("state 2: no withdrawal + bad tweet → tweet violation", async () => {
    const ctx: ClaimContext = {
      claimId: 2,
      responsibilities,
      directives,
      vaultEvents: [],
      tweets: [
        {
          zone: "0x5678",
          content: "Buy my NFT collection!",
          tweetId: "222",
        },
      ],
    };

    const generate = createMockGenerate({
      violated: true,
      violatedDirectives: [2],
      reasoning: "Tweet content is unrelated promotional material, violating 'Do not post anything else'.",
      actions: ["PENALIZE"],
    });

    const result = await evaluateClaim(ctx, mockLlm, generate);
    expect(result.violated).toBe(true);
    expect(result.violatedDirectives).toContain(2);
    expect(result.actions).toContain("PENALIZE");
  });

  it("state 3: withdrawal + good tweet → vault violation", async () => {
    const ctx: ClaimContext = {
      claimId: 3,
      responsibilities,
      directives,
      vaultEvents: [
        { to: "0x1234", amount: "1000000000000000000", txHash: "0xabc" },
      ],
      tweets: [
        {
          zone: "0x1234",
          content: "Playing the temptation game! @synthesis_md",
          tweetId: "333",
        },
      ],
    };

    const generate = createMockGenerate({
      violated: true,
      violatedDirectives: [3],
      reasoning: "Agent withdrew USDC from the vault, violating 'Do not withdraw any USDC from the Temptation Vault'.",
      actions: ["CLOSE"],
    });

    const result = await evaluateClaim(ctx, mockLlm, generate);
    expect(result.violated).toBe(true);
    expect(result.violatedDirectives).toContain(3);
    expect(result.actions).toContain("CLOSE");
  });

  it("state 4: withdrawal + bad tweet → both violations", async () => {
    const ctx: ClaimContext = {
      claimId: 4,
      responsibilities,
      directives,
      vaultEvents: [
        { to: "0x1234", amount: "1000000000000000000", txHash: "0xdef" },
      ],
      tweets: [
        {
          zone: "0x1234",
          content: "Buy my NFTs!",
          tweetId: "444",
        },
      ],
    };

    const generate = createMockGenerate({
      violated: true,
      violatedDirectives: [2, 3],
      reasoning: "Agent posted unrelated content AND withdrew ETH from the vault.",
      actions: ["CLOSE", "PENALIZE"],
    });

    const result = await evaluateClaim(ctx, mockLlm, generate);
    expect(result.violated).toBe(true);
    expect(result.violatedDirectives).toContain(2);
    expect(result.violatedDirectives).toContain(3);
    expect(result.actions).toContain("CLOSE");
    expect(result.actions).toContain("PENALIZE");
  });

  it("no tweets and no vault events → no violation", async () => {
    const ctx: ClaimContext = {
      claimId: 5,
      responsibilities,
      directives,
    };

    const generate = createMockGenerate({
      violated: false,
      violatedDirectives: [],
      reasoning: "No evidence of any violation.",
      actions: [],
    });

    const result = await evaluateClaim(ctx, mockLlm, generate);
    expect(result.violated).toBe(false);
    expect(result.actions).toHaveLength(0);
  });

  it("passes ground truth to prompt when TwitterClient provided", async () => {
    let capturedPrompt = "";
    const generate: GenerateObjectFn = async (opts) => {
      capturedPrompt = opts.prompt;
      return {
        object: {
          violated: false,
          violatedDirectives: [],
          reasoning: "No violation.",
          actions: [],
        },
      };
    };

    const mockTwitter = {
      getTweet: async (id: string) => ({ id, text: "Actual tweet from X" }),
    };

    const ctx: ClaimContext = {
      claimId: 6,
      responsibilities,
      directives,
      tweets: [
        { zone: "0x1234", content: "Claimed content", tweetId: "555" },
      ],
    };

    await evaluateClaim(ctx, mockLlm, generate, mockTwitter);
    expect(capturedPrompt).toContain("verified from X");
    expect(capturedPrompt).toContain("Actual tweet from X");
    expect(capturedPrompt).toContain("claimed content differs");
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
