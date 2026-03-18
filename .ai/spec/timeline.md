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

### DONE (day 2)
- **SDK** (56 tests): all payload encoders/decoders, contract read helpers (Ponder + RPC backends), TZ account operations (signAsZone, buildZoneExecute), ABI generation
- **Compiler** (27 tests): TZSchemaDocument format, template registry (8 templates), compile + decompile roundtrip, resource token encoding, HatsModule data packing
- **Ponder** (36 tests): schema with relations, all 14 event handlers, env-var-configurable addresses/startBlock/RPC, rawProposalData stored on proposals
- **E2E test** (13 tests): full 9-beat lifecycle on Anvil fork — negotiate (with Ponder-sourced decompile), staking (real USDC + StakingEligibility on Base fork), data API (mock), claim, adjudicate, renegotiation. Transcript generation.
- **DeployAll.s.sol**: single deploy script orchestrating all contracts, nonce prediction for RTR↔AgreementRegistry, JSON output
- **profile.deploy**: via-ir + 200 optimizer runs, Agreement fits under EIP-170 (23KB)
- **Bugs found + fixed**: SDK encodeAccept payload, Ponder relations missing, Agreement over 24KB, staking eligibility blocks ACTIVATE, Ponder startBlock on fork, permission token semantics (consume vs provide)

**Test counts**: 351 contracts + 56 SDK + 27 compiler + 36 ponder + 13 E2E = **483 tests passing**

---

## Remaining work

### Day 3 (March 18): Data APIs + x402 service + Context graph design

**Data APIs (`packages/data-apis/`):**
- ERC-8128 signature verification middleware (real `isValidSignature()` RPC call)
- Resource token authorization middleware (permission token balance check via RPC)
- Directive enforcement middleware (rate limits — in-memory, log violations)
- Receipt generation (structured JSON for each authorized request)
- Agent A's endpoints: /market-data, /social-graph (mock data, real auth)
- E2E integration: replace `MockDataApi` with real data API servers, keep E2E green

**x402 service (`packages/compiler/` or `packages/x402-service/`):**
- Express server wrapping SDK + compiler
- /compile, /decompile endpoints
- /encode/:input, /decode/event endpoints
- /explain endpoint (chain reads via SDK)
- E2E integration: replace direct SDK/compiler calls with HTTP, keep E2E green

**Context graph design (spec work, not implementation):**
- Define the entity/edge schema for Bonfires: what entities (agreements, zones, actors, mechanisms), what edges (party-of, zone-in, claims-against), what properties
- Define how each data source maps to Bonfires entities:
  - Ponder indexer: onchain state (agreements, zones, claims, resource tokens, reputation feedback)
  - ERC-8128 receipts: offchain actions (API access events, with endpoint, timestamp, requester)
  - What else? Agent-local observations? Adjudicator reasoning?
- Define the sync approach: push from Ponder? Batch? Real-time?
- Write up as `.ai/spec/context-graph.md` (or update existing)
- This design work unblocks day 4 Bonfires integration without wasting time on wrong schema

### Day 4 (March 19): Bonfires + GenLayer + 8004 Eligibility

**Bonfires integration:**
- Provision bonfire for Trust Zones
- Implement sync based on day 3 context graph design
- Register agents (system, adjudicator, demo agents)
- Receipt ingestion from data APIs
- Test query patterns needed by adjudicator

**GenLayer integration:**
- Real adjudicator implementation using GenLayer
- Connect to Bonfires for evidence queries
- Test with the E2E dispute scenario (rate limit violation)

**8004 Eligibility module:**
- Hats eligibility module that checks ERC-8004 reputation scores
- Fills the `reputation-gate` template (currently zero address in compiler config)
- Enables the trust level model: `trustLevel = financialStake + reputationValue(8004Score)`
- Deploy on Base fork, add to E2E test as second eligibility module (chained with staking)

### Day 5 (March 20): Demo agents + Integration + Polish

**Demo agents (`packages/agents/`):**
- Agent A: propose, activate, access data, monitor receipts, file claim
- Agent B: counter (via Ponder read + decompile), access data, violate directives, attempt unauthorized access
- Adjudicator: query Bonfires, evaluate evidence, deliver verdict via GenLayer
- Demo orchestrator: thin wrapper around E2E test flow
- E2E integration: replace test driver with agent API calls, keep E2E green

**Live counterparty agent (stretch):**
- A real agent that plays counterparty to external agents (e.g., hackathon judging agents)
- Accepts proposals, negotiates terms, stakes, activates — live, not scripted
- Different demo mode: interactive rather than narrated

**Integration testing:**
- Full 9-beat demo with all real components
- Fix integration issues
- Receipt flow validation: data API → Bonfires → adjudicator → verdict

### Day 6 (March 21): Deploy + Rehearse + Submission prep

**Deploy:**
- Deploy all contracts to Base (mainnet or Sepolia)
- Verify on Basescan, update SDK addresses
- Full demo rehearsal (all 9 beats, real chain)

**Submission prep (see `.ai/context/submission-skill.md` for full API):**
- Self-custody transfer for all team members (`/participants/me/transfer/init` + `/confirm`)
- Write `description` (elevator pitch) and `problemStatement` (specific problem + who's affected)
- Compile `conversationLog` from saved session transcripts — judges read this
- Select `trackUUIDs` from catalog (see `.ai/context/bounties-and-tracks.md` for our targets)
- Fill `submissionMetadata`: agentHarness=claude-code, model=claude-opus-4-6, skills, tools, resources
- Post on Moltbook (project announcement → `moltbookPostURL`)
- Create draft project via `POST /projects`
- Record demo video → `videoURL`
- Make repo public → `repoURL`

### Day 7 (March 22): Polish + Submit

- Final demo run
- Update draft with any final changes
- Publish via `POST /projects/:uuid/publish`
- Verify project appears in public listing

---

## Open design questions

These need resolution before or during implementation:

**1. Onchain access control via permission tokens.**
How do permission tokens gate onchain execution by the TZ account? The current demo shows offchain gating (data API checks token balance via RPC). For onchain gating, the TZ account's ERC-7579 hooks (HookMultiPlexer → PermissionsHook) could check permission token balances before allowing `execute()` calls. Need to define: which onchain actions are gated? How does PermissionsHook map permission tokens to allowed targets/selectors?

**2. x402 service: MCP server or REST API + skill?**
The x402 service wraps SDK + compiler for agent consumption. Two approaches:
- **MCP server**: Claude-native tool exposure. Agents call tools directly. Tight integration with Claude Code / agent frameworks.
- **REST API + skill**: Universal HTTP endpoints. Any agent framework can consume. Skill file provides Claude Code integration.
Might do both — MCP for Claude agents, REST for everything else. Same underlying logic.

**3. Live counterparty agent.**
A qualitatively different demo than the scripted 9-beat flow. Instead of narrating "this is what would happen," show it happening with a real external agent. Higher risk, higher reward. Needs: a listening agent that can receive proposals, evaluate terms against its own preferences, counter-propose, stake, and operate within the agreement. Could interact with hackathon judging agents.

## Critical path

```
Contracts (DONE) → SDK + Compiler + Ponder + E2E (DONE)
  → Data APIs + x402 (day 3) → Bonfires + GenLayer + 8004 (day 4)
  → Demo agents (day 5) → Deploy + Rehearse (day 6) → Submit (day 7)
```

The E2E test is the integration backbone — each new component plugs in by replacing its mock and keeping the test green.

## Cut lines (if behind)

| If behind by... | Cut | Impact |
|-----------------|-----|--------|
| Day 3 | x402 service | Agents use SDK directly. Lose AgentCash bounty ($1,750). |
| Day 4 | Bonfires integration | Use Ponder directly for reads. Adjudicator reads chain directly. |
| Day 4 | 8004 eligibility module | Use staking-only eligibility. Lose reputation↔bond dynamic. |
| Day 4 | Real GenLayer | StubAdjudicator with preset verdicts. Lose "real adjudication" claim. |
| Day 5 | Live counterparty agent | Scripted demo only. Still compelling but not interactive. |
| Day 5 | Renegotiation (beat 9) | End at beat 8. Lose "the money shot" but core thesis still demonstrated. |

## Parallelism

- Data APIs and x402 service are independent — can be built in parallel
- Context graph design is a spec task — can happen while building data APIs
- Bonfires integration depends on context graph design (day 3 output)
- GenLayer and 8004 eligibility module are independent of each other
- Demo agents depend on data APIs + Bonfires + GenLayer
- Deploy to real chain can wait until day 6 (E2E on fork validates everything)
