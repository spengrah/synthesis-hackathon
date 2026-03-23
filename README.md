# Trust Zones

**Trust Zones is a modular agreement substrate for AI agents.** It provides the building blocks — permissions, responsibilities, directives, constraints, and incentive mechanisms — as atomic, composable, negotiable onchain primitives. Agents assemble exactly the right agreement for their collaboration, and the protocol makes it enforceable.

Every agreement is a smart contract. Each party gets a Trust Zone — a scoped ERC-7579 smart account that holds that party's role in the relationship. The building blocks plug into zones as typed resource tokens and mechanism modules, so parties can negotiate over individual pieces and compose them in different ways.

## How it works

An agreement defines a relationship along two axes: what is **deterministic** and what is **non-deterministic**.

**Deterministic — definable a priori, self-enforcing:**
- **Constraints** — what you CANNOT do. ERC-7579 hooks reject unauthorized transactions automatically.
- **Permissions** — what you CAN do. ERC-6909 tokens granting access to specific capabilities.

**Non-deterministic — requires post-hoc evaluation:**
- **Responsibilities** — what you SHOULD do. Tokens defining positive obligations.
- **Directives** — what you SHOULD NOT do. Tokens defining negative obligations.

**Incentive mechanisms** give the non-deterministic rules teeth. Staked collateral, reputation bonds, token lockups — pluggable smart contract modules that create consequences for behavior that code alone can't enforce.

**ERC-8004 reputation feedback** is built into the protocol: after every agreement, the outcome is written to the ERC-8004 Reputation Registry. Cooperate — positive feedback. Violate — negative feedback. This feeds back into future agreements.

The agent wears the zone's Hats Protocol hat and can operate *as* the zone — onchain via `execute()`, offchain via ERC-8128 signatures verified through ERC-1271.

## What is different about Trust Zones

Trust Zones is not an application — it's the substrate that applications are built on.

| Category | What it does | Why Trust Zones is different |
|----------|-------------|------------------------------|
| Marketplace | Matches parties for work/services | Trust Zones defines the agreement structure underneath the interaction |
| Wallet policy | Bounds what an agent can spend/do | Trust Zones governs the full relationship between parties — both sides get zones with modular, negotiable terms |
| Reputation layer | Records history after interactions | Trust Zones structures the interaction itself, then feeds outcomes back into reputation |
| Escrow app | Holds funds against deliverables | Trust Zones provides the general substrate — escrow is one configuration of permissions and constraints you could compose |

The key difference is composability. Every element — each permission, responsibility, directive, constraint, and incentive mechanism — is a discrete, negotiable unit. Parties assemble exactly the right agreement for their collaboration.
 
## Core primitives

| Primitive | What it is | Onchain form |
|-----------|-----------|-------------|
| **Agreement** | The relationship between parties, with lifecycle state machine | Smart contract (one per agreement) |
| **Trust Zone** | A party's scope — holds resource tokens and mechanism modules | ERC-7579 smart account |
| **TZ Token** | Proof of zone membership — enables "act as" onchain and offchain | Hats Protocol hat |
| **Resource Tokens** | Atomic tokens defining zone scope (permissions, responsibilities, directives) | ERC-6909 in ResourceTokenRegistry |
| **Mechanisms** | Pluggable modules governing zone behavior (staking, constraints, reputation gates) | Hats modules + ERC-7579 hooks |

## Agreement lifecycle

```
PROPOSED → ACCEPTED → READY → ACTIVE → CLOSED
                ↑                         │
                └─── renegotiation ───────┘
```

1. **Negotiate** — Parties propose, counter, and accept terms via the mechanism compiler
2. **Set up** — Zone accounts, hat modules, and resource tokens are deployed
3. **Stake** — Parties deposit bonds into staking eligibility modules
4. **Activate** — Zone hats minted, agreement goes live
5. **Operate** — Agents access resources via ERC-8128-authenticated APIs and onchain execute calls
6. **Enforce** — Constraints block unauthorized access; directive violations trigger claims
7. **Adjudicate** — Evidence evaluated, verdicts delivered, bonds at risk
8. **Resolve** — Agreement closed, ERC-8004 reputation feedback written onchain

## Monorepo structure

```
packages/
  contracts/     Solidity (Foundry). Agreement, TrustZone, ResourceTokenRegistry, HatValidator, TemptationVault.
  sdk/           TypeScript. Typed contract wrappers, payload encoders/decoders, TZ account ops.
  compiler/      TypeScript. TZ schema documents ↔ onchain ProposalData. 8 mechanism templates.
  ponder/        Ponder indexer. Contract events → queryable GraphQL store.
  e2e/           Integration tests. Full 9-beat lifecycle on Anvil Base fork.
  agents/        Autonomous counterparty + adjudicator agents.
  cli/           Trust Zones CLI. ERC-8128 zone signing + transaction preparation.
  viz/           Real-time leaderboard, agreement explorer, protocol story.
  skill/         Claude Code skills: trust-zones (protocol tools) + temptation-game (live demo).
  x402-service/  x402-gated MCP server. Compiler + SDK as pay-per-request tools.
  bonfires/      Bonfires knowledge graph integration.
```

## Key integrations

- **Hats Protocol** — zone membership, module ecosystem for mechanisms
- **ERC-7579** — smart account standard for trust zone accounts
- **ERC-6909** — multi-token standard for resource token registry
- **ERC-8004** — onchain reputation feedback after agreement resolution
- **ERC-8128** — offchain auth for gated APIs (tweet proxy, data APIs)
- **x402** — pay-per-request protocol for MCP server access

## Agent tooling

Agents interact with Trust Zones through two interfaces:

- **`@trust-zones/cli`** — local CLI for ERC-8128 zone signing and transaction preparation. Free, no dependencies.
- **x402 MCP server** — pay-per-request protocol service exposing the compiler and SDK as MCP tools (compile, decompile, encode, decode, explain, staking_info). Any agent with an MCP-compatible harness can use it.

## Development

**Prerequisites:** Node.js 18+, [pnpm](https://pnpm.io/), [Foundry](https://book.getfoundry.sh/)

```bash
# Install dependencies
pnpm install

# Run contract tests (394 tests)
pnpm test:contracts

# Run SDK tests (56 tests)
pnpm test:sdk

# Run compiler tests (23 tests)
pnpm test:compiler

# Run Ponder tests (36 tests)
pnpm test:ponder

# Run E2E integration tests (30 tests, requires Anvil)
pnpm test:e2e
```

## Chain

Base. Contracts deployed on Base mainnet and Base Sepolia — see `packages/contracts/deployments.json` for addresses. USDC, ERC-8004 identity/reputation, and ERC-8128 web auth all on Base.

## Built at

[The Synthesis](https://synthesis.devfolio.co/) — March 13–22, 2026.
