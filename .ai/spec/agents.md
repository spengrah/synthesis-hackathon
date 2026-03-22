# Shared Agent Infrastructure Spec

## Overview

Both the adjudicator and counterparty agents share common infrastructure for LLM calls, chain interaction, Ponder queries, polling, ERC-8128 signing, Twitter reads, and Claude CLI fallback generation. This lives in `packages/agents/src/shared/`.

A third agent class, `TrustZonesAgent`, lives in `src/tz-agent/` and serves as a reference "temptee" implementation used in E2E tests.

## Technology Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Agent framework | Vercel AI SDK (`ai` + `@ai-sdk/openai`) | Lightweight, TypeScript-native, any OpenAI-compatible provider |
| LLM provider | Venice.ai or similar (OpenAI-compatible API) | Cost-effective open-source models. Fallback: Claude API. |
| Chain interaction | viem | Already used throughout the project |
| Contract reads | SDK's `createPonderBackend()` | Typed GraphQL queries |
| Evidence enrichment | Bonfires `/delve` | Semantic search across all tiers |
| Auth | `@slicekit/erc8128` | For 8128-gated service endpoints |
| Bonfires | `@trust-zones/bonfires` | Receipt logging (counterparty) + cross-tier evidence queries (adjudicator) |
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

### `erc8128.ts` — Zone signer client

Creates an ERC-8128 `SignerClient` for a zone smart account. Reads the zone's `HatValidator` address on-chain and prefixes EOA signatures with it for ERC-7579 `isValidSignature` routing.

```typescript
export async function createZoneSignerClient(
  walletClient: WalletClient,
  zoneAddress: Address,
  chainId: number,
  opts?: { ttlSeconds?: number; publicClient?: PublicClient; rpcUrl?: string },
): Promise<SignerClient>
```

Used by `TrustZonesAgent.signedFetch()` to authenticate requests to the tweet proxy.

### `twitter.ts` — Twitter API client

Read-only Twitter client wrapping `twitter-api-v2`. Used by the adjudicator/counterparty to fetch tweet content for evidence evaluation.

```typescript
export interface TwitterClient {
  getTweet(tweetId: string): Promise<{ id: string; text: string } | null>;
}

export function createTwitterClient(config: {
  consumerKey: string; consumerSecret: string;
  accessToken: string; accessTokenSecret: string;
}): TwitterClient

export function createTwitterClientFromEnv(): TwitterClient
```

### `claude-cli.ts` — Claude CLI generate fallback

Shells out to `claude -p --model haiku` for LLM generation when the AI SDK provider is unavailable. Saves session transcripts to `packages/agents/llm-sessions/` for auditability.

Exports two functions:
- `runClaudeCli(prompt, opts?)` — low-level: returns raw text from Claude CLI.
- `createClaudeCliGenerate(opts?)` — returns a `GenerateObjectFn` compatible with `adjudicator/evaluate.ts`, suitable for passing as the `generate` override in `AdjudicatorConfig`.

## `TrustZonesAgent` class

`packages/agents/src/tz-agent/index.ts` exports a `TrustZonesAgent` class — a reference "temptee" agent used in E2E tests. It wraps the same code paths the public interfaces expose (MCP tools, CLI commands) but calls the underlying functions directly.

```typescript
export class TrustZonesAgent {
  constructor(cfg: TrustZonesAgentConfig)

  // Agreement lifecycle
  createAgreement(registry, counterparty, schemaDoc): Promise<Address>
  accept(agreementAddress, proposalPayload): Promise<Hex>
  setUp(agreementAddress): Promise<Hex>
  activate(agreementAddress): Promise<Hex>
  stake(stakingModule, token, amount): Promise<void>
  complete(agreementAddress, feedback): Promise<Hex>

  // Ponder queries (MCP: graphql)
  graphql<T>(query, variables?): Promise<T>
  getAgreementState(agreementAddress): Promise<...>
  getZoneDetails(zoneAddress): Promise<...>

  // Schema operations (MCP: compile / decompile)
  compileSchema(doc): Promise<{ payload: Hex; inputId: Hex }>
  compileCounter(doc): Promise<{ payload: Hex; inputId: Hex }>
  decompileProposal(rawProposalData): Promise<TZSchemaDocument>

  // Zone operations (CLI: sign-http, prepare-tx)
  signedFetch(url, init): Promise<Response>
  postTweet(tweetProxyUrl, content): Promise<{ tweetId; url }>
  executeViaZone(to, value, data): Promise<Hex>

  // Zone management
  setZone(zoneAddress): void
  getZone(): Address | null
  discoverZone(agreementAddress): Promise<Address>
}
```

Accepts an optional `mcpClient` in config. When provided, compile/decompile/graphql/encode calls are routed through the MCP client instead of direct imports.

## Testability

Agent logic is exported as pure functions that can be called without polling loops. E2E tests import and call these directly. Standalone mode wraps them in polling loops.

```typescript
// Can be called from E2E test OR from polling loop
import { evaluateClaim } from "./adjudicator/evaluate"
import { buildCounterProposal } from "./counterparty/negotiate"
```

### `generate` override (adjudicator)

`AdjudicatorConfig` accepts a `generate` function that replaces the default AI SDK `generateObject` call. This allows non-AI-SDK generators like `createClaudeCliGenerate()` or test mocks:

```typescript
import { createClaudeCliGenerate } from "./shared/claude-cli.js"

startAdjudicator({ ...config, generate: createClaudeCliGenerate() })
```

### `evaluateTweets` override (counterparty)

`CounterpartyConfig` accepts an `evaluateTweets` function that replaces the default `createCliEvaluateTweets()`. Same pattern — inject a mock in tests or swap LLM backends.

## Entry Points

`packages/agents/src/index.ts` — library barrel (no side effects on import). Re-exports all public types and functions from adjudicator, counterparty, shared modules, and `TrustZonesAgent`.

`packages/agents/src/cli.ts` — CLI entry point with `--role` flag:

```
node dist/cli.js --role adjudicator
node dist/cli.js --role counterparty
```

Reads all config from environment variables and calls `startAdjudicator()` or `startCounterparty()`.

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
