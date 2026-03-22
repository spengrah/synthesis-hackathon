# x402 Service Spec

## Overview

An MCP (Model Context Protocol) server that bundles the Trust Zones SDK and Compiler behind pay-per-call tools. Agents that don't want to import the libraries locally can connect to the MCP server instead. Payment in USDC on Base via the x402 protocol (optional, controlled by `REQUIRE_PAYMENT` env var).

A companion CLI (`packages/cli/`) provides zone-signing and transaction-preparation utilities for agents that need to sign HTTP requests as a trust zone or prepare calldata.

## Architecture

```
Agent (MCP client)
  │
  │  MCP tool call (+ x402 payment if enabled)
  │
  ▼
x402 Service (MCP server via Streamable HTTP at POST /mcp)
  │
  ├── compile         — Compiler: TZ schema doc → ProposalData
  ├── decompile       — Compiler: ProposalData → TZ schema doc
  ├── encode          — SDK: structured params → submitInput calldata
  ├── decode_event    — SDK: event log → structured data
  ├── explain         — Read helpers: agreement state → human-readable summary
  ├── graphql         — Ponder GraphQL proxy (x402-gated read access)
  ├── staking_info    — Read helpers: zone staking eligibility + instructions
  └── ping            — Health check
```

## MCP Tools

### compile

Compile a Trust Zones schema document into ABI-encoded ProposalData.

**Parameters:**
- `tzSchemaDoc` (any) — TZSchemaDocument JSON object

**Input example:**
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
        "incentives": [
          { "template": "staking", "params": { "token": "0x...", "minStake": "5000000000000000", "cooldownPeriod": 86400 } }
        ],
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

### decompile

Decompile ABI-encoded ProposalData back into a Trust Zones schema document.

**Parameters:**
- `proposalData` (string) — Hex-encoded ProposalData bytes

**Response:**
```json
{
  "tzSchemaDoc": { ... }
}
```

### encode

Encode parameters into `submitInput()` calldata for an Agreement contract. Returns inputId, payload, and full calldata.

**Parameters:**
- `inputId` (string) — Input type: `propose`, `counter`, `accept`, `reject`, `withdraw`, `setup`, `activate`, `claim`, `adjudicate`, `complete`, `exit`, `finalize`
- `params` (any, optional) — Parameters for the input (varies by type). Required for propose/counter (ProposalData), claim ({mechanismIndex, evidence}), adjudicate ({claimId, actions}), complete/exit ({feedbackURI, feedbackHash}).

**Input examples:**
```json
// encode propose
{ "inputId": "propose", "params": { "proposalData": { ... } } }

// encode claim
{ "inputId": "claim", "params": { "mechanismIndex": 0, "evidence": "0x..." } }

// encode adjudicate
{
  "inputId": "adjudicate",
  "params": {
    "claimId": 1,
    "actions": [
      { "mechanismIndex": 0, "targetIndex": 1, "actionType": "PENALIZE", "params": "0x..." }
    ]
  }
}

// encode accept (no params needed)
{ "inputId": "accept" }
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

### decode_event

Decode an Agreement contract event log into structured data.

**Parameters:**
- `eventName` (string) — Event name (e.g. `ProposalSubmitted`, `AgreementStateChanged`)
- `topics` (string[]) — Event log topics array
- `data` (string) — Hex-encoded event log data

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

### graphql

Query the Trust Zones Ponder GraphQL API. Returns agreements, zones, permissions, directives, claims, proposals, reputation feedback, and transaction hashes.

**Parameters:**
- `query` (string) — GraphQL query string
- `variables` (object, optional) — GraphQL variables

**Input example:**
```json
{
  "query": "query { agreement(id: \"0x...\") { state trustZones { items { txHash permissions { items { resource } } } } } }"
}
```

**Response:** Standard GraphQL response from Ponder.

This is the most valuable read tool — agents get fully parsed, relational data without running their own indexer.

### explain

Get a human-readable summary of an agreement's current state including parties, zones, permissions, directives, claims, and reputation feedback.

**Parameters:**
- `agreement` (string) — Agreement contract address (0x...)

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

### staking_info

Get the eligibility module address and staking instructions for a zone in an agreement. Agents call this after setup to know where to stake.

**Parameters:**
- `agreement` (string) — Agreement contract address (0x...)
- `agentAddress` (string) — The agent's EOA address (0x...)

**Response:** Eligibility module address and staking instructions for the agent's zone.

### ping

Health check. Returns server version, payment status, and list of available tools.

**Parameters:** none

**Response:**
```json
{
  "server": "trust-zones",
  "version": "0.1.0",
  "payment": "enabled",
  "tools": ["compile", "decompile", "encode", "decode_event", "graphql", "explain", "staking_info", "ping"]
}
```

## x402 payment

Tool calls are optionally gated by `@x402/mcp` payment wrappers. When `REQUIRE_PAYMENT=true`, agents pay per tool call in USDC on Base.

```typescript
import { createPaymentWrapper, x402ResourceServer } from "@x402/mcp";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

// Per-tool pricing:
// compile, decompile:  $0.01
// encode, decode_event: $0.005
// graphql:              $0.005
// explain:              $0.01
// staking_info:         $0.005
// ping:                 free
```

Pricing is illustrative. The point is: the mechanism template registry (which constraint maps to which hook) is the proprietary value behind the compile/decompile tools. The encode/decode tools are convenience — agents could do this locally with the SDK.

## Implementation

### Package structure

```
packages/x402-service/
├── src/
│   ├── server.ts             # MCP server + x402 payment wrappers
│   └── tools/
│       ├── compile.ts        # compile, decompile
│       ├── encode.ts         # encode
│       ├── decode.ts         # decode_event
│       ├── graphql.ts        # graphql (Ponder proxy)
│       ├── explain.ts        # explain
│       └── staking.ts        # staking_info
├── package.json
└── tsconfig.json
```

### Dependencies

- `@modelcontextprotocol/sdk` — MCP server framework
- `@x402/mcp` — MCP payment wrappers
- `@x402/core`, `@x402/evm` — x402 facilitator client + EVM scheme
- `@trust-zones/sdk` — encoding/decoding/reads
- `@trust-zones/compiler` — compile/decompile
- `viem` — chain reads for explain
- `zod` — tool parameter validation

### Transport

The MCP server is exposed over Streamable HTTP at `POST /mcp`. Each request is handled statelessly — a fresh transport and server instance is created per request. No sessions, no server-initiated messages.

### CLI

```
packages/cli/
├── src/
│   ├── index.ts                  # CLI entry point
│   ├── sign-http.ts              # sign-http command
│   ├── prepare-http-request.ts   # prepare-http-request, finalize-http-request
│   ├── prepare-tx.ts             # prepare-tx command
│   └── hat-validator.ts          # HatValidator utilities
├── package.json
└── tsconfig.json
```

The CLI is a zone-signing and transaction-preparation tool. It does not interact with the x402 service. Commands:

- **`tz sign-http`** — Sign an HTTP request as a zone (ERC-8128). Requires `--zone`, `--url`, `--method`, `--private-key`, `--rpc-url`.
- **`tz prepare-http-request`** — Prepare an HTTP request for signing (outputs the message to sign). Requires `--zone`, `--url`, `--method`, `--rpc-url`.
- **`tz finalize-http-request`** — Finalize a signed HTTP request (outputs headers). Requires `--signature`, `--zone`, `--rpc-url`, `--url`, `--method`.
- **`tz prepare-tx`** — Prepare a transaction for zone execution (returns calldata). Requires `--zone`, `--to`, `--value`, `--data`.

### Deployment

Self-hosted (Railway). Stateless — no database, no session. All reads go to Ponder or are computed from inputs.

## Relationship to SDK and Compiler

```
┌─────────────────────────────────────────────┐
│         x402 Service (MCP server)           │
│                                             │
│  compile, decompile  ──→ Compiler library   │
│  encode, decode_event──→ SDK library        │
│  explain, graphql    ──→ SDK reads + Ponder │
│  staking_info        ──→ SDK reads + Ponder │
│                                             │
│  Optionally behind x402 payment gate        │
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
