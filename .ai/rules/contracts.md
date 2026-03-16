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

## Deploy scripts

Deploy scripts live in `script/`. Tests use the same deploy scripts to ensure the deployment path is tested.

Contracts that use `msg.sender` for ownership must take `owner` as an explicit constructor parameter so the deploy script can pass it through correctly (`vm.prank` doesn't propagate through nested `new` calls).

## Dependencies

All dependencies are git submodules in `packages/contracts/lib/`:

- OpenZeppelin contracts-upgradeable (AccountERC7579HookedUpgradeable)
- OpenZeppelin contracts (Clones, ECDSA, draft-IERC7579, draft-IERC4337)
- Hats Protocol
- Rhinestone core-modules (HookMultiPlexer)
- forge-std

## Chain

Base mainnet. Hats Protocol, ERC-8004 IdentityRegistry, and ReputationRegistry are already deployed — use existing instances, do not redeploy.
