# Track Guide: Agents With Receipts — ERC-8004

**Sponsor:** Protocol Labs

## Bounty requirements

> Build agents that can be trusted. Leverage ERC-8004, a decentralized trust framework for autonomous agents.
>
> Required: (1) ERC-8004 integration via real onchain transactions, (2) autonomous agent architecture, (3) agent identity + operator model, (4) onchain verifiability.

## How Trust Zones meets each requirement

### 1. ERC-8004 integration — real onchain transactions

Trust Zones writes ERC-8004 reputation feedback at agreement resolution. This is not a wrapper or mock — the `Agreement` contract calls `IERC8004.giveFeedback()` on the ERC-8004 Reputation Registry when agreements close.

Two feedback paths:
- **COMPLETED outcome** — both parties receive positive feedback (tag: `COMPLETED`)
- **ADJUDICATED outcome** — the violating party receives negative feedback (tag: `ADJUDICATED`), the other receives positive feedback

This means every Temptation Game produces real ERC-8004 reputation artifacts on Base mainnet.

### 2. Autonomous agent architecture

The project includes two autonomous agents:
- **Counterparty agent** (`packages/agents/src/counterparty/`) — monitors the AgreementRegistry for proposals, evaluates the proposer's ERC-8004 reputation, calibrates terms (withdrawal limits, stake requirements), counter-proposes, monitors for violations, files claims
- **Adjudicator agent** (`packages/agents/src/adjudicator/`) — monitors for claims, evaluates evidence (onchain transactions + tweet content + directive text), renders verdicts, executes adjudication actions

Both run as persistent autonomous loops with planning, execution, and verification stages.

### 3. Agent identity + operator model

Each party in an agreement has an ERC-8004 agent ID. During agreement setup, each party's agent ID is stored in the Agreement contract. At resolution, `giveFeedback()` is called against those agent IDs — so reputation accrues to the agent's persistent ERC-8004 identity, not to ephemeral agreement-specific addresses.

Within an agreement, each party gets a Trust Zone — an ERC-7579 smart account and a Hats Protocol hat granting permission to control it. The agent operates *as* the zone onchain via `execute()` and offchain via ERC-8128 signatures.

### 4. Onchain verifiability

All agreement lifecycle events are onchain on Base:
- Agreement initilization, negotiation (proposals, counterproposals, and acceptance), setup (zone accounts, hat modules, resource tokens), activation, claims, adjudication, completion
- Resource token minting (permissions, responsibilities, directives)
- ERC-8004 feedback transactions
- Staking deposits and slashing via Hats eligibility modules

The Ponder indexer (`packages/ponder/`) indexes all events into a queryable GraphQL store. The Bonfires Graph (`https://trust-zone-agreements.app.bonfires.ai/graph`) provides a semantic search interface for the indexed data, including from offchain action receipts. 

### Reputation feedback loop (bonus)

ERC-8004 reputation is not just written — it's *read* and *used*. The counterparty agent queries an agent's prior reputation before proposing terms. Agents with clean records get better terms (lower stake, higher withdrawal limits). Agents with violations get tighter constraints. This is a closed feedback loop: behavior → reputation → future terms → behavior.

## Key paths

| What | Where |
|------|-------|
| ERC-8004 feedback in Agreement contract | `packages/contracts/src/Agreement.sol` — search for `giveFeedback` |
| ERC-8004 interface | `packages/contracts/src/interfaces/IERC8004.sol` |
| Reputation-aware negotiation | `packages/agents/src/counterparty/negotiate.ts` |
| Counterparty agent | `packages/agents/src/counterparty/` |
| Adjudicator agent | `packages/agents/src/adjudicator/` |
| Ponder reputation indexing | `packages/ponder/src/Agreement.ts` — search for `ReputationFeedback` |
| ERC-8004 viewer | https://agentproof.sh |
| Live demo | `packages/skill/temptation-game/SKILL.md` |
