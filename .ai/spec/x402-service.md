# x402 Service Spec

## Overview

An x402-gated API server that bundles the Trust Zones SDK and Compiler behind pay-per-request endpoints. Agents that don't want to import the libraries locally can call the service instead. Payment in USDC on Base via the x402 protocol.

A companion CLI and Claude Code skill (`/trust-zones`) let agents install and interact with the API without writing HTTP calls directly.

## Architecture

```
Agent (or CLI / Skill)
  │
  │  HTTP request + x402 payment header
  │
  ▼
x402 Service (Express + @x402/express middleware)
  │
  ├── /compile        — Compiler: TZ schema doc → ProposalData
  ├── /decompile      — Compiler: ProposalData → TZ schema doc
  ├── /encode/:input  — SDK: structured params → submitInput calldata
  ├── /decode/event   — SDK: event log → structured data
  ├── /explain        — Read helpers: agreement state → human-readable summary
  └── /graphql        — Ponder GraphQL proxy (x402-gated read access)
```

## Endpoints

### POST /compile

Compile a TZ schema document into ABI-encoded ProposalData.

**Request:**
```json
{
  "tzSchemaDoc": {
    "version": "0.1.0",
    "zones": [
      {
        "actor": { "address": "0x...", "agentId": 42 },
        "maxActors": 1,
        "description": "Zone A",
        "constraints": [
          { "template": "budget-cap", "params": { "token": "0x...", "limit": "1000000" } }
        ],
        "eligibilities": [
          { "template": "staking", "params": { "token": "0x...", "minStake": "5000000000000000", "cooldownPeriod": 86400 } }
        ],
        "incentives": [],
        "permissions": [
          { "resource": "/market-data", "value": 10, "period": "hour", "expiry": 1710700000 }
        ],
        "responsibilities": [
          { "obligation": "Provide uptime guarantee", "criteria": "99% over agreement period" }
        ],
        "directives": [
          { "rule": "Do not redistribute data", "severity": "severe" }
        ]
      }
    ],
    "adjudicator": { "template": "stub-adjudicator" },
    "deadline": 1710700000
  }
}
```

**Response:**
```json
{
  "proposalData": "0x...",
  "termsHash": "0x..."
}
```

### POST /decompile

Decompile ABI-encoded ProposalData back into a TZ schema document.

**Request:**
```json
{
  "proposalData": "0x..."
}
```

**Response:**
```json
{
  "tzSchemaDoc": { ... }
}
```

### POST /encode/:inputId

Encode structured parameters into calldata for any `submitInput()` call.

**Path parameter:** `inputId` — one of: `propose`, `counter`, `accept`, `reject`, `withdraw`, `activate`, `claim`, `adjudicate`, `complete`, `exit`, `finalize`

**Request (varies by inputId):**

```json
// POST /encode/propose
{ "proposalData": { ... } }

// POST /encode/claim
{ "mechanismIndex": 0, "evidence": "0x..." }

// POST /encode/adjudicate
{
  "claimId": 1,
  "actions": [
    { "mechanismIndex": 0, "targetIndex": 1, "actionType": "PENALIZE", "params": "0x..." }
  ]
}

// POST /encode/complete
{ "feedbackURI": "ipfs://...", "feedbackHash": "0x..." }

// POST /encode/accept (no body needed)
{}
```

**Response:**
```json
{
  "inputId": "0x...",
  "payload": "0x...",
  "calldata": "0x..."
}
```

`calldata` is the full encoded `submitInput(inputId, payload)` calldata, ready to use as transaction data.

### POST /decode/event

Decode a contract event log into structured data.

**Request:**
```json
{
  "eventName": "ProposalSubmitted",
  "topics": ["0x...", "0x..."],
  "data": "0x..."
}
```

**Response:**
```json
{
  "eventName": "ProposalSubmitted",
  "args": {
    "proposer": "0x...",
    "termsHash": "0x...",
    "proposalData": { ... }
  }
}
```

### POST /graphql

Proxied access to Ponder's GraphQL API. Returns the full parsed, relational data model — agreements, zones, typed entities (permissions, directives, constraints, etc.), claims, proposals, transaction hashes.

**Request:**
```json
{
  "query": "query { agreement(id: \"0x...\") { state trustZones { items { txHash permissions { items { resource } } } } } }"
}
```

**Response:** Standard GraphQL response from Ponder.

This is the most valuable read endpoint — agents get fully parsed, relational data without running their own indexer. The SDK's Ponder read backend can point at this endpoint.

### POST /explain

Read agreement state from Ponder and produce a human/agent-readable summary.

**Request:**
```json
{
  "agreement": "0x..."
}
```

**Response:**
```json
{
  "address": "0x...",
  "state": "ACTIVE",
  "parties": [
    { "address": "0x...", "agentId": 1 },
    { "address": "0x...", "agentId": 2 }
  ],
  "zones": [
    {
      "account": "0x...",
      "party": "0x...",
      "active": true,
      "txHash": "0x...",
      "permissions": [
        { "resource": "tweet-post", "value": 10, "period": "day" }
      ],
      "responsibilities": [
        { "obligation": "Post about the temptation game" }
      ],
      "directives": [
        { "rule": "Do not withdraw any ETH", "severity": "severe" }
      ]
    }
  ],
  "claims": [
    { "id": "0x...:0", "verdict": true, "actions": ["CLOSE"], "txHash": "0x..." }
  ],
  "deadline": "2026-03-20T00:00:00Z",
  "termsUri": "ipfs://..."
}
```

## x402 payment

All endpoints are gated by the `@x402/express` middleware. Agents pay per request in USDC on Base.

```typescript
import { x402 } from "@x402/express"

app.use(x402({
  network: "base",
  payTo: TREASURY_ADDRESS,
  prices: {
    "POST /compile": "0.01",       // $0.01 USDC
    "POST /decompile": "0.01",
    "POST /encode/*": "0.005",
    "POST /decode/event": "0.005",
    "POST /graphql": "0.005",
    "POST /explain": "0.01",
  }
}))
```

Pricing is illustrative. The point is: the mechanism template registry (which constraint maps to which hook) is the proprietary value behind the compile/decompile endpoints. The encode/decode endpoints are convenience — agents could do this locally with the SDK.

## Implementation

### Package structure

```
packages/x402-service/
├── src/
│   ├── server.ts             # Express server + x402 middleware
│   ├── routes/
│   │   ├── compile.ts        # /compile, /decompile
│   │   ├── encode.ts         # /encode/:inputId
│   │   ├── decode.ts         # /decode/event
│   │   ├── graphql.ts        # /graphql (Ponder proxy)
│   │   └── explain.ts        # /explain
│   └── config.ts             # Addresses, pricing, RPC, Ponder URL
├── package.json
└── tsconfig.json
```

### Dependencies

- `express`
- `@x402/express` — payment middleware
- `@trust-zones/sdk` — encoding/decoding/reads
- `@trust-zones/compiler` — compile/decompile
- `viem` — chain reads for /explain

### CLI + Skill

```
packages/tz-cli/
├── src/
│   ├── index.ts              # CLI entry: tz compile, tz encode, tz explain, ...
│   └── client.ts             # x402 HTTP client (handles payment flow)
├── SKILL.md                  # Claude Code skill definition (/trust-zones)
├── package.json
└── tsconfig.json
```

The CLI wraps the x402 API calls with wallet-based payment. The skill (`/trust-zones`) provides tool descriptions and example flows so agents can use the API through Claude Code.

### Deployment

Self-hosted (Railway). Stateless — no database, no session. All reads go to Ponder or are computed from inputs.

## Relationship to SDK and Compiler

```
┌─────────────────────────────────────────────┐
│             x402 Service (API)               │
│                                              │
│  /compile, /decompile ──→ Compiler library   │
│  /encode, /decode     ──→ SDK library        │
│  /explain, /graphql   ──→ SDK reads + Ponder │
│                                              │
│  All behind x402 payment gate                │
└─────────────────────────────────────────────┘
         │                      │
         ▼                      ▼
┌─────────────────┐  ┌─────────────────┐
│  Compiler        │  │  SDK             │
│  (TypeScript     │  │  (TypeScript     │
│   library)       │  │   library)       │
│                  │  │                  │
│  Also usable     │  │  Also usable     │
│  directly by     │  │  directly by     │
│  agents who      │  │  agents who      │
│  import it       │  │  import it       │
└─────────────────┘  └─────────────────┘
```

The x402 service is a convenience + revenue layer, not a dependency. The SDK and compiler are independently usable as npm packages.
