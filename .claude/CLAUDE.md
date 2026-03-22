# CLAUDE.md

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
  sdk/          — TypeScript. Typed contract wrappers, payload encoders/decoders, TZ account ops.
  compiler/     — TypeScript. Mechanism templates + x402 server.
  ponder/       — Ponder indexer. Events → queryable store.
  e2e/          — Integration tests. Full 9-beat lifecycle on Anvil Base fork.
  agents/       — Autonomous counterparty + adjudicator agents.
  cli/          — Trust Zones CLI (ERC-8128 signing, tx prep).
  viz/          — Real-time dashboards (leaderboard, explorer, story).
  skill/        — Claude Code skills (trust-zones, temptation-game).
  bonfires/     — Bonfires knowledge graph integration.
  x402-service/ — x402-gated MCP server for compiler/SDK tools.
```

## Key specs (read before working)

- `overview.md` — thesis, primitives, architecture, resolution model
- `tz-account.md` — TrustZone + HatValidator
- `tokens.md` — Resource Token Registry (ERC-6909, 3 types)
- `agreement.md` — Agreement Contract + Registry, state machine
- `hats.md` — Hats Protocol integration
- `ponder.md` — Events, schema, entity mapping
- `demo.md` — Demo scenario (reciprocal data exchange, 9 beats)
- `compiler.md` — Mechanism templates + x402 server
- `timeline.md` — Build sequencing + cut lines
- `reputation-game.md` — Temptation Game scenario spec

## Rules

Read these before working on contracts:

- `.ai/rules/core.md` — general project rules
- `.ai/rules/contracts.md` — Foundry config, interface conventions, deploy scripts, dependencies
- `.ai/rules/testing.md` — TDD workflow, BTT trees, test bases, fork setup, naming conventions

## Chain

Base (Sepolia for testnet, mainnet for production). USDC, x402, ERC-8004 all on Base.

## Work standards

This is a hackathon but that does not lower the bar. Never dismiss issues as "not blockers for the hackathon" or "operational timing issues" to avoid fixing them. The user's directives and intentions are not to be undermined with laziness. Investigate root causes, fix real bugs, and do the work properly.

## Submission deadline

March 22, 2026.
