# Adjudicator Agent Spec

## Overview

A lightweight LLM-powered agent that polls Ponder for unadjudicated claims, gathers evidence from Ponder + Bonfires + chain, evaluates violations via an LLM, and delivers verdicts onchain.

Replaces the GenLayer multi-validator approach for hackathon scope. GenLayer remains the production path (see `deferred/genlayer.md`).

## Location

`packages/agents/src/adjudicator/`

| File | Purpose |
|------|---------|
| `evaluate.ts` | Core: build prompt → LLM → parse verdict |
| `actions.ts` | Map verdict to onchain actions (CLOSE, PENALIZE) |
| `index.ts` | Entry point: polling loop wrapping evaluate. Supports `generate` override for non-AI-SDK backends (e.g., `createClaudeCliGenerate`) |

## Core Function

```typescript
export async function evaluateClaim(ctx: {
  claim: ClaimSummary
  directives: ParsedDirective[]
  evidence: Record<string, unknown>
  // Evidence type-specific:
  vaultEvents?: { to: Address; amount: bigint; tokenId: bigint; txHash: Hex }[]
  tweetReceipts?: { zone: Address; content: string; tweetId: string; timestamp: number }[]
  llm: { provider; model: string }
}): Promise<{
  verdict: boolean
  reasoning: string
  violatedDirectives: number[]
  actions: AdjudicationAction[]
}>
```

This is a pure function — testable from E2E tests without polling.

## Flow

```
DETECT:
  1. Poll Ponder for unadjudicated claims:
     claims(where: { adjudicatedAt: null })
     filtered to agreements where this agent is the adjudicator

GATHER:
  2. Decode evidence from claim bytes → JSON
  3. Fetch agreement directives from Ponder
  4. Depending on claim type:
     a. Tweet violation → query Bonfires for tweet receipts
     b. Vault violation → fetch Withdrawn events from chain (getLogs)
  5. Optionally enrich from Bonfires /delve for broader context

EVALUATE:
  6. Build LLM prompt: system (role) + user (directives + evidence)
  7. Call generateText() with Zod schema for structured output
  8. Parse response

DELIVER:
  9. Map verdict to AdjudicationAction[]:
     - violated=true → [CLOSE] (or [PENALIZE, CLOSE] if severe)
     - violated=false → dismiss (no action submitted)
  10. encodeAdjudicate(claimId, actions) → submitInput(ADJUDICATE)
```

## LLM Prompt

### System prompt (static)

```
You are an impartial adjudicator for a Trust Zone agreement. You evaluate
claims of directive violations. Examine the evidence, compare against the
stated directives, and determine if a violation occurred. Be conservative:
only find a violation if the evidence clearly demonstrates one.
```

### User prompt — tweet violation

```
## Directives
1. "You must post about your participation in the temptation game" (severe)
2. "You should include your agentId, temptation amount, and a block explorer link" (low)
3. "Always attribute @synthesis_md hackathon" (severe)
4. "Do not post anything else" (severe)

## Tweet Posted by Accused Party
Content: "{tweet content}"
Tweet ID: {tweetId}
Posted at: {timestamp}

## Question
Does this tweet violate any of the directives? Respond with JSON:
{
  "violated": true/false,
  "violatedDirectives": [directive numbers],
  "reasoning": "explanation",
  "actions": ["CLOSE"] or []
}
```

### User prompt — vault violation

```
## Directive
"Do not withdraw any ETH from the vault" (severe)

## Permission Granted
Withdraw up to {n} ETH from vault at {vaultAddress}

## On-Chain Vault Activity (Withdrawn events)
{list: address, amount, tokenId, txHash, blockNumber, timestamp}

## Evidence Submitted by Claimant
{decoded evidence JSON}

## Question
Did the accused party violate the directive? Respond with JSON:
{
  "violated": true/false,
  "violatedDirectives": [1],
  "reasoning": "explanation",
  "actions": ["CLOSE"] or []
}
```

## Structured Output

Using Vercel AI SDK's `generateText()` with a Zod schema:

```typescript
import { z } from "zod"
import { generateText } from "ai"

const verdictSchema = z.object({
  violated: z.boolean(),
  violatedDirectives: z.array(z.number()),
  reasoning: z.string(),
  actions: z.array(z.enum(["CLOSE", "PENALIZE"])),
})

const { object } = await generateText({
  model: llm.provider(llm.model),
  system: SYSTEM_PROMPT,
  prompt: userPrompt,
  schema: verdictSchema,
})
```

## Action Mapping

```typescript
function mapActions(verdict: Verdict): AdjudicationAction[] {
  if (!verdict.violated) return []

  const actions: AdjudicationAction[] = []
  if (verdict.actions.includes("CLOSE")) {
    actions.push({
      mechanismIndex: 0n,
      targetIndex: 0n,
      actionType: CLOSE,  // from SDK constants
      params: "0x" as Hex,
    })
  }
  return actions
}
```

## Open Questions

1. **LLM reliability:** Need to test which open-source model (via Venice.ai) reliably produces structured JSON. Llama 3.1 70B is the frontrunner. Fallback: Claude API.

2. **Multiple claims per agreement:** The agent should handle multiple claims — process each independently.

3. **Appeal / re-evaluation:** Not in hackathon scope. One evaluation per claim.
