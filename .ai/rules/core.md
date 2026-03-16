# Core rules

- Spec documents in `.ai/spec/` are authoritative. Code must conform to spec.
- Keep changes scoped to the current build phase.
- Do not add features not in the spec.
- Prefer boring, readable code over clever abstractions.
- Contracts: keep gas costs reasonable but don't micro-optimize for a testnet demo.
- All Solidity interfaces must be defined before implementations.
- Event design and Ponder schema are co-designed — changes to events require schema updates.
