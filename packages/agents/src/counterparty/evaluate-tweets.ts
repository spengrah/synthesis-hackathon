import { z } from "zod";
import { generateText } from "ai";
import { runClaudeCli } from "../shared/claude-cli.js";
import type { LLMClient } from "../shared/llm.js";

export const tweetEvaluationSchema = z.object({
  hasPotentialViolation: z.boolean(),
  violations: z.array(z.object({
    tweetId: z.string(),
    violatedRules: z.array(z.number()),
    reasoning: z.string(),
  })),
});

export type TweetEvaluation = z.infer<typeof tweetEvaluationSchema>;

export interface TweetEvaluationContext {
  responsibilities: { obligation: string; criteria?: string }[];
  directives: { rule: string; severity: string }[];
  tweets: { zone: string; content: string; tweetId: string }[];
}

/**
 * Function type for tweet evaluation — allows injecting a mock in tests.
 */
export type EvaluateTweetsFn = (ctx: TweetEvaluationContext) => Promise<TweetEvaluation>;

function buildPrompt(ctx: TweetEvaluationContext): string {
  const parts: string[] = [];

  // Rules — same numbering as the adjudicator uses
  if (ctx.responsibilities.length > 0) {
    const list = ctx.responsibilities
      .map((r, i) => `${i}. ${r.obligation}${r.criteria ? ` (criteria: ${r.criteria})` : ""}`)
      .join("\n");
    parts.push(`## Responsibilities (obligations — agent MUST do these)\n${list}`);
  }

  if (ctx.directives.length > 0) {
    const offset = ctx.responsibilities.length;
    const list = ctx.directives
      .map((d, i) => `${offset + i}. [${d.severity}] ${d.rule}`)
      .join("\n");
    parts.push(`## Directives (restrictions — agent MUST NOT violate these)\n${list}`);
  }

  // Tweets
  const tweetLines = ctx.tweets.map((t) =>
    `- Tweet ID: ${t.tweetId}, Zone: ${t.zone}\n  Content: "${t.content}"`,
  );
  parts.push(`## Tweets Posted by Agent\n${tweetLines.join("\n")}`);

  parts.push("## Question\nDo any of these tweets violate the responsibilities or directives above? Identify each violating tweet by ID and the rule numbers violated.");

  return parts.join("\n\n");
}

/**
 * Create an EvaluateTweetsFn using an AI SDK LLM client (Venice, OpenAI, etc.).
 */
export function createLlmEvaluateTweets(llm: LLMClient): EvaluateTweetsFn {
  return async (ctx) => {
    if (ctx.tweets.length === 0) {
      return { hasPotentialViolation: false, violations: [] };
    }

    const fullPrompt = [
      "You are monitoring an agent's tweets on behalf of a counterparty in a Trust Zone agreement.",
      "The counterparty wants to know if any tweets violate the agreement's responsibilities or directives.",
      "Be thorough — flag anything that looks like a potential violation. The adjudicator will make the final call.",
      "",
      buildPrompt(ctx),
      "",
      "Output ONLY valid JSON, no other text:",
      '{"hasPotentialViolation": true/false, "violations": [{"tweetId": "...", "violatedRules": [rule numbers], "reasoning": "one sentence"}]}',
    ].join("\n");

    try {
      const result = await generateText({
        model: llm.provider(llm.model),
        prompt: fullPrompt,
      });

      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in LLM response");
      const parsed = JSON.parse(jsonMatch[0]) as TweetEvaluation;
      if (typeof parsed.hasPotentialViolation !== "boolean") {
        throw new Error("Invalid: missing hasPotentialViolation");
      }
      return parsed;
    } catch (err) {
      console.error("[counterparty] Tweet evaluation LLM call failed:", (err as Error).message?.slice(0, 200));
      return { hasPotentialViolation: false, violations: [] };
    }
  };
}

/**
 * Create a real EvaluateTweetsFn using `claude -p` (Haiku).
 */
export function createCliEvaluateTweets(opts?: {
  sessionsDir?: string;
}): EvaluateTweetsFn {
  return async (ctx) => {
    if (ctx.tweets.length === 0) {
      return { hasPotentialViolation: false, violations: [] };
    }

    const fullPrompt = [
      "You are monitoring an agent's tweets on behalf of a counterparty in a Trust Zone agreement.",
      "The counterparty wants to know if any tweets violate the agreement's responsibilities or directives.",
      "Be thorough — flag anything that looks like a potential violation. The adjudicator will make the final call.",
      "",
      buildPrompt(ctx),
      "",
      "Output JSON:",
      '{"hasPotentialViolation": true/false, "violations": [{"tweetId": "...", "violatedRules": [rule numbers], "reasoning": "one sentence"}]}',
    ].join("\n");

    try {
      const cleaned = runClaudeCli(fullPrompt, {
        sessionsDir: opts?.sessionsDir,
        sessionPrefix: "counterparty-tweet-eval",
      });

      const parsed = JSON.parse(cleaned) as TweetEvaluation;
      if (typeof parsed.hasPotentialViolation !== "boolean") {
        throw new Error("Invalid: missing hasPotentialViolation");
      }

      return parsed;
    } catch (err) {
      console.error("[counterparty] Tweet evaluation LLM call failed:", (err as Error).message?.slice(0, 200));
      return { hasPotentialViolation: false, violations: [] };
    }
  };
}
