import { z } from "zod";
import type { LLMClient } from "../shared/llm.js";

export const verdictSchema = z.object({
  violated: z.boolean(),
  violatedDirectives: z.array(z.number()),
  reasoning: z.string(),
  actions: z.array(z.enum(["CLOSE", "PENALIZE"])),
});

export type Verdict = z.infer<typeof verdictSchema>;

export interface ClaimContext {
  claimId: number;
  evidence: Record<string, unknown>;
  responsibilities: { obligation: string; criteria?: string }[];
  directives: { rule: string; severity: string }[];
  vaultEvents?: { to: string; amount: string; txHash: string }[];
  tweetReceipts?: { zone: string; content: string; tweetId: string }[];
}

const SYSTEM_PROMPT = `You are an impartial adjudicator for a Trust Zone agreement. You evaluate claims of responsibility failures and directive violations. Examine the evidence, compare against the stated responsibilities (obligations the agent MUST fulfill) and directives (restrictions the agent MUST NOT violate), and determine if a violation occurred. Be conservative: only find a violation if the evidence clearly demonstrates one.`;

function buildRulesSection(ctx: ClaimContext): string {
  const parts: string[] = [];

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

  return parts.join("\n\n");
}

function buildVaultUserPrompt(ctx: ClaimContext): string {
  const evidenceJson = JSON.stringify(ctx.evidence, null, 2);

  const vaultEvents = (ctx.vaultEvents ?? [])
    .map((e) => `- To: ${e.to}, Amount: ${e.amount}, TxHash: ${e.txHash}`)
    .join("\n");

  return `${buildRulesSection(ctx)}

## Evidence Submitted by Claimant
${evidenceJson}

## On-Chain Vault Activity
${vaultEvents || "No vault activity recorded."}

## Question
Did the accused party violate any responsibilities or directives? Respond with structured JSON.`;
}

function buildTweetUserPrompt(ctx: ClaimContext): string {
  const tweet = ctx.tweetReceipts?.[0];
  const tweetSection = tweet
    ? `Content: "${tweet.content}"\nTweet ID: ${tweet.tweetId}\nZone: ${tweet.zone}`
    : "No tweet data available.";

  return `${buildRulesSection(ctx)}

## Tweet Posted by Accused Party
${tweetSection}

## Question
Does this tweet violate any responsibilities or directives? Respond with structured JSON.`;
}

/**
 * Generate function type that matches the AI SDK's generateObject signature.
 * Accepts this as a parameter so tests can provide a mock.
 */
export type GenerateObjectFn = (opts: {
  model: ReturnType<LLMClient["provider"]>;
  schema: typeof verdictSchema;
  system: string;
  prompt: string;
}) => Promise<{ object: Verdict }>;

export async function evaluateClaim(
  ctx: ClaimContext,
  llm: LLMClient,
  generate: GenerateObjectFn,
): Promise<Verdict> {
  const hasTweetEvidence = ctx.tweetReceipts && ctx.tweetReceipts.length > 0;
  const userPrompt = hasTweetEvidence
    ? buildTweetUserPrompt(ctx)
    : buildVaultUserPrompt(ctx);

  const result = await generate({
    model: llm.provider(llm.model),
    schema: verdictSchema,
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
  });

  return result.object;
}
