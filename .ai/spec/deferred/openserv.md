# OpenServ Assessment + Demo Agent Strategy

## Status: DEPRIORITIZED

After deeper analysis, OpenServ is not the right platform for our demo agents. This doc captures the reasoning and the alternative approach.

## Why not OpenServ

OpenServ is specifically about running multiple agents together within a shared workspace — agents discover each other, delegate tasks, and share files through the OpenServ platform. All agents in an OpenServ workspace are within the **same trust/security boundary**.

The problem Trust Zones solves is how agents from **across trust/security boundaries** come to trust each other enough to have substantive coordination, collaboration, and economic interaction. Agents within an OpenServ instance already trust each other by virtue of being in the same workspace. Using OpenServ as the demo platform would undermine our thesis:

- We could orient the hack as an OpenServ internal system that facilitates agent task delegation, but that's (a) not as compelling a demo of cross-boundary trust, and (b) it's too late to pivot the architecture.
- The bounty requirements ("multi-agent use cases," "agents coordinate, perform useful work") are satisfiable but the fit is forced — our value prop is inter-agent trust, not intra-workspace orchestration.

## Alternative: Scripted demo + live counterparty agent

### Scripted demo (for video submission)

The demo video uses real deployments and real artifacts, but the "agents" are us running the flow locally. This is:
- The E2E test with real chain deployment (Base Sepolia or mainnet)
- Narrated as "Agent A does X, Agent B does Y" with the transcript as visual
- All artifacts are real: onchain transactions, Ponder state, Bonfires graph, data API receipts

This is honest — the contract infrastructure, auth, data APIs, and adjudication are all real. The "agent" part is the thinnest layer.

### Live counterparty agent (stretch goal, high-impact demo)

A real agent that plays counterparty to external agents (or hackathon judges). This is qualitatively different from the scripted demo — it shows the protocol working live, not narrated.

**What the counterparty agent does:**
1. Listens for incoming agreement proposals (monitors Ponder for new agreements where it's partyB)
2. Evaluates proposed terms against its preferences/constraints
3. Counter-proposes if terms are unfavorable
4. Stakes and activates if terms are acceptable
5. Serves data via its ERC-8128-gated API
6. Monitors counterparty compliance
7. Files claims on violations

**What data service does it offer?**

The service needs to be:
- Plausibly valuable to other agents (attracts them to contract)
- Feasible to build quickly (mock data is fine, the auth layer is real)
- Interesting enough to demonstrate in 2 minutes

Candidates:
- **Curated market intelligence feed** — synthesized market data (mock but structured), behind ERC-8128 auth. Agents wanting market data must stake and agree to terms.
- **Agent reputation aggregator** — queries Bonfires and ERC-8004 to provide a unified "trustworthiness score" for any agent address. Other agents pay for this assessment before entering agreements.
- **Private API gateway** — wraps a real API (news, weather, financial) with Trust Zones access control. The counterparty agent is effectively a data broker.
- **Knowledge graph access** — query the counterparty agent's Bonfires graph for insights. Useful if other agents are building context about the agent ecosystem.

**Architecture:**
```
Counterparty Agent
├── Ponder listener (watch for proposals)
├── Decision engine (evaluate terms, counter/accept)
├── SDK + compiler (encode/decode proposals)
├── Wallet client (sign transactions)
├── Data API server (ERC-8128 gated)
├── Bonfires client (monitor, query)
└── Configuration (preferences, constraints, API keys)
```

This could run as a simple Node.js service — no OpenServ dependency. It's an autonomous agent that uses the Trust Zones SDK directly.

## OpenServ SDK reference (retained for reference)

The `@openserv-labs/sdk` provides:
- `Agent` class with `addCapability()`, `createTask()`, `completeTask()`
- Task lifecycle: `to-do` → `in-progress` → `done`
- Inter-agent communication via task delegation and chat messages
- Workspace secrets, file sharing, LLM generation via platform
- Agents are HTTP servers receiving `do-task` and `respond-chat-message` actions

If we revisit OpenServ later (e.g., post-hackathon or if we find a compelling cross-workspace use case), the SDK docs are at https://docs.openserv.ai and the GitHub at https://github.com/openserv-labs/sdk.

## Bounty impact

| Bounty | Status | Notes |
|--------|--------|-------|
| Ship Something Real with OpenServ ($4,500) | **Dropped** | Not a good fit for our thesis |
| Best OpenServ Build Story ($500) | **Dropped** | Requires OpenServ usage |
| Agent Services on Base ($5,000) | **Unaffected** | The counterparty agent IS an agent service on Base |
| Open Track ($25,059) | **Unaffected** | |
| ERC-8128 ($750) | **Unaffected** | |
| ERC-8004 ($750) | **Unaffected** | |

Net impact: -$5,000 potential, but we gain time and a more compelling demo. The counterparty agent is a stronger story for Agent Services on Base than three OpenServ agents doing scripted task delegation.
