# Security Review — synthesis-hackathon (Trust Zones)

---

## Scope

|                                  |                                                        |
| -------------------------------- | ------------------------------------------------------ |
| **Mode**                         | DEEP                                                   |
| **Files reviewed**               | `Agreement.sol` · `AgreementRegistry.sol`<br>`HatValidator.sol` · `ResourceTokenRegistry.sol` · `TrustZone.sol` |
| **Confidence threshold (1-100)** | 80                                                     |

---

## Findings

[95] **1. No validation that proposal zone parties match agreement parties**

`Agreement._handleActivate` / `Agreement._deployZone` · Confidence: 95

**Description**
During activation, `_deployZone` reads `zone.party` from stored proposal data to mint hats and verify agent IDs, but never validates that `zone.party` matches one of `$._parties[0]` or `$._parties[1]` — an attacker can craft a proposal where `zones[0].party` is an arbitrary address, causing the zone hat to be minted to a third party who gains hat-wearer authorization over the TrustZone smart account.

**Fix**

```diff
  function _deployZone(AgreementStorage storage $, TZTypes.TZConfig memory zone, uint256 zoneIndex) internal {
+   if (zone.party != $._parties[zoneIndex]) revert NotAParty(zone.party);
    _verifyAgentId(zone);
    uint256 zoneHatId = _createZoneHat($, zone);
```

---

[95] **2. No deadline validation allows agreements with past or zero deadlines**

`Agreement._handleActivate` · Confidence: 95

**Description**
`_handleActivate` reads `data.deadline` from stored proposal data and stores it as `$._deadline` without checking that it is in the future, allowing activation with a deadline of 0 or a past timestamp — `getHatStatus` immediately returns false (zones are born dead), and `_handleFinalize` can be called immediately to close the agreement, bypassing any intended active period.

**Fix**

```diff
  function _handleActivate(AgreementStorage storage $, address caller) internal returns (bytes32) {
    bytes32 state = $._currentState;
    _requireState($, AgreementTypes.ACCEPTED);
    _requireParty($, caller);

    AgreementTypes.ProposalData memory data = abi.decode($._storedProposalData, (AgreementTypes.ProposalData));
    if (data.zones.length != 2) revert InvalidZoneCount();
+   if (data.deadline <= block.timestamp) revert DeadlineReached(data.deadline);

    $._adjudicator = data.adjudicator;
    $._deadline = data.deadline;
```

---

[95] **3. Unchecked arbitrary call in adjudication allows arbitrary code execution on mechanism modules**

`Agreement._handleAdjudicate` · Confidence: 95

**Description**
The PENALIZE/REWARD adjudication path performs `mech.module.call(action.params)` where `mech.module` is set from proposal data and `action.params` is fully adjudicator-controlled with no restriction on function selector — a colluding adjudicator can invoke any function on the registered module, including functions like `ResourceTokenRegistry.transferFrom` if the module address points to the token registry, enabling theft of resource tokens from TrustZone accounts.

**Fix**

```diff
- (bool success,) = mech.module.call(action.params);
- if (!success) revert InvalidInput(action.actionType);
+ // Enforce a specific mechanism interface rather than raw .call
+ (bool success,) = mech.module.call(
+     abi.encodeWithSelector(IMechanism.execute.selector, action.params)
+ );
+ if (!success) revert InvalidInput(action.actionType);
```

---

[95] **4. ResourceTokenRegistry transfer ignores the `amount` parameter**

`ResourceTokenRegistry._transfer` · Confidence: 95

**Description**
`_transfer` accepts an `amount` parameter and emits it in the `Transfer` event, but internally always transfers exactly 1 token regardless of the amount value — a caller passing `amount=0` still moves the token, and a caller passing `amount=1000` emits a misleading event, violating ERC-6909 interface semantics and potentially confusing indexers and integrations.

**Fix**

```diff
  function _transfer(address caller, address sender, address receiver, uint256 id, uint256 amount)
    internal
    returns (bool)
  {
+   if (amount != 1) revert InsufficientBalance(sender, id);
    _checkIsCreator(id);
    _checkIsHeld(sender, id);
    _checkNotHeld(receiver, id);
```

---

[80] **5. getHatStatus returns true for ACCEPTED state for any hatId**

`Agreement.getHatStatus` · Confidence: 80

**Description**
In the ACCEPTED state, `getHatStatus` returns `true` for any `_hatId` without checking whether that hat belongs to this agreement — during the window between accept and activate, any hat queried against this agreement's toggle will appear active; if Hats Protocol or an integration checks toggle status for unrelated hats that reference this agreement as their toggle, those hats would be incorrectly reported as active.

**Fix**

```diff
- if (state == AgreementTypes.ACCEPTED) return true;
+ if (state == AgreementTypes.ACCEPTED) {
+   return (_hatId == $._zoneHatIds[0] || _hatId == $._zoneHatIds[1]);
+ }
```

---

[80] **6. Adjudicator can execute duplicate actions in a single adjudication call**

`Agreement._handleAdjudicate` · Confidence: 80

**Description**
The `actions` array within a single adjudication call has no bound on length or deduplication — the adjudicator can include duplicate PENALIZE/REWARD actions referencing the same mechanism multiple times, executing the mechanism module's arbitrary call multiple times for a single claim verdict.

**Fix**

```diff
  for (uint256 i = 0; i < actions.length; i++) {
    AgreementTypes.AdjudicationAction memory action = actions[i];
    actionTypes[i] = action.actionType;
+   if (actions.length > $._mechanisms.length * 2 + 2) revert InvalidInput(AgreementTypes.ADJUDICATE);
```

---

[80] **7. ResourceTokenRegistry owner cannot be transferred**

`ResourceTokenRegistry` · Confidence: 80

**Description**
The `owner` state variable is set in the constructor with no transfer or renounce mechanism — if the owner address is compromised or its keys are lost, no new agreements can ever be registered as minters, permanently bricking the protocol's ability to create new agreements that mint resource tokens.

**Fix**

```diff
+ function transferOwnership(address newOwner) external {
+     if (msg.sender != owner) revert NotOwner();
+     if (newOwner == address(0)) revert InvalidParty(newOwner);
+     owner = newOwner;
+ }
```

---

| | | **Below Confidence Threshold** |
|---|---|---|

---

[75] **8. Reentrancy via arbitrary module call in `_handleAdjudicate`**

`Agreement._handleAdjudicate` · Confidence: 75

**Description**
`_handleAdjudicate` performs a raw external call `mech.module.call(action.params)` with no reentrancy guard — if the module address is under the adjudicator's control, the module can re-enter `submitInput` while the agreement is still ACTIVE (claim is marked adjudicated but state has not yet transitioned), allowing a second adjudication call with a different claim ID to issue a CLOSE action before the outer call completes, resulting in double-close with corrupted outcome state.

---

[75] **9. ResourceTokenRegistry creator can transfer tokens from any holder without consent**

`ResourceTokenRegistry.transferFrom` · Confidence: 75

**Description**
`transferFrom` only checks `msg.sender == creator[id]` via `_checkIsCreator` with no check that `msg.sender` has allowance from `sender` or that `caller == sender` — any Agreement that created a token can forcibly move it out of any holder's account; this is exploitable through the adjudication path because `_handleAdjudicate` calls `mech.module.call(action.params)` from the Agreement's own address, and since Agreement is the creator of the tokens it minted, crafted calldata can drain resource tokens from a party's TrustZone.

---

## Findings List

| # | Confidence | Title |
|---|---|---|
| 1 | [95] | No validation that proposal zone parties match agreement parties |
| 2 | [95] | No deadline validation allows agreements with past or zero deadlines |
| 3 | [95] | Unchecked arbitrary call in adjudication allows arbitrary code execution |
| 4 | [95] | ResourceTokenRegistry transfer ignores the `amount` parameter |
| 5 | [80] | getHatStatus returns true for ACCEPTED state for any hatId |
| 6 | [80] | Adjudicator can execute duplicate actions in single call |
| 7 | [80] | ResourceTokenRegistry owner cannot be transferred |
| | | **Below Confidence Threshold** |
| 8 | [75] | Reentrancy via arbitrary module call in `_handleAdjudicate` |
| 9 | [75] | ResourceTokenRegistry creator can transfer tokens without consent |

---

> This review was performed by an AI assistant using the [Pashov Skills](https://github.com/pashov/skills) solidity-auditor (DEEP mode). AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Team security reviews, bug bounty programs, and on-chain monitoring are strongly recommended.
