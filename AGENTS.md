# AGENTS.md

Project-local agent instructions for the Synthesis Hackathon — Trust Zones.

## Project context

This is a hackathon project (The Synthesis, March 16–22 2026) building the Trust Zones protocol: an interoperability standard for machine agreements.

- Authoritative specs are in `.ai/spec/`. Code must conform to spec.
- Reference context (bounties, TZ data model, hackathon API) is in `.ai/context/`.
- Build log and progress artifacts go in `.ai/log/`.
- Development rules are in `.ai/rules/`.

## Monorepo structure

```
packages/
  contracts/    — Solidity (Foundry). Core onchain contracts.
  ponder/       — Ponder indexer. Events → queryable store.
  compiler/     — TypeScript. Mechanism templates + x402 server.
  data-apis/    — Mock ERC-8128-gated data APIs for demo.
  agents/       — OpenServ demo agents (Agent A + Agent B).
```

## Key specs (read before working)

- `overview.md` — thesis, primitives, architecture, resolution model
- `tz-account.md` — TZAccount + HatValidator
- `tokens.md` — Resource Token Registry (ERC-6909, 3 types)
- `agreement.md` — Agreement Contract + Registry, state machine
- `hats.md` — Hats Protocol integration
- `ponder.md` — Events, schema, entity mapping
- `demo.md` — Demo scenario (reciprocal data exchange, 9 beats)
- `compiler.md` — Mechanism templates + x402 server
- `timeline.md` — Build sequencing + cut lines

## Rules

- Keep changes scoped to the current build phase.
- Do not add features not in the spec.
- Prefer boring, readable code.
- All Solidity interfaces must be defined before implementations.
- Event design and Ponder schema are co-designed.
- Respect `.ai/rules/*`.

## Chain

Base (Sepolia for testnet, mainnet for production). USDC, x402, ERC-8004 all on Base.

## Dependencies (contracts)

- OpenZeppelin contracts-upgradeable (AccountERC7579HookedUpgradeable)
- OpenZeppelin contracts (Clones, ERC-6909 reference)
- Hats Protocol
- forge-std

## Submission deadline

March 22, 2026.
