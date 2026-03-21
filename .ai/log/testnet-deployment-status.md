# Testnet Deployment & E2E Status

**Date:** 2026-03-21 (day 6)

## What's working

### Base Sepolia deployment
- All contracts deployed via `DeployAll.s.sol` (reads chain config from `script/chains.json`)
- Temptation vault deployed as part of DeployAll (USDC-based, not ETH)
- 3 agent keypairs generated, funded with ETH, registered on ERC-8004 identity registry
- Vault funded with 10 USDC (deployer approved + deposited)
- `pnpm test:e2e:sepolia` script runs the test from any directory

### Base Sepolia test run (passed once)
Full lifecycle completed in 62s:
- PROPOSED → NEGOTIATING → ACCEPTED → READY → staked → ACTIVE
- Tweets posted (mock proxy with ERC-8128 auth)
- Vault withdrawal (violation)
- Counterparty agent detected violation, filed claim
- Adjudicator agent evaluated, closed agreement
- Reputation feedback written to ERC-8004 with value=-1, tag="ADJUDICATED"
- Feedback content: `{"outcome":"FAILED","agreement":"0x...","claimId":1,"violatedDirectives":[],"unfulfilledResponsibilities":[]}`

### Anvil test
Was passing before the 1-zone + USDC vault changes. Now broken (see blockers below).

## Current blockers

### 1. Adjudicator can't find directives (1-zone bug)

**Root cause:** `getAgreementState()` returns `trustZones: [Address, Address]` as a fixed 2-tuple. With 1 zone, the second entry is `0x0000000000000000000000000000000000000000`. The adjudicator iterates both zones and tries `getZoneDetails("0x0000...")` which fails — Ponder has no zone at the zero address.

**Fix applied (in `packages/agents/src/adjudicator/index.ts`):**
```typescript
const zones = state.trustZones.filter((tz) => tz !== "0x0000000000000000000000000000000000000000");
```

Also added: skip claim if directives AND responsibilities are empty (will retry next tick). This prevents adjudicating without knowing the rules.

**Status:** Fix applied but not yet verified — the Anvil test keeps timing out and I haven't gotten a clean run yet.

### 2. Empty violatedDirectives in feedback

The feedback content has `"violatedDirectives":[]` even though the mock LLM returns `violatedDirectives: [4]`. This is because:
- The adjudicator fetches zone details to build the `FeedbackContext` with directive tokenIds
- When the zero-address bug caused the fetch to fail, `feedbackCtx.directives` was empty
- `mapVerdictToActions` couldn't map index 4 to a token ID → filtered out → empty array

This should be fixed by fix #1 above — once directives are fetched correctly, the token ID mapping will work.

### 3. Staking race condition on Base Sepolia

The temptee's `approve` tx confirms but the staking module's `stake()` call sometimes reverts with "ERC20: transfer amount exceeds allowance". This is an RPC state propagation issue on Base Sepolia — the approve state isn't visible to the next RPC call immediately.

**Workaround applied:** `confirmations: 2` on the approve receipt wait in `TrustZonesAgent.stake()`.

Similarly, `NotEligible` on activate after staking — the staking module sees the stake but Hats doesn't see eligibility yet.

**Workaround applied:** Poll `getWearerStatus()` before calling activate (only on non-local networks).

### 4. Vault balance check too strict

`ensureVault()` checks `balance >= VAULT_FUND` but the vault depletes across test runs. Changed to `balance >= VAULT_FUND / 2n`.

### 5. Testnet USDC conservation

Added `scale` factor: `chain.isLocal ? 1n : 10n` — testnet uses 10x smaller amounts (0.1 USDC stake, 0.115 USDC withdrawal limit, 1 USDC vault fund).

## Changes made this session

### Contract changes
- **Agreement.sol:** Allow 1-2 zones (was exactly 2). Setup loops over `data.zones.length`. Activate skips zeroed zones.
- **Agreement.sol:** Reputation feedback: value=+1 for COMPLETED, -1 for ADJUDICATED (FEEDBACK action), 0 for EXITED/EXPIRED. Skip `_writeReputationFeedback` entirely for ADJUDICATED.
- **Temptation.sol:** ETH → ERC-20 (USDC). Constructor takes `(registry, token)`.
- **DeployAll.s.sol:** Reads chain config from `chains.json`. Deploys Temptation vault. Outputs keyed by chainId.
- **All Foundry tests:** Updated for 1-zone, USDC vault, reputation value changes. 384/384 passing.

### Ponder changes
- **Schema:** Added `value` column to `reputationFeedback`. Changed ID to include `logIndex`.
- **Handler:** Infers value from tag. Filters by `agreement.state === "ACTIVE"` for unadjudicated claims.

### E2E / agent changes
- **constants.ts:** Chain-aware config (`getChainConfig`). Supports Anvil, Base, Base Sepolia.
- **deploy.ts:** `readDeployments(chainId)` for pre-deployed contracts.
- **sync-timing.test.ts:** Supports both Anvil and Sepolia via `CHAIN_ID` env var. Reads agent keys from `.env.agents`. Testnet USDC scaling.
- **reputation-game-scenario.ts:** 1-zone builders (no counterparty zone). USDC amounts. Withdrawal limit formula fixed (no more ETH/USDC mixing).
- **agents/shared/chain.ts:** `chainId` parameter for Sepolia support.
- **agents/adjudicator:** Filter ACTIVE-only claims. Filter zero-address zones. Skip if no directives (retry next tick).
- **agents/counterparty, adjudicator configs:** Added `chainId` parameter.
- **TrustZonesAgent:** Chain-aware (`chainId` in config). `confirmations: 2` on approve.

### Infra
- `scripts/generate-agent-keys.sh` — generates 3 keypairs to `.env.agents`
- `script/chains.json` — chain-specific addresses (8004 registries, USDC)
- `pnpm test:e2e:sepolia` — root script for Sepolia test runs
- Deployer, agent accounts funded on Base Sepolia

## Agent addresses (Base Sepolia)

| Role | Address | agentId |
|------|---------|---------|
| Deployer | 0xd2f8D13dd5DD07a839804ca23Ef0025013229d74 | — |
| Temptee | 0x7e2D979413f72FaAE6Ee1f31a6CEe7c99b3B4CDa | 2351 |
| Counterparty | 0x04de2b59872646C06B3EEc9E08689EFF666688d1 | 2352 |
| Adjudicator | 0x89FCa6887935b722b524Ba16A213297Ab804B221 | 2353 |

## Key deployed addresses (Base Sepolia, latest deploy)

See `packages/contracts/deployments.json` key `"84532"`.

## Next steps

1. Verify Anvil test passes with the zero-address filter fix
2. Re-run Sepolia test to verify feedback includes directive token IDs
3. Consider persisting Ponder data between test runs to avoid reindexing
4. Port changes to other e2e tests (reputation-game, lifecycle, reciprocal-demo)
5. Redeploy to Sepolia after contract changes are finalized
