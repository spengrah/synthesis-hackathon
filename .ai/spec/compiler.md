# TZ Compiler Spec

## Overview

TypeScript library (`@trust-zones/compiler`) that translates between TZ schema documents (semantic, human/agent-readable) and ProposalData deployment bytes (mechanical, onchain-executable). This is the core IP — the mechanism template registry that maps TZ schema dimensions to onchain artifacts.

The compiler is focused exclusively on PROPOSE/COUNTER payloads (TZ schema ↔ ProposalData). General-purpose `submitInput()` encoding for other inputs (CLAIM, ADJUDICATE, COMPLETE, etc.) lives in the SDK (`@trust-zones/sdk`). Both are bundled into the x402 service for agents who prefer API access.

## Two layers

| Layer | Format | Where | Who reads |
|-------|--------|-------|-----------|
| Semantic | TZ schema document (JSON) | IPFS / Bonfires | Agents |
| Mechanical | ProposalData (ABI-encoded) | Onchain | Agreement contract |

## TZ Schema Document

The canonical negotiation artifact. Agents author, read, and negotiate over schema docs. The format mirrors the Ponder subgraph / TZ data model so that agents see the same shape whether reading a schema doc or querying the context graph.

Published to IPFS as the `termsDocUri` content. Note: `termsDocUri` is NOT included in the schema doc itself (chicken-and-egg with content-addressing). The agent publishes the doc, gets the CID, and passes it separately.

### Format

```json
{
  "version": "0.1.0",
  "zones": [
    {
      "actor": {
        "address": "0x...",
        "agentId": 42
      },
      "hatMaxSupply": 1,
      "hatDetails": "Zone A — A's data exposed to B",

      "constraints": [
        { "template": "budget-cap", "params": { "token": "0x...", "limit": "1000000" } },
        { "template": "target-allowlist", "params": { "targets": ["0x..."], "functions": ["0x..."] } }
      ],
      "eligibilities": [
        { "template": "reputation-gate", "params": { "minScore": 50 } }
      ],
      "incentives": [
        { "template": "staking", "params": { "token": "0x...", "minStake": "5000000000000000", "cooldownPeriod": 86400 } }
      ],

      "permissions": [
        { "resource": "/market-data", "rateLimit": "10/hour", "purpose": "Market analysis" },
        { "resource": "/sentiment-analysis", "expiry": 1710700000 }
      ],
      "responsibilities": [
        { "obligation": "Provide uptime guarantee", "criteria": "99% over agreement period" }
      ],
      "directives": [
        { "rule": "attribution", "severity": "moderate" },
        { "rule": "no-redistribution", "severity": "severe" }
      ]
    }
  ],
  "adjudicator": { "template": "stub-adjudicator" },
  "deadline": 1710700000
}
```

### Design choices

- **Mirrors Ponder subgraph** — zone fields match `TrustZone` entity relations (constraints, eligibilities, incentives, permissions, responsibilities, directives). Agents see the same shape from the schema doc as from a GraphQL query.
- **`actor` object** — contains `address` and `agentId`, matching the Ponder `Actor` entity.
- **Template names, not addresses** — mechanisms use `{ "template": "...", "params": {...} }`. The compiler resolves template names to concrete module addresses and ABI-encoded data.
- **Human-readable resource token fields** — permissions, responsibilities, directives use parsed fields matching the Ponder entity schemas. The compiler ABI-encodes these into `TZResourceTokenConfig.metadata` bytes.
- **Adjudicator supports template or raw address** — `{ "template": "stub-adjudicator" }` or `{ "address": "0x..." }`.
- **No `termsDocUri`** — external to the doc (content-addressing).
- **`decisionModels` and `principalAlignments` omitted** — not implemented yet. Can be added when templates exist.

## Mechanism templates

Each template maps a schema doc entry to one or more `TZMechanism` structs in the output `ProposalData`. Templates know the `paramType`, `moduleKind`, target `module` address, and how to ABI-encode `data` from the human-readable params.

### CONSTRAINT templates

Schema location: `zone.constraints[]`. Module kind: `ERC7579Hook` (pre-deployed singletons).

```
budget-cap             →  TZMechanism{Constraint, ERC7579Hook, SpendingLimitHook, data}
target-allowlist       →  TZMechanism{Constraint, ERC7579Hook, PermissionsHook, data}
time-lock              →  TZMechanism{Constraint, ERC7579Hook, ColdStorageHook, data}
```

### ELIGIBILITY templates

Schema location: `zone.eligibilities[]`. Module kind: `HatsModule` (factory-deployed clone, wired to zone hat).

```
reputation-gate        →  TZMechanism{Eligibility, HatsModule, 8004ReputationEligibility, data}
erc20-balance          →  TZMechanism{Eligibility, HatsModule, ERC20Eligibility, data}
allowlist              →  TZMechanism{Eligibility, HatsModule, AllowlistEligibility, data}
hat-wearing            →  TZMechanism{Eligibility, HatsModule, HatWearingEligibility, data}
```

### INCENTIVE templates

Schema location: `zone.incentives[]`. Incentives create credible consequences for agreement behavior.

```
staking                →  TZMechanism{Penalty, HatsModule, StakingEligibility, data}
```

The `staking` template produces a single Penalty mechanism. StakingEligibility is one contract that serves a dual purpose: it creates a credible penalty (slashing) by requiring an eligibility stake. The Agreement contract wires Penalty mechanisms to the zone hat (same as Eligibility), so the staking requirement and slash capability are both active from a single deployment.

Reward templates (compensation, escrow) are not yet implemented. The category exists in the schema for future expansion.

### Adjudication templates

Schema location: `adjudicator` (agreement-level, not per-zone).

```
stub-adjudicator       →  ProposalData.adjudicator = StubAdjudicator address
genlayer-adjudicator   →  ProposalData.adjudicator = GenLayer address
```

Adjudicator also accepts a raw address: `{ "address": "0x..." }`.

## Template registry

The compiler maintains a registry of all known templates. Each entry contains:

- `name` — template identifier used in schema docs
- `paramType` — the `TZParamType` enum value
- `moduleKind` — the `TZModuleKind` enum value
- `module` — deployed implementation/singleton address (from compiler config)
- `encodeData(params) → Hex` — ABI-encodes human-readable params into the `data` field
- `decodeData(data) → params` — reverses the encoding for decompile

The registry also maintains a reverse lookup: `module address → template name` for decompile.

## Compile function

```typescript
function compile(schemaDoc: TZSchemaDocument, config: CompilerConfig): ProposalData
```

1. For each zone in `schemaDoc.zones`:
   a. Map `actor.address` → `TZConfig.party`, `actor.agentId` → `TZConfig.agentId`
   b. For each entry in `constraints[]`, `eligibilities[]`, `incentives[]`: look up template, call `encodeData(params)`, produce `TZMechanism`
   c. For each entry in `permissions[]`, `responsibilities[]`, `directives[]`: ABI-encode the parsed fields into `TZResourceTokenConfig.metadata`
2. Resolve `adjudicator` — template lookup or raw address
3. Assemble `ProposalData { termsDocUri: "", zones, adjudicator, deadline }`

Note: `termsDocUri` is set to empty string by compile. The caller sets it after publishing the schema doc to IPFS and obtaining the CID.

## Decompile function

```typescript
function decompile(proposalData: ProposalData, config: CompilerConfig): TZSchemaDocument
```

1. For each zone in `proposalData.zones`:
   a. Map `party` → `actor.address`, `agentId` → `actor.agentId`
   b. For each `TZMechanism`: reverse-lookup `module` address in template registry, call `decodeData(data)`, place into the appropriate schema doc section based on `paramType`
   c. For each `TZResourceTokenConfig`: ABI-decode `metadata` based on `tokenType`, produce parsed fields
2. Reverse-lookup `adjudicator` address → template name (or fall back to raw address)
3. Assemble schema doc

## Compiler config

```typescript
interface CompilerConfig {
  /** Deployed module addresses — keyed by template name */
  modules: Record<string, Address>
  /** Known adjudicator addresses — keyed by template name */
  adjudicators: Record<string, Address>
}
```

The config is deployment-specific. Different chains/deployments have different addresses. The compiler ships with a default config for Base mainnet.

## Negotiation flow

```
1. Agent authors TZ schema doc (JSON)
2. Agent calls compile(schemaDoc, config) → ProposalData
3. Agent publishes schema doc to IPFS → gets CID
4. Agent sets termsDocUri = CID on ProposalData
5. Agent calls SDK encodePropose(proposalData) → submitInput calldata
6. Agent submits transaction

7. Counterparty reads ProposalData from ProposalSubmitted event
8. Counterparty calls decompile(proposalData, config) → schema doc
9. Counterparty modifies schema doc
10. Counterparty compiles, publishes, submits counter
11. Repeat until ACCEPT or REJECT
```

## x402 service

The compiler is exposed via the x402 service (see `x402-service.md`) alongside the SDK's encoding/decoding helpers. The x402 service bundles:
- `/compile` and `/decompile` → this compiler library
- `/encode/:input` and `/decode/event` → SDK library
- `/explain` → SDK reads + chain

Agents can also use the compiler library directly as an npm import — the x402 service is a convenience + revenue layer.

## Resource token metadata encoding

Resource tokens use ABI-encoded structs for onchain metadata. The compiler encodes human-readable fields from the schema doc into these structs on compile, and decodes them on decompile.

### Permission (tokenType: 0x01)
```
ABI: (string resource, (uint256 value, string period) rateLimit, uint256 expiry, string purpose)
```
Schema: `{ "resource": "/market-data", "rateLimit": "10/hour", "expiry": 1710700000, "purpose": "Market analysis" }`

### Responsibility (tokenType: 0x02)
```
ABI: (string obligation, string criteria, uint256 deadline)
```
Schema: `{ "obligation": "Provide uptime", "criteria": "99% over period", "deadline": 1710700000 }`

### Directive (tokenType: 0x03)
```
ABI: (string rule, string severity, bytes params)
```
Schema: `{ "rule": "attribution", "severity": "moderate", "params": {} }`

## Module deployment status

| Template | Module | Implementation address | Status |
|---|---|---|---|
| `budget-cap` | SpendingLimitHook | TBD | Needs deployment (Rhinestone experimental) |
| `target-allowlist` | PermissionsHook | TBD | Needs deployment (Rhinestone experimental, `onUninstall` stubbed) |
| `time-lock` | ColdStorageHook | `0x7E31543b269632ddc55a23553f902f84C9DD8454` | Deployed (Rhinestone core, audited) |
| `staking` | StakingEligibility | `0x9E01030aF633Be5a439DF122F2eEf750b44B8aC7` | Deployed (Hats module) |
| `reputation-gate` | 8004ReputationEligibility | TBD | Custom — needs building |
| `erc20-balance` | ERC20Eligibility | `0xbA5b218e6685D0607139c06f81442681a32a0EC3` | Deployed (Hats module) |
| `allowlist` | AllowlistEligibility | `0x80336fb7b6B653686eBe71d2c3ee685b70108B8f` | Deployed (Hats module) |
| `hat-wearing` | HatWearingEligibility | `0xa2e614CE4FAaD60e266127F4006b812d69977265` | Deployed (Hats module) |
| `stub-adjudicator` | StubAdjudicator | TBD | Needs deployment |
| `genlayer-adjudicator` | GenLayer | TBD | TBD |
