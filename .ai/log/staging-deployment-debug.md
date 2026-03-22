# Staging Deployment Debug Log

**Date:** 2026-03-21 (day 6, evening)

## Goal

Deploy all services to Railway (Base Sepolia staging), run temptation game e2e test against deployed services with real LLM-driven agents.

## Services Deployed

6 Railway services in `staging` environment:
- **Ponder** (GraphQL indexer) — https://ponder-staging-e981.up.railway.app
- **Tweet Proxy** (ERC-8128 auth, posts to X) — https://tweet-proxy-staging.up.railway.app
- **Viz** (dashboard) — https://viz-staging.up.railway.app
- **Adjudicator Agent** (Venice LLM, minimax-m25)
- **Counterparty Agent** (Venice LLM, minimax-m25)
- **Bonfires Sync** (Ponder → Bonfires knowledge graph)

## Issues Found & Fixed

### 1. Ponder crash-looping on public RPC
**Symptom:** `IgnorableError: Fatal error: Unable to sync`
**Cause:** Base Sepolia public RPC (`sepolia.base.org`) rate-limits Ponder's historical sync
**Fix:** Switch to Alchemy RPC for Ponder

### 2. Ponder indexing old agreements
**Symptom:** `agreement.update()` fails for old agreements, `UniqueConstraintError`
**Cause:** `PONDER_START_BLOCK` too far back, picks up old test agreements
**Fix:** Set `PONDER_START_BLOCK` to near-current block before each test run

### 3. Node 18 on Railway
**Symptom:** `import.meta.dirname` undefined
**Fix:** Added `.node-version` file with `20`

### 4. SDK not built
**Symptom:** `ERR_MODULE_NOT_FOUND: @trust-zones/sdk/dist/index.js`
**Fix:** Added `pnpm build:sdk && pnpm build:compiler` to Railway build command

### 5. Production environment competing with staging
**Symptom:** Counter-proposals using mainnet USDC despite staging having correct address
**Cause:** Railway `production` environment had same agent keys, both environments watching same chain
**Fix:** Removed production worker deployments, kept staging only

### 6. USDC address wrong in staking modules
**Symptom:** `StakingEligibility.TOKEN()` returns mainnet USDC on Sepolia
**Cause:** Counterparty agent's `negotiate.ts` hardcoded Base mainnet USDC
**Fix:** Accept `usdc` parameter from config, pass `USDC_ADDRESS` env var

### 7. Alchemy RPC URL had extra quotes
**Symptom:** `SyntaxError: Unexpected token M in JSON at position 0`
**Cause:** Shell escaping added quotes around Alchemy API key in Railway env var
**Fix:** Strip quotes from env var value

### 8. Internal networking timeout
**Symptom:** `ConnectTimeoutError: Connect Timeout Error (ponder-staging-e981.up.railway.app:443)`
**Cause:** Workers using public URL instead of Railway internal networking
**Fix:** Set `PONDER_URL=http://ponder.railway.internal:8080/graphql` on worker services

### 9. Venice LLM doesn't support structured output
**Symptom:** `response_format is not supported by this model`
**Cause:** `generateObject` with `mode: "json"` sends `response_format: { type: "json_object" }` which Venice rejects
**Fix:** Fallback to `generateText` + manual JSON parsing when `generateObject` fails

### 10. LLM returning absurd stake amounts
**Symptom:** `minStake=100000000` (100 USDC) — far more than agent has
**Cause:** LLM not constrained to reasonable values
**Fix:** Cap stake to 1 USDC, withdrawal to 2 USDC in counterparty logic

### 11. Tweet proxy muzzled by X
**Symptom:** `Request failed with code 401` from Twitter API
**Cause:** X developer app flagged for spam-like behavior (automated test tweets)
**Fix:** Use MockTweetProxy locally for now; working on unmuzzling

### 12. Missing CLOSE action in adjudication (CURRENT BLOCKER)
**Symptom:** `submitInput` reverts — adjudicator sends FEEDBACK without CLOSE
**Cause:** LLM returns `actions: []` (empty), `mapVerdictToActions` only generates FEEDBACK from feedbackCtx
**Fix:** Always include CLOSE when `verdict.violated` is true
**Status:** Fix deployed, awaiting clean test run

## What Works End-to-End

Beats 1-6 pass consistently against deployed staging services:
1. Temptee proposes bare agreement (local)
2. **Deployed counterparty** evaluates via LLM, counter-proposes (Venice minimax-m25)
3. Temptee accepts, sets up, stakes, activates
4. Temptee tweets (mock proxy) and withdraws from vault
5. **Deployed counterparty** detects violation via Ponder, files claim
6. (**Deployed adjudicator** finds claim, evaluates via LLM — fix for CLOSE action just deployed)

## Remaining

- Beat 7: Verify adjudicator CLOSE+FEEDBACK tx succeeds with the fix
- Beat 8: Verify reputation feedback appears in Ponder
- Unmuzzle Twitter app for real tweet posting
- Full reciprocal demo test against staging
