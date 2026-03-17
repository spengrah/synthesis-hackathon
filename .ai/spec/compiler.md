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

### CONSTRAINT templates (TZParamType.Constraint → ERC-7579 hooks on TZ Account)
```
budget-cap             →  TZMechanism{Constraint, SpendingLimitHook, initData}
target-allowlist       →  TZMechanism{Constraint, PermissionsHook, initData}
time-lock              →  TZMechanism{Constraint, ColdStorageHook, initData}
```

### ELIGIBILITY templates (TZParamType.Eligibility → Hats eligibility modules on zone hat)
```
reputation-gate        →  TZMechanism{Eligibility, 8004ReputationEligibility, initData}
staking-requirement    →  TZMechanism{Eligibility, StakingEligibility, initData}
```

### INCENTIVE templates (TZParamType.Penalty/Reward → claimable mechanisms in agreement registry)
```
slashable-bond         →  TZMechanism{Penalty, StakingModule, initData{slashPercent, ...}}
reputation-feedback    →  TZMechanism{Reward, ReputationRegistry, initData{...}}
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
