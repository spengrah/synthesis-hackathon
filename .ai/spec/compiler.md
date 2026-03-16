# TZ Compiler Spec

## Overview

Offchain TypeScript library + x402-gated API server. Translates between TZ schema documents (semantic, human/agent-readable) and ProposalData deployment bytes (mechanical, onchain-executable).

## Two layers

| Layer | Format | Where | Who reads |
|-------|--------|-------|-----------|
| Semantic | TZ schema document (JSON) | IPFS / Bonfires | Agents |
| Mechanical | ProposalData (ABI-encoded) | Onchain | Agreement contract |

## Mechanism templates

Atomic, composable functions. Each maps one TZ schema dimension to one onchain artifact.

### CONSTRAINT templates (paramType 0x03 → ERC-7579 hooks on TZ Account)
```
budget-cap             →  Mechanism{CONSTRAINT, SpendingLimitHook, params}
target-allowlist       →  Mechanism{CONSTRAINT, PermissionsHook, params}
time-lock              →  Mechanism{CONSTRAINT, ColdStorageHook, params}
```

### ELIGIBILITY templates (paramType 0x01 → Hats eligibility modules on zone hat)
```
reputation-gate        →  Mechanism{ELIGIBILITY, 8004ReputationEligibility, params}
staking-requirement    →  Mechanism{ELIGIBILITY, StakingEligibility, params}
```

### INCENTIVE templates (paramType 0x02 → claimable mechanisms in agreement registry)
```
slashable-bond         →  Mechanism{INCENTIVE, StakingModule, params{slashPercent, ...}}
reputation-feedback    →  Mechanism{INCENTIVE, ReputationRegistry, params{...}}
```

### Adjudication (agreement-level, not per-zone)
```
genlayer-adjudicator   →  ProposalData.adjudicator = GenLayer address
stub-adjudicator       →  ProposalData.adjudicator = StubAdjudicator address
```

## Compile function

```typescript
function compile(tzSchemaDoc: TZSchemaDocument): ProposalData
```

Reads the TZ schema document, matches constraints/eligibilities/incentives/etc. against the mechanism template registry, and produces ABI-encoded ProposalData ready for `submitInput(PROPOSE, ...)`.

## Decompile function

```typescript
function decompile(proposalData: ProposalData): TZSchemaDocument
```

Reverse-lookup: reads deployment bytes, matches hook/module addresses against the mechanism template registry, and produces a readable TZ schema document.

## x402 server (Tier 2)

Express server with `@x402/express` middleware. Two endpoints:

```
POST /compile   { tzSchemaDoc }      →  { deploymentBytes, termsHash }
POST /decompile { deploymentBytes }  →  { tzSchemaDoc }
```

- Payment: USDC on Base
- Self-hosted (Vercel, Railway, etc.)
- Not a dependency — agents can also use the compiler library locally

## Negotiation flow

```
1. Agent authors TZ schema doc
2. Agent calls compiler → deployment bytes
3. Agent submits: submitInput(PROPOSE, ProposalData{termsHash, termsUri, zones, ...})
4. Agent publishes TZ schema doc to IPFS/Bonfires at termsUri
5. Counterparty reads ProposalData, calls decompiler → readable doc
6. Counterparty modifies, recompiles, submits counter
7. Repeat until ACCEPT or REJECT
```
