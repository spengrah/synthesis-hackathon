# Shared Agent Infrastructure Spec

## Overview

Both the adjudicator and counterparty agents share common infrastructure for LLM calls, chain interaction, Ponder queries, and polling. This lives in `packages/agents/src/shared/`.

## Technology Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Agent framework | Vercel AI SDK (`ai` + `@ai-sdk/openai`) | Lightweight, TypeScript-native, any OpenAI-compatible provider |
| LLM provider | Venice.ai or similar (OpenAI-compatible API) | Cost-effective open-source models. Fallback: Claude API. |
| Chain interaction | viem | Already used throughout the project |
| Contract reads | SDK's `createPonderBackend()` | Typed GraphQL queries |
| Evidence enrichment | Bonfires `/delve` | Semantic search across all tiers |
| Auth | `@slicekit/erc8128` | For 8128-gated service endpoints |
| Hosting | Railway | Simple Node.js deployment, no cold starts |

## Shared Modules

### `llm.ts` — LLM client

```typescript
import { createOpenAI } from "@ai-sdk/openai"

export function createLLMClient(config: {
  baseUrl: string   // e.g., "https://api.venice.ai/api/v1"
  apiKey: string
  model: string     // e.g., "llama-3.1-70b"
}) {
  const provider = createOpenAI({ baseURL: config.baseUrl, apiKey: config.apiKey })
  return { provider, model: config.model }
}
```

Works with any OpenAI-compatible API (Venice.ai, Together, Groq, OpenAI, etc.).

### `chain.ts` — viem clients

```typescript
export function createChainClients(rpcUrl: string, privateKey: Hex) {
  const account = privateKeyToAccount(privateKey)
  const transport = http(rpcUrl)
  return {
    public: createPublicClient({ chain: base, transport }),
    wallet: createWalletClient({ account, chain: base, transport }),
    account,
  }
}
```

### `polling.ts` — poll-until utility

```typescript
export async function pollUntil<T>(
  fn: () => Promise<T | null>,
  opts: { intervalMs: number; timeoutMs: number; label: string }
): Promise<T>
```

Used by both agents for polling Ponder (claims, proposals, state changes).

### `ponder.ts` — Ponder query helpers

Wraps the SDK's `createPonderBackend()` plus adds custom queries:

```typescript
export function createAgentPonderClient(ponderUrl: string) {
  const backend = createPonderBackend(ponderUrl)
  return {
    ...backend,
    getUnadjudicatedClaims(adjudicatorAddress: Address): Promise<ClaimSummary[]>,
    getProposalsForParty(partyAddress: Address): Promise<ProposalInfo[]>,
    getActiveAgreementsForParty(partyAddress: Address): Promise<AgreementInfo[]>,
  }
}
```

## Testability

Agent logic is exported as pure functions that can be called without polling loops. E2E tests import and call these directly. Standalone mode wraps them in polling loops.

```typescript
// Can be called from E2E test OR from polling loop
import { evaluateClaim } from "./adjudicator/evaluate"
import { buildVaultSchemaDoc } from "./counterparty/negotiate"
```

## Entry Point

`packages/agents/src/index.ts` — CLI entry point:

```
node dist/index.js --role adjudicator
node dist/index.js --role counterparty
```

## Environment Variables

| Variable | Used by | Purpose |
|----------|---------|---------|
| `RPC_URL` | Both | Base RPC endpoint |
| `PONDER_URL` | Both | Ponder GraphQL endpoint |
| `PRIVATE_KEY` | Both | Agent EOA private key |
| `LLM_API_KEY` | Both | LLM provider API key |
| `LLM_BASE_URL` | Both | LLM provider base URL |
| `LLM_MODEL` | Both | Model name |
| `VAULT_ADDRESS` | Counterparty | Vault contract address |
| `BONFIRES_API_KEY` | Both | Bonfires Bearer token |
| `BONFIRES_BONFIRE_ID` | Both | Bonfire instance ID |
| `X_API_KEY` | Counterparty | X/Twitter OAuth credentials |
| `X_API_SECRET` | Counterparty | |
| `X_ACCESS_TOKEN` | Counterparty | |
| `X_ACCESS_SECRET` | Counterparty | |

## Hosting

Railway — one service per agent (or one service with `--role` flag). Each agent is a long-running Node.js process that polls Ponder on an interval.
