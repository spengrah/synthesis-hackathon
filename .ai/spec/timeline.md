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

### DONE (day 2 evening — research + spec)
- **5 research agents** completed overnight:
  - GenLayer: 3-component architecture, Optimistic Democracy as jury, pseudocode → **deferred** (too complex for hackathon, simple LLM agent replaces)
  - Bonfires context graph: 12 entity types, 16 edges, 3-tier sync, 5 query patterns, auth model, provisioning flow
  - OpenServ: SDK analysis, agent mapping → **deprioritized** (wrong trust model, agents are same-boundary)
  - ERC-8128: `@slicekit/erc8128` reference impl, middleware design, smart account auth flow
  - ERC-8004 eligibility: ReputationEligibility module design → **deferred** (too complex, relying on feedback as primary 8004 integration)
- **Reputation Game designed:** vault + tweet proxy demo concept, two enforcement models, directives, negotiation logic
- **Scope decisions:**
  - Dropped OpenServ ($4,500 bounty) — wrong trust model
  - Deferred GenLayer — simple LLM adjudicator for hackathon, GenLayer as production path
  - Deferred 8004 eligibility module — existing reputation feedback is sufficient
  - Consolidated two demos into one: reputation game replaces reciprocal data exchange
  - Dropped directive middleware from 8128 spec — directives are post-hoc by definition

---

## Remaining work

### Day 3 (March 18): Vault + Agents + Tweet Proxy

**Vault contract (`packages/contracts/src/Vault.sol`):**
- Simple ETH holder with permission-token-gated withdrawal
- `withdraw(amount, permissionTokenId)` checks RTR balance + decodes custom metadata
- Permission metadata: `abi.encode(address vault, uint256 maxAmount)` — new `vault-withdraw` compiler template
- Foundry tests
- Add to deploy script
- ~3h

**Shared agent infrastructure (`packages/agents/src/shared/`):**
- `llm.ts`: Vercel AI SDK + OpenAI-compatible provider (Venice.ai etc.)
- `chain.ts`: viem public + wallet clients
- `polling.ts`: generic poll-until utility
- `ponder.ts`: Ponder query helpers (wraps SDK + custom queries for claims, proposals)
- ~2h

**Adjudicator agent (`packages/agents/src/adjudicator/`):**
- `evaluate.ts`: fetch context → build LLM prompt → parse verdict → return actions
- `index.ts`: polling loop wrapping evaluate
- Handles both tweet violations (content eval) and vault violations (event check)
- Pure function export for E2E testability
- See `adjudicator-agent.md` for prompt design
- ~3-4h

**Counterparty agent (`packages/agents/src/counterparty/`):**
- `negotiate.ts`: `buildReputationGameSchemaDoc()`, `determineTerms()`, standard directives
- `monitor.ts`: poll vault events + tweet receipts, file claims, signal completion
- `tweet-proxy.ts`: Express endpoint, posts to X via `twitter-api-v2`, **mock auth** (keyid header + Ponder permission check — real 8128 signature verification swapped in on day 4)
- `index.ts`: start proxy + polling loops
- See `counterparty-agent.md` for full design
- ~3-4h

**X account setup:**
- Create X account, register developer portal, get OAuth credentials
- Enable "Automated Account" label
- Free tier: 1,500 tweets/month
- ~30min

### Day 4 (March 19): ERC-8128 + Bonfires + E2E

**ERC-8128 real auth (`packages/data-apis/` + tweet proxy):**
- Install `@slicekit/erc8128`
- `verifyERC8128` middleware (signature verification via ERC-1271 / `isValidSignature()`)
- Replace mock keyid auth in tweet proxy + data API endpoints with real 8128 signature verification
- `logReceipt` middleware (fire-and-forget to Bonfires)
- No directive middleware (directives are post-hoc)
- See `erc8128.md` for design
- ~3-4h

**Bonfires integration:**
- Bonfires team provisions bonfire, provides API key
- `packages/bonfires-client/`: shared client for entities, edges, episodes, delve
- Ponder → Bonfires sync service: entities + edges for agreements, zones, actors, tokens
- Receipt logging: tweet proxy + data API → Bonfires episodes
- Adjudicator queries: `/delve` for claim context
- See `context-graph.md` for schema + API mapping
- ~4-5h

**Reputation game E2E test (`packages/e2e/test/reputation-game.test.ts`):**
- Deploy vault, fund with ETH
- Counterparty proposes via `buildReputationGameSchemaDoc()`
- Tested agent accepts, SET_UP, stake, ACTIVATE
- Honest path: compliant tweet → no withdrawal → COMPLETE → positive 8004
- Dishonest path: withdrawal → claim → adjudicator evaluates → CLOSE → negative 8004
- Tweet violation path: off-topic tweet → claim → LLM evaluates → CLOSE
- Mock or real LLM depending on `LLM_API_KEY` env var
- ~3-4h

### Day 5 (March 20): Integration + Live Demo + Polish

**Integration testing:**
- Full reputation game flow with all real components (8128, Bonfires, LLM adjudicator)
- Fix integration issues
- Receipt flow: tweet proxy → Bonfires → adjudicator queries → verdict

**Live demo setup:**
- Deploy contracts to Base (mainnet or Sepolia)
- Deploy counterparty agent + adjudicator to Railway
- Fund vault with real ETH
- Test live: propose to an external agent, full flow
- Write up "how to interact" instructions

**Compiler template:**
- `vault-withdraw` template: encode/decode `(address vault, uint256 maxAmount)`
- Update `PermissionEntry` type to support template-specific params
- Roundtrip tests

### Day 6 (March 21): Demo Video + Submission Prep

**Demo video (recorded, reciprocal):**
- Script the 9-beat reciprocal flow
- Real deployments, real tweets, real artifacts
- Narrated walkthrough
- Show: negotiation, 8128 auth, compliant tweet, constraint (vault reverts), directive violation, claim, LLM adjudication, 8004 feedback

**Submission prep (see `.ai/context/submission-skill.md`):**
- Self-custody transfer for all team members
- Write `description` + `problemStatement`
- Compile `conversationLog` from session transcripts
- Select `trackUUIDs`: Agent Services on Base, Open Track, ERC-8128, ERC-8004
- Fill `submissionMetadata`: agentHarness=claude-code, model=claude-opus-4-6
- Post on Moltbook → `moltbookPostURL`
- Create draft project via `POST /projects`

### Day 7 (March 22): Submit

- Final demo run (live)
- Record demo video → `videoURL`
- Make repo public → `repoURL`
- Update draft, publish via `POST /projects/:uuid/publish`
- Verify project appears in public listing

---

## Bounty targets

| Bounty | Prize | Fit | Status |
|--------|-------|-----|--------|
| Agent Services on Base | $5,000 | Strong — counterparty agent IS an agent service on Base | Active |
| Open Track | $25,059 | Strong — novel protocol, working demo | Active |
| ERC-8128 (Slice) | $750 | Strong — smart account auth via 8128, tweet proxy + data API | Active |
| ERC-8004 | $750 | Moderate — reputation feedback on agreement closure | Active |
| ~~OpenServ~~ | ~~$4,500~~ | ~~Dropped~~ | Deferred |

## Critical path

```
Contracts + SDK + Compiler + Ponder + E2E (DONE)
  → Vault + Agents + Tweet Proxy (day 3)
    → 8128 + Bonfires + E2E (day 4)
      → Integration + Live Demo (day 5)
        → Demo Video + Submission (day 6-7)
```

## Cut lines (if behind)

| If behind by... | Cut | Impact |
|-----------------|-----|--------|
| Day 3 | Tweet proxy | Vault-only demo. Lose 8128 integration in recorded demo. |
| Day 4 | Bonfires | Adjudicator reads Ponder directly. Lose cross-tier evidence queries. |
| Day 4 | Real 8128 auth | Keep mock keyid header from E2E test. Lose Slice bounty ($750). |
| Day 5 | Live interactive demo | Recorded demo only. Still compelling but not interactive. |
| Day 5 | Reciprocal demo (Zone B) | Single zone only (live demo mode). Lose mutual delegation narrative. |

## Parallelism

- Vault contract and shared agent infra are independent → parallel on day 3
- Adjudicator and counterparty agent share infra but have independent logic → partially parallel
- 8128 middleware and Bonfires integration are independent → parallel on day 4
- E2E test depends on vault + agents → day 4 after day 3 outputs
- Deploy to real chain can wait until day 5 (fork validates everything)

## Specs

| Spec | Status | Location |
|------|--------|----------|
| Protocol overview | Done | `overview.md` |
| Agreement contract | Done | `agreement.md` |
| Resource tokens | Done | `tokens.md` |
| TZ account | Done | `tz-account.md` |
| Hats integration | Done | `hats.md` |
| SDK | Done | `sdk.md` |
| Compiler | Done | `compiler.md` |
| Ponder | Done | `ponder.md` |
| Reputation game (demo) | Done | `reputation-game.md` |
| Shared agents | Done | `agents.md` |
| Adjudicator agent | Done | `adjudicator-agent.md` |
| Counterparty agent | Done | `counterparty-agent.md` |
| ERC-8128 middleware | Done | `erc8128.md` |
| Context graph (Bonfires) | Done | `context-graph.md` |
| x402 service | Stub | `x402-service.md` |
| GenLayer | Deferred | `deferred/genlayer.md` |
| OpenServ | Deferred | `deferred/openserv.md` |
| 8004 eligibility module | Deferred | `deferred/erc8004-eligibility.md` |
| Original demo (reciprocal data exchange) | Deferred | `deferred/demo.md` |
| Original agents | Deferred | `deferred/agents.md` |
