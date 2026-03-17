# TZ Account Spec

## Base

`TZAccount.sol` is a thin wrapper around OZ's `AccountERC7579HookedUpgradeable` (from `openzeppelin-contracts-upgradeable`). The upgradeable variant is required for ERC-1167 clone deployment (ERC-7201 namespaced storage, `Initializable`).

## What OZ provides (no modifications)

- Full ERC-7579 module management (`installModule`, `uninstallModule`, `isModuleInstalled`)
- Validator modules (type 1) — routes `isValidSignature()` and 4337 validation to installed validators
- Executor modules (type 2) — `executeFromExecutor()` for admin operations
- Hook modules (type 4) — preCheck/postCheck constraint enforcement
- Fallback handlers (type 3)
- ERC-1271 signature validation — delegates to validators via `isValidSignatureWithSender()`
- Token receiving (ETH, ERC-20, ERC-721, ERC-1155)

## TZAccount.sol additions

### Override: `_checkEntryPointOrSelf()`

Extends OZ access control to authorize hat-wearers for direct calls. Delegates to the installed HatValidator:

```solidity
function _checkEntryPointOrSelf() internal view override {
    if (msg.sender == address(entryPoint())) return;
    if (msg.sender == address(this)) return;
    if (HatValidator(hatValidator).isAuthorized(address(this), msg.sender)) return;
    revert Unauthorized();
}
```

### Convenience: `execute(address to, uint256 value, bytes calldata data)`

Simpler call signature for agents. Encodes as a 7579 single call and invokes the inherited `execute(bytes32 mode, bytes calldata)`. Goes through the full OZ pipeline: `_checkEntryPointOrSelf` → hooks → execution.

### Initialization

```solidity
function initialize(
    address _hatValidator, bytes calldata _hatValidatorInitData, // abi.encode(hatId)
    address _agreementExecutor, bytes calldata _executorInitData,
    address _hookMultiplexer, bytes calldata _hookInitData
) external initializer
```

- Sets `hatValidator` address (for `_checkEntryPointOrSelf` to call)
- Installs HatValidator as validator module
- Installs agreement contract as executor module
- Installs HookMultiPlexer as hook module

### Storage (minimal)

- `address public hatValidator` — for the `_checkEntryPointOrSelf` override
- Everything else lives in the modules themselves

## Deployment

- ERC-1167 minimal proxy clones
- Implementation deployed once
- Agreement contract deploys clones via `Clones.cloneDeterministic(impl, salt)`
- Salt: `keccak256(abi.encode(agreementAddress, zoneIndex))`
- Each clone initialized via `TZAccount.initialize(...)`

## Module configuration

| Module type | Contract | Role |
|------------|---------|------|
| Validator (1) | HatValidator | Hat-gated auth for direct calls + 4337 + ERC-1271 |
| Executor (2) | Agreement contract | Admin operations: configure hooks, manage resources on state transitions |
| Hook (4) | HookMultiPlexer | Constraint enforcement: routes to sub-hooks by target/selector/global |

---

# HatValidator Spec

## Role

Single source of truth for hat-based authorization. Reusable ERC-7579 validator module for any account.

## Interface

```solidity
contract HatValidator is IValidator {
    IHats public immutable HATS;  // set in constructor

    // Associated storage — keyed by the smart account that installed this module.
    // One HatValidator deployment serves all TZ accounts.
    mapping(address account => uint256) internal _hatIds;

    constructor(address hats) {
        HATS = IHats(hats);
    }

    // Direct-call authorization (called by TZAccount._checkEntryPointOrSelf)
    function isAuthorized(address account, address caller) external view returns (bool);

    // 4337 UserOp validation (called by OZ base)
    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash)
        external returns (uint256);

    // ERC-1271 signature validation (called by OZ base)
    function isValidSignatureWithSender(address sender, bytes32 hash, bytes calldata signature)
        external view returns (bytes4);

    // ERC-7579 lifecycle
    function onInstall(bytes calldata data) external;  // decode abi.encode(hatId), store keyed by msg.sender
    function onUninstall(bytes calldata data) external;
    function isModuleType(uint256 typeID) external pure returns (bool);
}
```

## Authorization logic

All three paths converge on `HATS.isWearerOfHat(signer, hatId)`, reading the hat ID for the calling account:
- `isAuthorized(account, caller)`: reads `_hatIds[account]`, checks caller directly
- `validateUserOp`: reads `_hatIds[msg.sender]`, recovers signer from UserOp signature
- `isValidSignatureWithSender`: reads `_hatIds[msg.sender]`, recovers signer from signature bytes

## State

Associated storage pattern (standard ERC-7579 module approach):
- `IHats public immutable HATS` — Hats Protocol contract address, set in constructor
- `mapping(address account => uint256) _hatIds` — one entry per TZ account that installs this module
- Configured via `onInstall(abi.encode(hatId))` — stores keyed by `msg.sender` (the installing account)
