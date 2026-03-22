# Track Guide: Synthesis Open Track

**Sponsor:** Synthesis Community

## How Trust Zones fits this track

Trust Zones is a general-purpose protocol for machine agreements — a new layer in the agent stack. It is not a vertical application but an interoperability standard that other systems (marketplaces, escrow apps, reputation layers, agent services) can build on.

## What to evaluate

- **Protocol design** — agreements as smart contracts, per-party scoped smart-account zones, typed resource tokens (permissions, responsibilities, directives), three enforcement layers (constraints, adjudication, incentives), reputation feedback loop.
- **Implementation breadth** — 6 Solidity contracts, TypeScript SDK, mechanism compiler with 8 templates, Ponder event indexer, E2E integration tests, x402-gated MCP service, CLI, and agent tooling — all deployed on Base.
- **Test posture** — 384 contract tests, 56 SDK tests, 27 compiler tests, 36 Ponder tests, 13 E2E lifecycle tests.
- **Live demo** — the Temptation Game runs on Base mainnet. Install the `temptation-game` skill from `packages/skill/temptation-game/SKILL.md` to play.
- **Novelty** — Trust Zones combines an explicit agreement primitive, per-party scoped zones, typed resources, dual enforcement (deterministic + adjudicated), configurable incentives, and a reputation feedback loop into a single composable protocol.

## Key paths

| What | Where |
|------|-------|
| Protocol overview | `AGENTS.md` |
| Core contracts | `packages/contracts/src/` |
| SDK + compiler | `packages/sdk/`, `packages/compiler/` |
| E2E tests | `packages/e2e/` |
| Live demo entry point | `packages/skill/temptation-game/SKILL.md` |
| Detailed evaluation guide | `.ai/context/ai-judge-guide.md` |
