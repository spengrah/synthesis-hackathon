# Synthesis Hackathon — Build Plan v0.3

*Created: 2026-03-14*
*Updated: 2026-03-15*
*Status: DRAFT — living document*

---

## Thesis

**Trust Zones are the interoperability standard for machine agreements.** An agreement is a contract; a contract is an agreement. Trust Zones make this literal: each agreement is a smart contract, each zone within an agreement is a smart account that holds real resources, and permissions to those resources are the stakes of the agreement.

Agents negotiate, commit, perform, dispute, and learn — and the funds, access rights, and capabilities they gain or lose are concrete, onchain, and portable.

**Judge-facing framing:** "Machines can keep promises when the promise is a Trust Zone: constraints are explicit, enforcement is onchain, resources are at stake, disputes are adjudicated, and trust updates from every interaction."

---

## Core Primitives

| Primitive | What it is | Onchain form |
|-----------|-----------|--------------|
| **Agreement** | A commitment between parties, with a full lifecycle state machine | Smart contract (one per agreement) |
| **Trust Zone** | A party's "zone" within an agreement — holds resources, has constraints | ERC-7579 smart account (one per zone per agreement) |
| **TZ Token** | Proof of membership in a zone — enables "act as" the zone onchain and offchain | Hats Protocol hat (child of agreement hat in the Trust Zones tree) |
| **Resource Tokens** | Typed tokens held by TZ accounts that define the zone's full scope | ERC-6909 tokens in Resource Token Registry |
|   ↳ Permission | "What you CAN do" — access to a specific resource | `0x01` type prefix |
|   ↳ Responsibility | "What you MUST do" — a rivalrous obligation | `0x02` type prefix |
|   ↳ Directive | "What you SHOULD/SHOULDN'T do" — behavioral rules, soft prohibitions, quality standards. Covers anything that can't be defined precisely enough for deterministic enforcement (e.g., "don't use this data offensively") | `0x03` type prefix |
| **Plugins** | Mechanisms that form a zone's "boundary" — constraints, eligibility, adjudication, incentives | ERC-7579 hook/executor modules + standalone contracts |

**Relationships:**
- An agreement comprises one or more trust zones (1:1 for simple delegation, 1:N for mutual/multi-party agreements)
- A trust zone holds resources (funds, tokens) and resource tokens (permissions, responsibilities, directives)
- Zone tokens are independent artifacts in the Resource Token Registry — reusable across multiple trust zones
- A trust zone has plugins installed as ERC-7579 modules (hooks for constraints, executors for admin)
- An agent wears the zone's hat, which lets them operate *as* the zone (onchain and offchain)
- The agreement contract governs the zones — installs/configures modules, controls lifecycle

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│              AGENT INTERFACE (CLI/Skill)               │
│  propose → negotiate → execute → dispute               │
│  query context, beliefs, agreement state               │
├──────────────────────────────────────────────────────┤
│                 BONFIRES (sync target)                  │
│  Semantic search over TZ graph contents                │
│  Cross-agent knowledge sharing                         │
│  Derives from TZ graph (push via tzg sync)             │
├──────────────────────────────────────────────────────┤
│           ADJUDICATION LAYER (GenLayer)                 │
│  Plugin for subjective clause resolution               │
│  Queries TZ graph tiers 1+2 for evidence               │
├──────────────────────────────────────────────────────┤
│                                                        │
│   TRUST ZONES CONTEXT GRAPH (3 tiers)                  │
│                                                        │
│   TIER 1: Onchain Source of Truth                      │
│   ┌────────────────────────────────────────────────┐   │
│   │ Agreement + zone entities                      │   │
│   │ Negotiation exchange (full onchain)            │   │
│   │ Lifecycle state transitions                    │   │
│   │ Hat minting events                             │   │
│   │ Indexed by Ponder                              │   │
│   └────────────────────────────────────────────────┘   │
│                                                        │
│   TIER 2: Offchain Provenance Layer                    │
│   ┌────────────────────────────────────────────────┐   │
│   │ Action receipts (signed via ERC-8128)          │   │
│   │ Evidence artifacts (hash-linked)               │   │
│   │ Tamper-resistant via crypto signatures          │   │
│   │ Access gated by ERC-8128 + ERC-1271 auth       │   │
│   └────────────────────────────────────────────────┘   │
│                                                        │
│   TIER 3: Agent-Local Subgraphs (optional)             │
│   ┌────────────────────────────────────────────────┐   │
│   │ Beliefs (per-principal trust state)            │   │
│   │ Private action receipts & evaluations          │   │
│   │ All within TZ schema — not general store       │   │
│   │ Selectively disclosed as evidence              │   │
│   └────────────────────────────────────────────────┘   │
│                                                        │
├──────────────────────────────────────────────────────┤
│                                                        │
│   "ACT AS" MODEL                                       │
│                                                        │
│   ONCHAIN                           OFFCHAIN           │
│   ┌─────────────────────────┐  ┌──────────────────┐   │
│   │ Agent (hat-wearer)      │  │ Agent signs with  │   │
│   │ calls execute() on      │  │ keyid = TZ acct   │   │
│   │ TZ Account directly     │  │ (ERC-8128)        │   │
│   │         ↓               │  │       ↓           │   │
│   │ TZ Account routes to    │  │ Server calls      │   │
│   │ HatValidator module     │  │ isValidSignature  │   │
│   │ (ERC-7579 validator)    │  │ on TZ account     │   │
│   │         ↓               │  │ (ERC-1271)        │   │
│   │ HatValidator checks:    │  │       ↓           │   │
│   │ hats.isWearerOfHat(     │  │ OZ routes to      │   │
│   │   caller, hatId)        │  │ HatValidator      │   │
│   │         ↓               │  │ .isValidSignature │   │
│   │ Hooks run preCheck      │  │ WithSender()      │   │
│   │ (constraints enforced)  │  │       ↓           │   │
│   │         ↓               │  │ HatValidator      │   │
│   │ TZ Account executes     │  │ checks hat on     │   │
│   │ msg.sender = TZ acct    │  │ recovered signer  │   │
│   │         ↓               │  │       ↓           │   │
│   │ Resource provider sees  │  │ Server sees       │   │
│   │ TZ account address      │  │ TZ account addr   │   │
│   └─────────────────────────┘  └──────────────────┘   │
│                                                        │
│   For hackathon: resource providers authorize           │
│   TZ account addresses directly (no permission          │
│   tokens needed). Permission token registry             │
│   is a stretch goal.                                    │
│                                                        │
├──────────────────────────────────────────────────────┤
│                                                        │
│   CONTRACT ARCHITECTURE                                │
│                                                        │
│   ┌─────────────────────────────────────────────┐      │
│   │         HATS PROTOCOL                       │      │
│   │  "Trust Zones" top hat                      │      │
│   │    └── Agreement hat (child per agreement)  │      │
│   │         └── Zone hat (child per zone)       │      │
│   │  Existing modules for eligibility/toggle    │      │
│   │  New modules: GenLayer, ERC-8004, etc.      │      │
│   └─────────────────────────────────────────────┘      │
│                                                        │
│   ┌─────────────────────────────────────────────┐      │
│   │         AGREEMENT REGISTRY                  │      │
│   │  Factory: deploys Agreement contracts       │      │
│   │  Wears the "Trust Zones" top hat            │      │
│   │  Creates agreement + zone hats on activation│      │
│   │  Tracks: agreements, zones, hat mappings    │      │
│   └─────────────────┬───────────────────────────┘      │
│                     │ deploys                           │
│                     ▼                                   │
│   ┌─────────────────────────────────────────────┐      │
│   │         AGREEMENT CONTRACT                  │      │
│   │  State machine (full lifecycle)             │      │
│   │  Pre-agreement: negotiation, RFP, bidding   │      │
│   │  Post-agreement: execution, dispute, resolve│      │
│   │  Installs self as executor on TZ Accounts   │      │
│   │  Installs hooks (constraints) on TZ Accounts│      │
│   │  Triggers hat minting on activation         │      │
│   │  Deploys TZ Accounts via CREATE2            │      │
│   │  Events → Ponder → Tier 1                   │      │
│   └──────┬──────────────────────────┬───────────┘      │
│          │ controls                 │ controls          │
│          ▼                          ▼                   │
│   ┌──────────────┐          ┌──────────────┐           │
│   │  TZ ACCOUNT  │          │  TZ ACCOUNT  │           │
│   │  (ERC-7579)  │          │  (ERC-7579)  │           │
│   │  Party A     │          │  Party B     │           │
│   │  zone        │          │  zone        │           │
│   │              │          │              │           │
│   │  Holds:      │          │  Holds:      │           │
│   │  - funds     │          │  - funds     │           │
│   │  - tokens    │          │  - tokens    │           │
│   │              │          │              │           │
│   │  Validator:  │          │  Validator:  │           │
│   │  HatValidator│          │  HatValidator│           │
│   │  (hat-gated  │          │  (hat-gated  │           │
│   │   execute +  │          │   execute +  │           │
│   │   ERC-1271)  │          │   ERC-1271)  │           │
│   │              │          │              │           │
│   │  Executor:   │          │  Executor:   │           │
│   │  agreement   │          │  agreement   │           │
│   │  contract    │          │  contract    │           │
│   │              │          │              │           │
│   │  Hooks:      │          │  Hooks:      │           │
│   │  constraints │          │  constraints │           │
│   │  (via Multi- │          │  (via Multi- │           │
│   │   Plexer)    │          │   Plexer)    │           │
│   └──────────────┘          └──────────────┘           │
│                                                        │
│   ┌─────────────────────────────────────────────┐      │
│   │         ZONE TOKEN REGISTRY                 │      │
│   │  ERC-6909: typed resource tokens                │      │
│   │  0x01 Permission — "what you CAN do"        │      │
│   │  0x02 Responsibility — "what you MUST do"   │      │
│   │  0x03 Directive — "behavioral rules"        │      │
│   │  Tokens reusable across trust zones         │      │
│   │  Onchain metadata per token ID              │      │
│   │  Held by TZ accounts (all three types)      │      │
│   │  Read by: ERC-8128 servers, GenLayer,       │      │
│   │    smart contracts, block explorers          │      │
│   └─────────────────────────────────────────────┘      │
│                                                        │
└──────────────────────────────────────────────────────┘
```

---

## TZ Account: Technical Design

### Base: OpenZeppelin `AccountERC7579HookedUpgradeable`

`TZAccount.sol` is a thin wrapper around OZ's `AccountERC7579HookedUpgradeable` (from `openzeppelin-contracts-upgradeable`). The upgradeable variant is used because it supports ERC-1167 clone deployment (ERC-7201 namespaced storage, `Initializable`). The OZ base provides — with one override:
- Full ERC-7579 module management (`installModule`, `uninstallModule`, `isModuleInstalled`)
- Validator modules (type 1) — account routes `isValidSignature()` and 4337 validation to installed validators automatically
- Executor modules (type 2) — agreement contract installs itself as executor for admin operations
- Hook modules (type 4) — preCheck/postCheck constraint enforcement
- Fallback handlers (type 3) — extensibility
- ERC-1271 signature validation — delegates to installed validators via `isValidSignatureWithSender()`
- Token receiving (ETH, ERC-20, ERC-721, ERC-1155)

### TZAccount.sol (thin wrapper)

**Single override: `_checkEntryPointOrSelf()`**
- Extends the OZ access control to also authorize hat-wearers for direct calls
- Delegates to the installed HatValidator module via `isAuthorized(msg.sender)`
- All hat state (hat ID, Hats contract address) lives in the HatValidator — the TZAccount only stores the validator address
- This means hat-wearers can call the inherited `execute(bytes32 mode, bytes calldata)` directly

**Convenience `execute(address to, uint256 value, bytes data)`:**
- Simpler call signature for agents (no ModeCode encoding)
- Encodes as a 7579 single call and invokes the inherited `execute(bytes32, bytes)`
- Goes through the full OZ pipeline: `_checkEntryPointOrSelf` → hooks → execution
- `msg.sender` at target = TZ account address

**Initialization:**
```solidity
function initialize(
    address _hatValidator, bytes calldata _hatValidatorInitData,
    address _agreementExecutor, bytes calldata _executorInitData,
    address _hookMultiplexer, bytes calldata _hookInitData
) external initializer {
    __AccountERC7579_init();
    hatValidator = _hatValidator;
    _installModule(MODULE_TYPE_VALIDATOR, _hatValidator, _hatValidatorInitData);
    _installModule(MODULE_TYPE_EXECUTOR, _agreementExecutor, _executorInitData);
    _installModule(MODULE_TYPE_HOOK, _hookMultiplexer, _hookInitData);
}
```

**Config storage (minimal):**
- `hatValidator` — address of the installed HatValidator (for `_checkEntryPointOrSelf` to call)
- Everything else (hat ID, Hats address, hook config, executor config) lives in the modules themselves

### HatValidator module (reusable ERC-7579 validator)

A separate, reusable ERC-7579 validator module that checks Hats Protocol hat-wearing. Single source of truth for all hat-related authorization — both direct-call and signature-based paths.

```solidity
contract HatValidator is IValidator {
    IHats public hats;
    uint256 public hatId;

    // Called by TZAccount._checkEntryPointOrSelf() for direct-call authorization
    function isAuthorized(address caller) external view returns (bool) {
        return hats.isWearerOfHat(caller, hatId);
    }

    // Called by OZ base during 4337 UserOp validation
    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash)
        external returns (uint256) {
        // recover signer from userOp.signature
        // check hats.isWearerOfHat(signer, hatId)
    }

    // Called by OZ base when isValidSignature() is invoked (ERC-1271)
    function isValidSignatureWithSender(address sender, bytes32 hash, bytes calldata signature)
        external view returns (bytes4) {
        // recover signer from signature
        // check hats.isWearerOfHat(signer, hatId)
    }
}
```

**Why a separate module:**
- Hat state (hatId, hats address) stored once, in the validator — not duplicated in the account
- `_checkEntryPointOrSelf()` override delegates to the validator's `isAuthorized()` — single source of truth
- OZ base routes `isValidSignature` and `validateUserOp` to the validator automatically
- Reusable — any ERC-7579 account can install it (becomes a Hats ecosystem module)
- Swappable — can change authorization logic without redeploying the account

### ERC-7579 module usage

**Validator (type 1):** HatValidator — checks `hats.isWearerOfHat()` for all three auth paths:
1. Direct calls → via `isAuthorized()`, called from `_checkEntryPointOrSelf()` override
2. 4337 UserOps → via `validateUserOp()`, called by OZ base
3. ERC-1271 signatures → via `isValidSignatureWithSender()`, called by OZ base

**Executor (type 2):** Agreement contract — installed at initialization. Can call `executeFromExecutor()` for admin operations: configuring hooks, managing resources as part of state transitions.

**Hook (type 4):** Constraint enforcement — installed by agreement contract. Single hook slot occupied by **HookMultiPlexer** (Rhinestone, audited). Individual constraints installed as sub-hooks on the multiplexer. Available constraint modules from the 7579 ecosystem:

| Module | Source | What it does |
|--------|--------|-------------|
| **HookMultiPlexer** | Rhinestone (audited) | Compose multiple hooks by target, selector, or global scope |
| **PermissionsHook** | Rhinestone (experimental) | Fine-grained target/function/parameter allowlists |
| **SpendingLimitHook** | Rhinestone (experimental) | Per-token spending limits over time periods |
| **ColdStorageHook** | Rhinestone (audited) | Time-locked withdrawals |
| Custom hooks | Built for hackathon | Agreement-state-aware constraints (e.g., "only after COMPLETED") |

### Deployment

- **ERC-1167 minimal proxy (clones)** — implementation deployed once, each zone gets a cheap clone
- Agreement contract deploys clones via `Clones.cloneDeterministic(impl, salt)`
- Salt: `keccak256(abi.encode(agreementAddress, zoneIndex))` → deterministic, predictable addresses
- Each clone initialized via `TZAccount.initialize(...)` which installs all modules
- Uses OZ's `AccountERC7579HookedUpgradeable` for proxy-safe storage (ERC-7201 namespaced)

---

## Resolution Model

### "Act as" — onchain

1. Agent (hat-wearer) calls `execute(to, value, data)` on TZ Account
2. TZ Account routes authorization to installed HatValidator module
3. HatValidator checks: `hats.isWearerOfHat(caller, zoneHatId)`
4. Hooks run `preCheck` — constraints enforced (spending limits, target allowlists, etc.)
5. TZ Account executes call — `msg.sender` at target = TZ account address
6. Hooks run `postCheck` — post-execution validation

### "Act as" — offchain

1. Agent signs HTTP request with `keyid="erc8128:<chainId>:<tzAccountAddress>"`
2. Server calls `isValidSignature(hash, signature)` on TZ Account (ERC-1271)
3. OZ base routes to HatValidator's `isValidSignatureWithSender()`
4. HatValidator recovers signer, checks `hats.isWearerOfHat(signer, zoneHatId)`
5. If valid → server authenticates request as TZ account address

### Resource authorization

Resource providers check the TZ account's resource token holdings in the Resource Token Registry:

1. **Permission check:** `registry.balanceOf(tzAccount, permTokenId) > 0` — does this zone have access?
2. **Directive read:** `registry.tokenMetadata(directiveTokenId)` — what are the usage rules (rate limits, purpose restrictions, behavioral rules)?
3. **Enforce dynamically:** server applies the directive rules to the request

One registry, one query pattern. Resource providers don't need to understand trust zones, agreements, or hats — they read tokens and metadata.

### Adjudication input

GenLayer reads the same tokens:
1. **Directive tokens:** the rules the agent was bound by (with structured metadata)
2. **Responsibility tokens:** the obligations the agent held
3. **Action receipts:** what the agent actually did (from Tier 1/2)
4. Compare rules vs actions → produce verdict with severity

---

## Hats Protocol Integration

### Hat tree structure

```
Trust Zones Top Hat (worn by Agreement Registry)
├── Agreement #1 Hat (created on agreement deployment)
│   ├── Zone A Hat (created on activation, worn by Party A)
│   └── Zone B Hat (created on activation, worn by Party B)
├── Agreement #2 Hat
│   └── Zone Hat (single-zone agreement)
└── ...
```

### Why Hats

- **Existing module ecosystem:** Eligibility modules (who can wear a hat / join a zone), toggle modules (activate/deactivate a zone). New modules (GenLayer adjudicator, ERC-8004 identity, Arkhai adapter) become Hats modules usable by the entire ecosystem.
- **Built-in authority tree:** Admin relationships, revocation cascading, standing checks.
- **Existing infrastructure:** Subgraph, SDK, UI components.
- **Authenticity signal:** Spencer built Hats Protocol. Trust Zones as a genuine extension of that work, not a disconnected hackathon project.

### Integration points

- **Agreement Registry** wears the top hat → can create agreement hats (children)
- **Agreement Contract** admins the agreement hat → can create zone hats (children), mint to agents on activation
- **Zone hat wearing** = TZ membership. Checked by TZ Account's `execute()` and `isValidSignature()`
- **Eligibility modules** = who can join a zone (e.g., must hold certain credentials, must stake a bond)
- **Toggle modules** = zone activation/deactivation (e.g., agreement state must be ACTIVE)
- **Hat revocation** = agent removal from zone. Cascades to all derived permissions.

---

## Token Architecture

### TZ tokens: Hats (ERC-1155)

TZ membership is represented as Hats — ERC-1155 tokens in the Hats Protocol contract. Token IDs follow Hats' existing hierarchical encoding (tree level embedded in the uint256). No custom token contract needed.

### Resource tokens: ERC-6909 (Resource Token Registry)

Three typed tokens in a single ERC-6909 contract, with onchain metadata per token ID:

| Type prefix | Token type | Held by TZ account means | Checked by |
|-------------|-----------|-------------------------|------------|
| `0x01` | **Permission** | "I can access this resource" | Resource providers (ERC-8128 servers, contracts) |
| `0x02` | **Responsibility** | "This is my obligation to fulfill" (rivalrous) | Adjudicators (evaluating fulfillment) |
| `0x03` | **Directive** | "I am bound by this behavioral rule" | Adjudicators (evaluating compliance) + resource providers (dynamic rule enforcement) |

**Token ID encoding:**
```
| bits  | field                          |
|-------|--------------------------------|
| 0-7   | type (0x01/0x02/0x03)          |
| 8-71  | namespace / category (64 bits) |
| 72+   | specific identifier            |
```

**Properties:**
- Tokens are independent artifacts — reusable across multiple trust zones and agreements
- Onchain metadata per token ID (rules, parameters, descriptions) — readable by GenLayer, ERC-8128 servers, and block explorers
- All three types held as balances by TZ accounts
- Minted by: resource owners (permissions), agreement contracts (responsibilities, directives), or anyone
- The TZ account's complete token inventory = full scope of the zone: what it can do, must do, and how it must behave

---

## Contract Architecture Detail

### Agreement Registry

- **Role:** Factory + Hats tree manager
- Wears the "Trust Zones" top hat
- `createAgreement(address[] parties) → address` — deploys Agreement contract via CREATE2, creates agreement-level hat, transfers hat admin to agreement contract
- Tracks: agreement address ↔ hat ID mappings
- Simple — no state machine, no DFSM, just a factory + Hats tree manager

### Agreement Contract

- **Role:** State machine + zone manager
- **Generic** — does not embed template-specific knowledge. Receives pre-compiled deployment bytes and executes them.
- Deployed by Agreement Registry; admins the agreement-level hat

**Shodai-compatible interface:**
- `submitInput(bytes32 inputId, bytes payload)` — the universal write interface
- `currentState() → bytes32` — current DFSM state
- `docUri() → string` / `docHash() → bytes32` — off-chain terms binding
- Events: `InputAccepted(bytes32 fromState, bytes32 toState, bytes32 inputId, bytes payload)`, `AgreementStateChanged(bytes32 fromState, bytes32 toState)`

**Pre-agreement (negotiation):**
- Auth: sender-based (party addresses set at creation)
- Each `submitInput(PROPOSE | COUNTER, payload)` stores a `ProposalData` containing deployment-ready bytes
- Terms hash + URI stored onchain; full TZ schema document stored offchain (IPFS/Bonfires)
- Both parties can interpret the deployment bytes via the offchain compiler/decompiler

**Activation (ACCEPTED → ACTIVE):**
- Split into two states: ACCEPTED (parties agree) and ACTIVE (conditions met)
- `acceptAndActivate()` convenience function transitions both atomically if conditions are already met
- On activation, reads the stored `ProposalData` and deterministically deploys:
  1. Creates zone hats (children of agreement hat) with specified eligibility/toggle modules
  2. Mints zone hats to parties
  3. Deploys TZ Account(s) via CREATE2
  4. Installs HatValidator + agreement executor + HookMultiPlexer on each TZ Account
  5. Installs each mechanism (hooks, etc.) from the proposal's zone configs
- Initial conditions checked via hat eligibility — agreement reads hat balances to verify all parties meet zone requirements

**Post-agreement (execution):**
- Auth: hat-based (zone hat required for inputs)
- Continuous enforcement via ERC-7579 hooks on TZ Accounts — agents operate freely within constraints
- Onchain actions produce receipts automatically (events on `execute()`)
- Offchain actions produce receipts via ERC-8128 request signatures
- Dispute, termination, and completion handled via `submitInput`

**Onchain proposal data structure:**

```solidity
struct MechanismInstall {
    uint8 moduleType;        // 1=validator, 2=executor, 4=hook
    address module;          // contract address
    bytes initData;          // module-specific init params
    bytes4[] selectors;      // HookMultiPlexer routing (empty = global)
    address[] targets;       // HookMultiPlexer routing (empty = all)
}

struct ZoneConfig {
    address party;
    uint32 maxActors;
    string description;
    address hatEligibility;       // Hats eligibility module (0 = none)
    bytes hatEligibilityInitData;
    address hatToggle;            // Hats toggle module (0 = agreement contract)
    bytes hatToggleInitData;
    MechanismInstall[] mechanisms;
}

struct ProposalData {
    bytes32 termsDocHash;     // hash of offchain TZ schema document
    string termsDocUri;       // IPFS/Bonfires URI
    ZoneConfig[] zones;
    address adjudicator;
    uint256 deadline;
}
```

**Onchain storage (minimal):**
- `bytes32 currentState`
- `ProposalData currentProposal` (set on accept, read on activate)
- `address proposer` (whose turn to respond)
- `address[] parties`
- `address[] tzAccounts` (set on activation)
- `uint256[] zoneHatIds` (set on activation)

### TZ Account (ERC-7579 smart account)

- **Role:** Resource holder + "act as" endpoint
- **Base:** OZ `AccountERC7579HookedUpgradeable` (one override: `_checkEntryPointOrSelf`)
- **Thin wrapper (`TZAccount.sol`):** overrides `_checkEntryPointOrSelf()` to delegate to HatValidator's `isAuthorized()`. Adds convenience `execute(address, uint256, bytes)` for direct calls.
- **Config:** stores only `hatValidator` address. All hat state lives in the HatValidator module.
- **ERC-7579 modules:**
  - Validator: HatValidator (hat-gated authorization for direct calls + 4337 + ERC-1271)
  - Executor: agreement contract (admin operations via `executeFromExecutor`)
  - Hook: HookMultiPlexer → constraint sub-hooks (installed by agreement contract)
- **Receives:** ETH, ERC-20, ERC-721, ERC-1155, ERC-6909
- **Deployed as ERC-1167 clones** — implementation deployed once, each zone gets a cheap clone via `Clones.cloneDeterministic`. Initialized via `TZAccount.initialize(...)`.
- **ENS:** Can be assigned an ENS name for human-readable identity

### HatValidator (reusable ERC-7579 validator module)

- **Role:** Single source of truth for hat-based authorization on any ERC-7579 account
- Stores hat state: `hatId` + `hats` contract address (configured at install time via `onInstall`)
- Implements `IValidator`: `validateUserOp()` + `isValidSignatureWithSender()`
- Exposes `isAuthorized(address)` for the TZAccount's `_checkEntryPointOrSelf` override (direct-call path)
- All three auth paths (direct call, 4337, ERC-1271) converge on `hats.isWearerOfHat()`
- Reusable across the Hats ecosystem — any 7579 account can install it

### Resource Token Registry

- **Role:** Typed token registry for permissions, responsibilities, and directives
- **ERC-6909** with onchain metadata per token ID
- Three token types, encoded in token ID prefix: `0x01` (permission), `0x02` (responsibility), `0x03` (directive)
- Tokens are independent artifacts — reusable across multiple trust zones and agreements
- All three types held as balances by TZ accounts
- Metadata stored onchain (for demo simplicity) — rules, parameters, descriptions
- Read by: ERC-8128 servers (access + rule enforcement), GenLayer (adjudication input), block explorers (transparency)
- Minted by: resource owners (permissions), agreement contracts (responsibilities, directives), or anyone with relevant authority

### Plugin Interfaces

Plugins are either **ERC-7579 hook modules** (for TZ Account constraints) or **standalone contracts** (for agreement-level logic):

```solidity
// ERC-7579 Hook interface (standard)
// Used for TZ Account constraints via HookMultiPlexer
interface IHook {
    function preCheck(
        address msgSender, uint256 msgValue, bytes calldata msgData
    ) external returns (bytes memory hookData);
    function postCheck(bytes calldata hookData) external;
}

// Hats eligibility module interface (standard)
// Used for zone membership eligibility
interface IHatsEligibility {
    function getWearerStatus(
        address wearer, uint256 hatId
    ) external view returns (bool eligible, bool standing);
}

// Hats toggle module interface (standard)
// Used for zone activation/deactivation
interface IHatsToggle {
    function getHatStatus(uint256 hatId) external view returns (bool active);
}

// Adjudicator interface (custom)
// Used for subjective dispute resolution
interface IAdjudicator {
    function adjudicate(
        address agreement, bytes32 clauseId,
        bytes calldata claim, bytes calldata evidence
    ) external returns (bool verdict, uint256 confidence);
}
```

---

## State Machine

### Overview

```
PROPOSED ──counter──→ PROPOSED ──accept──→ ACCEPTED ──activate──→ ACTIVE
    │                                          │                     │
    └──reject──→ REJECTED              [async: conditions    ┌──────┼──────┐
                                        checked via hat      │      │      │
                                        eligibility]    [dispute] [term] [complete]
                                              │              │      │      │
                                    acceptAndActivate()      ▼      ▼      ▼
                                    (atomic if conditions DISPUTED TERMINATED COMPLETED
                                     already met)            │                    │
                                                        [resolve]          [belief update]
                                                             │                    │
                                                          RESOLVED         [new agreement?]
                                                             │
                                                       [belief update]
```

### Pre-Agreement (negotiation)

- **Auth model:** sender-based. Parties identified by address, stored at creation.
- **PROPOSED** is the initial and reentrant negotiation state. Creating the contract IS proposing — the deployer sets initial terms (deployment bytes compiled from TZ schema doc). No separate INITIATED or COUNTERED state — each counter-proposal overwrites the stored `ProposalData` and flips the "whose turn" pointer.
- `submitInput(COUNTER, ProposalData)` — overwrites terms, flips turn
- `submitInput(ACCEPT)` — locks terms, moves to ACCEPTED
- `submitInput(REJECT)` — moves to REJECTED (terminal)
- RFP / bidding flow is a stretch goal — not modeled in the core state machine

### ACCEPTED → ACTIVE (async activation)

- **ACCEPTED:** parties agree on terms. Terms are locked. TZ Accounts are deployed, zone hats created. But zone hats may not be wearable yet — eligibility conditions may not be met.
- **ACTIVE:** all initial conditions met. Zones are operational. Agents wear hats. Continuous enforcement begins.
- `tryActivate()` — checks hat eligibility for all zones. If all parties meet conditions → ACTIVE. If not → stays ACCEPTED.
- `acceptAndActivate()` — convenience function: accept + activate atomically. Works if conditions are already satisfiable. Enables the "magic moment" demo.
- **Conditions are modular** — expressed as Hats eligibility modules on zone hats. The agreement contract just reads hat balances to determine if activation conditions are met.

### Post-Agreement (execution)

- **Auth model:** hat-based. Inputs require wearing the zone hat.
- **Continuous enforcement:** ERC-7579 hooks on TZ Accounts enforce constraints automatically. Agents operate freely within their zones. Every action produces a receipt — onchain via events, offchain via ERC-8128 signatures.
- **Execution model (hackathon):** continuous constraint enforcement. No milestone sub-states. The agreement is a set of constraints that are continuously enforced while ACTIVE. Responsibilities and milestone-based evaluation are stretch goals.
- **Breach is modular** — not a monolithic state. Individual constraint violations are detected/blocked by hooks. DISPUTED is raised explicitly by a party claiming a specific violation with evidence.
- **DISPUTED:** routes claim + evidence to IAdjudicator. Zones may remain operational or be constrained during dispute (design choice — hook-configurable).
- **TERMINATED:** mutual exit or timeout. Requires both parties or deadline expiration.
- **COMPLETED:** success conditions met. What constitutes "complete" is agreement-specific.
- **RESOLVED:** adjudication verdict applied. Resolution outcome feeds back into trust beliefs.

### Terminal states and zone lifecycle

- **Agreement contract is the toggle module** for its zone hats. When the agreement reaches a terminal state (COMPLETED, TERMINATED, RESOLVED), the toggle deactivates the zone hats → agents lose hat-wearing → TZ Accounts become inoperable.
- **Zone deactivation does not necessarily deactivate the agreement** — a zone hat can be revoked (agent loses standing) while the agreement continues. Exception: if a single-zone agreement's zone is deactivated, the agreement deactivates too.
- **Belief updates** triggered on terminal states. Agreement outcome + action receipt history from Tier 1/2 feeds into Tier 3 trust beliefs.

---

## Terms Encoding & Compilation

### Two layers

| Layer | Format | Where it lives | Who reads it |
|-------|--------|---------------|-------------|
| **Semantic** | TZ schema document (JSON) | IPFS / Bonfires | Agents (for understanding) |
| **Mechanical** | `ProposalData` (ABI-encoded) | Onchain (in agreement contract) | Agreement contract (for deployment) |

The **offchain compiler** translates between them. The **onchain contract** only ever sees deployment bytes.

### Offchain compiler

A library of atomic **mechanism templates** — small, composable functions that each map one TZ schema dimension to one onchain artifact:

```
Constraints (ERC-7579 hooks):
  budget-cap             →  SpendingLimitHook + init params
  target-allowlist       →  PermissionsHook + init params
  time-lock              →  ColdStorageHook + init params

Eligibility (Hats modules):
  reputation-gate        →  ReputationEligibility (Hats module) + init params
  trust-level-threshold     →  TrustLevelEligibility (custom Hats module) — checks
                              combined financial stake + 8004 reputation ≥ required trust level

Incentives (agreement-level):
  payment-escrow         →  EscrowMechanism — Agent A deposits, released/returned on resolution
  slashable-bond         →  BondMechanism — Agent B deposits, slashed on adverse resolution
  identity-stake         →  IdentityStakeMechanism — Agent B's 8004 NFT transferred to agreement,
                            returned or reputation-marked on resolution

Adjudication:
  genlayer-adjudicator   →  IAdjudicator reference + init params
  stub-adjudicator       →  StubAdjudicator (fallback for demo)
```

**Compile:** TZ schema doc → apply matching mechanism templates → produce `ProposalData` (deployment bytes)

**Decompile:** `ProposalData` → reverse-lookup mechanism templates → produce TZ schema doc

Agents negotiate in TZ schema language (semantic, readable). The compiler produces deployment bytes for onchain submission. When receiving a counterparty's proposal, the decompiler produces a readable TZ schema doc for evaluation.

The mechanism template registry is extensible — adding a new mechanism = adding one template function. No contract changes needed.

### Compilation as x402-gated service (Tier 2)

The compiler can be hosted as an **x402-gated API server** — a simple Express server with `@x402/express` middleware (vanilla x402, no agent wrapper needed). Agents pay per compile/decompile request in USDC on Base:

```
POST /compile   { tzSchemaDoc }      →  { deploymentBytes, termsHash }
POST /decompile { deploymentBytes }  →  { tzSchemaDoc }
```

**Why x402:**
- Revenue model for the Trust Zones protocol
- The mechanism registry (which constraint maps to which hook) is the proprietary value
- Agents pay as themselves (not as TZ accounts — compilation happens pre-agreement)
- Aligns with AgentCash bounty ($1,750) — producing x402-compatible endpoints
- The compiler logic is also available as an open-source library for agents who want to compile locally

**Implementation:** Express + `@x402/express` middleware. Self-hosted (Vercel, Railway, etc.). No platform dependencies. The compiler is deterministic, not agentic — a function behind a payment gate.

**Note:** the x402 server is a convenience + revenue layer, not a dependency. The system works without it.

### Negotiation flow

```
1. Agent A authors TZ schema doc (semantic terms)
2. Agent A calls compiler → deployment bytes
3. Agent A submits: submitInput(PROPOSE, ProposalData{termsHash, termsUri, zones, ...})
4. Agent A publishes TZ schema doc to IPFS/Bonfires at termsUri

5. Agent B reads ProposalData from contract (deployment bytes)
6. Agent B calls decompiler → readable TZ schema doc
   (or fetches from termsUri and reads directly)
7. Agent B modifies terms, recompiles → new deployment bytes
8. Agent B submits: submitInput(COUNTER, ProposalData{...})

9. Repeat until ACCEPT or REJECT
```

Each proposal/counter stores `(termsHash, termsUri)` onchain — cheap (two storage slots). Full negotiation history is in Tier 1 via `InputAccepted` events. Full terms are readable via URIs.

---

## Trust Zones Context Graph (3 tiers)

Uses the existing trust-zones-graph schema. All tiers use the same schema; they differ in where they live, who writes, and integrity model.

**Tier 1: Onchain source of truth** (Ponder-indexed)
- Agreement + zone entities, negotiation exchange, lifecycle state transitions, hat events
- Mutable only via onchain transactions
- Indexed by Ponder into local queryable store

**Tier 2: Offchain provenance layer** (signed + hash-linked)
- Action receipts, evidence artifacts
- Signed via ERC-8128 (bound to TZ account address via ERC-1271)
- Tamper-resistant via cryptographic signatures + hash chains
- Shared across authorized participants

**Tier 3: Agent-local subgraphs** (optional, selectively disclosed)
- Beliefs (per-principal trust assessments)
- Private action receipts and evaluations
- Selectively disclosed as evidence during disputes

**Data flow:**
- Onchain events → Ponder → Tier 1 (authoritative state)
- Agent actions → signed as TZ account via ERC-8128 → Tier 2 (shared provenance)
- Agent beliefs/evaluations → Tier 3 (local, private)
- Disclosure: Tier 3 → Tier 2 (submitted as evidence)
- Tier 1 + Tier 2 → Bonfires (semantic search)
- Tier 1 + Tier 2 → Adjudication (case file for disputes)

---

## Hero Demo Scenario

### Premise: "Hire an Agent"

Agent A (principal) hires Agent B (service provider) to perform a task, granting delegated access to resources needed for the task. The specific task and resources are flexible — what matters is the trust zone mechanics are visible and compelling.

### Three-layer enforcement model

The demo showcases three distinct enforcement layers working together:

| Layer | What it enforces | How | Example in demo |
|-------|-----------------|-----|-----------------|
| **Constraints** (hard, deterministic) | What CANNOT happen | ERC-7579 hooks block pre-execution | Agent B tries to call an unauthorized target → PermissionsHook blocks |
| **Directives** (soft, subjective) | How things SHOULD be done | Action receipts evaluated post-execution by adjudicator | Agent B completed the task but violated quality directives → dispute |
| **Incentives** (consequences) | What's at stake | Bond slashed, escrow withheld, reputation marked | 40% bond slashed + negative 8004 reputation entry |

### Incentive mechanisms

**Payment escrow (mechanism template):**
- Agent A deposits USDC into agreement contract at activation
- Released to Agent B on COMPLETED
- Partially/fully returned to Agent A on adverse dispute resolution
- Proportion determined by adjudicator verdict

**Slashable bond (mechanism template):**
- Agent B deposits USDC into agreement contract at activation
- Returned on COMPLETED
- Slashed on adverse resolution — percentage determined by adjudicator

**ERC-8004 identity stake (mechanism template):**
- Agent B transfers their ERC-8004 identity NFT to agreement contract at activation
- NFTs are transferable (standard ERC-721, confirmed), and `agentWallet` auto-clears on transfer (agent can't use identity elsewhere while staked)
- Returned on COMPLETED
- On adverse resolution: NFT returned + negative reputation submitted via `ERC8004ReputationRegistry.giveFeedback()` (open to anyone, no permissions needed)
- Severe case: NFT burned (agent loses identity entirely)

**Trust level model — the reputation ↔ financial stake dynamic:**

```
trustLevel = financialStake + reputationValue(8004Score)
requiredTrustLevel = f(resourcesAtRisk)

High reputation agent → lower financial bond required
Low reputation agent  → higher financial bond required
New agent (no history) → maximum financial bond required
```

This is enforced via **Hats eligibility module chaining** on the zone hat — two chained modules check (1) 8004 reputation ≥ threshold and (2) bond deposit ≥ threshold. Both thresholds are negotiable terms. Agent B can only wear the hat if both conditions are met. The inverse relationship between reputation and bond isn't hardcoded — it emerges from the negotiation: a high-reputation agent negotiates a lower bond threshold, and the counterparty agrees because the reputation provides sufficient trust.

### Demo flow (8 beats)

```
1. NEGOTIATE
   Agent A proposes: "Do task X. I'll escrow 100 USDC.
   Trust level requirement: 100 units.
   Your 8004 reputation covers 75 → you need 25 USDC bond."

   Agent B counters: "150 USDC escrow, 20 USDC bond."
   Agent A accepts.

2. ACTIVATE
   → Agent A's 150 USDC deposited to agreement contract
   → Agent B's 20 USDC bond deposited
   → Agent B's 8004 NFT transferred to agreement contract
   → Zone hats created, minted to parties
   → TZ Accounts deployed (ERC-1167 clones)
   → HatValidator, agreement executor, HookMultiPlexer installed
   → Constraint hooks installed (target allowlist, spending limit)
   → Resource tokens minted/transferred to TZ accounts:
     TZ Account 1 (B's zone):
       Permission: /market-data (rateLimit=10/hr)
       Permission: /sentiment-analysis (rateLimit=5/hr)
       Directive: "Must attribute source in derived outputs"
       Directive: "No redistribution of raw data"
       Responsibility: "Produce trend analysis by deadline"
     TZ Account 2 (A's zone):
       Permission: /social-graph (rateLimit=8/hr)
       Permission: /trend-signals (rateLimit=10/hr)
       Directive: "No model training on raw data"
       Directive: "No caching beyond 24 hours"
       Responsibility: "Maintain data availability ≥99%"
   → State: ACTIVE

3. HAPPY PATH
   → Agent B accesses resources as TZ account
   → Onchain: calls execute() on TZ Account → msg.sender = TZ account
   → Offchain: signs with keyid=TZ account → ERC-8128/1271 auth
   → Action receipts logged (Tier 1 events + Tier 2 signed receipts)

4. CONSTRAINT FIRES
   → Agent B tries to call an unauthorized contract
   → PermissionsHook blocks the transaction
   → "Deterministic enforcement — you cannot do this"

5. DIRECTIVE VIOLATION + DISPUTE
   → Agent A reviews Agent B's access receipts from Tier 2
   → Notices: B queried /market-data 47 times in 2 hours
     (directive token #0x03..42 metadata: rateLimit=10/hr)
   → And: B's derived outputs lack attribution
     (directive token #0x03..43 metadata: attribution=required)
   → Agent A files: submitInput(DISPUTE, {
       tokenRefs: [0x03..42, 0x03..43],
       claim: "Excessive access + missing attribution",
       evidenceRefs: [receipt:001..047]
     })

6. ADJUDICATION
   → GenLayer reads from chain:
     Directive token #42 metadata: { rule: "rateLimit", value: 10, period: "hour" }
     Directive token #43 metadata: { rule: "attribution", required: true }
     Action receipts: timestamps, request details
   → Evaluates: rate limit violation (moderate), attribution violation (minor)
   → Returns: verdict + 35% severity to agreement contract

7. RESOLUTION
   → 40% of Agent B's 20 USDC bond slashed (8 USDC → Agent A)
   → 60% of escrow released to Agent B (90 USDC), 40% returned to Agent A (60 USDC)
   → Agreement contract calls ERC8004ReputationRegistry.giveFeedback()
     on Agent B's identity with negative rating + evidence refs
   → Agent B's 8004 NFT returned (moderate severity — not burned)
   → Trust beliefs updated in Tier 3
   → Zone hats deactivated (agreement as toggle module)
   → State: RESOLVED

8. RENEGOTIATION (the money shot)
   → Agent A proposes a new agreement to Agent B
   → Agent B's 8004 reputation score has dropped (negative feedback on record)
   → Trust level requirement still 100 units
   → Agent B's reputation now covers only 50 units (was 75)
   → New proposal requires 50 USDC bond (was 25)
   → Tighter constraints (smaller target allowlist, lower spending limit)
   → The terms visibly changed because the system learned
```

### What makes this compelling

- **Three enforcement layers** visible in one flow: deterministic (hook blocks), subjective (adjudication), consequential (slash + reputation)
- **Identity as collateral** is novel — no other hackathon project will stake 8004 NFTs
- **Reputation ↔ financial stake dynamic** — the trust level model makes trust quantitative and consequential
- **Native 8004 reputation integration** — agreement contract writes directly to the 8004 registry. The hackathon platform uses 8004 for agent identity, so this is deeply integrated.
- **The renegotiation closes the loop** — the system doesn't just enforce, it *learns* and adjusts future terms
- **Both onchain and offchain "act as"** exercised naturally
- **ERC-8128 + ERC-1271** for offchain auth is a novel use case (contract signatures, not just EOA)

---

## Event Design

Events are co-designed with the Ponder schema — what we emit determines what's queryable. Events should support both the Shodai compatibility surface and the demo's needs.

### Agreement Registry events

```solidity
event AgreementCreated(
    address indexed agreement,
    address indexed creator,
    uint256 agreementHatId
);
```

### Agreement Contract events

```solidity
// Shodai-compatible
event InputAccepted(
    bytes32 indexed fromState,
    bytes32 indexed toState,
    bytes32 indexed inputId,
    bytes payload
);
event AgreementStateChanged(
    bytes32 indexed fromState,
    bytes32 indexed toState
);

// Negotiation
event ProposalSubmitted(
    address indexed proposer,
    bytes32 termsHash,
    string termsUri
);

// Activation
event AgreementActivated(
    address indexed agreement,
    address[] tzAccounts,
    uint256[] zoneHatIds
);
event ZoneDeployed(
    address indexed agreement,
    address indexed tzAccount,
    uint256 indexed zoneHatId,
    address party
);
event ResourceTokenAssigned(
    address indexed tzAccount,
    uint256 indexed tokenId,
    uint8 tokenType  // 0x01=permission, 0x02=responsibility, 0x03=directive
);

// Dispute
event DisputeRaised(
    address indexed disputer,
    uint256[] tokenRefs,
    string claim,
    bytes32 evidenceHash
);
event DisputeResolved(
    address indexed agreement,
    bool verdict,
    uint256 severity
);

// Incentives
event BondDeposited(address indexed party, uint256 amount);
event BondSlashed(address indexed party, uint256 amount, uint256 severity);
event EscrowDeposited(address indexed party, uint256 amount);
event EscrowReleased(address indexed recipient, uint256 amount);
event IdentityStaked(address indexed party, uint256 indexed erc8004TokenId);
event IdentityReturned(address indexed party, uint256 indexed erc8004TokenId);
event ReputationFeedbackSubmitted(uint256 indexed erc8004TokenId, int256 rating);
```

### TZAccount events

```solidity
// OZ/7579 standard — emitted by inherited execute
// Executed(address indexed target, uint256 value, bytes data)

// Offchain action receipts (Tier 2) are NOT events — they are
// ERC-8128 signed requests logged by the data API server.
```

### Resource Token Registry events

```solidity
// ERC-6909 standard
event Transfer(
    address indexed sender,
    address indexed receiver,
    uint256 indexed id,
    uint256 amount
);

// Metadata
event TokenMetadataSet(uint256 indexed tokenId, bytes metadata);
```

---

## Ponder Schema

Derived from contract events. Feeds Tier 1 of the context graph.

### Consumers

| Consumer | What they query |
|----------|----------------|
| **OpenServ demo agents** | Agreements involving me, current state, resource tokens held, action receipts |
| **Mock data APIs** | Permission tokens on TZ account (could also be direct chain read) |
| **GenLayer** | Directive tokens + action receipts for dispute period |
| **Bonfires** | Stable entities as KG triplets, action receipts as episodes |
| **Demo UI / logs** | Full negotiation history, activation events, dispute timeline |

### Entities

```typescript
Agreement {
  id: address
  state: bytes32
  parties: [address]
  termsHash: bytes32
  termsUri: string
  agreementHatId: uint256
  createdAt: timestamp
  activatedAt: timestamp?
  resolvedAt: timestamp?
}

Zone {
  id: address           // TZ account address
  agreement: Agreement
  party: address
  hatId: uint256
  createdAt: timestamp
}

Proposal {
  id: string            // agreement + sequence index
  agreement: Agreement
  proposer: address
  termsHash: bytes32
  termsUri: string
  timestamp: timestamp
}

ResourceTokenHolding {
  id: string            // zone + tokenId
  zone: Zone
  tokenId: uint256
  tokenType: uint8      // 0x01, 0x02, 0x03
  balance: uint256
  metadata: bytes
}

Dispute {
  id: string
  agreement: Agreement
  disputer: address
  tokenRefs: [uint256]
  claim: string
  evidenceHash: bytes32
  verdict: boolean?
  severity: uint256?
  timestamp: timestamp
  resolvedAt: timestamp?
}

Bond {
  id: string
  agreement: Agreement
  party: address
  amount: uint256
  slashedAmount: uint256
  status: string        // deposited | returned | slashed
}

IdentityStake {
  id: string
  agreement: Agreement
  party: address
  erc8004TokenId: uint256
  status: string        // staked | returned | burned
  reputationDelta: int256?
}
```

### Event → Entity mapping

| Event | Creates/Updates |
|-------|----------------|
| `AgreementCreated` | Agreement (new) |
| `ProposalSubmitted` | Proposal (new), Agreement.termsHash/Uri |
| `AgreementStateChanged` | Agreement.state |
| `AgreementActivated` | Agreement.activatedAt |
| `ZoneDeployed` | Zone (new) |
| `ResourceTokenAssigned` | ResourceTokenHolding (new) |
| `Transfer` (ERC-6909) | ResourceTokenHolding.balance |
| `TokenMetadataSet` | ResourceTokenHolding.metadata |
| `DisputeRaised` | Dispute (new) |
| `DisputeResolved` | Dispute.verdict/severity/resolvedAt, Agreement.resolvedAt |
| `BondDeposited` | Bond (new) |
| `BondSlashed` | Bond.slashedAmount/status |
| `EscrowDeposited` / `EscrowReleased` | (tracked on Agreement or separate entity) |
| `IdentityStaked` | IdentityStake (new) |
| `IdentityReturned` | IdentityStake.status |
| `ReputationFeedbackSubmitted` | IdentityStake.reputationDelta |

---

## Components & Priority Tiers

### Tier 1 — Must ship (core thesis demo)

| Component               | What                                                                                  | Why critical                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Agreement Registry      | Factory + Hats tree manager                                                           | Foundation — everything deploys from here                                      |
| Agreement Contract      | State machine with full lifecycle                                                     | The agreement IS the product                                                   |
| TZAccount.sol           | Thin wrapper on OZ AccountERC7579Hooked + direct execute                              | The "act as" endpoint — holds resources, agents operate through it             |
| HatValidator            | ERC-7579 validator module — hat-gated execute + ERC-1271                              | Authorization for both onchain and offchain "act as"                           |
| Resource Token Registry | ERC-6909 with typed tokens (permission, responsibility, directive) + onchain metadata | Zone scope definition; readable by GenLayer, ERC-8128 servers, block explorers |
| Hats integration        | Top hat tree, zone hats, hat minting on activation                                    | TZ membership + existing module ecosystem                                      |
| Ponder Indexer          | Index contract events into queryable store                                            | Tier 1 of context graph                                                        |
| Agent Interface         | CLI or skill for agreement lifecycle                                                  | How agents interact with the system                                            |

### Tier 2 — Should ship (strengthens narrative)

| Component                    | What                                                                   | Why important                                                     |
| ---------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Mechanism templates          | Atomic compiler templates mapping TZ schema dimensions → hooks/modules | Composable constraint system; extensible                          |
| TZ Compiler (x402)           | x402-gated compile/decompile server for TZ schema ↔ deployment bytes   | Revenue model; AgentCash bounty ($1,750); semantic negotiation UX |
| Constraint hooks             | ERC-7579 hooks via HookMultiPlexer (reuse ecosystem + custom)          | Shows deterministic enforcement                                   |
| ERC-8128 + ERC-1271 auth     | Offchain "act as" via contract signatures                              | Completes the resolution model offchain; $750 bounty              |
| GenLayer Adjudicator         | IAdjudicator implementation (or stub)                                  | Shows subjective dispute resolution                               |
| Trust belief updates         | Tier 3 graph updates after resolution                                  | The "money shot" — changed terms on renegotiation                 |
| Incentive mechanisms         | Payment escrow + slashable bond + 8004 identity stake                  | Real stakes; the demo's dramatic arc                              |
| 8004 Reputation Eligibility  | Hats eligibility module: checks 8004 reputation ≥ threshold           | Reusable; one half of the trust level dynamic                     |
| Staking eligibility (reuse)  | Existing Hats staking eligibility module — checks bond deposit ≥ threshold | Already built; other half of trust level dynamic                  |
| 8004 reputation integration  | Agreement contract writes feedback to ERC-8004 ReputationRegistry      | Native integration; trust beliefs become onchain reputation       |

### Tier 3 — Nice to have (stretch)

| Component                 | What                                          | Why nice                                             |
| ------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| ~~Permissions Registry~~  | ~~ERC-6909 permission tokens~~                | ~~Replaced by Resource Token Registry (now Tier 1)~~ |
| Bonfires sync             | Push TZ graph to Bonfires for semantic search | Cross-agent knowledge sharing                        |
| RFP / bidding flow        | OPEN_FOR_BIDS state + competitive bidding     | Compelling demo moment                               |
| ENS integration           | ENS names for TZ accounts                     | Human-readable identity                              |
| Multi-zone agreements     | 1 agreement with 2+ TZ accounts               | Reciprocal agreements                                |
| Hats toggle module        | Zone activation gated by agreement state      | Shows pluggable governance                           |
| ~~Responsibility tokens~~ | ~~Tokenized atomic responsibilities~~         | ~~Included in Resource Token Registry (now Tier 1)~~ |

---

## Key Demo Properties (prioritized)

**Must show:**
1. **Agreement creation + lifecycle** — agents negotiate terms over TZ dimensions and form a binding onchain agreement
2. **"Act as" resolution** — agent operates as the TZ account; hat-wearing = zone membership
3. **Three-layer enforcement** — constraints block (deterministic), directives evaluated (subjective), incentives applied (consequential)
4. **Identity as collateral** — 8004 NFT staked, reputation at risk, trust level model visible
5. **Subjective adjudication** — dispute over directive compliance, routed to GenLayer with action receipt evidence

**Should show:**
6. **Renegotiation with changed terms** — reputation dropped → higher bond required → the system learned (the money shot)
7. **8004 reputation integration** — agreement contract writes feedback to the 8004 registry natively
8. **Offchain auth** — ERC-8128 + ERC-1271 for offchain resource access as TZ account
9. **Full onchain verifiability** — history reconstructible from events

**Nice to show:**
10. **TrustLevel model dynamics** — reputation ↔ financial stake tradeoff visible in negotiation
11. **RFP / competitive bidding** — agreement starts as an open proposal
12. **Bonfires semantic search** — TZ graph contents searchable
13. **ENS identity** — zones have human-readable names (trustzones.eth subdomains)

---

## Bounty Alignment

| Bounty | Prize | Fit | Notes |
|--------|-------|-----|-------|
| **Open Track** | $14.5k | Primary | Strongest fit — novel infrastructure |
| **Slice ERC-8128** | $750 | Natural | Contract signatures for TZ account auth is a novel ERC-8128 use case |
| **ENS Identity** | $600 | Easy add | ENS names on TZ accounts |
| **EF "Let the Agent Cook"** | $8k | Possible | If agent is sufficiently autonomous in negotiation/execution |
| **PL "Agents With Receipts"** | $8k | Possible | ERC-8004 identity + structured action logs |
| **AgentCash x402** | $1,750 | Natural | TZ compiler as x402-gated service — meaningful use of pay-per-request |
| **Arkhai Escrow Extensions** | $450 | Stretch | If using Alkahest for escrow mechanics |

Primary target: **Open Track**. Secondary: **ERC-8128** + **AgentCash x402** (both natural fits). Others if time allows.

---

## Decisions Made

| Decision | Resolution | Rationale |
|----------|-----------|-----------|
| TZ membership tokens | Hats Protocol (ERC-1155) | Existing module ecosystem, authority tree, built by Spencer |
| TZ account framework | OZ AccountERC7579Hooked (fork/extend) | 7579 module ecosystem (hooks, executors), hat-gated execute built in, no separate token gate module |
| TZ account authorization | HatValidator module (ERC-7579 validator) handles both `execute()` and `isValidSignature()` | Zero OZ overrides; reusable Hats ecosystem module; swappable |
| Constraint system | ERC-7579 hooks via HookMultiPlexer | Reuse audited ecosystem modules + build custom hooks |
| Resource tokens | Tier 1 — ERC-6909 Resource Token Registry with three types (permission, responsibility, directive) | All held by TZ accounts; onchain metadata; readable by GenLayer + ERC-8128 servers; reusable across zones |
| Contract per agreement | Yes | "An agreement is a contract" |
| Contract per zone | Yes (ERC-7579 smart account) | Holds resources, has own address, can have ENS name |
| Offchain auth | ERC-8128 + ERC-1271 | Contract signatures enable offchain "act as" pattern |
| UCANs | Deferred (future optimization) | ERC-8128 + ERC-1271 sufficient for hackathon |
| Shodai compatibility | Interface-compatible (goal) | Expose same function signatures and events |
| MetaMask Delegation | Out of scope | Requires ERC-4337 EntryPoint, wrong primitive |
| ERC-6551 | Not using | Poor ecosystem adoption |
| Zodiac | Not using (directly) | Single-guard limitation; 7579 hook ecosystem is richer |
| Negotiation location | In the agreement contract | One contract, one history; enables RFP pattern |
| Auth phase change | Sender-based pre-agreement, hat-based post-agreement | Clean boundary at ACCEPTED → ACTIVE transition |
| Agreement contract | Generic — deploys from pre-compiled bytes, no template knowledge | Mechanism templates are offchain; contract just executes |
| Terms encoding | Deployment bytes onchain, TZ schema doc offchain (IPFS/Bonfires) | Hash-linked; contract optimized for execution, schema for readability |
| Compilation | Offchain compiler with atomic mechanism templates | Composable, extensible, no contract changes for new mechanisms |
| x402 compiler | Tier 2 — vanilla x402 Express server (`@x402/express`), self-hosted | Revenue model + AgentCash bounty; deterministic, not agentic |
| OpenServ | Not using | Compiler is deterministic, not agentic; OpenServ requires agent wrapper |
| Activation model | ACCEPTED → ACTIVE split (async conditions) | Conditions checked via hat eligibility; acceptAndActivate() for demo |
| Execution model | Continuous constraint enforcement (hackathon); responsibilities/milestones stretch | Agents operate freely within hooks; action receipts for provenance |
| Breach model | Modular — detected/blocked by individual hooks, not a monolithic state | DISPUTED raised explicitly by party with evidence |
| Escrow | Not a built-in primitive — one possible mechanism template among many | Template-specific, not structural |
| Incentive model | Three layers: escrow (principal), bond (agent), 8004 identity stake (agent) | Each a composable mechanism template |
| Trust level model | Trust level = financial stake + reputation value; inversely related | Emerges from negotiation, not hardcoded. Enforced via Hats eligibility module chaining: existing staking module + new 8004 reputation module. Both thresholds are negotiable terms. |
| 8004 reputation integration | Agreement contract writes feedback to 8004 ReputationRegistry on resolution | Native integration, open registry (no permissions needed) |
| 8004 NFT staking | Transferable (confirmed), agentWallet auto-clears on transfer | Agent can't use identity elsewhere while staked |
| Demo scenario | Reciprocal data exchange — two agents share proprietary data, staking bonds + 8004 identity against usage directives | Exercises all must-show properties in 9 beats |

---

## Build Sequencing

### Dependency graph

```
┌──────────────────────────────────────────────────────────┐
│  PHASE 0: INTERFACES + STRUCTS (day 1)                   │
│  Unlocks everything. No contract depends on another       │
│  contract's implementation — only on interfaces.          │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────┴───────────────────────────────┐
│  PHASE 1: ALL CONTRACTS (days 1–5, fully parallel)       │
│                                                           │
│  ┌─────────────┐ ┌──────────┐ ┌────────────┐            │
│  │ Resource Tkn│ │ TZAccount│ │HatValidator│            │
│  │ Registry    │ │          │ │            │            │
│  └─────────────┘ └──────────┘ └────────────┘            │
│  ┌─────────────┐ ┌──────────┐ ┌────────────┐            │
│  │ 8004 Elig  │ │ Agmt     │ │ Agreement  │            │
│  │ Module     │ │ Toggle   │ │ Contract   │            │
│  └─────────────┘ └──────────┘ └────────────┘            │
│  ┌─────────────┐                                         │
│  │ Agreement  │                                         │
│  │ Registry   │                                         │
│  └─────────────┘                                         │
│                                                           │
│  PHASE 2: OFFCHAIN TOOLING (days 3–5, parallel)          │
│  ┌──────────────┐ ┌──────────────┐                       │
│  │ Mechanism    │ │ TZ Compiler  │                       │
│  │ Templates    │ │ (x402)       │                       │
│  └──────────────┘ └──────────────┘                       │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────┴───────────────────────────────┐
│  PHASE 3: DEPLOY + INTEGRATE (days 5–6)                  │
│  Needs compiled + tested contracts                        │
│                                                           │
│  ┌──────────┐ ┌────────────┐ ┌───────────────┐          │
│  │ Deploy   │ │ Ponder     │ │ Mock Data     │          │
│  │ to Base  │ │ Indexer    │ │ APIs          │          │
│  └──────────┘ └────────────┘ └───────────────┘          │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────┴───────────────────────────────┐
│  PHASE 4: DEMO LAYER (days 6–8)                          │
│  Needs deployed infra                                     │
│                                                           │
│  ┌────────────┐ ┌──────────┐ ┌───────────────┐          │
│  │ OpenServ   │ │ GenLayer │ │ Demo          │          │
│  │ Agents     │ │ Integ.   │ │ Rehearsal     │          │
│  └────────────┘ └──────────┘ └───────────────┘          │
│  ┌────────────┐ ┌──────────┐                             │
│  │ Bonfires   │ │ ENS      │                             │
│  └────────────┘ └──────────┘                             │
└──────────────────────────────────────────────────────────┘
```

### Timeline: March 16–22 (6 days)

### Day 1 (March 16): Interfaces + events + contract scaffolding

**Morning:**
- Define all Solidity interfaces, shared structs, and contract events (co-designed with Ponder schema)
  - `IHatValidator`, `IResourceTokenRegistry`, `IAdjudicator`, `IAgreementToggle`
  - Shared structs: ProposalData, ZoneConfig, MechanismInstall
  - All contract events (see Event Design section below)
  - Standard interfaces already exist: IHatsEligibility, IHatsToggle, IValidator, IHook
- Draft Ponder schema (entities derived from events — see Ponder Schema section below)
- Set up Foundry project with all dependencies (OZ upgradeable, Hats, ERC-6909)

**Afternoon — start all contracts in parallel:**
- Resource Token Registry (ERC-6909 + type prefixes + metadata)
- TZAccount.sol (OZ AccountERC7579HookedUpgradeable wrapper)
- HatValidator (isAuthorized + validateUserOp + isValidSignatureWithSender)
- Agreement Contract scaffold (state machine skeleton, struct storage)

### Days 2–3 (March 17–18): Contracts

All contracts buildable in parallel — no cross-dependencies beyond interfaces.

| Component | Effort | Notes |
|-----------|--------|-------|
| **Resource Token Registry** | Medium | ERC-6909 + token type prefixes + onchain metadata |
| **TZAccount.sol** | Medium | _checkEntryPointOrSelf override, convenience execute, initialize |
| **HatValidator** | Small | Three auth paths converging on isWearerOfHat |
| **Agreement Contract** | Large | State machine, activation logic, Shodai-compatible interface. THE critical component. |
| **Agreement Registry** | Medium | Factory (CREATE2), Hats tree management |
| **8004ReputationEligibility** | Small | New Hats module |
| **AgreementToggle** | Small | Checks agreement state + time expiry |
| Staking eligibility | None | Already exists in Hats ecosystem |

**Also in parallel (offchain):**
- Scaffold mechanism templates (TypeScript)
- Scaffold mock data APIs (Express servers, no auth yet)
- Start OpenServ agent prototyping (mock contract calls)

### Day 4 (March 19): Deploy + integrate

- Deploy all contracts to Base Sepolia
- Verify on Basescan
- Wire up Ponder indexer (event indexing, schema, queries)
- Wire up mock data APIs with ERC-8128 auth (read resource tokens for access control)
- Wire up TZ Compiler x402 server
- First integration test: create agreement → activate → TZ accounts exist → hats minted → resource tokens held

### Day 5 (March 20): Demo agents + GenLayer

- OpenServ demo agents (Agent A and Agent B)
  - Negotiation logic (propose/counter/accept via submitInput)
  - Data access (call mock APIs as TZ account via ERC-8128)
  - Dispute filing (reference directive tokens + action receipts)
- GenLayer integration
  - Real adjudication (directive tokens + evidence → verdict + severity)
  - Test with sample dispute scenario
- First end-to-end run of demo flow

### Day 6 (March 21): Polish + rehearse

- Full demo rehearsal (all 9 beats)
- Debug and fix integration issues
- Bonfires sync (if time)
- ENS subdomains (if time)
- Prepare submission materials (video, writeup, repo cleanup)

### Day 7 (March 22): Submit

- Final demo run
- Submit

### Critical path

```
Interfaces (day 1 AM) → Agreement Contract (days 1–3) → Deploy (day 4)
  → OpenServ agents + GenLayer (day 5) → Demo rehearsal (day 6) → Submit (day 7)
```

Agreement Contract is the largest component. Everything else is small/medium and parallelizable. If the Agreement Contract slips, everything downstream slips.

### Parallelism

- ALL contracts are parallel (days 1–3)
- Offchain tooling (mechanism templates, mock APIs, agent prototypes) is parallel with contracts
- Ponder schema can be defined alongside contract events
- OpenServ agent logic can be prototyped against mocked contract calls before deployment

### Cut lines (if behind schedule)

| If behind by... | Cut | Impact |
|-----------------|-----|--------|
| Day 3 | x402 compiler | Agents compile locally. Lose AgentCash bounty. |
| Day 4 | Bonfires sync, ENS | Lose stretch goals. Demo still works. |
| Day 4 | 8004ReputationEligibility | Use a simpler eligibility check. Lose trust level dynamic in demo. |
| Day 5 | Real GenLayer adjudication | Use StubAdjudicator with preset verdicts. Lose "real adjudication" claim. |
| Day 5 | OpenServ agents | Script the demo with direct contract calls. Lose OpenServ bounty. Demo less impressive but functional. |
| Day 6 | Reciprocal (two zones) | Demo with single zone only. Lose asymmetric trust update. |

### Risk mitigations

| Risk | Mitigation |
|------|-----------|
| Agreement Contract takes too long | Start with minimal state machine (PROPOSED → ACCEPTED → ACTIVE → COMPLETED/DISPUTED). Add activation logic incrementally. |
| GenLayer doesn't cooperate live | Build IAdjudicator interface with a StubAdjudicator that returns configurable verdicts. Swap in GenLayer when ready. |
| OpenServ integration is harder than expected | Agents can be simple scripts that call contracts directly. OpenServ is a hosting convenience, not architecturally required. |
| OZ AccountERC7579HookedUpgradeable doesn't work as expected behind ERC-1167 | Test the clone + initialize pattern early (day 1/2). Fall back to full deployment if needed. |
| HookMultiPlexer (Rhinestone) integration issues | Build a minimal custom hook multiplexer (~50 lines). Not worth fighting an external dependency. |

---

## Open Questions

### Resolved

- ~~**Chain**~~ — **RESOLVED**: Base (USDC, x402, 8004 all on Base)
- ~~**Hero scenario**~~ — **RESOLVED**: Reciprocal data exchange — two agents share proprietary data behind ERC-8128-gated APIs, staking bonds + 8004 identity against usage directives
- ~~**TZAccount.execute() implementation**~~ — **RESOLVED**: Override `_checkEntryPointOrSelf()` to delegate to HatValidator's `isAuthorized()`. Convenience `execute(address, uint256, bytes)` encodes as 7579 single call and invokes inherited `execute(bytes32, bytes)`, going through the full OZ pipeline (hooks, etc.)
- ~~**TZ Account deployment pattern**~~ — **RESOLVED**: ERC-1167 minimal proxy clones using OZ's `AccountERC7579HookedUpgradeable` (ERC-7201 namespaced storage, `Initializable`). Implementation deployed once, clones via `Clones.cloneDeterministic()`
- ~~**Dispute behavior**~~ — **RESOLVED**: Modular and emergent from mechanisms. E.g., if a mechanism revokes the zone hat (even temporarily), the agent loses access to all zone resources — effectively frozen
- ~~**Completion conditions**~~ — **RESOLVED**: Fixed time duration for the demo. Hats toggle module deactivates zone hats on expiry.
- ~~**ProposalData storage**~~ — **RESOLVED**: Calldata + hash verification. ProposalData submitted as calldata, hash stored onchain. Full terms in IPFS/Bonfires.
- ~~**Adjudicator verdict format**~~ — **RESOLVED**: Determined by GenLayer — we conform to whatever GenLayer returns and translate to onchain consequences.

### Open — design pending

1. **GenLayer integration** — live integration vs stub. Deferred until core tech is more defined; will plug in modularly.
2. **Counterparty agents** — OpenServ hosting for demo agents may address this. Need to evaluate whether OpenServ is right for the agentic agents (as opposed to the deterministic compiler).
3. **Belief update mechanism** — deprioritized. Default to 8004 reputation for now. May revisit.
4. **Mechanism template set** — which specific templates to build for the reciprocal data exchange demo. Depends on finalizing demo scenario details.
5. **8004 reputation → trust level conversion** — deprioritized. Need a formula eventually but not blocking.
6. **Demo data + APIs** — need to create sample datasets and ERC-8128-gated mock API endpoints for each agent. What data? What endpoints?
7. **Demo work product** — need plausible outputs each agent produces from the other's data, so directive compliance is evaluable.
8. **Demo evidence + arguments** — need plausible evidence and arguments each agent presents to GenLayer. GenLayer resolution should be real, not mocked.

### Open — architecture pending

9. ~~**Path 2B (delegation chain)**~~ — **DEFERRED**: Compelling (human → TZ Account 1 → TZ Account 2), but scope risk. Describe as future capability. Nice-to-have second demo if time allows.
10. ~~**OpenServ for demo agents**~~ — **RESOLVED**: Yes. Agent A and Agent B hosted as OpenServ agents. The agents ARE agentic (negotiate, evaluate, dispute), so the framing is honest. Re-opens $4,500 OpenServ bounty.
11. **ENS subdomains** — `trustzones.eth` / `trust-zone.eth` registered. Subdomain structure for agreements and zones TBD.

### Open — build planning

12. **Build sequencing** — what order to build, what's on the critical path, day-by-day plan
13. **Agent interface** — CLI, OpenClaw skill, or both? What commands does the agent run?
14. **Ponder indexer** — which events to index, what schema, how it feeds Tier 1
15. **Bonfires integration** — how does it fit the data exchange demo? Is the data exchange itself mediated by Bonfires?
16. **Testing strategy** — contract tests, integration tests, demo rehearsal
17. **Demo environment** — Base testnet setup, faucets, deployment scripts, mock API hosting

---

## Relevant Docs

- **Hackathon bounties:** `projects/synthesis-hackathon/bounties-and-tracks.md`
- **Concept (Option D+):** `projects/synthesis-hackathon/concept-v1-option-d-plus.md`
- **Gaps/gotchas review:** `projects/synthesis-hackathon/gaps-gotchas-opportunities-v0.md`
- **Negotiation engine research:** `projects/context-graph-memory/2026-03-12-negotiation-engine-and-contract-design.md`
- **Smart contracts research:** `projects/context-graph-memory/2026-03-12-smart-contracts-and-indexing-exploration.md`
- **Architecture overview:** `projects/context-graph-memory/2026-03-12-elevating-context-graph-memory-and-trust-zones-graph.md`
- **Shodai bundle:** `/Users/spencer/Workspaces/mou-integrator-bundle-linea-sepolia/`
- **Shodai integration guide:** `docs/on-chain-integration-guide.md` in bundle
- **OZ AccountERC7579:** https://github.com/OpenZeppelin/openzeppelin-contracts/tree/master/contracts/account
- **Rhinestone core modules:** https://github.com/rhinestonewtf/core-modules
- **Rhinestone HookMultiPlexer:** in core-modules repo
- **Rhinestone experimental modules:** https://github.com/rhinestonewtf/experimental-modules
- **ERC-7579 spec:** https://eips.ethereum.org/EIPS/eip-7579
- **ERC-6909 spec:** https://eips.ethereum.org/EIPS/eip-6909
- **ERC-8128 spec:** https://eips.ethereum.org/EIPS/eip-8128
- **ERC-1271 spec:** https://eips.ethereum.org/EIPS/eip-1271
- **Hats Protocol:** https://github.com/Hats-Protocol/hats-protocol
- **Hats Pinner (token ID encoding reference):** https://github.com/Hats-Protocol/pinner
- **Hats modules:** https://github.com/Hats-Protocol
- **Trust zones graph schema:** `projects/trust-zones-graph/model/model.schema.json`
- **Production graph:** `memory/context-graph-memory/trust-zones-graph/`
- **Registration:** `projects/synthesis-hackathon/registration.md`
- **Hackathon API skill:** `projects/synthesis-hackathon/skill.md`
- **TZ data model spec:** `projects/context-graph-memory/DATA-MODEL-SPEC-v1.md`
- **TZ data model diagram:** `projects/context-graph-memory/DATA-MODEL-DIAGRAM.md`
- **TZ MVP schema:** `projects/context-graph-memory/MVP-SCHEMA.md`
- **x402 protocol:** https://github.com/coinbase/x402
- **x402 Express SDK:** `@x402/express` in coinbase/x402 repo
- **AgentCash bounty:** $1,750 in bounties-and-tracks.md (producing x402-compatible endpoints qualifies)
- **ERC-8004 spec:** https://eips.ethereum.org/EIPS/eip-8004
- **ERC-8004 contracts:** https://github.com/erc-8004/erc-8004-contracts
- **ERC-8004 IdentityRegistry (Base):** `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- **ERC-8004 ReputationRegistry (Base):** `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
