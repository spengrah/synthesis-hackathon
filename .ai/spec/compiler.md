# TZ Compiler Spec

## Overview

TypeScript library (`@trust-zones/compiler`) that translates between TZ schema documents (semantic, human/agent-readable) and ProposalData deployment bytes (mechanical, onchain-executable). This is the core IP — the mechanism template registry that maps TZ schema dimensions to onchain artifacts.

The compiler is focused exclusively on PROPOSE/COUNTER payloads (TZ schema ↔ ProposalData). General-purpose `submitInput()` encoding for other inputs (CLAIM, ADJUDICATE, COMPLETE, etc.) lives in the SDK (`@trust-zones/sdk`). Both are bundled into the x402 service for agents who prefer API access.

## Two layers

| Layer | Format | Where | Who reads |
|-------|--------|-------|-----------|
| Semantic | TZ schema document (JSON) | IPFS / Bonfires | Agents |
| Mechanical | ProposalData (ABI-encoded) | Onchain | Agreement contract |

## Mechanism templates

Atomic, composable functions. Each maps one TZ schema dimension to one onchain artifact.

Each template produces a `TZMechanism` with the appropriate `paramType`, `moduleKind`, `module` address, and `data`.

### CONSTRAINT templates (ERC7579Hook — pre-deployed singletons)
```
budget-cap             →  TZMechanism{Constraint, ERC7579Hook, SpendingLimitHook, data}
target-allowlist       →  TZMechanism{Constraint, ERC7579Hook, PermissionsHook, data}
time-lock              →  TZMechanism{Constraint, ERC7579Hook, ColdStorageHook, data}
```

### ELIGIBILITY templates (HatsModule — factory-deployed, wired to zone hat)
```
reputation-gate        →  TZMechanism{Eligibility, HatsModule, 8004ReputationEligibility, data}
staking-requirement    →  TZMechanism{Eligibility, HatsModule, StakingEligibility, data}
```

### PENALTY templates (HatsModule — factory-deployed, wired to zone hat)
```
slashable-bond         →  TZMechanism{Penalty, HatsModule, StakingEligibility, data}
```

### REWARD templates (HatsModule or External — NOT wired to zone hat)
```
reputation-feedback    →  TZMechanism{Reward, External, ReputationRegistry, data}
token-distribution     →  TZMechanism{Reward, HatsModule, RewardModule, data}
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

## x402 service

The compiler is exposed via the x402 service (see `x402-service.md`) alongside the SDK's encoding/decoding helpers. The x402 service bundles:
- `/compile` and `/decompile` → this compiler library
- `/encode/:input` and `/decode/event` → SDK library
- `/explain` → SDK reads + chain

Agents can also use the compiler library directly as an npm import — the x402 service is a convenience + revenue layer.

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
