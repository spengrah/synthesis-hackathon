# Trust Zones — Contracts

Smart contracts for the Trust Zones protocol: an interoperability standard for machine agreements.

## Architecture

```
                                 ┌─────────────────────┐
                                 │  AgreementRegistry   │
                                 │  (factory + top hat)  │
                                 └──────────┬──────────┘
                                            │ createAgreement()
                                            │ deploys clone, creates hat,
                                            │ registers minter
                                            ▼
                           ┌──────────────────────────────────┐
                           │           Agreement               │
                           │     (state machine + router)       │
                           │                                    │
                           │  PROPOSED → NEGOTIATING → ACCEPTED │
                           │       ↓                      ↓     │
                           │    REJECTED              ACTIVE    │
                           │                      ↓    ↓    ↓   │
                           │                   CLAIM  EXIT  ... │
                           │                      ↓             │
                           │                   CLOSED           │
                           └──┬──────────────────┬──────────────┘
                              │                  │
                    activates │                  │ activates
                              ▼                  ▼
               ┌──────────────────┐  ┌──────────────────┐
               │   TrustZone A    │  │   TrustZone B    │
               │  (ERC-7579 acct) │  │  (ERC-7579 acct) │
               │  party A wears   │  │  party B wears   │
               │  zone hat        │  │  zone hat        │
               └────────┬─────────┘  └────────┬─────────┘
                        │                      │
          ┌─────────────┼──────────────────────┼─────────────┐
          │             │                      │             │
          ▼             ▼                      ▼             ▼
   ┌─────────────┐ ┌─────────┐        ┌─────────┐ ┌─────────────┐
   │ HatValidator │ │  Hook   │        │  Hook   │ │ HatValidator │
   │ (ERC-7579   │ │Multipl. │        │Multipl. │ │ (shared      │
   │  validator) │ │(ERC-7579│        │(ERC-7579│ │  instance)   │
   └─────────────┘ │  hook)  │        │  hook)  │ └─────────────┘
                   └────┬────┘        └────┬────┘
                        │                  │
                   ┌────┴────┐        ┌────┴────┐
                   │sub-hooks│        │sub-hooks│
                   │Permiss. │        │Spending │
                   │Hook etc │        │Limit etc│
                   └─────────┘        └─────────┘

  ┌────────────────────────────────────────────────────────────────┐
  │                   ResourceTokenRegistry                        │
  │              (ERC-6909, auto-generated IDs)                    │
  │  Permission (0x01) | Responsibility (0x02) | Directive (0x03)  │
  └────────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────────┐
  │                      Hats Protocol                             │
  │                   (deployed on Base)                            │
  │                                                                │
  │  Trust Zones Top Hat (worn by AgreementRegistry)               │
  │  ├── Agreement #1 Hat (worn by Agreement clone)                │
  │  │   ├── Zone A Hat (worn by party A → auth for TrustZone A)   │
  │  │   └── Zone B Hat (worn by party B → auth for TrustZone B)   │
  │  └── Agreement #2 Hat ...                                      │
  └────────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────────┐
  │                   ERC-8004 (deployed on Base)                   │
  │  IdentityRegistry — agent identity (ERC-721)                   │
  │  ReputationRegistry — feedback written on agreement close      │
  └────────────────────────────────────────────────────────────────┘
```

## Contracts

### AgreementRegistry (`src/AgreementRegistry.sol`)

Factory that deploys Agreement clones. Wears the Trust Zones top hat (minted in constructor). On `createAgreement(partyB, proposalData)`:

1. Creates an agreement-level hat (child of top hat)
2. Deploys an Agreement clone via `Clones.cloneDeterministic`
3. Mints the agreement hat to the clone
4. Registers the clone as an authorized minter on ResourceTokenRegistry
5. Initializes the clone with parties + proposal data

### Agreement (`src/Agreement.sol`)

State machine, zone manager, and mechanism router. Deployed as ERC-1167 minimal proxy clones. All interactions flow through `submitInput(bytes32 inputId, bytes payload)` (Shodai-compatible).

**State machine:**
```
bytes32(0) ─[init]──→ PROPOSED ─[COUNTER]──→ NEGOTIATING
                         │  ↑                    ↓  ↑
                         │  └──[WITHDRAW]   [COUNTER]─┘
                         │                       │
                    [ACCEPT]──────────────[ACCEPT]
                         │
                         ▼
                      ACCEPTED ─[ACTIVATE]─→ ACTIVE ──→ CLOSED
                                               │
                              CLAIM, ADJUDICATE, COMPLETE, EXIT, FINALIZE
```

**Activation** deploys two TrustZone clones (one per party), creates zone hats, installs modules (HatValidator, Agreement as executor, HookMultiPlexer), registers mechanisms, and mints resource tokens.

**Close** deactivates zone hats, writes ERC-8004 reputation feedback for each party with an agentId, and emits settlement events.

Implements: `IHatsToggle` (deadline-based auto-deactivation), `IHatsEligibility` (always eligible for hackathon), `IERC7579Module` (executor on TrustZones).

### TrustZone (`src/TrustZone.sol`)

ERC-7579 smart account — a party's zone within an agreement. Thin wrapper around OZ's `AccountERC7579HookedUpgradeable`. Deployed as ERC-1167 clones.

Adds:
- `_checkEntryPointOrSelf()` override — authorizes hat-wearers via HatValidator for direct calls
- `execute(address, uint256, bytes)` — convenience function encoding as 7579 single call
- `initialize()` — installs HatValidator (validator), Agreement (executor), HookMultiPlexer (hook)

An agent wearing the zone hat can operate *as* the TrustZone onchain (`execute()`) and offchain (ERC-8128 + ERC-1271 contract signatures).

### HatValidator (`src/modules/HatValidator.sol`)

ERC-7579 validator module gating authorization on Hats Protocol hat-wearing. Single deployment serves all TrustZone accounts via associated storage (`mapping(address => uint256)`).

Three auth paths converge on `hats.isWearerOfHat(signer, hatId)`:
- `isAuthorized(account, caller)` — direct call (TrustZone override)
- `validateUserOp(userOp, hash)` — ERC-4337
- `isValidSignatureWithSender(sender, hash, sig)` — ERC-1271

### ResourceTokenRegistry (`src/ResourceTokenRegistry.sol`)

ERC-6909 registry for typed resource tokens. Three types:

| Type | Prefix | Meaning |
|------|--------|---------|
| Permission | `0x01` | What you CAN do — access to a resource |
| Responsibility | `0x02` | What you MUST do — obligations |
| Directive | `0x03` | What you SHOULD/SHOULDN'T do — behavioral rules |

Token IDs are auto-generated: `(++counter << 8) | typePrefix`. Non-transferable except by creator (the Agreement that minted them). Max balance of 1 per holder. Immutable metadata set on mint.

### Shared Types

- `src/lib/TZTypes.sol` — `TZParamType` enum (9 values: Constraint, Permission, Responsibility, Directive, Eligibility, Reward, Penalty, PrincipalAlignment, DecisionModel), `TZMechanism`, `TZResourceTokenConfig`, `TZConfig`
- `src/lib/AgreementTypes.sol` — state/input/action constants, `ProposalData`, `AdjudicationAction`

## External Dependencies

**Deployed on Base (used as-is):**
- Hats Protocol: `0x3bc1A0Ad72417f2d411118085256fC53CBdDd137`
- ERC-8004 IdentityRegistry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- ERC-8004 ReputationRegistry: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

**Module libraries (available for constraint/eligibility templates):**
- Rhinestone HookMultiPlexer, PermissionsHook, SpendingLimitHook, ColdStorageHook
- Hats StakingEligibility, EligibilitiesChain

## Development

```shell
# Build
forge build

# Test (requires INFURA_KEY in .env for Base fork)
source .env && forge test

# Format
forge fmt

# Test profiles
FOUNDRY_PROFILE=lite forge test    # 32 fuzz runs
FOUNDRY_PROFILE=ci forge test      # 5000 fuzz runs
```

See `/.ai/rules/contracts.md` and `/.ai/rules/testing.md` for development conventions.
