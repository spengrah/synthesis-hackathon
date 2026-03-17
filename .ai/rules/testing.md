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

Tests deploy contracts by instantiating the deploy script and calling `execute()` — do not use `new Contract()` directly. This ensures the deployment path is tested:

```solidity
function _deployResourceTokenRegistry() internal virtual {
    vm.startPrank(deployer);
    DeployResourceTokenRegistry deployScript = new DeployResourceTokenRegistry();
    registry = deployScript.execute(deployer);
    vm.stopPrank();
}
```

### Error references in tests

Import the Errors interface directly and reference errors via `IContractErrors.ErrorName.selector`. For errors with parameters, use `abi.encodeWithSelector`:

```solidity
vm.expectRevert(IResourceTokenRegistryErrors.NotAuthorizedMinter.selector);
vm.expectRevert(abi.encodeWithSelector(IResourceTokenRegistryErrors.InsufficientBalance.selector, from, id));
```

### Returned values

When a function returns a value (e.g., auto-generated token ID from `mint`), tests must capture and use the return value. Do not compute expected IDs independently — use the actual returned value for subsequent assertions.

### Harness pattern

For testing internal functions, create a harness contract in `test/harness/` that exposes internals as public. The harness calls `_getAgreementStorage()` (internal visibility) and forwards to internal handlers:

```solidity
function exposed_handleCounter(address caller, bytes calldata payload) external returns (bytes32) {
    AgreementStorage storage $ = _getAgreementStorage();
    return _handleCounter($, caller, payload);
}
```

Use `AgreementHarnessBase` which deploys the harness as the implementation. All agreement handler tests should use the harness — call `exposed_*` functions directly instead of routing through `submitInput()`. This allows testing handlers in isolation without the state machine router.

Keep a separate `InputAccepted.t.sol` that tests through `submitInput()` to verify the wrapper emits `InputAccepted` events correctly — the harness tests don't cover this since `InputAccepted` is emitted by the wrapper, not the handlers.

### Cross-language ABI verification

SDK and Ponder decode the same ABI-encoded data that Solidity produces. Use a Solidity fixture test (`test/fixtures/ABIFixtures.t.sol`) to generate encoded bytes, capture them in a shared JSON fixture file (`packages/sdk/test/fixtures/abi-fixtures.json`), and verify both sides decode identically. This proves ABI layout compatibility.

### Mocking external dependencies

For 8004 identity/reputation calls, use `vm.mockCall` and `vm.expectCall`:
```solidity
vm.mockCall(Constants.REPUTATION_REGISTRY, abi.encodeWithSelector(IReputationRegistry.giveFeedback.selector), abi.encode());
vm.expectCall(Constants.REPUTATION_REGISTRY, abi.encodeCall(IReputationRegistry.giveFeedback, (agentId, 0, 0, ...)));
```

For mechanism modules, use simple mock contracts that record calls:
```solidity
contract MockMechanism {
    bytes public lastCallData;
    fallback() external payable { lastCallData = msg.data; }
}
```

## Running contract tests

All test scripts are in the root `package.json`. Each `test:contracts:*` script automatically starts a local Anvil fork if one isn't already running.

### Local Anvil fork

Fork-based tests hit an RPC endpoint for every new address touched. A persistent local Anvil fork eliminates RPC latency and rate-limit risk. The test scripts handle this automatically, but you can also manage the fork manually:

```bash
pnpm fork:start      # start Anvil fork (Base mainnet at pinned block)
pnpm fork:status     # check if running
pnpm fork:stop       # stop Anvil, restore Alchemy URL in foundry.toml
```

`fork:start` swaps the `base` RPC endpoint in `foundry.toml` to `localhost:8545`. `fork:stop` restores it to Alchemy.

### Test scripts

```bash
pnpm test:contracts            # full suite (default profile: 64 fuzz runs, 32 invariant runs)
pnpm test:contracts:unit       # unit tests only (no integration/invariant)
pnpm test:contracts:invariant  # invariant tests only
pnpm test:contracts:fast       # lite profile (32 fuzz runs, 5 invariant runs)
pnpm test:contracts:ci         # CI profile (5000 fuzz runs, 100 invariant runs)
```

### Foundry profiles

| Profile   | Fuzz runs | Invariant runs | Invariant depth | Use case           |
|-----------|-----------|----------------|-----------------|--------------------|
| default   | 64        | 32             | 15              | Local development  |
| lite      | 32        | 5              | 20              | Quick smoke test   |
| ci        | 5000      | 100            | 25              | Pre-merge CI       |
| minimal   | 1         | 1              | 1               | Compilation check  |

### Invariant test gotchas

Invariant tests that run on a fork **must** restrict `targetSender` to known actor addresses. Without this, Foundry's fuzzer generates random `msg.sender` values, each triggering an RPC call to fetch account state — causing rate limits and slow runs.

## Fork testing

Fork tests use Base mainnet at a pinned block (`Constants.FORK_BLOCK`). Real deployed dependencies:

- Hats Protocol: `0x3bc1A0Ad72417f2d411118085256fC53CBdDd137`
- HatsModuleFactory: `0x0a3f85fa597B6a967271286aA0724811acDF5CD9`
- ERC-8004 IdentityRegistry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- ERC-8004 ReputationRegistry: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

Requires `ALCHEMY_API_KEY` in `.env` for the Base RPC endpoint (or a running local Anvil fork via `pnpm fork:start`).

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

## ERC-7201 storage hash verification

Subagents frequently generate incorrect ERC-7201 storage location hashes. Always recompute and verify:

```
keccak256(abi.encode(uint256(keccak256("namespace.string")) - 1)) & ~bytes32(uint256(0xff))
```

Check this against the constant in the contract before accepting subagent output.

## Clone ownership bootstrapping

When contract A (e.g., AgreementRegistry) deploys contract B (e.g., ResourceTokenRegistry) and B must have A as its owner, use `vm.computeCreateAddress` in tests to predict A's address before deployment, then deploy B with that predicted address as owner.

## Subagent review checklist

Before committing subagent output:
1. Verify ERC-7201 storage location hashes
2. Check error names match the interface (subagents sometimes invent their own)
3. Check event signatures match the interface
4. Review Base.t.sol for conflicts with other subagents' changes
5. Run `forge test` to confirm ALL tests pass (not just the new ones)
6. Check that naming/docs match the current model (e.g., "RegisteredMechanism" not "ClaimableMechanism")
7. If Agreement constructor changed, regenerate SDK ABIs (`pnpm run generate-abis` in packages/sdk)
8. If events changed, check Ponder ABI and handler alignment
9. Verify spec files are consistent with implementation — spec divergence is a recurring source of bugs
