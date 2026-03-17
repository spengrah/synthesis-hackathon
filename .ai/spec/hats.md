# Hats Protocol Integration Spec

## Hat tree structure

```
Trust Zones Top Hat (worn by Agreement Registry)
├── Agreement #1 Hat (created on agreement deployment)
│   ├── Zone A Hat (created on activation, worn by Party A)
│   └── Zone B Hat (created on activation, worn by Party B)
├── Agreement #2 Hat
│   └── Zone Hat (single-zone agreement)
└── ...
```

## Integration points

- **Agreement Registry** wears the top hat → can create agreement hats (children)
- **Agreement Contract** admins the agreement hat → creates zone hats (children), mints to agents on activation
- **Zone hat wearing** = TZ membership. Checked by HatValidator on TZ Account.
- **Hat deactivation** (via toggle or `setHatStatus`) = agent loses all zone access. Cascades to TZ Account lockout.

## Zone hat configuration

Zone hats are created during activation. Their configuration comes from `TZConfig`:

### Hat metadata (from TZConfig fields)
- `hatMaxSupply` — how many of this zone hat can exist (typically 1 for 1:1 agreements)
- `hatDetails` — human/agent-readable description

### Hat-wired eligibility modules

Mechanisms with `moduleKind == HatsModule` and `paramType ∈ {Eligibility, Penalty}` are deployed via `HatsModuleFactory` and wired to the zone hat as eligibility modules. Multiple modules are chained via `HatsEligibilitiesChain` (AND-all logic).

**ELIGIBILITY** modules gate hat-wearing — the agent must meet criteria to wear the hat:
1. **Staking eligibility** — agent deposits ETH/tokens. `data` encodes minStake, token, cooldown.
2. **8004ReputationEligibility** — checks agent's 8004 reputation. `data` encodes threshold.

**PENALTY** modules are also wired to the hat because a negative judgment (e.g., slashing) results in the agent losing hat eligibility and being ejected from the zone.

**REWARD** modules with `moduleKind == HatsModule` are deployed via the factory but NOT wired to the zone hat — they don't affect eligibility.

### Toggle module

The agreement contract is always the toggle. Not configurable per zone.

- Agreement implements `IHatsToggle.getHatStatus(hatId)`:
  - Returns `active = true` when agreement is ACTIVE and `block.timestamp < deadline`
  - Returns `active = false` after deadline or when agreement is CLOSED
  - Provides automatic lame-duck prevention — zones go inert on deadline

### Explicit deactivation

On CLOSED, the agreement also calls `HATS.setHatStatus(hatId, false)` to immediately and permanently deactivate zone hats, regardless of toggle.

## Settlement flow (on CLOSED)

When the agreement transitions to CLOSED, it interacts with mechanisms based on the outcome:

1. **Deactivate zone hats** — `HATS.setHatStatus(hatId, false)` for each zone
2. **INCENTIVE mechanisms** — the adjudicator can trigger actions (SLASH, FEEDBACK, etc.) via ADJUDICATE before or as part of closure
3. **8004 reputation** — agreement writes `giveFeedback()` for each party with an `agentId` (see agreement.md)
4. **Resource tokens** — resource tokens remain in TZ accounts but are inoperative — zone hats are deactivated so no agent can operate the TZ account. Resource providers should verify hat status in addition to token balance.

## Eligibility module deployment

During activation, mechanisms with `moduleKind == HatsModule` and `paramType ∈ {Eligibility, Penalty}` are deployed via `HatsModuleFactory.createHatsModule()` and wired to the zone hat:

1. Predict zone hat ID via `HATS.getNextId(agreementHatId)`
2. Deploy each module: `factory.createHatsModule(implementation, hatId, "", data, salt)`
3. If multiple: wrap in `HatsEligibilitiesChain` (AND-all)
4. Create hat with the resulting eligibility address

Salt uniqueness: `zoneIndex * 100 + subIndex` per module to avoid collisions when two modules share the same implementation.

If no hat-wired mechanisms are specified, `Agreement.getWearerStatus()` is used as the eligibility module and always returns `(true, true)` (open eligibility).

## Hats Protocol addresses

Hats is already deployed on Base. Use existing deployment — do not redeploy.
