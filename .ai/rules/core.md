# Core rules

- Spec documents in `.ai/spec/` are authoritative. Code must conform to spec.
- Keep changes scoped to the current build phase.
- Do not add features not in the spec.
- Prefer boring, readable code over clever abstractions.
- Contracts: keep gas costs reasonable but don't micro-optimize for a testnet demo.
- All Solidity interfaces must be defined before implementations.
- Event design and Ponder schema are co-designed — changes to events require schema updates.
- Spec and implementation must stay in sync. After any contract change, check and update the relevant spec files. Stale specs are a recurring source of reviewer findings and subagent confusion.
- When changing constructor parameters or immutables, trace the ripple: deploy scripts, test bases, harness constructor, AgreementRegistry pass-through, SDK ABI regeneration.
- The SDK, Ponder, and contracts share ABI definitions. After contract changes: rebuild (`forge build`), regenerate SDK ABIs, verify Ponder ABI alignment.

## Scripts

All project scripts are in the root `package.json`. Key commands:

```bash
pnpm test                      # all tests (contracts + sdk + ponder)
pnpm test:contracts            # full forge suite (auto-starts Anvil fork)
pnpm test:contracts:unit       # unit tests only
pnpm test:contracts:invariant  # invariant tests only
pnpm test:contracts:fast       # lite profile (quick smoke test)
pnpm test:contracts:ci         # CI profile (high fuzz/invariant runs)
pnpm test:sdk                  # SDK tests
pnpm test:ponder               # Ponder tests
pnpm build:sdk                 # build SDK
pnpm codegen:sdk               # regenerate SDK ABIs from forge artifacts
pnpm codegen:ponder            # regenerate Ponder schema types
pnpm fork:start                # manually start Anvil fork
pnpm fork:stop                 # stop Anvil fork
pnpm fork:status               # check if fork is running
```
