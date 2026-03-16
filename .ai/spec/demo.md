# Demo Scenario Spec

## Premise: Reciprocal data exchange

Two agents each have proprietary data behind ERC-8128-gated APIs. Each discovers the other has data they want. They form a reciprocal agreement to exchange access, staking bonds + 8004 identity against usage directives. The specific data/task is generic — the demo is about the trust zone mechanics.

## Agreement structure

One agreement, two trust zones:

```
Agreement: reciprocal data exchange
├── Zone 1 (A→B): A's data API exposed to B
│   Agent B wears hat, operates as TZ Account 1
│   Resource tokens: permissions for A's endpoints, directives for usage rules
└── Zone 2 (B→A): B's data API exposed to A
    Agent A wears hat, operates as TZ Account 2
    Resource tokens: permissions for B's endpoints, directives for usage rules
```

## Three-layer enforcement

| Layer | What | Demo moment |
|-------|------|-------------|
| Constraints | ERC-7579 hooks (target allowlist, rate limits) | Agent B tries unauthorized endpoint → blocked |
| Directives | Resource tokens (0x03) with usage rules | Agent B violates rate limit/attribution rules → dispute |
| Incentives | Bond + 8004 stake | Bond slashed + negative reputation on resolution |

## Trust level model

```
trustLevel = financialStake + reputationValue(8004Score)
requiredTrustLevel = f(resourcesAtRisk)
```

Enforced via Hats eligibility module chaining: existing staking module + new 8004 reputation module. Both thresholds are negotiated terms. The inverse relationship between reputation and bond emerges from negotiation.

## Incentive mechanisms

- **Slashable bond**: each agent deposits ETH. Returned on completion. Slashed on adverse resolution.
- **8004 identity stake**: each agent transfers their 8004 NFT to agreement contract. Returned on completion. On adverse resolution: returned + negative reputation via `giveFeedback()`.
- **Payment escrow** (optional): principal deposits USDC for agent. Released on completion.

## Demo flow (9 beats)

### 1. NEGOTIATE
Agent A proposes terms (via compiler → deployment bytes → submitInput):
- Zone 1 (A→B): expose /market-data, /sentiment-analysis. Directives: rate limit 10/hr, must attribute, no redistribution.
- Zone 2 (B→A): expose /social-graph, /trend-signals. Directives: no model training, no caching >24hr.
- Trust level requirement: 100 units per zone.
- Agent B's reputation covers 70 → needs 0.003 ETH bond.
- Agent A's reputation covers 60 → needs 0.004 ETH bond.

Agent B counters with modified terms. Agent A accepts.

### 2. STAKE + ACTIVATE
`acceptAndActivate()`:
- Both agents deposit ETH bonds
- Both agents transfer 8004 NFTs to agreement contract
- Zone hats created and minted
- TZ Accounts deployed (ERC-1167 clones)
- Modules installed (HatValidator, agreement executor, HookMultiPlexer)
- Resource tokens minted/transferred to each TZ account:
  - TZ Account 1 (B's zone): permission tokens for A's endpoints + directive tokens
  - TZ Account 2 (A's zone): permission tokens for B's endpoints + directive tokens
- State: ACTIVE

### 3. HAPPY PATH
Both agents access each other's data:
- Agent B calls A's API as TZ Account 1 (ERC-8128 offchain "act as")
- Agent A calls B's API as TZ Account 2 (same)
- Action receipts logged: Tier 1 (onchain events) + Tier 2 (ERC-8128 signed requests)

### 4. CONSTRAINT FIRES
Agent B tries to access /raw-export on A's API (not in permission tokens).
→ A's API checks: does TZ Account 1 hold a permission token for /raw-export? No.
→ Request denied. "Deterministic enforcement."

### 5. DIRECTIVE VIOLATION + DISPUTE
Agent A reviews B's access receipts from Tier 2.
- B queried /market-data 47 times in 2 hours (directive token: rateLimit=10/hr)
- B's derived outputs lack attribution (directive token: attribution=required)

Agent A files: `submitInput(DISPUTE, {tokenRefs, claim, evidenceRefs})`

### 6. ADJUDICATION
GenLayer reads from chain:
- Directive tokens + metadata (the rules)
- Action receipts (what happened)
- Evaluates: rate limit violation (moderate), attribution violation (minor)
- Returns: verdict + 35% severity

### 7. RESOLUTION
- 35% of B's bond slashed
- Agreement contract calls `ERC8004ReputationRegistry.giveFeedback()` on B's identity
- B's 8004 NFT returned (moderate severity — not burned)
- A's bond returned in full, reputation untouched
- Zone hats deactivated
- State: RESOLVED

### 8. ASYMMETRIC TRUST UPDATE
- A's trust in B dropped (visible in 8004 reputation registry)
- B's trust in A unchanged
- Trust beliefs updated in Tier 3

### 9. RENEGOTIATION (the money shot)
Same agents, new agreement.
- Zone 1 (A→B): trust level requirement still 100 units. B's reputation now covers 50 (was 70). B needs 0.005 ETH bond (was 0.003). Fewer endpoints exposed. Stricter rate limits.
- Zone 2 (B→A): A's terms unchanged (reputation intact, same bond).
- The asymmetry is visible. The system learned differently about each party.

## What makes this compelling for judges

- Three enforcement layers visible in one demo
- Identity as collateral — novel, no other hackathon project does this
- Reputation ↔ financial stake dynamic — quantitative trust
- Native 8004 reputation integration — writes directly to the hackathon's own identity standard
- Both onchain and offchain "act as" demonstrated naturally
- The renegotiation closes the loop — the system learns
- ERC-8128 + ERC-1271 for offchain auth is a novel use case
- Shodai-compatible events — interoperability by construction
