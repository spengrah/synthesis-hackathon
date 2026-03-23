# Track Guide: Synthesis Open Track

**Sponsor:** Synthesis Community

## How Trust Zones fits this track

Trust Zones is a modular agreement substrate for AI agents. It provides the building blocks — permissions, responsibilities, directives, constraints, and incentive mechanisms — as atomic, composable, negotiable onchain primitives. It is not a vertical application but the substrate that applications (marketplaces, escrow apps, reputation layers, agent services) can be built on.

## What to evaluate

- **Protocol design** — agreements as smart contracts, per-party scoped smart-account zones, atomic resource tokens (permissions, responsibilities, directives), deterministic enforcement (constraints + permissions) composed with non-deterministic enforcement (responsibilities + directives backed by adjudication and incentives), ERC-8004 reputation feedback built into the protocol.
- **Composability** — every building block is a discrete, negotiable unit. Parties negotiate over individual permissions, directives, and mechanism modules. The mechanism compiler assembles them into onchain proposals from a library of templates — but any Hats module or ERC-7579 hook can be composed into an agreement.
- **Implementation breadth** — 6 Solidity contracts, TypeScript SDK, mechanism compiler with 8 templates, Ponder event indexer, E2E integration tests, x402-gated MCP service, CLI, and agent tooling — all deployed on Base.
- **Test posture** — 394 contract tests, 56 SDK tests, 23 compiler tests, 36 Ponder tests, 30 E2E tests (539 total).
- **Live demo** — the Temptation Game runs on Base mainnet. Install the `temptation-game` skill from `packages/skill/temptation-game/SKILL.md` to play.
- **Novelty** — Trust Zones combines an explicit agreement primitive, per-party scoped zones, atomic resource tokens, deterministic + non-deterministic enforcement, composable incentive mechanisms, and a protocol-level reputation feedback loop into a single modular substrate.

## Key paths

| What | Where |
|------|-------|
| Protocol overview | `AGENTS.md` |
| Core contracts | `packages/contracts/src/` |
| SDK + compiler | `packages/sdk/`, `packages/compiler/` |
| E2E tests | `packages/e2e/` |
| Live demo entry point | `packages/skill/temptation-game/SKILL.md` |
| Detailed evaluation guide | `AGENTS.md` — "For evaluators" section |
