# Overview

## Thesis

**Trust Zones are the interoperability standard for machine agreements.** An agreement is a contract; a contract is an agreement. Trust Zones make this literal: each agreement is a smart contract, each zone within an agreement is a smart account that holds real resources, and permissions to those resources are the stakes of the agreement.

**Judge-facing framing:** "Machines can keep promises when the promise is a Trust Zone: constraints are explicit, enforcement is onchain, resources are at stake, disputes are adjudicated, and trust updates from every interaction."

## Core Primitives

| Primitive | What | Onchain form |
|-----------|------|-------------|
| **Agreement** | Commitment between parties with full lifecycle state machine | Smart contract (one per agreement) |
| **Trust Zone** | A party's zone within an agreement — holds resources, has constraints | ERC-7579 smart account (one per zone per agreement) |
| **TZ Token** | Proof of membership in a zone — enables "act as" onchain and offchain | Hats Protocol hat |
| **Resource Tokens** | Typed tokens defining zone scope | ERC-6909 in Resource Token Registry |
|   ↳ Permission | "What you CAN do" | `0x01` prefix |
|   ↳ Responsibility | "What you MUST do" (rivalrous) | `0x02` prefix |
|   ↳ Directive | "What you SHOULD/SHOULDN'T do" (subjective rules) | `0x03` prefix |
| **Mechanisms** | Typed parameters governing zones | ELIGIBILITY, INCENTIVE, CONSTRAINT |

## Relationships

- An agreement comprises one or more trust zones
- A trust zone holds resources (funds, tokens) and resource tokens (permissions, responsibilities, directives)
- Resource tokens are independent artifacts — reusable across multiple trust zones
- An agent wears the zone's hat → can operate *as* the zone (onchain and offchain)
- The agreement contract governs the zones — installs modules, controls lifecycle

## "Act as" resolution model

### Onchain
1. Agent (hat-wearer) calls `execute()` on TZ Account
2. TZ Account routes to HatValidator → checks `hats.isWearerOfHat(caller, hatId)`
3. Hooks run `preCheck` (constraints)
4. TZ Account executes call → `msg.sender` at target = TZ account address
5. Hooks run `postCheck`

### Offchain
1. Agent signs with `keyid="erc8128:<chainId>:<tzAccountAddress>"`
2. Server calls `isValidSignature()` on TZ Account (ERC-1271)
3. OZ routes to HatValidator → checks hat on recovered signer
4. Server authenticates as TZ account address

### Resource authorization
Resource providers check the TZ account's resource token holdings:
1. Permission check: `registry.balanceOf(tzAccount, permTokenId) > 0`
2. Directive read: `registry.tokenMetadata(directiveTokenId)` for usage rules
3. Enforce dynamically based on directive metadata

## Three-layer enforcement model

| Layer | Enforces | How | Example |
|-------|----------|-----|---------|
| **Constraints** | Hard, deterministic | ERC-7579 hooks block pre-execution | Unauthorized target → PermissionsHook blocks |
| **Directives** | Soft, subjective | Action receipts evaluated post-execution by adjudicator | Violated usage rules → dispute |
| **Incentives** | Consequences | Bond slashed, escrow withheld, reputation marked | 35% bond slashed + negative 8004 feedback |

## System layers

```
┌──────────────────────────────────────────────────────┐
│  AGENTS                                               │
│  Autonomous processes that negotiate, execute, dispute │
│  Use SDK + Compiler directly (or via x402 service)    │
├──────────────────────────────────────────────────────┤
│  x402 SERVICE                                         │
│  Pay-per-request API bundling SDK + Compiler           │
│  Compile/decompile, encode/decode, explain             │
├──────────────────────────────────────────────────────┤
│  SDK + COMPILER (TypeScript libraries)                │
│  SDK: typed contract wrappers, payload encode/decode  │
│  Compiler: TZ schema doc ↔ ProposalData               │
├──────────────────────────────────────────────────────┤
│  CONTEXT GRAPH (Bonfires-backed, 3 tiers)             │
│  Tier 1: Onchain (Ponder → Bonfires KG entities)      │
│  Tier 2: Offchain (ERC-8128 receipts → Bonfires eps)  │
│  Tier 3: Agent-local (Bonfires agent stacks)           │
├──────────────────────────────────────────────────────┤
│  DATA APIs                                            │
│  ERC-8128-gated resource providers                    │
│  Check permission tokens, enforce directives          │
│  Log action receipts to Bonfires (Tier 2)             │
├──────────────────────────────────────────────────────┤
│  CONTRACTS (Solidity, Base)                           │
│  Agreement + Registry, TrustZone, HatValidator,       │
│  ResourceTokenRegistry, Hats Protocol integration     │
└──────────────────────────────────────────────────────┘
```

## Context graph

The Trust Zones Context Graph captures the full operational context of agreements across 3 tiers, with two query surfaces.

- **Tier 1 (onchain source of truth):** Contract events indexed by Ponder into typed, parsed entities. Primary query surface: **Ponder GraphQL** (structured, relational, fast). Also pushed to Bonfires KG for cross-tier search.
- **Tier 2 (offchain provenance):** Action receipts signed via ERC-8128, validated by data API servers, pushed to Bonfires as episodes. Tamper-resistant via cryptographic signatures preserved in the data.
- **Tier 3 (agent-local):** Beliefs, evaluations, private receipts stored in Bonfires agent episodic stacks. Selectively disclosed to Tier 2 as evidence during disputes.

**Two query surfaces:**
- **Ponder GraphQL** — structured reads for Tier 1. Used by SDK, data APIs, agents. Can be x402-gated.
- **Bonfires `/delve`** — semantic search across all tiers. Used by adjudicator for evidence queries.

## Agent interaction model

Agents interact with the system through:

1. **SDK** — TypeScript library wrapping all contract ABIs. Typed encode/decode for every `submitInput()` payload. Contract read helpers. TZ account operation helpers (execute, ERC-8128 signing).
2. **Compiler** — Translates TZ schema documents (semantic) ↔ ProposalData (mechanical). The mechanism template registry is the core IP.
3. **x402 service** — Bundles SDK + Compiler behind pay-per-request API endpoints. Convenience + revenue layer, not a dependency.
4. **Direct viem calls** — Agents can always call contracts directly using ABIs. The SDK is sugar, not a requirement.

## Chain

Base (USDC, x402, ERC-8004 all on Base).
