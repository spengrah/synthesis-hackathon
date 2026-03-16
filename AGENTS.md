# AGENTS.md

Project-local agent instructions for the Synthesis Hackathon — Trust Zones.

## Project context

This is a hackathon project (The Synthesis, March 16–22 2026) building the Trust Zones protocol: an interoperability standard for machine agreements.

- Authoritative specs are in `.ai/spec/`. Code must conform to spec.
- Reference context (bounties, TZ data model, hackathon API) is in `.ai/context/`.
- Build log and progress artifacts go in `.ai/log/`.
- Development rules are in `.ai/rules/`.

## Monorepo structure

```
packages/
  contracts/    — Solidity (Foundry). Core onchain contracts.
  ponder/       — Ponder indexer. Events → queryable store.
  compiler/     — TypeScript. Mechanism templates + x402 server.
  data-apis/    — Mock ERC-8128-gated data APIs for demo.
  agents/       — OpenServ demo agents (Agent A + Agent B).
```

## Key specs (read before working)

- `overview.md` — thesis, primitives, architecture, resolution model
- `tz-account.md` — TrustZone + HatValidator
- `tokens.md` — Resource Token Registry (ERC-6909, 3 types)
- `agreement.md` — Agreement Contract + Registry, state machine
- `hats.md` — Hats Protocol integration
- `ponder.md` — Events, schema, entity mapping
- `demo.md` — Demo scenario (reciprocal data exchange, 9 beats)
- `compiler.md` — Mechanism templates + x402 server
- `timeline.md` — Build sequencing + cut lines

## Chain

Base (Sepolia for testnet, mainnet for production). USDC, x402, ERC-8004 all on Base.

## Dependencies (contracts)

- OpenZeppelin contracts-upgradeable (AccountERC7579HookedUpgradeable)
- OpenZeppelin contracts (Clones, ECDSA, draft-IERC7579, draft-IERC4337)
- Hats Protocol
- Rhinestone core-modules (HookMultiPlexer)
- forge-std

All dependencies are git submodules in `packages/contracts/lib/`.

## Submission deadline

March 22, 2026.

---

## Contracts: development workflow

### Foundry configuration

- Solidity `>=0.8.28`, EVM target `cancun`
- Optimizer: `1_000_000` runs, `bytecode_hash = "none"` (deterministic deploys)
- Formatter: 2-space tabs, 120-char lines, `bracket_spacing = true`, `multiline_func_header = "attributes_first"`, `quote_style = "double"`
- Pre-commit hook runs `forge fmt` on staged `.sol` files

### Approach: test-driven development

1. Define the interface (types, errors, events, functions) in `src/interfaces/`
2. Write a BTT `.tree` file specifying all branching logic in `test/unit/<Contract>/`
3. Write tests based on the `.tree` file in `test/unit/<Contract>/*.t.sol`
4. Implement the contract in `src/` to make all tests pass
5. Run `forge fmt` and `forge test`

### Shared types

- `src/lib/TZTypes.sol` — Trust Zone protocol-level types (`TZParamType` enum, `TZMechanism`, `TZResourceTokenConfig`, `TZConfig`)
- `src/lib/AgreementTypes.sol` — Agreement-specific types (states, input IDs, adjudication actions, `ProposalData`, `AdjudicationAction`)

### Interface conventions (from proposal-hatter)

Each contract has a single interface file with inheritance:

```
IContractErrors      — custom errors
IContractEvents      — events
IContract            — inherits both, declares all functions
```

NatSpec: `@notice` for public docs, `@dev` for implementation details, `@param`/`@return` for all parameters.

### BTT test trees

Each contract has a `.tree` file in `test/unit/<Contract>/` specifying all branching logic using the Branching Tree Technique:

- `given` = precondition / state setup
- `when` = action / condition being tested
- `it should` = leaf assertion

File naming: `<Function>.t.sol` — one file per function or function group.

### Test base hierarchy

All test bases are in `test/Base.t.sol`:

```
Test (forge-std)
└── ForkTestBase                    — Base mainnet fork, real Hats + 8004, deployment helpers
    ├── HatValidatorBase            — deploys HatValidator, creates test hat
    ├── TrustZoneBase               — deploys TrustZone clone + hat tree
    ├── AgreementBase               — deploys all contracts, creates agreement
    │   └── AgreementHarnessBase    — uses harness for internal function testing
    ├── AgreementRegistryBase       — deploys registry infrastructure
    └── IntegrationBase             — full environment, agreement factory helpers

ResourceTokenRegistryBase           — standalone (no fork needed), deploys registry + minter
```

**Key pattern: composable deployment helpers.** Each contract-specific base calls only the helpers it needs. `IntegrationBase` calls all of them. No duplication — all deployment logic lives in `ForkTestBase`.

### Deploy scripts

Deploy scripts live in `script/`. Tests use the same deploy scripts to ensure the deployment path is tested:

```solidity
// In ForkTestBase:
function _deployResourceTokenRegistry() internal virtual {
    vm.startPrank(deployer);
    DeployResourceTokenRegistry deployScript = new DeployResourceTokenRegistry();
    registry = deployScript.execute(deployer);
    vm.stopPrank();
}
```

Contracts that use `msg.sender` for ownership should take `owner` as an explicit constructor parameter so the deploy script can pass it through correctly (vm.prank doesn't propagate through nested `new` calls).

### Test naming

```
test_FunctionScenario()             — happy path
testFuzz_FunctionScenario()         — fuzz variant
test_RevertIf_ErrorCondition()      — revert case
```

### Fork testing

Fork tests use Base mainnet at a pinned block (`Constants.FORK_BLOCK`). Real deployed dependencies:
- Hats Protocol: `0x3bc1A0Ad72417f2d411118085256fC53CBdDd137`
- ERC-8004 IdentityRegistry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- ERC-8004 ReputationRegistry: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

Requires `INFURA_KEY` in `.env` for the Base RPC endpoint.

### Test directory structure

```
test/
├── Base.t.sol                          — all test bases
├── helpers/
│   ├── Constants.sol                   — fork block, addresses, prefixes
│   ├── Defaults.sol                    — default token IDs, metadata, struct builders
│   └── TestHelpers.sol                 — utility functions
├── harness/                            — contracts exposing internals for testing
├── unit/
│   ├── ResourceTokenRegistry/
│   │   ├── ResourceTokenRegistry.tree
│   │   ├── Mint.t.sol
│   │   └── ...
│   ├── HatValidator/
│   │   ├── HatValidator.tree
│   │   └── ...
│   ├── TrustZone/
│   ├── Agreement/
│   └── AgreementRegistry/
└── integration/
    ├── NegotiationFlow.t.sol
    ├── ActivationFlow.t.sol
    └── ...
```

### Rules

- Keep changes scoped to the current build phase
- Do not add features not in the spec
- Prefer boring, readable code
- All Solidity interfaces must be defined before implementations
- Event design and Ponder schema are co-designed
- Use deploy scripts for deployment, even in tests
- Constructor ownership: take `owner` as parameter, not `msg.sender`
- Respect `.ai/rules/*`
