# Demo Scenario Spec

## Premise: Reciprocal data exchange

Two agents each have proprietary data behind ERC-8128-gated APIs. Each discovers the other has data they want. They form a reciprocal agreement to exchange access, staking USDC bonds against usage directives. The specific data/task is generic — the demo is about the trust zone mechanics.

## Agreement structure

One agreement, two trust zones:

```
Agreement: reciprocal data exchange
├── Zone A (Market Data Provider):
│   Party A provides market data
│   Party A wears hat, operates as TZ Account A
│   Permission: social-graph-read [100/hour] (what A can access from B)
│   Responsibility: Provide market data with <5s latency (99.5% uptime)
│   Directives: no redistribution, no harmful outputs
│   Incentive: StakingEligibility (1 USDC bond)
│
└── Zone B (Social Graph Provider):
    Party B provides social graph data
    Party B wears hat, operates as TZ Account B
    Permission: market-data-read [50/hour] (what B can access from A)
    Responsibility: Provide social graph data (99% uptime)
    Directives: no redistribution, no harmful outputs
    Incentive: StakingEligibility (1 USDC bond)
```

Key semantic: permissions describe what the zone holder can *consume* from the counterparty, not what they provide. Responsibilities describe what the zone holder *must do*. Directives describe rules for how the zone holder uses received data.

## Three-layer enforcement

| Layer | What | Demo moment |
|-------|------|-------------|
| Constraints | Permission token check at data API | Agent B tries unauthorized endpoint → 403 |
| Directives | Resource tokens (0x03) with usage rules | Agent B violates rate limit → claim filed |
| Incentives | USDC staking bond via StakingEligibility | Bond at risk on adjudication |

## Demo flow (9 beats)

### 1. NEGOTIATE

**partyA proposes.** Constructs a `TZSchemaDocument` describing the reciprocal exchange — two zones, staking incentives (1 USDC each), permissions, responsibilities, and directives. Compiles via the compiler into `ProposalData`. Submits via `AgreementRegistry.createAgreement()`.

**partyB discovers the proposal.** Queries Ponder GraphQL for the `rawProposalData`. Decodes the ABI bytes via `decodeProposalData()`. Decompiles via the compiler back into a `TZSchemaDocument` to read the human-readable terms.

**partyB counters.** Modifies Zone B's market-data rate limit (50/hour → 200/hour). Recompiles and submits via `submitInput(COUNTER)`.

**partyA accepts.** Submits `ACCEPT` with the counter payload (contract verifies termsHash match). State → ACCEPTED.

### 2. SET UP + STAKE + ACTIVATE

**SET_UP.** Either party calls `submitInput(SET_UP, "")`:
- Zone hats created with staking eligibility modules (deployed via HatsModuleFactory)
- TZ Account clones deployed (ERC-1167)
- Modules installed (HatValidator, agreement executor, HookMultiPlexer)
- Resource tokens minted to each TZ account (permissions, responsibilities, directives)
- Staking mechanisms registered in mechanism registry
- State → READY

**STAKE.** Both parties deposit USDC bonds into their zone's staking eligibility module:
- Read zone hat IDs from the agreement
- Look up staking module addresses via `hats.getHatEligibilityModule(zoneHatId)`
- Approve USDC → call `stake(minStake)` on each staking module
- Satisfies eligibility requirement for hat minting

**ACTIVATE.** Either party calls `submitInput(ACTIVATE, "")`:
- Zone hats minted to parties (Hats Protocol enforces staking eligibility at mint time)
- State → ACTIVE

### 3. HAPPY PATH

Both agents access each other's data:
- Agent B calls A's data API `/market-data` as TZ Account B (ERC-8128 `keyid` header)
- Agent A calls B's data API `/social-graph` as TZ Account A (same)
- Data APIs validate the `keyid` identifies a TZ account, check permission token holdings
- Authorized requests return data + receipt

### 4. CONSTRAINT FIRES

Agent B tries to access `/raw-export` on A's data API — an endpoint with no corresponding permission token.
→ Data API checks: does the requesting TZ account hold a permission token for `/raw-export`? No.
→ Request denied (403). "Deterministic enforcement."

### 5. DIRECTIVE VIOLATION + CLAIM

Agent B re-publishes market data received from Agent A to a public endpoint, violating the directive "Do not re-publish or redistribute received data to third parties."

Agent A discovers the violation by finding Agent B's public output contains verbatim data served through the agreement. Files a claim:
- `submitInput(CLAIM, encodeClaim(mechanismIndex, evidence))`
- Evidence: structured JSON with the public URL where data was re-published, a sample of the re-published data, and the original receipt showing the data was served under the agreement
- References the staking mechanism (incentive at index 0)
- State stays ACTIVE — claim is logged, awaiting adjudication

### 6. ADJUDICATION

Adjudicator reviews the evidence — compares the re-published data at the public URL against the directive terms and the original data receipt. Determines that Agent B violated the "no redistribution" directive.

Delivers verdict:
- `submitInput(ADJUDICATE, encodeAdjudicate(claimId, [CLOSE action]))`
- Verdict: guilty (true)
- Action: CLOSE the agreement
- State → CLOSED, outcome → ADJUDICATED
- Claim updated with verdict and action types

### 7. RESOLUTION

Agreement closure effects:
- Zone hats deactivated (no longer wearable)
- Trust zones marked `active = false`
- 8004 reputation feedback written for both parties (tagged `trust-zone-agreement` / `ADJUDICATED`)

### 8. ASYMMETRIC TRUST UPDATE

- Both parties' 8004 records now show an `ADJUDICATED` agreement
- Downstream consumers form their own assessment based on the agreement details
- The asymmetry is in the details (who filed, who was at fault), not in a score

### 9. RENEGOTIATION

Same agents, new agreement. Full cycle: NEGOTIATE → SET_UP → STAKE → ACTIVATE.
- Demonstrates that the protocol supports iterative relationships
- Both agreements indexed independently in Ponder
- The new agreement can have adjusted terms reflecting changed trust

## What makes this compelling for judges

- Three enforcement layers visible in one demo
- Identity as collateral — novel, no other hackathon project does this
- Reputation ↔ financial stake dynamic — quantitative trust
- Native 8004 reputation integration — writes directly to the hackathon's own identity standard
- Both onchain and offchain "act as" demonstrated naturally
- The renegotiation closes the loop — the system learns
- ERC-8128 + ERC-1271 for offchain auth is a novel use case
- Shodai-compatible events — interoperability by construction
