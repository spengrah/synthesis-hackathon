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

**Test counts**: 364 contracts + 56 SDK + 23 compiler + 36 ponder + 26 agents + 13 lifecycle E2E + 15 reputation game E2E = **533 tests passing**

---

## Remaining work

### E2E gaps (things still mocked or not exercised)

| Gap | Current state | Fix |
|-----|---------------|-----|
| agentId | Hardcoded `0` | Use unique ID per agent (ENS, EOA address) |
| Reputation query | `{ count: 0 }` hardcoded | Query ERC-8004 registry for prior agreement history |
| Vault funding | `testClient.setBalance()` (Anvil cheat) | Real ETH deposit via `temptation.deposit()` |
| USDC balances | `testClient.setStorageAt()` (Anvil cheat) | Real USDC from faucet/transfer |
| Bonfires receipts | Not implemented | Tweet proxy + data API → Bonfires episodes |
| Network | Anvil fork (local) | Base Sepolia or mainnet |

Anvil cheats (setBalance, setStorageAt) are inherent to local testing and go away on real network deployment.

### Day 4 (March 19): Bonfires + Integration polish

**Bonfires integration:**
- Bonfires team provisions bonfire, provides API key
- `packages/bonfires-client/`: shared client for entities, edges, episodes, delve
- Ponder → Bonfires sync service
- Receipt logging: tweet proxy + data API → Bonfires episodes
- Adjudicator queries: `/delve` for claim context
- See `context-graph.md` for schema + API mapping
- ~4-5h

### Day 5 (March 20): Integration + Live Demo

**Integration testing:**
- Full reputation game flow with all real components (8128, Bonfires, LLM adjudicator + counterparty, real tweets)
- Fix integration issues
- Receipt flow: tweet proxy → Bonfires → adjudicator queries → verdict

**Live demo setup:**
- Deploy contracts to Base (mainnet or Sepolia)
- Deploy counterparty agent + adjudicator to Railway
- Fund Temptation contract with real ETH (via `deposit()`)
- Test live: external agent proposes, full flow
- Write up "how to interact" instructions

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
        → Bonfires + Integration polish (day 4)
          → Integration + Live Demo (day 5)
            → Demo Video + Submission (day 6-7)
```

## Cut lines (if behind)

| If behind by... | Cut | Impact |
|-----------------|-----|--------|
| Day 4 | Bonfires | Adjudicator reads Ponder directly. Lose cross-tier evidence queries. |
| Day 5 | Live interactive demo | Recorded demo only. Still compelling but not interactive. |
| Day 5 | Reciprocal demo (Zone B) | Single zone only. Lose mutual delegation narrative. |

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
