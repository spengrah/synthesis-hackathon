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

## Mechanisms per zone

Each zone has mechanisms of all three types, configured as negotiated terms:

- **ELIGIBILITY**: Staking module (bond requirement) + 8004 reputation check
- **INCENTIVE**: Bond slash parameters, 8004 reputation feedback on close
- **CONSTRAINT**: ERC-7579 hooks (target allowlist, rate limit enforcement)

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
- Both agents deposit ETH bonds (via staking ELIGIBILITY module)
- Zone hats created with chained eligibility (staking + 8004 reputation)
- Zone hats minted to agents (both agents' `agentId` verified against 8004 IdentityRegistry)
- TZ Accounts deployed (ERC-1167 clones)
- Modules installed (HatValidator, agreement executor, HookMultiPlexer)
- CONSTRAINT mechanisms installed as ERC-7579 hooks
- INCENTIVE mechanisms registered in claimable mechanism registry
- Resource tokens minted to each TZ account:
  - TZ Account 1 (B's zone): permission tokens for A's endpoints + directive tokens
  - TZ Account 2 (A's zone): permission tokens for B's endpoints + directive tokens
- State: ACTIVE

### 3. HAPPY PATH
Both agents access each other's data:
- Agent B calls A's API as TZ Account 1 (ERC-8128 offchain "act as")
- Agent A calls B's API as TZ Account 2 (same)
- Data APIs validate ERC-8128 signatures via `isValidSignature()` on TZ accounts
- Data APIs check permission token holdings in ResourceTokenRegistry
- Data APIs enforce directive rate limits locally
- Action receipts logged to Bonfires context graph as episodes (Tier 2)

### 4. CONSTRAINT FIRES
Agent B tries to access /raw-export on A's API (not in permission tokens).
→ A's data API checks: does TZ Account 1 hold a permission token for /raw-export? No.
→ Request denied. Receipt logged to Bonfires (attempted access, denied).
→ "Deterministic enforcement."

### 5. DIRECTIVE VIOLATION + CLAIM
Agent A queries Bonfires context graph (`/delve`) for B's action receipts on Zone 1.
- Finds 47 /market-data requests in 2 hours (directive token: rateLimit=10/hr)
- Finds B's derived outputs lack attribution (directive token: attribution=required)
- Logs belief about violation to agent-local Bonfires stack (Tier 3)
- Discloses evidence to shared Bonfires bonfire (Tier 3 → Tier 2)

Agent A files: `submitInput(CLAIM, abi.encode(mechanismIndex, evidence))`
- References the INCENTIVE mechanism (bond slash) for Zone 1
- State stays ACTIVE — claim is logged, adjudicator is notified

### 6. ADJUDICATION
Adjudicator (registered as Bonfires agent) queries the context graph:
- `/delve` for directive tokens + metadata (the rules)
- `/delve` for action receipts in the relevant time window (what happened)
- `/knowledge_graph/expand/entity` for agreement structure and zone config
- Evaluates: rate limit violation (moderate), attribution violation (minor)

Adjudicator delivers: `submitInput(ADJUDICATE, abi.encode(claimId, verdict, actions))`
- actions: SLASH 35% of B's bond + CLOSE agreement

### 7. RESOLUTION + CLOSE
Agreement executes adjudication actions:
- 35% of B's bond slashed via staking module
- Agreement transitions to CLOSED with outcome `ADJUDICATED`
- Zone hats deactivated via `HATS.setHatStatus(hatId, false)`
- Resource tokens burned from TZ accounts
- 8004 reputation feedback written for both parties:
  - B: tagged `trust-zone-agreement` / `ADJUDICATED`, referencing the agreement
  - A: tagged `trust-zone-agreement` / `ADJUDICATED`, referencing the agreement

### 8. ASYMMETRIC TRUST UPDATE
- B's 8004 record now shows an `ADJUDICATED` agreement (downstream consumers see this)
- A's 8004 record shows the same agreement but as the non-at-fault party
- Downstream consumers form their own assessment of each agent's trustworthiness
- The asymmetry is in the agreement details, not in a single score

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
