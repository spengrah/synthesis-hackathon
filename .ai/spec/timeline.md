# Build Timeline

## March 16–22 (6 days). Submissions due March 22.

### Day 1 (March 16): Interfaces + events + scaffolding

**Morning:**
- Define all Solidity interfaces and shared structs
- Define all contract events (co-designed with Ponder schema)
- Draft Ponder entity schema
- Set up Foundry project with dependencies

**Afternoon:**
- Start all contracts in parallel (interfaces unlocks everything)

### Days 2–3 (March 17–18): Contracts (all parallel)

| Component | Effort | Notes |
|-----------|--------|-------|
| Resource Token Registry | Medium | ERC-6909 + type prefixes + metadata |
| TZAccount.sol | Medium | OZ wrapper + _checkEntryPointOrSelf + execute |
| HatValidator | Small | Three auth paths → isWearerOfHat |
| Agreement Contract | Large | State machine, activation, Shodai interface. CRITICAL PATH. |
| Agreement Registry | Medium | Factory + Hats tree |
| 8004ReputationEligibility | Small | New Hats module |
| AgreementToggle | Small | State + time check |

Also parallel (offchain):
- Mechanism templates (TypeScript)
- Mock data API scaffolding
- OpenServ agent prototyping

### Day 4 (March 19): Deploy + integrate

- Deploy all contracts to Base Sepolia
- Ponder indexer (event indexing, schema, queries)
- Mock data APIs with ERC-8128 auth
- TZ Compiler x402 server
- First integration test

### Day 5 (March 20): Demo agents + GenLayer

- OpenServ demo agents (negotiation, data access, dispute)
- GenLayer integration (real adjudication)
- First end-to-end demo run

### Day 6 (March 21): Polish + rehearse

- Full demo rehearsal (all 9 beats)
- Debug integration issues
- Bonfires sync (if time)
- ENS subdomains (if time)
- Submission materials

### Day 7 (March 22): Submit

## Critical path

```
Interfaces (day 1) → Agreement Contract (days 1–3) → Deploy (day 4)
  → OpenServ agents (day 5) → Demo rehearsal (day 6) → Submit (day 7)
```

## Cut lines (if behind)

| If behind by... | Cut | Impact |
|-----------------|-----|--------|
| Day 3 | x402 compiler | Agents compile locally. Lose AgentCash bounty. |
| Day 4 | Bonfires, ENS | Lose stretch goals. Demo works. |
| Day 4 | 8004ReputationEligibility | Simpler eligibility. Lose trust level dynamic. |
| Day 5 | Real GenLayer | StubAdjudicator with preset verdicts. Lose "real adjudication" claim. |
| Day 5 | OpenServ agents | Script demo with direct contract calls. Lose OpenServ bounty. |
| Day 6 | Reciprocal (two zones) | Single zone only. Lose asymmetric trust update. |
