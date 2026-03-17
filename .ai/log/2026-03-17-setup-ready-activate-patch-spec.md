# Patch Spec: Split Agreement Activation Into `SET_UP` and `ACTIVATE`

Date: 2026-03-17

## Summary

The current Agreement lifecycle conflates two distinct phases:

1. infrastructure setup
2. live admission of parties into zone hats

This breaks stake-gated and other eligibility-gated Hats modules, because the eligibility module instances are only deployed during `ACTIVATE`, while Hats enforces eligibility at `mintHat()`. A party therefore has no opportunity to satisfy eligibility requirements before the mint occurs.

The fix is to split the current `ACTIVATE` behavior into:

- `SET_UP`: deploy and configure the agreement runtime
- `ACTIVATE`: mint the zone hats and make the agreement live

`ACTIVATE` should not duplicate eligibility checks. It should rely on Hats Protocol enforcement at `mintHat()`.

---

## Problem Statement

Current behavior in `Agreement`:

- `ACCEPTED -> ACTIVATE -> ACTIVE`
- `ACTIVATE`:
  - deploys hats/modules/zones/resources
  - immediately mints zone hats to the parties

For mechanisms like `StakingEligibility`:

- the module is deployed only during activation
- `HATS.mintHat(zoneHatId, party)` checks eligibility immediately
- if the wearer has not already staked, Hats reverts with `NotEligible()`
- but the wearer cannot stake before activation, because the module instance did not exist yet

This is a real protocol/design bug, not just a test issue.

---

## Target Behavior

### New lifecycle

```text
PROPOSED -> NEGOTIATING -> ACCEPTED -> READY -> ACTIVE -> CLOSED
```

Where:

- `READY` means all runtime infrastructure exists, but the parties do not yet wear the zone hats
- `ACTIVE` means the hats have been minted and the agreement is live

### Operational semantics

#### `SET_UP`

Allowed in `ACCEPTED`.

Must:

- decode locked proposal data
- validate deadline / zone count / party ownership / agent IDs
- create zone hats
- deploy hat-wired Hats modules
- deploy standalone Hats modules
- deploy TrustZone clones
- install validator / executor / hook multiplexer
- initialize constraint hooks
- initialize external modules
- register mechanisms
- mint resource tokens to TZ accounts
- persist zone addresses / zone hat IDs / agent IDs / deadline / adjudicator
- transition `ACCEPTED -> READY`

Must not:

- mint zone hats to parties
- allow claims
- allow operational zone authority

#### `ACTIVATE`

Allowed only in `READY`.

Must:

- call `HATS.mintHat(zoneHatId, party)` for both zones
- rely on Hats eligibility enforcement
- transition `READY -> ACTIVE` only if both mints succeed

Must not:

- re-check eligibility in Agreement
- redeploy anything
- mutate the mechanism registry or TZ setup

### Atomicity

`ACTIVATE` must remain atomic:

- if either mint fails, the whole transaction reverts
- the agreement remains in `READY`
- no partial live state is allowed

---

## Required Contract Changes

## 1. Agreement state machine

### Add new state

Add:

```solidity
bytes32 constant READY = keccak256("READY");
```

### Add new input ID

Add:

```solidity
bytes32 constant SET_UP = keccak256("SET_UP");
```

Retain:

```solidity
bytes32 constant ACTIVATE = keccak256("ACTIVATE");
```

### New transitions

Replace:

```text
ACCEPTED --[ACTIVATE]--> ACTIVE
```

With:

```text
ACCEPTED --[SET_UP]----> READY
READY    --[ACTIVATE]--> ACTIVE
```

### Update `acceptAndActivate`

Current shortcut goes directly to live activation.

New behavior should be:

- `ACCEPT/acceptAndActivate` path performs:
  - `ACCEPT`
  - `SET_UP`
  - `ACTIVATE`
- if Hats minting fails during `ACTIVATE`, the entire `acceptAndActivate` tx reverts

This preserves the convenience path for open-eligibility agreements while still honoring gated ones.

Optional naming alternative:

- keep `acceptAndActivate` name, but internally it is now `accept -> set up -> activate`

---

## 2. Split Agreement logic

### Replace current `_handleActivate`

Current `_handleActivate` should be split into:

- `_handleSetUp`
- `_handleActivate`

### `_handleSetUp`

Responsibilities:

- everything the current activation flow does except hat minting

Suggested extraction:

- current `_deployZone` should be split into:
  - `_setUpZone(...)`
  - `_mintZoneHat(...)`

Or:

- `_deployZone(...)` becomes a setup-only method
- hat minting happens in `_handleActivate`

### Zone setup sequence

For each zone during `SET_UP`:

1. verify `zone.party == parties[zoneIndex]`
2. verify `agentId` ownership if nonzero
3. predict/create zone hat
4. deploy hat-wired Hats modules
5. create zone hat with those modules as eligibility
6. do not mint the hat
7. deploy standalone Hats modules
8. deploy TrustZone clone
9. initialize hooks / external modules
10. register mechanisms
11. mint resource tokens
12. store zone metadata

### `_handleActivate`

Responsibilities:

- require state `READY`
- require caller is a party
- mint both zone hats to the intended parties
- set state to `ACTIVE`
- emit `AgreementActivated`
- emit `AgreementStateChanged(READY, ACTIVE)`

Important:

- if `mintHat(zoneHatId, party)` reverts with `NotEligible()`, bubble the Hats failure naturally
- do not wrap that failure into an Agreement-specific eligibility error unless there is a very strong reason

---

## 3. Agreement auth and state gating

### `getHatStatus`

Current behavior should change so hats are not effectively active before live activation.

Recommended behavior:

- return `true` only when:
  - state is `ACTIVE`
  - deadline not passed
  - hat not explicitly deactivated

Therefore:

- `READY` returns `false`
- `ACCEPTED` returns `false`

This ensures zones are inert before activation even though the TZ accounts and hooks already exist.

### Claims / runtime inputs

These should remain `ACTIVE`-only:

- `CLAIM`
- `ADJUDICATE`
- `COMPLETE`
- `EXIT`
- `FINALIZE`

`READY` must reject them all.

### Zone authority

`READY` must be non-operational in practice:

- no party should be able to use zone authority through HatValidator
- no valid ERC-1271 signature path via zone hat wearing

This should naturally hold because:

- the hats exist but are not worn yet
- `getHatStatus()` should also return false before `ACTIVE`

---

## 4. Events

### Recommended new event

Add:

```solidity
event AgreementSetUp(address indexed agreement, address[2] trustZones, uint256[2] zoneHatIds);
```

Reason:

- distinguish infra deployment from live activation
- gives indexers and SDK a clean semantic point for `READY`

Alternative:

- reuse `AgreementActivated` for the final `READY -> ACTIVE` transition only
- add a separate setup event

Recommended final event model:

- `AgreementSetUp(...)` on `SET_UP`
- `AgreementActivated(...)` on `ACTIVATE`

---

## Required Spec Updates

## 1. `.ai/spec/agreement.md`

Update:

- states list
- input IDs list
- transition diagram
- auth table
- `acceptAndActivate` description
- activation logic section
- close/runtime sections that currently assume all deployment and minting happen in one step

Specific required changes:

- add `READY`
- add `SET_UP`
- rewrite `ACCEPTED` section:
  - `SET_UP` deploys zones, mechanisms, hooks, tokens, but does not mint hats
- add `READY` section:
  - all setup artifacts exist
  - prospective wearers may satisfy eligibility requirements against deployed modules
  - hats are not yet minted
  - no claims or live zone operations
- rewrite activation section:
  - `ACTIVATE` only mints hats and transitions to `ACTIVE`
  - Hats enforces eligibility

## 2. `.ai/spec/hats.md`

Update:

- hat tree structure language
- zone hat configuration section
- toggle semantics
- eligibility module deployment section

Specific required changes:

- zone hats are created during `SET_UP`, not `ACTIVATE`
- zone hats are minted to parties during `ACTIVATE`, not `SET_UP`
- `READY` is a pre-admission phase where eligibility modules are already deployed and can be interacted with
- clarify that Hats eligibility enforcement occurs at `mintHat()`
- note that toggle/status should not make zones operational before `ACTIVE`

## 3. `.ai/spec/compiler.md`

Update incentive / eligibility deployment semantics:

- current compiler language is broadly fine, but runtime flow text should reflect:
  - modules are deployed during `SET_UP`
  - wearer admission occurs during `ACTIVATE`

Specific additions:

- staking template output remains the same
- but the deployment semantics should note:
  - the deployed module must exist before the final activation mint
  - parties may need to satisfy stake/reputation/etc. during `READY`

## 4. `.ai/spec/demo.md`

Update demo beat order:

- accepted agreement
- `SET_UP`
- parties satisfy any eligibility preconditions if needed
- `ACTIVATE`
- live zone usage

If the demo currently implies single-step activation, it needs to reflect the new two-step flow.

## 5. `.ai/spec/timeline.md`

Update milestone/test language:

- first integration test becomes:
  - create agreement
  - set up agreement
  - activate agreement
  - verify TZ accounts exist and hats are minted only after activation

## 6. `.ai/spec/ponder.md`

Update event/indexing assumptions if needed:

- add `READY` handling
- add `AgreementSetUp` event handling if introduced
- distinguish:
  - setup timestamp
  - activation timestamp

Potential schema additions:

- `setUpAt`
- `activatedAt`

If `activatedAt` already exists, do not overload it with setup time.

## 7. `.ai/spec/sdk.md` and `.ai/spec/x402-service.md`

Update any user-facing flow docs:

- new input ID `set_up`
- `activate` semantics changed
- `acceptAndActivate` still exists but may revert if eligibility preconditions are not yet satisfied

---

## Suggested Code-Level Changes

## Agreement contract

### New constants

- add `READY`
- add `SET_UP`

### New handlers

- `_handleSetUp(AgreementStorage storage $, address caller) internal returns (bytes32)`
- `_handleActivate(AgreementStorage storage $, address caller) internal returns (bytes32)` becomes mint-only

### Dispatch

Update `submitInput` routing:

- `SET_UP` valid from `ACCEPTED`
- `ACTIVATE` valid from `READY`

### Zone deployment internals

Refactor so hat creation and hat minting are separate:

- `_createZoneHatDefinition(...)`
- `_mintZoneHatToParty(...)`

The important property is:

- `SET_UP` creates hat IDs and configures eligibility/toggle
- `ACTIVATE` performs `mintHat`

### Agreement storage

No major new storage should be required beyond the new state, unless implementation convenience suggests:

- `bool _isSetUp`

This is optional if `READY` is sufficient.

---

## Test Plan Changes

## Unit tests

Add / update:

- `ACCEPTED -> SET_UP -> READY`
- `READY -> ACTIVATE -> ACTIVE`
- `ACTIVATE` reverts from `ACCEPTED`
- `SET_UP` reverts from `READY` / `ACTIVE`
- `SET_UP` deploys trust zones, hats, mechanisms, tokens, but does not mint zone hats
- `ACTIVATE` mints hats but does not redeploy anything
- `acceptAndActivate` performs both phases atomically

## Hats integration tests

Rewrite the current staking integration suite to the intended lifecycle:

1. `SET_UP` deploys `StakingEligibility` and leaves agreement `READY`
2. before staking, `ACTIVATE` reverts with Hats `NotEligible()`
3. prospective wearer stakes into the deployed module
4. `ACTIVATE` succeeds

For multi-module chain case:

1. `SET_UP`
2. stake into only one module
3. `ACTIVATE` reverts with `NotEligible()`
4. stake into second module
5. `ACTIVATE` succeeds

## Zone behavior tests

Add:

- `READY` trust zone cannot `execute`
- `READY` trust zone cannot validate signatures
- `READY` cannot file claims
- after `ACTIVATE`, zone authority becomes live

## Invariants

Add / update:

- `READY` never allows active-only actions
- `ACTIVE` can only be reached after `READY`
- setup artifacts are immutable from `READY` onward
- failed `ACTIVATE` from `READY` leaves agreement in `READY`

---

## Open Design Choices

## Naming

Recommended:

- `SET_UP`
- `READY`
- `ACTIVATE`

Alternative:

- rename current idea of activation to `CONFIGURE`
- reserve `ACTIVATE` for live admission

`SET_UP` is acceptable and clearer than overloading `ACTIVATE`.

## Resource tokens in `READY`

Recommended:

- mint during `SET_UP`
- but keep TZ accounts inert because hats are not worn and `getHatStatus()` is false

Reason:

- setup is complete and inspectable
- no live access exists yet

## Partial activation

Recommended:

- do not support one-sided activation
- both hats mint or the tx reverts

This keeps the protocol simpler and preserves bilateral symmetry.

---

## Acceptance Criteria

This patch is complete when:

1. `Agreement` has a real `READY` state and `SET_UP` input
2. current activation logic is split into setup-only and mint-only phases
3. Hats eligibility is enforced only by Hats at mint time
4. stake-gated/eligibility-gated agreements can be set up before the wearer satisfies eligibility
5. prospective wearers can satisfy eligibility during `READY`
6. `ACTIVATE` succeeds once Hats allows both mints
7. `READY` is non-operational
8. specs are updated consistently across Agreement, Hats, Compiler, Demo, Timeline, Ponder, and SDK docs
9. tests are updated to reflect the new lifecycle

---

## Recommended Implementation Order

1. Update `agreement.md` and `hats.md`
2. Refactor `Agreement.sol` state machine and handler split
3. Update `getHatStatus` and `acceptAndActivate`
4. Update unit tests for state machine / setup / activate
5. Rewrite staking-based integration tests to use `READY`
6. Update compiler/demo/ponder/sdk specs
7. Update invariants

