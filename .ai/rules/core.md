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
