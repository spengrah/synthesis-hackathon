# Testing rules

## Approach: test-driven development

1. Define the interface (types, errors, events, functions) in `src/interfaces/`
2. Write a BTT `.tree` file specifying all branching logic in `test/unit/<Contract>/`
3. Write tests based on the `.tree` file in `test/unit/<Contract>/*.t.sol`
4. Implement the contract in `src/` to make all tests pass
5. Run `forge fmt` and `forge test`

## BTT test trees

Each contract has a `.tree` file in `test/unit/<Contract>/` specifying all branching logic using the Branching Tree Technique:

- `given` = precondition / state setup
- `when` = action / condition being tested
- `it should` = leaf assertion

## Test naming

```
test_FunctionScenario()             — happy path
testFuzz_FunctionScenario()         — fuzz variant
test_RevertIf_ErrorCondition()      — revert case
```

File naming: `<Function>.t.sol` — one file per function or function group.

## Test base hierarchy

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

### Composable deployment helpers

Deployment logic lives ONCE in `ForkTestBase` as helper functions. Each contract-specific base calls only the helpers it needs. `IntegrationBase` calls all of them. No duplication.

### Deploy scripts in tests

Tests use the same deploy scripts from `script/` to ensure the deployment path is tested:

```solidity
function _deployResourceTokenRegistry() internal virtual {
    vm.startPrank(deployer);
    DeployResourceTokenRegistry deployScript = new DeployResourceTokenRegistry();
    registry = deployScript.execute(deployer);
    vm.stopPrank();
}
```

### Harness pattern

For testing internal functions (e.g., Agreement's `_handlePropose`, `_close`), create a harness contract in `test/harness/` that exposes internals as public functions. Use `AgreementHarnessBase` which overrides the deployment to use the harness.

## Fork testing

Fork tests use Base mainnet at a pinned block (`Constants.FORK_BLOCK`). Real deployed dependencies:

- Hats Protocol: `0x3bc1A0Ad72417f2d411118085256fC53CBdDd137`
- ERC-8004 IdentityRegistry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- ERC-8004 ReputationRegistry: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

Requires `INFURA_KEY` in `.env` for the Base RPC endpoint.

## Test directory structure

```
test/
├── Base.t.sol                          — all test bases
├── helpers/
│   ├── Constants.sol                   — fork block, addresses, prefixes
│   ├── Defaults.sol                    — default token IDs, metadata, struct builders
│   └── TestHelpers.sol                 — utility functions
├── harness/                            — contracts exposing internals for testing
├── unit/
│   ├── <Contract>/
│   │   ├── <Contract>.tree             — BTT spec
│   │   ├── <Function>.t.sol            — one file per function group
│   │   └── ...
│   └── ...
└── integration/
    ├── NegotiationFlow.t.sol
    ├── ActivationFlow.t.sol
    └── ...
```

## Standalone vs fork tests

Contracts with no external dependencies (e.g., ResourceTokenRegistry) use standalone test bases that inherit `Test` directly — no fork needed, faster execution. Contracts that interact with Hats Protocol or ERC-8004 use `ForkTestBase`.
