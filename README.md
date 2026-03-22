# Trust Zones

**Trust Zones is an interoperability standard for machine agreements.** It makes the metaphor literal: each agreement is a smart contract, each zone within an agreement is a smart account that holds real resources, and permissions to those resources are the stakes of the agreement.

Machines can keep promises when the promise is a Trust Zone: constraints are explicit, enforcement is onchain, resources are at stake, disputes are adjudicated, and trust updates from every interaction.

## How it works

Agents form **agreements** — smart contracts that define the terms of collaboration between parties. Each agreement creates **trust zones**, one per party. A trust zone is an ERC-7579 smart account that holds **resource tokens** defining scope: what the zone holder can access (permissions), what they must do (responsibilities), and what they must not do (directives).

The agent wears the zone's Hats Protocol hat and can operate *as* the zone — onchain via `execute()`, offchain via ERC-8128 signatures verified through ERC-1271. Financial bonds and reputation back the commitments.

**Three layers of enforcement:**

| Layer | What it does | Example |
|-------|-------------|---------|
| **Constraints** | Hard limits, enforced deterministically | Unauthorized action → blocked |
| **Directives** | Subjective rules, enforced by adjudication | Rule violation → claim filed |
| **Incentives** | Financial consequences | Bond at risk on guilty verdict |

## What is different about Trust Zones

| Category | What it does | Why Trust Zones is different |
|----------|-------------|------------------------------|
| Marketplace | Matches parties for work/services | Trust Zones defines the agreement structure underneath the interaction |
| Wallet policy | Bounds what an agent can spend/do | Trust Zones governs the full relationship between parties, not just one wallet's execution bounds |
| Reputation layer | Records history after interactions | Trust Zones structures the interaction itself and updates trust from the resulting behavior |
| Escrow app | Holds funds against deliverables | Trust Zones governs permissions, duties, directives, and adjudication across resources |

Trust Zones is the agreement substrate. Marketplaces, escrow apps, and reputation layers are things you could build on top of it.

## Core primitives

| Primitive | Purpose | Onchain form |
|-----------|---------|-------------|
| **Agreement** | Commitment between parties with lifecycle state machine | Smart contract (one per agreement) |
| **Trust Zone** | A party's scope within an agreement — holds resources, has constraints | ERC-7579 smart account |
| **TZ Token** | Proof of zone membership — enables "act as" onchain and offchain | Hats Protocol hat |
| **Resource Tokens** | Typed tokens defining zone scope (permissions, responsibilities, directives) | ERC-6909 in ResourceTokenRegistry |
| **Mechanisms** | Typed parameters governing zones (eligibility, incentive, constraint) | Hat modules + ERC-7579 hooks |

## Agreement lifecycle

```
PROPOSED → ACCEPTED → READY → ACTIVE → CLOSED
                ↑                         │
                └─── renegotiation ───────┘
```

1. **Negotiate** — Parties propose, counter, and accept terms via the compiler
2. **Set up** — Zone accounts, hat modules, and resource tokens are deployed
3. **Stake** — Parties deposit USDC bonds into staking eligibility modules
4. **Activate** — Zone hats minted, agreement goes live
5. **Operate** — Agents access resources via ERC-8128-authenticated APIs and onchain execute calls
6. **Enforce** — Constraints block unauthorized access; directive violations trigger claims
7. **Adjudicate** — Evidence evaluated, verdicts delivered, bonds at risk
8. **Resolve** — Agreement closed, reputation feedback written via ERC-8004

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

# Run contract tests (384 tests)
pnpm test:contracts

# Run SDK tests (56 tests)
pnpm test:sdk

# Run compiler tests (27 tests)
pnpm test:compiler

# Run Ponder tests (36 tests)
pnpm test:ponder

# Run E2E integration tests (13 tests, requires Anvil)
pnpm test:e2e
```

The E2E test runs the full 9-beat demo scenario on an Anvil fork of Base mainnet — negotiate, stake, exchange data, enforce constraints, file claims, adjudicate, and renegotiate.

## Chain

Base. Contracts deployed on Base mainnet and Base Sepolia. USDC, ERC-8004 identity/reputation, and ERC-8128 web auth all on Base.

## Built at

[The Synthesis](https://synthesis.devfolio.co/) — March 16–22, 2026.
