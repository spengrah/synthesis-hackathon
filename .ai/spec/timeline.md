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

### DONE (day 2 evening — research + spec)
- **5 research agents** completed overnight: GenLayer, Bonfires context graph, OpenServ, ERC-8128, ERC-8004 eligibility
- **Reputation Game designed:** vault + tweet proxy demo, two enforcement models
- **Scope decisions:** dropped OpenServ, deferred GenLayer + 8004 eligibility module, consolidated to single demo

### DONE (day 3 — March 18)
- **Temptation.sol** (was Vault): ETH holder with permission-token-gated withdrawal. 27 unit tests (BTT format with .tree) + 9 integration tests (real RTR + token metadata)
- **Permission metadata generalized**: new standard format `(string resource, uint256 value, bytes32 period, uint256 expiry, bytes params)`. Replaces old nested rateLimit tuple. Temptation decodes standard format natively — no custom template needed. Updated across compiler, SDK, Ponder, contracts, E2E.
- **Agents package** (`packages/agents/`):
  - Shared infra: Vercel AI SDK client, viem chain clients, polling utility, Ponder query helpers, `claude -p` CLI wrapper
  - Adjudicator agent: `evaluateClaim()` with Zod-typed structured output, responsibilities + directives in prompt, `mapVerdictToActions()`, session transcript saving
  - Counterparty agent: `buildCounterProposal()`, `determineWithdrawalLimit()`, `checkVaultWithdrawals()`, `buildClaimEvidence()`
  - CLI entry point: `--role adjudicator|counterparty`
  - 23 unit tests
- **Responsibilities/directives split**: tweet obligations moved from directives to responsibilities. Only "do not post anything else" and "do not withdraw" remain as directives.
- **Reputation game E2E** (13 tests): integrated with real components:
  - Real Temptation.sol deployment + withdrawal via impersonated zone account
  - Real permission token with standard metadata format
  - Real `claude -p haiku` LLM adjudication (with mock fallback via MOCK_LLM=1)
  - Real constraint test: both NoPermissionToken and ExceedsPermittedAmount error paths
  - Directives + responsibilities fetched from Ponder via `backend.getZoneDetails()`
  - Real feedback URIs with JSON content + keccak256 hash
  - `checkVaultWithdrawals()` from agents package for violation detection
  - LLM session transcripts saved to `packages/agents/llm-sessions/`
- **termsDocUri** added to TZSchemaDocument + compiler compile/decompile pipeline
- **X account created**: `@tempt_game_bot` with developer account (pay-as-you-go API)

### DONE (day 3 evening — March 18)
- **Real tweet proxy** (`packages/agents/src/counterparty/tweet-proxy.ts`):
  - `TweetProxy` class with `twitter-api-v2`, posts to `@tempt_game_bot`
  - `createTweetProxyFromEnv()` factory reads X credentials from env
  - E2E gated via `REAL_TWEETS=1` flag (mock proxy used by default)
  - Smoke-tested: real tweet posted and verified on X
- **Adjudicator unified prompt**: single evaluation across both Temptation Vault withdrawals + tweets (was two separate prompt builders). Fetches ground truth from X via `TwitterClient` when available.
- **Counterparty LLM tweet evaluation** (`packages/agents/src/counterparty/evaluate-tweets.ts`):
  - `createCliEvaluateTweets()` — uses `claude -p haiku`, self-interested prompt (flags potential violations)
  - `EvaluateTweetsFn` injectable type for test mocking
  - Wired into `checkTweetViolations()` and `startCounterparty()` loop
- **Shared `runClaudeCli()`**: extracted from `claude-cli.ts`, reusable by both adjudicator and counterparty with configurable session prefixes
- **Compiler hex params passthrough**: `PermissionEntry.params` accepts raw `Hex` (pass-through) or `Record<string, unknown>` (JSON-encoded). Temptation's vault-withdraw permission now uses `encodeAbiParameters([{type: "address"}], [vaultAddress])` directly — no more JSON workaround.
- **Beat 5 cleaned up**: uses agreement-minted permission token (from setUp) instead of manually minting via impersonated registry owner
- **Ponder `ResourceTokenAssigned` fix**: deployed entity rows now read metadata from `resourceToken` table to populate `obligation`/`rule`/etc. immediately (was null due to event ordering race)
- **Dotenv loading** for E2E: `packages/agents/.env` loaded automatically when `REAL_TWEETS=1`
- **ERC-8128 auth** (`@slicekit/erc8128`):
  - Tweet proxy supports both auth modes: ERC-8128 verification (when `publicClient` provided) or keyid header fallback (mock/test)
  - `MemoryNonceStore` for replay protection
  - Express → Fetch API request conversion for `verifyRequest()`
  - `createZoneSignerClient()` helper: agent EOA signs, keyid points to zone smart account
  - E2E wired: `REAL_TWEETS=1` uses ERC-8128 signed requests via `signerClient.fetch()`
- **Real zone execution**: beat 5 uses `zone.execute()` via tested agent's EOA instead of `testClient.impersonateAccount()`. Matches the real onchain flow.
- **Counterparty tweet eval E2E beats**:
  - Beat 3b: counterparty LLM evaluates compliant tweet → no violation (proves no spurious claims)
  - Beat 3c: agent posts "Buy my NFTs!" → counterparty LLM detects violation (without filing claim, to preserve later beats)
  - Mock fallback via `MOCK_LLM=1` for deterministic CI

**Test counts (day 3)**: 364 contracts + 56 SDK + 23 compiler + 36 ponder + 26 agents + 13 lifecycle E2E + 15 reputation game E2E = **533 tests passing**

**Test counts (day 5)**: +17 reciprocal demo E2E + 1 sync-timing E2E (full production pipeline) + 22 x402-service = **573 tests passing**

---

## Remaining work

### E2E gaps (things still mocked or not exercised)

| Gap | Current state | Fix |
|-----|---------------|-----|
| ERC-8128 zone auth | `bad_signature` — TrustZone doesn't implement ERC-1271 | Implement `isValidSignature` on TrustZone or HatValidator |
| agentId | Hardcoded `0` | Use unique ID per agent (ENS, EOA address) |
| Reputation query | `{ count: 0 }` hardcoded | Query ERC-8004 registry for prior agreement history |
| Vault funding | `testClient.setBalance()` (Anvil cheat) | Real ETH deposit via `temptation.deposit()` |
| USDC balances | `testClient.setStorageAt()` (Anvil cheat) | Real USDC from faucet/transfer |
| ~~Bonfires receipts~~ | ~~Not implemented~~ | **DONE** — tweet proxy → Bonfires episodes, sync service, adjudicator cross-tier queries |
| Network | Anvil fork (local) | Base Sepolia or mainnet |

Anvil cheats (setBalance, setStorageAt) are inherent to local testing and go away on real network deployment.

### DONE (day 4 — March 19)

**Viz suite — Leaderboard + Story:**
- New `index.html` leaderboard: stats, sortable table, game/tweet feeds, live mode polling Ponder + tweet proxy + vault RPC
- Story: 2 new scenes (mechanism template library, "What Else Is Possible?"), expanded zone cards, GenLayer note
- Shared nav header across all 3 pages
- `serve.ts` routing: `/` → leaderboard, `/dashboard`, `/story`

**Dashboard enhancements:**
- Basescan links for agreements, zones, agents, tx hashes throughout
- X.com links for tweets, AgentProof.sh links for agentId
- Actor section in zone cards (agent address + agentId linked to AgentProof)
- Slashable Stake with SLASHED pill on adjudication (violator only)
- Data API access event logged
- Selective zone deactivation note in event log

**Ponder txHash indexing:**
- Added `txHash` field to proposal, trustZone, claim, reputationFeedback schemas
- 4 handlers now store `event.log.transactionHash`
- Dashboard queries and renders tx links from Ponder in live mode

**x402 MCP server** (`packages/x402-service/`):
- MCP server (not Express) wrapping compiler + SDK via `@x402/mcp`
- 7 tools: compile, decompile, encode, decode_event, graphql, explain, ping
- x402 payment gating toggleable via `REQUIRE_PAYMENT` env var
- 22 unit tests passing
- Verified working via MCP Inspector

**Skills** (`packages/skill/`):
- `trust-zones/SKILL.md` — protocol skill: MCP server tools, mechanism templates, example flows
- `temptation-game/SKILL.md` — game skill: how to enter, requirements, rules, links

**Staking categorization fix:**
- Staking is Incentive (paramType Penalty), not Qualification — fixed across story, skill, x402 spec

### DONE (day 4 continued — March 19-20): Bonfires

**Bonfires integration** (`packages/bonfires/`):
- Bonfire provisioned: `trust-zone-agreements` (slug: `trust-zones`), API key in root `.env`
- `BonfiresClient`: HTTP wrapper with `X-Bonfire-Id` + `X-Agent-Id` headers, all endpoints (entity, edge, episode, delve, expand, agents)
- `UuidRegistry`: entity name→UUID map + edge dedup set, persisted to `.bonfires-uuids.json`, concurrent-safe via in-flight dedup
- **Sync service** (`src/sync/`): Ponder GraphQL → Bonfires knowledge graph
  - Incremental diff: only syncs agreements with changes (new entities, state transitions, claims, feedback)
  - Parallel entity/edge creation within each tier
  - Edge dedup: tracks created edges, skips re-posting
  - 14 entity builders, 18 edge builders, 5 episode builders
  - No `entity_types` on episodes (prevents Graphiti auto-extraction noise)
- **Receipt logging** (`src/receipts/`): `createReceiptLogger()` for tweet proxy — direct push to Bonfires episodes
- **Adjudicator queries** (`src/queries/`): `getAdjudicationContext()` — parallel `/delve` for tweet receipts, directives, evidence
- **Wired into tests**: all 3 E2E tests (reciprocal-demo, reputation-game, sync-timing) start sync service + receipt logger when `BONFIRES_*` env vars present
- data-apis deprecated from scope — receipt logging via tweet proxy only

### DONE (day 5 — March 20): Integration + Agent Tooling

**Full integration test** (`test/sync-timing.test.ts`):
- `TrustZonesAgent` class as the temptee — uses same code paths as MCP tools + CLI
- Real tweets posted to X via `@tempt_game_bot` (real `TweetProxy` with `REAL_TWEETS=1`)
- Real LLM evaluation via `claude -p` (both counterparty tweet eval + adjudicator verdict)
- Real Bonfires sync running alongside, receipt logging on each tweet
- Production `startCounterparty()` autonomously detects vault + tweet violations, files claims
- Production `startAdjudicator()` autonomously finds claims, queries Bonfires for cross-tier evidence, evaluates via LLM, submits verdict onchain
- `staking_info` MCP tool used to discover eligibility module by agent address
- Full cross-tier receipt flow verified: tweet proxy → Bonfires episode → adjudicator `/delve` query → LLM prompt
- Realistic agent-speed delays (3-5s between beats)

**TrustZonesAgent** (`packages/agents/src/tz-agent/`):
- Reference implementation for external agents participating in Trust Zones agreements
- Methods mirror public interfaces: createAgreement, accept, setUp, stake, activate, complete, discoverZone, postTweet, executeViaZone
- ERC-8128 signing with automatic HatValidator lookup + keyid fallback
- Each method comments which tool it corresponds to (MCP or CLI)
- Future: swap deterministic calls for LLM-driven tool use via skills

**CLI** (`packages/cli/`):
- `tz sign-http` — ERC-8128 zone auth (reads HatValidator from chain, prefixes signature for ERC-7579 routing)
- `tz prepare-tx` — zone execution calldata preparation (returns `{ to, data, value }` for any wallet)
- Available as `tz` (alias) or `trust-zones`

**x402 MCP server updates:**
- New `staking_info` tool: finds eligibility module by agreement + agent address (queries Ponder + onchain)
- `graphql` tool reads PONDER_URL at call time (not import time)
- 8 tools total: compile, decompile, encode, decode_event, graphql, explain, staking_info, ping

**Skills updated:**
- `temptation-game/SKILL.md` — full agent journey: install trust-zones skill → propose → read terms → accept → find zone → stake → activate → tweet → complete. Staking instructions with both manual contract calls and MCP tool convenience.
- `trust-zones/SKILL.md` — two-layer tooling: remote MCP server (paid, protocol knowledge) + local CLI (free, signing + zone execution). Install via `npm install -g @trust-zones/cli`.

**Integration bugs fixed:**
- BonfiresClient: entity response `{ uuid }` not `{ entity: { uuid } }`, edge response `{ edge_uuid }` not `{ edge: { uuid } }`
- Ponder GraphQL: `$party` variable declared but unused, `verdict_is_null` not valid (filter in JS instead)
- `agreement.adjudicator` field never populated by Ponder handlers — adjudicator query now falls back to latest proposal's adjudicator
- Counterparty `lastCheckedBlock` initialized from current block (was 0, tried to scan 43M blocks)
- Adjudicator evidence: hex-decode claim evidence, parse both `withdrawal` (single) and `vaultEvents` (array) formats
- `startAdjudicator()` accepts injectable `GenerateObjectFn` (decouples from AI SDK)
- `startCounterparty()` accepts injectable `EvaluateTweetsFn`
- `createZoneSignerClient` now async — reads `hatValidator()` from zone contract automatically

**ERC-8128 auth on zone smart accounts:**
- Root cause diagnosed: OZ `AccountERC7579.isValidSignature` expects signature prefixed with validator module address (first 20 bytes)
- Fix implemented: `createZoneSignerClient` and CLI `sign-http` read zone's HatValidator address from chain and prefix signatures automatically
- `HatValidator.isValidSignatureWithSender` already implements ERC-1271 correctly (recovers signer, checks `isWearerOfHat`)
- **Not yet tested end-to-end** — tweet proxy ERC-8128 verification path needs validation with the prefixed signature
- Tweet proxy falls back to `keyid` header auth when ERC-8128 fails

### Remaining (day 5): Live Demo

**Live demo setup:**
- Test ERC-8128 with prefixed signature end-to-end
- Deploy contracts to Base (mainnet or Sepolia)
- Deploy counterparty agent + adjudicator to Railway
- Fund Temptation contract with real ETH (via `deposit()`)
- Test live: external agent proposes, full flow
- Write up "how to interact" instructions
- Clear stale data from Bonfires bonfire (Bonfires team)

### Day 6 (March 21): Demo Video + Submission Prep

**Demo video (recorded, reciprocal):**
- Script the reputation game flow
- Real deployments, real tweets from @tempt_game_bot, real artifacts
- Narrated walkthrough
- Show: negotiation, 8128 auth, compliant tweet, constraint (Temptation reverts), directive violation, claim, LLM adjudication, 8004 feedback

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
  → Temptation + Agents + E2E integration (DONE)
    → Tweet Proxy + Adjudicator + Counterparty LLM (DONE)
      → ERC-8128 + Zone execution + Tweet eval beats (DONE)
        → Bonfires + Integration polish (DONE)
          → Full integration with production agents + TrustZonesAgent + CLI (DONE)
            → Live Demo + ERC-8128 e2e verification (day 5)
              → Demo Video + Submission (day 6-7)
```

## Cut lines (if behind)

| If behind by... | Cut | Impact |
|-----------------|-----|--------|
| Day 4 | Bonfires | Adjudicator reads Ponder directly. Lose cross-tier evidence queries. |
| Day 5 | Live interactive demo | Recorded demo only. Still compelling but not interactive. |
| Day 5 | Reciprocal demo (Zone B) | Single zone only. Lose mutual delegation narrative. |

## Stretch

| Item | Description |
|------|-------------|
| Selective zone deactivation on close | Currently `_deactivateZoneHats()` deactivates ALL zone hats on agreement close, including the non-violating party. Make close logic configurable: on ADJUDICATED outcome, only deactivate the violating party's zone. Requires changes in Agreement.sol (`_close` / `_deactivateZoneHats`), adjudicator action types (new `DEACTIVATE_PARTY` action), Ponder handler, SDK, and dashboard rendering. |

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
| Original demo | Deferred | `deferred/demo.md` |
| Original agents | Deferred | `deferred/agents.md` |
