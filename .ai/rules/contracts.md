# Contract development rules

## Foundry configuration

- Solidity `>=0.8.28`, EVM target `cancun`
- Optimizer: `1_000_000` runs, `bytecode_hash = "none"` (deterministic deploys)
- Formatter: 2-space tabs, 120-char lines, `bracket_spacing = true`, `multiline_func_header = "attributes_first"`, `quote_style = "double"`
- Pre-commit hook runs `forge fmt` on staged `.sol` files

## Shared types

- `src/lib/TZTypes.sol` — Trust Zone protocol-level types (`TZParamType` enum, `TZMechanism`, `TZResourceTokenConfig`, `TZConfig`)
- `src/lib/AgreementTypes.sol` — Agreement-specific types (states, input IDs, adjudication actions, `ProposalData`, `AdjudicationAction`)

## Interface conventions

Each contract has a single interface file with inheritance:

```
IContractErrors      — custom errors
IContractEvents      — events
IContract            — inherits both, declares all functions
```

NatSpec: `@notice` for public docs, `@dev` for implementation details, `@param`/`@return` for all parameters.

## Constructor ownership

Constructors must take `owner` as an explicit parameter — never use `msg.sender`. `vm.prank` doesn't propagate through nested `new` calls in deploy scripts, so `msg.sender` in a constructor will be the deploy script contract, not the intended owner.

## Clone pattern

Contracts deployed as ERC-1167 minimal proxy clones (Agreement, TrustZone):
- Implementation constructor sets immutables shared across all clones (e.g., HATS, registries, impl addresses)
- Implementation constructor must call `_disableInitializers()` to prevent direct initialization
- Per-instance state is set via `initialize()` with the `initializer` modifier
- Use ERC-7201 namespaced storage to avoid slot collisions with inherited contracts

### Deterministic salt conventions
- Agreement clones: `keccak256(abi.encode(agreementHatId, block.chainid))`
- TrustZone clones: `keccak256(abi.encode(agreementAddress, zoneIndex))`

## Internal function design

- Decompose complex internals into small, focused functions for testability. Each should be exposable via a test harness.
- Factor out repeated checks into named internal functions (`_requireState`, `_requireTurn`, etc.) — avoid duplicating revert logic.

## Struct and event design

- Don't store derived data in structs. If a value can be computed (e.g., `termsHash = keccak256(payload)`), don't put it in the struct.
- Events should emit full data for indexer consumption. Don't rely on calldata availability — emit everything the indexer needs to reconstruct state.

## Deploy scripts

Deploy scripts live in `script/`. Tests use the same deploy scripts to ensure the deployment path is tested.

## Dependencies

All dependencies are git submodules in `packages/contracts/lib/`:

- OpenZeppelin contracts-upgradeable (AccountERC7579HookedUpgradeable)
- OpenZeppelin contracts (Clones, ECDSA, draft-IERC7579, draft-IERC4337)
- Hats Protocol + hats-module (eligibility chaining) + staking-eligibility
- Rhinestone modulekit + core-modules (HookMultiPlexer) + experimental-modules (PermissionsHook, SpendingLimitHook)
- forge-std

### Rhinestone module integration

Rhinestone uses npm for its dependency tree. After `forge install`:
1. `cd lib/modulekit && npm install`
2. Remappings point through `lib/modulekit/node_modules/` for transitive deps (solady, account-abstraction, etc.)

## Chain

Base mainnet. Hats Protocol, ERC-8004 IdentityRegistry, and ReputationRegistry are already deployed — use existing instances, do not redeploy.
