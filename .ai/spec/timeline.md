# Build Timeline

## March 16–22 (6 days). Submissions due March 22.

## Progress

### DONE (day 1)
- All Solidity interfaces, shared structs, events
- All 6 contracts implemented: Agreement, AgreementRegistry, TrustZone, HatValidator, ResourceTokenRegistry
- 209 unit tests across 41 suites, all passing
- Deploy scripts for all contracts
- 2 security audits addressed (Nemesis + Pashov)
- Specs, rules, .tree files, README all synced
- Dependencies: Hats Protocol, Rhinestone modules (HookMultiPlexer, PermissionsHook, SpendingLimitHook), StakingEligibility, EligibilitiesChain

---

## Remaining work

### Day 2 (March 17): SDK + Compiler + Ponder

**SDK (`packages/sdk/`):**
- Generate ABIs from forge artifacts
- Implement payload encoders for all `submitInput()` inputs
- Implement payload decoders for all events
- Implement contract read helpers
- Implement TZ account operation helpers (execute, ERC-8128 signing)

**Compiler (`packages/compiler/`):**
- Define TZ schema document format
- Implement mechanism template registry
- Implement compile function (TZ schema → ProposalData)
- Implement decompile function (ProposalData → TZ schema)
- Start with templates needed for the demo: budget-cap, target-allowlist, staking-requirement

**Ponder (`packages/ponder/`):**
- Define schema matching contract events
- Implement indexing handlers for all events
- Set up Bonfires push pipeline (Ponder → Bonfires KG)

### Day 3 (March 18): Context graph + Data APIs + Deploy

**Context graph (Bonfires integration):**
- Provision Bonfires bonfire for Trust Zones
- Register system agent, adjudicator agent, demo agents
- Implement Ponder → Bonfires sync (entities, edges, state transition episodes)
- Implement receipt ingestion library (ActionReceipt → Bonfires episode)
- Test query patterns: `/delve`, entity expansion, episode search

**Data APIs (`packages/data-apis/`):**
- ERC-8128 signature verification middleware
- Resource token authorization middleware (permission check)
- Directive enforcement middleware (rate limits)
- Receipt logging to Bonfires
- Agent A's endpoints: /market-data, /sentiment-analysis
- Agent B's endpoints: /social-graph, /trend-signals
- Mock data generators

**Deploy:**
- Deploy all contracts to Base (mainnet or Sepolia — decision pending)
- Verify on Basescan
- Update SDK with deployed addresses
- First integration test: create agreement → activate → TZ accounts exist

### Day 4 (March 19): Demo agents + x402 service

**Demo agents (`packages/agents/`):**
- Agent A: propose, activate, access data, monitor receipts, file claim
- Agent B: counter, access data, violate directives (scripted), attempt unauthorized access
- Adjudicator: query Bonfires, evaluate evidence, deliver verdict
- Demo orchestrator: sequential script running all 9 beats
- First end-to-end demo run

**x402 service (`packages/x402-service/`):**
- Express server + @x402/express middleware
- /compile, /decompile endpoints (wrapping compiler)
- /encode/:input, /decode/event endpoints (wrapping SDK)
- /explain endpoint (chain reads)

### Day 5 (March 20): GenLayer + Integration + Polish

**GenLayer integration:**
- Real adjudicator implementation (or refined stub)
- Connect to Bonfires for evidence queries
- Test with sample dispute scenario

**Integration testing:**
- Full 9-beat demo dry run
- Fix integration issues
- Receipt flow validation: data API → Bonfires → adjudicator → verdict

**Polish:**
- Error handling, logging, retry logic
- Clean up demo output for presentation

### Day 6 (March 21): Rehearse + Submit prep

- Full demo rehearsal (all 9 beats, scripted)
- Record demo video
- Write submission materials (README, architecture diagram, conversation log)
- Repo cleanup (remove secrets, clean dependencies)
- Bonfires sync (stretch — semantic search over agreement context)
- ENS subdomains (stretch)

### Day 7 (March 22): Submit

- Final demo run
- Submit

---

## Critical path

```
Contracts (DONE) → SDK + Compiler (day 2) → Deploy + Data APIs (day 3)
  → Demo agents (day 4) → Integration (day 5) → Rehearsal (day 6) → Submit (day 7)
```

Ponder + Bonfires integration runs in parallel with SDK/compiler work.

## Cut lines (if behind)

| If behind by... | Cut | Impact |
|-----------------|-----|--------|
| Day 2 | x402 service | Agents use SDK directly. Lose AgentCash bounty ($1,750). |
| Day 3 | Bonfires integration | Use Ponder directly for Tier 1 reads. Lose unified context graph. Adjudicator reads chain directly. |
| Day 3 | Directive enforcement in data APIs | Data APIs serve all requests, receipts logged. Adjudicator evaluates post-hoc only. |
| Day 4 | Real GenLayer | StubAdjudicator with preset verdicts. Lose "real adjudication" claim. |
| Day 4 | Compiler library | Agents construct ProposalData manually using SDK encoders. Less ergonomic but functional. |
| Day 5 | Reciprocal (two zones) | Single zone demo. Lose asymmetric trust update. |
| Day 5 | Renegotiation (beat 9) | End at beat 8. Lose "the money shot" but core thesis still demonstrated. |

## Parallelism

- SDK and compiler are independent — can be built in parallel
- Ponder indexer is independent of SDK/compiler
- Data APIs depend on SDK (for ABI types) but can scaffold in parallel
- Demo agents depend on SDK + compiler + data APIs + deployed contracts
- x402 service depends on SDK + compiler but is Tier 2 priority
