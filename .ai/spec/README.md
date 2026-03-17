# Spec directory

Authoritative project specs. Code must conform to these documents.

## Documents

### Contract layer
- `overview.md` — thesis, core primitives, architecture, system layers, resolution model
- `agreement.md` — Agreement Contract + Registry: state machine, activation, Shodai compatibility
- `tz-account.md` — TZAccount + HatValidator: OZ base, overrides, module usage, deployment
- `tokens.md` — Resource Token Registry (ERC-6909): types, encoding, metadata
- `hats.md` — Hats Protocol integration: tree structure, modules, eligibility, toggle

### Agent interaction layer
- `sdk.md` — TypeScript SDK: contract wrappers, payload encode/decode, TZ account operations
- `compiler.md` — TZ schema doc ↔ ProposalData: mechanism templates, compile/decompile
- `x402-service.md` — x402-gated API server: bundles SDK + compiler behind pay-per-request endpoints

### Context & data layer
- `context-graph.md` — Bonfires-backed 3-tier context graph: onchain, offchain receipts, agent-local
- `ponder.md` — Ponder indexer: events, schema, entity mapping, Bonfires push pipeline
- `data-apis.md` — ERC-8128-gated data APIs: auth, resource tokens, directive enforcement, receipt logging

### Demo & planning
- `agents.md` — Demo agent architecture: Agent A, Agent B, adjudicator, 9-beat orchestration
- `demo.md` — Demo scenario: reciprocal data exchange, 9-beat flow, enforcement layers
- `timeline.md` — Build sequencing, progress, remaining work, cut lines

## Source

These specs are derived from `./plan/build-plan-v0.3.md`. The build plan is the living design document; these specs are the implementation-ready extractions.
