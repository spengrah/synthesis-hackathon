# Security Review — Trust Zones Protocol

---

## Scope

|                                  |                                                        |
| -------------------------------- | ------------------------------------------------------ |
| **Mode**                         | default (all in-scope `.sol` files)                    |
| **Files reviewed**               | `Agreement.sol` · `AgreementRegistry.sol` · `HatValidator.sol`<br>`ResourceTokenRegistry.sol` · `Temptation.sol` · `TrustZone.sol`<br>`DeployAgreement.s.sol` · `DeployAgreementRegistry.s.sol` · `DeployAll.s.sol`<br>`DeployHatValidator.s.sol` · `DeployResourceTokenRegistry.s.sol` · `DeployTrustZone.s.sol` |
| **Confidence threshold (1-100)** | 80                                                     |

---

## Findings

[97] **1. Temptation.withdraw — Unlimited Repeated Withdrawals**

`Temptation.withdraw` · Confidence: 97

**Description**
The permission token is never burned, invalidated, or tracked after a successful withdrawal — since `balanceOf` remains 1 and `amount <= maxAmount` is a per-call cap (not cumulative), the caller can call `withdraw(maxAmount, tokenId)` repeatedly until the contract's entire ETH balance is drained.

**Fix**

```diff
+ mapping(uint256 => uint256) public cumulativeWithdrawn;
+
  function withdraw(uint256 amount, uint256 permissionTokenId) external nonReentrant {
      // ... existing checks ...
+     cumulativeWithdrawn[permissionTokenId] += amount;
+     if (cumulativeWithdrawn[permissionTokenId] > maxAmount) revert ExceedsMaxAmount();
      // ... transfer ETH ...
  }
```
---

[90] **2. Temptation.withdraw — Missing Expiry Check**

`Temptation.withdraw` · Confidence: 90

**Description**
The `withdraw` function decodes an `expiry` field from the permission token metadata but never validates it against `block.timestamp`, allowing holders of expired permission tokens to withdraw ETH indefinitely after the permission was intended to expire. The `period` field (intended for rate-limiting) is also decoded but unused.

**Fix**

```diff
  (string memory resource, uint256 maxAmount, bytes32 period, uint256 expiry, bytes memory params) =
      abi.decode(metadata, (string, uint256, bytes32, uint256, bytes));
+ if (block.timestamp > expiry) revert PermissionExpired();
```
---

[90] **3. Agreement._initializeExternalModules — Arbitrary External Call from Privileged Context**

`Agreement._initializeExternalModules` · Confidence: 90

**Description**
External mechanism initialization performs an unconstrained `module.call(data)` where both the target address and calldata are user-supplied via the proposal payload. The Agreement contract holds minter privileges on `ResourceTokenRegistry` and wears the agreement hat, so any arbitrary call from the Agreement's context inherits these privileges — enabling unauthorized token minting, hat manipulation, or chained token theft via `ResourceTokenRegistry.transferFrom` callback (Chain: [3] + [transferFrom], confidence 75).

**Fix**

```diff
- (bool success,) = mechs[i].module.call(mechs[i].data);
- if (!success) revert InvalidInput(bytes32("EXTERNAL_INIT"));
+ if (!approvedExternalModules[mechs[i].module]) revert UnapprovedModule();
+ (bool success,) = IExternalMechanism(mechs[i].module).initialize(mechs[i].data);
+ if (!success) revert InvalidInput(bytes32("EXTERNAL_INIT"));
```
---

[90] **4. Agreement._handleAdjudicate — Arbitrary External Call via Adjudication**

`Agreement._handleAdjudicate` · Confidence: 90

**Description**
For PENALIZE/REWARD actions, the adjudicator provides `action.params` which is passed as raw calldata to `mech.module.call(action.params)` with no restriction on function selector or parameters, enabling the adjudicator to invoke arbitrary functions on any registered mechanism module from the Agreement's privileged context.

**Fix**

```diff
- (bool success,) = mech.module.call(action.params);
+ (bool success,) = IMechanism(mech.module).onAdjudicate(
+     action.actionType, action.params
+ );
```
---

[90] **5. Agreement._handleSetUp — Unrestricted Self-Adjudication**

`Agreement._handleSetUp` · Confidence: 90

**Description**
No validation prevents a party from setting themselves as the adjudicator in the proposal data, enabling a party to unilaterally file claims and adjudicate them — executing PENALIZE actions, deactivating the counterparty's zone hat, writing false reputation feedback, and force-closing the agreement.

**Fix**

```diff
  $._adjudicator = data.adjudicator;
+ if (data.adjudicator == $._parties[0] || data.adjudicator == $._parties[1])
+     revert InvalidAdjudicator();
```
---

[75] **6. Agreement._handleFinalize — Permissionless Finalization**

`Agreement._handleFinalize` · Confidence: 75

**Description**
`_handleFinalize` has no access control — any address can call `submitInput(FINALIZE, "")` after the deadline to force-close the agreement, deactivating zone hats and writing "EXPIRED" reputation feedback for both parties, potentially front-running a legitimate COMPLETE signal at the deadline boundary.

---

Findings List

| # | Confidence | Title |
|---|---|---|
| 1 | [97] | Temptation.withdraw — Unlimited Repeated Withdrawals |
| 2 | [90] | Temptation.withdraw — Missing Expiry Check |
| 3 | [90] | Agreement._initializeExternalModules — Arbitrary External Call from Privileged Context |
| 4 | [90] | Agreement._handleAdjudicate — Arbitrary External Call via Adjudication |
| 5 | [90] | Agreement._handleSetUp — Unrestricted Self-Adjudication |
| 6 | [75] | Agreement._handleFinalize — Permissionless Finalization |

---

## Leads

_Vulnerability trails with concrete code smells where the full exploit path could not be completed in one analysis pass. These are not false positives — they are high-signal leads for manual review. Not scored._

- **Creator-Only TransferFrom Without Holder Consent** — `ResourceTokenRegistry._transfer` — Code smells: `_checkIsCreator` only, no allowance/approval check — The token creator (Agreement contract) can forcibly move tokens from any holder via `transferFrom` without the holder's consent; by design but becomes exploitable when chained with arbitrary external call vectors (Finding 3)
- **Unilateral Activation Starting Deadline Clock** — `Agreement._handleActivate` — Code smells: `_requireParty` only (either party), no two-party confirmation — Either party can activate the agreement (minting zone hats and starting the deadline) before the counterparty is operationally ready, enabling forced expiration for reputation damage
- **Unilateral Setup Without Counterparty Confirmation** — `Agreement._handleSetUp` — Code smells: `_requireParty` only (either party) — Either party can trigger full infrastructure deployment (zones, hats, tokens, adjudicator) after acceptance without the other party's explicit confirmation
- **No Minter Revocation or Ownership Transfer** — `ResourceTokenRegistry.registerMinter / owner` — Code smells: no `revokeMinter`, no `transferOwnership` — Terminated or compromised agreements retain permanent minting privileges; owner (AgreementRegistry) cannot be upgraded without bricking minter registration
- **Always-True Eligibility Check** — `Agreement.getWearerStatus` — Code smells: returns `(true, true)` for all addresses/hats — Any address passes eligibility for zone hats (explicitly a hackathon simplification per code comment)
- **Hat ID Prediction Race** — `Agreement._createZoneHat` — Code smells: `getNextId` → deploy modules → `createHat` non-atomic pattern — Zone hat ID prediction could be invalidated if a hat is created between prediction and creation, though only the Agreement (as hat admin) can create children, making exploitation unlikely
- **Permanent Agreement Executor on TrustZone** — `TrustZone (ERC-7579)` — Code smells: Agreement installed as executor, never uninstalled after closure — Combined with the arbitrary external call path (Finding 3), callback chains could enable indirect full control over TrustZone accounts via `executeFromExecutor`
- **Hardcoded Anvil Private Key Fallback** — `DeployAll.s.sol` — Code smells: `vm.envOr("PRIVATE_KEY", ANVIL_KEY)` — Deploy script defaults to the well-known Anvil account 0 private key; catastrophic if accidentally used on mainnet without `PRIVATE_KEY` env var
- **Reputation Feedback URI Injection** — `Agreement._close` — Code smells: counterparty-submitted `feedbackURI` written to ERC-8004 without content validation — A malicious party can inject arbitrary URIs into the counterparty's permanent reputation record during COMPLETE/EXIT signaling
- **Deadline Manipulation via Near-Future Timestamp** — `Agreement._handleSetUp` — Code smells: deadline validated only as `> block.timestamp`, no minimum ACTIVE duration — A proposer can lock in a near-expired deadline during proposal that barely survives the setUp check but leaves negligible operational time

---

> :warning: This review was performed by an AI assistant. AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Team security reviews, bug bounty programs, and on-chain monitoring are strongly recommended. For a consultation regarding your projects' security, visit [https://www.pashov.com](https://www.pashov.com)
