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

## Monorepo structure

```
packages/
  contracts/    Solidity (Foundry). Agreement, TrustZone, ResourceTokenRegistry, HatValidator.
  sdk/          TypeScript. Typed contract wrappers, payload encoders/decoders, TZ account ops.
  compiler/     TypeScript. TZ schema documents ↔ onchain ProposalData. Mechanism templates.
  ponder/       Ponder indexer. Contract events → queryable GraphQL store.
  e2e/          Integration tests. Full 9-beat lifecycle on Anvil Base fork.
  data-apis/    ERC-8128-gated data API servers (WIP).
  agents/       Demo agents (WIP).
```

## Core primitives

| Primitive | Purpose | Onchain form |
|-----------|---------|-------------|
| **Agreement** | Commitment between parties with lifecycle state machine | Smart contract (one per agreement) |
| **Trust Zone** | A party's scope within an agreement — holds resources, has constraints | ERC-7579 smart account |
| **TZ Token** | Proof of zone membership — enables "act as" onchain and offchain | Hats Protocol hat |
| **Resource Tokens** | Typed tokens defining zone scope (permissions, responsibilities, directives) | ERC-6909 in ResourceTokenRegistry |
| **Mechanisms** | Typed parameters governing zones (eligibility, incentive, constraint) | Hat modules + hooks |

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
5. **Operate** — Agents access each other's resources via ERC-8128-authenticated APIs
6. **Enforce** — Constraints block unauthorized access; directive violations trigger claims
7. **Adjudicate** — Evidence evaluated, verdicts delivered, bonds at risk
8. **Resolve** — Agreement closed, reputation feedback written via ERC-8004

## Development

**Prerequisites:** Node.js 18+, [pnpm](https://pnpm.io/), [Foundry](https://book.getfoundry.sh/)

```bash
# Install dependencies
pnpm install

# Run contract tests (351 tests)
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

Base. USDC, ERC-8004 identity/reputation, and ERC-8128 web auth all on Base.

## Built at

[The Synthesis](https://synthesis.devfolio.co/) — March 16–22, 2026.
