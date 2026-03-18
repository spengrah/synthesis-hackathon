# E2E Integration Test

## Purpose

The E2E test validates the full Trust Zones pipeline end-to-end:

```
Compiler → SDK → Contracts → Events → Ponder → GraphQL
```

It serves three functions:

1. **Integration test** — catches mismatches between layers (e.g., compiler produces bytes that contracts reject, Ponder indexes fields the SDK can't query, SDK encodes payloads the contract doesn't accept)
2. **Demo rehearsal scaffold** — follows the same 9-beat scenario from [`demo.md`](../../.ai/spec/demo.md), so demo agents (day 4) become thin wrappers around this same flow
3. **Transcript generator** — each run produces `packages/e2e/transcript.md`, a narrated walkthrough with addresses, compiler inputs/outputs, state transitions, and assertions

## Architecture

```
Anvil fork (Base mainnet, block 43454644)
  ↓ deploy contracts (FOUNDRY_PROFILE=deploy, via-ir)
TypeScript driver (viem + SDK + compiler)
  ↓ submitInput transactions
Contract events
  ↓ indexed by
Ponder (child process, dev mode, port 42069)
  ↓ queryable via
GraphQL assertions (SDK's createPonderBackend)
```

## Running

```bash
pnpm test:e2e           # fresh Anvil fork → run tests
pnpm test:e2e:verbose   # same, with verbose reporter
```

Transcript saved to `packages/e2e/transcript.md` after each run.

## Test structure

The test follows the 9-beat demo scenario defined in [`demo.md`](../../.ai/spec/demo.md). Each beat is a sequential `it()` block in `test/lifecycle.test.ts`. `beforeAll` deploys contracts and starts Ponder + mock data API. `afterAll` tears down child processes and saves the transcript.

The test validates each beat's effect through **GraphQL assertions against Ponder** — checking state transitions, indexed entities, zone deployments, claim verdicts, etc. This is the same read path that real agents and UIs will use.

## Mock strategy

The E2E test runs all 9 beats from day 1. Components that aren't built yet use mocks. As each component is built, its mock is replaced with the real thing. The full flow stays green throughout.

### Current state (day 2)

| Component | Status | Implementation |
|---|---|---|
| Contracts | Real | Anvil fork, via-ir deployment |
| SDK | Real | Encode/decode/read library calls |
| Compiler | Real | compile + decompile with real templates |
| Ponder | Real | Child process, indexes events, serves GraphQL |
| Data APIs | **Mock** | Express server, validates endpoint permissions |
| Bonfires | Not mocked | Adjudicator uses direct contract reads |
| x402 Service | Not needed | SDK calls are equivalent |
| Adjudicator | Direct `submitInput` | No evidence evaluation |
| Demo Agents | Test driver | Functions perform actions directly |

### Replacement plan

Each replacement is a discrete task: make the E2E test pass with the real component instead of the mock.

| Component | When | What changes in E2E |
|---|---|---|
| **Data APIs** | Day 3 | Replace `MockDataApi` with real Express servers using ERC-8128 middleware + resource token auth. Same routes, real validation. Start as child process like Ponder. |
| **Bonfires** | Day 3 | Add assertions on Bonfires KG entities. Route data API receipts to Bonfires. Add sync wait similar to Ponder polling. |
| **x402 Service** | Day 4 | Replace direct `compileSchemaDoc()` / `encodePropose()` calls with HTTP requests to x402 `/compile` and `/encode` endpoints. Start x402 as child process. GraphQL assertions unchanged. |
| **Adjudicator** | Day 4-5 | Replace direct `submitInput(ADJUDICATE)` with adjudicator agent that queries Bonfires for evidence, evaluates, and delivers verdict autonomously. Beat 6 becomes: trigger adjudicator → wait for verdict event in Ponder. |
| **Demo Agents** | Day 4 | Replace test driver function calls with OpenServ agent API invocations. Each beat sends a message to the appropriate agent. GraphQL assertions unchanged — they validate end state, not transport. |

### How to replace a mock

1. Build the real component in its package
2. Add a child process manager (like `PonderManager`) if it's a server
3. Replace the mock calls in `lifecycle.test.ts` with real calls
4. Keep the same GraphQL assertions — they validate what happened, not how
5. Run `pnpm test:e2e` — if it passes, the real component is compatible

The key insight: **GraphQL assertions are the stable interface**. They validate state (agreements, zones, claims, verdicts), not transport (direct SDK call vs HTTP to x402 vs agent message). This is the extensibility seam.

## Package structure

```
packages/e2e/
  package.json
  tsconfig.json
  vitest.config.ts
  transcript.md              ← generated each run
  src/
    constants.ts              — Anvil accounts, pre-deployed addresses, fork block
    context.ts                — DemoContext type (extensibility point for future components)
    deploy.ts                 — Runs DeployAll forge script, reads JSON output
    ponder-manager.ts         — Start/stop Ponder child process
    mock-data-api.ts          — Mock ERC-8128 data API (beats 3-4)
    graphql.ts                — wait-for-indexed utilities + SDK PonderBackend
    demo-scenario.ts          — TZSchemaDocument construction + compilation
    transcript.ts             — Markdown transcript generator
  test/
    lifecycle.test.ts         — The E2E test: 9 sequential beats
```

## Dependencies on other packages

- **SDK** — encode/decode, ABI constants, `createPonderBackend()`, `decodeProposalData()`
- **Compiler** — `compile()`, `decompile()`, template registry, `BASE_MAINNET_CONFIG`
- **Ponder** — schema must define relations for SDK GraphQL queries; must store `rawProposalData` on proposals
- **Contracts** — `DeployAll.s.sol`, compiled with `FOUNDRY_PROFILE=deploy` (via-ir, 200 optimizer runs)

## Bugs found by this test

1. **SDK `encodeAccept()` returns empty payload** — contract requires the proposal payload to verify termsHash
2. **Ponder schema had no relations** — SDK GraphQL queries assumed nested fields (`agreementParties`, `trustZones`, `claims`) that flat `onchainTable` didn't expose
3. **Agreement.sol exceeds EIP-170 24KB limit** — required `profile.deploy` with via-ir + reduced optimizer runs (200)
4. **Staking (Penalty/HatsModule) wired as hat eligibility** — parties must stake between SET_UP and ACTIVATE, not after
5. **Ponder `startBlock: 0` on Anvil fork** — tried to sync 43M historical blocks; fixed to use fork block
6. **Permissions were on wrong zones** — permission tokens describe what the zone holder can *consume*, not what they *provide*
