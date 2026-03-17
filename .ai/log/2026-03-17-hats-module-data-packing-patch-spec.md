# Patch Spec: HatsModule Data Packing + Sentinel Hat IDs

Date: 2026-03-17

## Summary

Two related issues prevent HatsModule-based mechanism templates from working correctly through the Agreement activation flow:

1. **`otherImmutableArgs` is always empty.** Agreement.sol passes `""` for `otherImmutableArgs` when calling `HatsModuleFactory.createHatsModule()`. Several modules require data there (token addresses, hat IDs, balances).

2. **Hat IDs unknown at compile time.** Some modules expect hat IDs (judgeHat, recipientHat, ownerHat, arbitratorHat) in their `initData`, but these hats don't exist until activation. The compiler cannot provide real values.

This patch introduces a packing convention for `TZMechanism.data` and a sentinel value convention for placeholder hat IDs.

---

## Problem Statement

### otherImmutableArgs

`HatsModuleFactory.createHatsModule` signature:

```solidity
function createHatsModule(
    address _implementation,
    uint256 _hatId,
    bytes calldata _otherImmutableArgs,
    bytes calldata _initData,
    uint256 _saltNonce
) external returns (address);
```

Current Agreement.sol (lines 679-685, 710-715):

```solidity
modules[idx] = HATS_MODULE_FACTORY.createHatsModule(
    mechs[i].module,      // implementation
    hatId,                // zone hat ID
    "",                   // otherImmutableArgs ← ALWAYS EMPTY
    mechs[i].data,        // initData
    zoneIndex * 100 + idx // saltNonce
);
```

Affected modules:

| Module | otherImmutableArgs needed | What breaks without it |
|---|---|---|
| StakingEligibility | `abi.encodePacked(address token)` | `_getArgAddress(72)` returns address(0) → ERC-20 transfers revert |
| ERC20Eligibility | `abi.encodePacked(address token, uint256 minBalance)` | Token check uses address(0), minBalance is 0 |
| HatWearingEligibility | `abi.encodePacked(uint256 criterionHatId)` | Criterion hat is 0 → eligibility check is meaningless |

### Unknown hat IDs

StakingEligibility `_setUp` decodes:

```solidity
(uint248 _minStake, uint256 _judgeHat, uint256 _recipientHat, uint256 _cooldownPeriod) =
    abi.decode(_initdata, (uint248, uint256, uint256, uint256));
```

`_judgeHat` and `_recipientHat` are hat IDs that should reference the agreement hat or zone hat — neither of which exists when an agent authors the TZ schema document and the compiler encodes `TZMechanism.data`.

Similarly, AllowlistEligibility expects `ownerHat` and `arbitratorHat`.

---

## Solution: Data Packing Convention

### Convention

For all mechanisms with `moduleKind == HatsModule`, the `TZMechanism.data` field uses a packed format:

```solidity
data = abi.encode(bytes otherImmutableArgs, bytes initData)
```

Agreement.sol splits them when calling the factory:

```solidity
(bytes memory immArgs, bytes memory initData_) = abi.decode(mechs[i].data, (bytes, bytes));
HATS_MODULE_FACTORY.createHatsModule(mechs[i].module, hatId, immArgs, initData_, salt);
```

This requires no changes to the `TZMechanism` struct. The convention is purely in how `data` is interpreted for `HatsModule` mechanisms.

### Examples

**StakingEligibility:**
```solidity
bytes memory immArgs = abi.encodePacked(address(USDC));
bytes memory initData = abi.encode(uint248(minStake), uint256(judgeHat), uint256(recipientHat), uint256(cooldown));
bytes memory data = abi.encode(immArgs, initData);
```

**ERC20Eligibility:**
```solidity
bytes memory immArgs = abi.encodePacked(address(token), uint256(minBalance));
bytes memory initData = ""; // no setUp args
bytes memory data = abi.encode(immArgs, initData);
```

**AllowlistEligibility:**
```solidity
bytes memory immArgs = ""; // no immutable args beyond hatId
bytes memory initData = abi.encode(uint256(ownerHat), uint256(arbitratorHat), accounts);
bytes memory data = abi.encode(immArgs, initData);
```

---

## Solution: Sentinel Values for Hat IDs

### Convention

```solidity
uint256 constant HAT_ID_SENTINEL = type(uint256).max;
```

The compiler encodes `HAT_ID_SENTINEL` wherever a hat ID is required but unknown at compile time. Agreement.sol recognizes the sentinel and replaces it with the actual hat ID during activation, before passing `initData` to the factory.

### Affected fields

| Module | Field | Replacement value |
|---|---|---|
| StakingEligibility | `judgeHat` | Agreement hat ID (so the agreement can call `slash()`) |
| StakingEligibility | `recipientHat` | Agreement hat ID (so slashed funds go to agreement admin) |
| AllowlistEligibility | `ownerHat` | Agreement hat ID |
| AllowlistEligibility | `arbitratorHat` | Agreement hat ID |

### Replacement logic

After splitting `data` into `immArgs` and `initData`, but before passing `initData` to the factory, Agreement.sol scans for sentinels and replaces them:

```solidity
// Replace sentinel hat IDs in initData with the actual agreement hat ID
bytes memory patchedInitData = _replaceSentinelHatIds(initData_, $.agreementHatId);
```

A simple approach — since `type(uint256).max` is `0xfff...fff` (32 bytes of 0xff), scan for this pattern in the initData bytes and replace each occurrence with the agreement hat ID:

```solidity
function _replaceSentinelHatIds(bytes memory initData, uint256 agreementHatId)
    internal
    pure
    returns (bytes memory)
{
    // Sentinel is 32 bytes of 0xff
    bytes32 sentinel = bytes32(type(uint256).max);
    bytes32 replacement = bytes32(agreementHatId);

    // Scan in 32-byte aligned chunks (ABI-encoded uint256 values are always aligned)
    for (uint256 i = 0; i + 32 <= initData.length; i += 32) {
        bytes32 chunk;
        assembly { chunk := mload(add(initData, add(32, i))) }
        if (chunk == sentinel) {
            assembly { mstore(add(initData, add(32, i)), replacement) }
        }
    }
    return initData;
}
```

This is safe because:
- ABI-encoded `uint256` values are 32-byte aligned
- `type(uint256).max` is not a realistic hat ID, token address, or stake amount
- The scan is O(n/32) over initData length, which is small

---

## Required Contract Changes

### 1. Add sentinel constant

In `AgreementTypes.sol` or `TZTypes.sol`:

```solidity
uint256 constant HAT_ID_SENTINEL = type(uint256).max;
```

### 2. Update `_deployHatWiredModules`

Current (Agreement.sol ~line 679):
```solidity
modules[idx] = HATS_MODULE_FACTORY.createHatsModule(
    mechs[i].module, hatId, "", mechs[i].data, zoneIndex * 100 + idx
);
```

New:
```solidity
(bytes memory immArgs, bytes memory initData_) = abi.decode(mechs[i].data, (bytes, bytes));
bytes memory patchedInitData = _replaceSentinelHatIds(initData_, $._agreementHatId);
modules[idx] = HATS_MODULE_FACTORY.createHatsModule(
    mechs[i].module, hatId, immArgs, patchedInitData, zoneIndex * 100 + idx
);
```

### 3. Update `_deployStandaloneHatsModules`

Same pattern — split data, patch sentinels, pass to factory. (Agreement.sol ~line 710)

### 4. Add `_replaceSentinelHatIds` internal function

As shown above.

---

## Compiler Encoding

The compiler encodes `TZMechanism.data` in the packed format from day 1. Per-template encoding:

| Template | otherImmutableArgs | initData | Sentinels |
|---|---|---|---|
| `staking` | `abi.encodePacked(address token)` | `abi.encode(uint248 minStake, uint256 SENTINEL, uint256 SENTINEL, uint256 cooldownPeriod)` | judgeHat, recipientHat |
| `erc20-balance` | `abi.encodePacked(address token, uint256 minBalance)` | `""` | none |
| `allowlist` | `""` | `abi.encode(uint256 SENTINEL, uint256 SENTINEL, address[] accounts)` | ownerHat, arbitratorHat |
| `hat-wearing` | `abi.encodePacked(uint256 criterionHatId)` | `""` | none |
| `reputation-gate` | `""` | `abi.encode(uint256 minScore)` | none |

---

## Test Plan

### Unit tests

- `_replaceSentinelHatIds` replaces sentinels correctly in various initData layouts
- `_replaceSentinelHatIds` does not modify non-sentinel values
- `_replaceSentinelHatIds` handles empty initData
- Factory receives correct `otherImmutableArgs` and `initData` after split

### Integration tests

- StakingEligibility with ERC-20 token: token address passed via immutableArgs, stake/slash works
- ERC20Eligibility: token + minBalance via immutableArgs, eligibility check works
- AllowlistEligibility: ownerHat sentinel replaced, owner can manage allowlist
- HatWearingEligibility: criterionHatId via immutableArgs, cross-hat eligibility works

### Roundtrip tests

- Compiler encodes packed data → Agreement splits correctly → module initializes with correct params

---

## Spec Updates Required

### agreement.md

- Update activation logic to show data splitting for HatsModule mechanisms
- Document the packing convention and sentinel replacement
- Update the deployment table to show immutableArgs flow

### compiler.md

- Already updated with the packing convention in template data encodings table

### hats.md

- Note that immutableArgs are now passed through from TZMechanism.data
- Document the sentinel → agreement hat ID replacement

---

## Acceptance Criteria

1. Agreement.sol splits `TZMechanism.data` into `(otherImmutableArgs, initData)` for HatsModule mechanisms
2. Sentinel hat IDs (`type(uint256).max`) are replaced with the actual agreement hat ID before factory call
3. StakingEligibility receives correct token address and hat IDs
4. ERC20Eligibility receives correct token address and minBalance
5. HatWearingEligibility receives correct criterionHatId
6. AllowlistEligibility receives correct ownerHat and arbitratorHat
7. All existing tests pass (no regressions)
8. New tests cover the packing and sentinel logic
