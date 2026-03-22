# Hats Protocol Integration Spec

## Hat tree structure

```
Trust Zones Top Hat (worn by Agreement Registry)
├── Agreement #1 Hat (created on agreement deployment)
│   ├── Zone A Hat (created on SET_UP, minted to Party A on ACTIVATE)
│   └── Zone B Hat (created on SET_UP, minted to Party B on ACTIVATE)
├── Agreement #2 Hat
│   └── Zone Hat (single-zone agreement)
└── ...
```

## Integration points

- **Agreement Registry** wears the top hat → can create agreement hats (children)
- **Agreement Contract** admins the agreement hat → creates zone hats (children) during SET_UP, mints to agents on ACTIVATE
- **Zone hat wearing** = TZ membership. Checked by HatValidator on TZ Account.
- **Hat deactivation** (via toggle or `setHatStatus`) = agent loses all zone access. Cascades to TZ Account lockout.

## Zone hat configuration

Zone hats are created during SET_UP. Their configuration comes from `TZConfig`:

### Hat metadata (from TZConfig fields)
- `maxActors` — how many of this zone hat can exist (typically 1 for 1:1 agreements)
- `description` — human/agent-readable description

### Hat-wired eligibility modules

Mechanisms with `moduleKind == HatsModule` and `paramType ∈ {Eligibility, Penalty}` are deployed via `HatsModuleFactory` and wired to the zone hat as eligibility modules. Multiple modules are chained via `HatsEligibilitiesChain` (AND-all logic).

**ELIGIBILITY** modules gate hat-wearing — the agent must meet criteria to wear the hat:
1. **Staking eligibility** — agent deposits ETH/tokens. `data` encodes packed `(otherImmutableArgs, initData)`.
2. **8004ReputationEligibility** — checks agent's 8004 reputation. `data` encodes packed `(otherImmutableArgs, initData)`.

**PENALTY** modules are also wired to the hat because a negative judgment (e.g., slashing) results in the agent losing hat eligibility and being ejected from the zone.

**REWARD** modules with `moduleKind == HatsModule` are deployed via the factory but NOT wired to the zone hat — they don't affect eligibility.

### Data packing for HatsModule mechanisms

For all `HatsModule` mechanisms, `TZMechanism.data` uses a packed format:

```solidity
data = abi.encode(bytes otherImmutableArgs, bytes initData)
```

The agreement splits this during SET_UP and passes `otherImmutableArgs` and `initData` separately to the factory. This allows modules like StakingEligibility to receive token addresses and other immutable args that were previously always empty.

### Sentinel hat ID replacement

Hat IDs that are unknown at compile time (e.g. `judgeHat`, `recipientHat` in StakingEligibility) are encoded as `type(uint256).max` (the sentinel value). During SET_UP, the agreement replaces all sentinel values in `initData` with the actual agreement hat ID before passing to the factory.

### Toggle module

The agreement contract is always the toggle. Not configurable per zone.

- Agreement implements `IHatsToggle.getHatStatus(hatId)`:
  - Returns `true` when agreement is READY (hats exist but no wearer — safe for eligibility checks and future minting)
  - Returns `true` when agreement is ACTIVE and `block.timestamp < deadline`
  - Returns `false` after deadline, when CLOSED, or when hat is explicitly deactivated
  - Provides automatic lame-duck prevention — zones go inert on deadline

### Explicit deactivation

On CLOSED, the agreement also calls `HATS.setHatStatus(hatId, false)` to immediately and permanently deactivate zone hats, regardless of toggle.

## Two-phase activation lifecycle

### SET_UP (ACCEPTED → READY)
- Zone hats are **created** with eligibility modules wired
- Eligibility modules are deployed and fully initialized
- Zone hats are NOT minted to parties
- Parties can interact with deployed eligibility modules (e.g. stake tokens)

### ACTIVATE (READY → ACTIVE)
- Zone hats are **minted** to parties via `HATS.mintHat(zoneHatId, party)`
- Hats Protocol enforces eligibility at `mintHat()` time
- If a party has not satisfied eligibility (e.g. not staked), Hats reverts with `NotEligible()`
- Both mints must succeed atomically

This split solves the chicken-and-egg problem: eligibility modules must exist before parties can satisfy their requirements, but the previous single-step activation deployed modules and minted hats in the same transaction.

## Settlement flow (on CLOSED)

When the agreement transitions to CLOSED, it interacts with mechanisms based on the outcome:

1. **Deactivate zone hats** — `HATS.setHatStatus(hatId, false)` for each zone
2. **INCENTIVE mechanisms** — the adjudicator can trigger actions (SLASH, FEEDBACK, etc.) via ADJUDICATE before or as part of closure
3. **8004 reputation** — agreement writes `giveFeedback()` for each party with an `agentId` (see agreement.md)
4. **Resource tokens** — resource tokens remain in TZ accounts but are inoperative — zone hats are deactivated so no agent can operate the TZ account. Resource providers should verify hat status in addition to token balance.

## Eligibility module deployment

During SET_UP, mechanisms with `moduleKind == HatsModule` and `paramType ∈ {Eligibility, Penalty}` are deployed via `HatsModuleFactory.createHatsModule()` and wired to the zone hat:

1. Predict zone hat ID via `HATS.getNextId(agreementHatId)`
2. Split packed data: `(immArgs, initData) = abi.decode(data, (bytes, bytes))`
3. Replace sentinel hat IDs in `initData` with agreement hat ID
4. Deploy each module: `factory.createHatsModule(implementation, hatId, immArgs, patchedInitData, salt)`
5. If multiple: wrap in `HatsEligibilitiesChain` (AND-all)
6. Create hat with the resulting eligibility address

Salt uniqueness: `zoneIndex * 100 + subIndex` per module to avoid collisions when two modules share the same implementation.

### Standalone module deployment

Mechanisms with `moduleKind == HatsModule` and `paramType` NOT in `{Eligibility, Penalty}` (e.g. Reward modules) are deployed via `HatsModuleFactory` in a separate pass but are NOT wired to the zone hat.

Salt uniqueness for standalone modules: `zoneIndex * 200 + mechanismArrayIndex`. The `* 200` base (vs `* 100` for hat-wired modules) prevents salt collisions between the two deployment passes.

If no hat-wired mechanisms are specified, `Agreement.getWearerStatus()` is used as the eligibility module and always returns `(true, true)` (open eligibility).

## Hats Protocol addresses

Hats is already deployed on Base. Use existing deployment — do not redeploy.
