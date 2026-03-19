---
name: trust-zones
description: Interact with the Trust Zones protocol — compile agreement schemas, encode transactions, query agreement state via the Trust Zones MCP server.
---

# Trust Zones

Trust Zones is an interoperability standard for machine agreements. Constraints are explicit, enforcement is onchain, resources are at stake, disputes are adjudicated, and trust updates from every interaction.

## MCP Server

The Trust Zones MCP server exposes protocol tools for compiling schemas, encoding transactions, and querying agreement state. Connect it to your agent:

```bash
claude mcp add trust-zones -- npx tsx /path/to/packages/x402-service/src/server.ts
```

Or with payment enabled (requires USDC on Base):

```bash
REQUIRE_PAYMENT=true TREASURY_ADDRESS=0x... claude mcp add trust-zones -- npx tsx /path/to/packages/x402-service/src/server.ts
```

## Available Tools

### `compile`
Compile a Trust Zones schema document into ABI-encoded ProposalData.

```json
{
  "tzSchemaDoc": {
    "version": "0.1.0",
    "zones": [
      {
        "actor": { "address": "0x1234...", "agentId": 1 },
        "maxActors": 1,
        "description": "Zone A — data provider",
        "constraints": [
          { "template": "budget-cap", "params": { "token": "0x...", "limit": "1000000" } }
        ],
        "incentives": [
          { "template": "staking", "params": { "token": "0x...", "minStake": "1000000", "cooldownPeriod": 86400 } }
        ],
        "permissions": [
          { "resource": "/market-data", "value": 10, "period": "hour" }
        ],
        "responsibilities": [
          { "obligation": "Provide data with 99% uptime" }
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

Returns `{ proposalData: "0x...", termsHash: "0x..." }`.

### `decompile`
Reverse a compiled ProposalData back into a human-readable schema.

### `encode`
Encode parameters into `submitInput()` calldata for an Agreement contract.

Valid `inputId` values: `propose`, `counter`, `accept`, `reject`, `withdraw`, `setup`, `activate`, `claim`, `adjudicate`, `complete`, `exit`, `finalize`.

Example — encode a propose:
```json
{ "inputId": "propose", "params": { "termsDocUri": "ipfs://...", "zones": [...], "adjudicator": "0x...", "deadline": 1710700000 } }
```

Example — encode a claim:
```json
{ "inputId": "claim", "params": { "mechanismIndex": 0, "evidence": "0x..." } }
```

Returns `{ inputId: "0x...", payload: "0x...", calldata: "0x..." }` where `calldata` is ready to submit as transaction data.

### `decode_event`
Decode an Agreement contract event log into structured data.

### `graphql`
Query the Trust Zones Ponder indexer for agreement state, zones, permissions, directives, claims, proposals, reputation feedback, and transaction hashes.

Example:
```json
{
  "query": "{ agreements(limit: 5) { items { id state outcome trustZones { items { id active } } } } }"
}
```

### `explain`
Get a human-readable summary of an agreement's current state.

```json
{ "agreement": "0xF6cFFBe062162120FDf6b0De81824F7b56410544" }
```

### `ping`
Health check. Returns server version and available tools.

## Mechanism Templates

The compiler supports 8 mechanism templates:

| Template | Category | What it does |
|----------|----------|-------------|
| `budget-cap` | Constraint | Limits total spend per period |
| `target-allowlist` | Constraint | Restricts callable addresses |
| `time-lock` | Constraint | Enforces delay between actions |
| `staking` | Incentive | Requires collateral deposit, slashable on violation |
| `reputation-gate` | Qualification | Requires minimum ERC-8004 score |
| `erc20-balance` | Qualification | Requires minimum token balance |
| `allowlist` | Qualification | Gates zone to selected addresses |
| `hat-wearing` | Qualification | Requires Hats Protocol role |

## Example Flow: Create an Agreement

1. **Compile** a schema document into ProposalData
2. **Encode** a `propose` input with the ProposalData
3. Submit the calldata to the Agreement contract on Base
4. Wait for counterparty to **encode** a `counter` or `accept`
5. Both parties **encode** `setup` then `activate`
6. Use **graphql** or **explain** to monitor agreement state
7. On completion, **encode** `complete` with reputation feedback

## Payment

When payment is enabled, tools cost $0.005–$0.01 per call in USDC on Base via the x402 protocol. Use `@x402/fetch` or `@x402/mcp` client to handle payments automatically:

```typescript
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
});
```

## Links

- Protocol: https://github.com/trust-zones
- Explorer: https://basescan.org
- ERC-8004 Identity: https://agentproof.sh
- x402 Protocol: https://x402.org
