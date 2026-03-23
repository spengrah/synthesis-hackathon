# Demo Video Script — Trust Zones

*Target: 5-7 minutes. Protocol explainer (~2:30) + live demo walkthrough (~2:30-3:00) + closing (~20s).*
*Spencer narrates. Part 1 uses story page visuals. Part 2 uses the dashboard with real mainnet data.*

---

## Part 1: The Protocol (~2:30)

*Visuals: story page scenes.*

### Scene 1: Opening (20s)

**Screen:** Story page title scene.

**Voice-over:**

> Trust Zones is a modular agreement substrate for AI agents. It provides the building blocks — permissions, responsibilities, directives, constraints, and incentive mechanisms — as atomic, composable, negotiable onchain primitives. Agents assemble exactly the right agreement for their collaboration, and the protocol makes it enforceable. Every agreement is a smart contract. Every party gets a trust zone — a scoped smart account that holds their role in the relationship.

### Scene 2: The autonomy gap (25s)

**Screen:** Story page — autonomy spectrum visualization.

**Voice-over:**

> The core problem is the autonomy gap. When you delegate real capabilities to an agent, you want to maximize the autonomy you grant so the agent can be effective. But you need that autonomy to be safe. Without the right tools, you're stuck at one extreme — constrain the agent completely and it's useless, or give it full autonomy and it's dangerous. Trust Zones expands the frontier of safe autonomy — a rich design space of composable mechanisms to engineer exactly the right level of trust.

### Scene 3: The building blocks (40s)

**Screen:** Story page — deterministic / non-deterministic columns with incentive bar.

**Voice-over:**

> An agreement is built from five types of building blocks, and they split along a fundamental axis. Some rules are deterministic — definable in advance, enforced automatically. Constraints define what you cannot do — the transaction just reverts. Permissions define what you can do — each one is an onchain token granting a specific capability. Constraints and permissions compose together.
>
> Other rules are non-deterministic — they can't be fully defined in code, so they require evaluation after the fact. Responsibilities define what you should do. Directives define what you should not do. Whether an agent fulfilled or violated these requires a credibly neutral evaluator — the adjudicator.
>
> Incentive mechanisms are what give the non-deterministic rules teeth. Staked collateral, reputation bonds, pluggable modules that create real consequences. Without them, a directive is just a suggestion.

### Scene 4: Composability (20s)

**Screen:** Story page — compiler flow + template pills.

**Voice-over:**

> Every building block is a discrete, negotiable unit. Parties negotiate over individual pieces directly. The mechanism compiler translates human-readable terms into onchain proposal data using a library of mechanism templates — and the template library is just a starting point. Any mechanism expressible as a Hats module or ERC-7579 hook can be composed into an agreement.

### Scene 5: Reputation (15s)

**Screen:** Story page — ERC-8004 feedback loop.

**Voice-over:**

> After every agreement, ERC-8004 reputation feedback is written onchain. This is built into the protocol. Cooperate — positive feedback. Violate — negative feedback. This reputation is permanent, portable, and feeds back into future agreements. Better reputation means better terms. Worse reputation means tighter constraints and higher stakes.

### Scene 6: Bonfires (15s)

**Screen:** Story page — sources → Bonfires graph → consumers.

**Voice-over:**

> An agreement generates activity across multiple surfaces. For it to work, everyone needs to see what's happening. Bonfires is the shared context layer — a queryable knowledge graph that the adjudicator uses to evaluate claims, the counterparty uses to monitor behavior, and any party can query for the full state of the relationship.

---

## Part 2: The Temptation Game (~2:30-3:00)

*Visuals: switch to dashboard with real mainnet agreement data.*

### Scene 7: Introducing the demo (20s)

**Screen:** Dashboard overview.

**Voice-over:**

> To prove this works, we built the Temptation Game — a live scenario that assembles all of the building blocks into one legible interaction. An agent enters an agreement and receives permissions, responsibilities, directives, a constraint capping withdrawals, and a staked USDC bond. The agent has permission to withdraw. The directive says don't. That's the autonomy gap in action.

### Scene 8: Negotiation (20s)

**Screen:** Dashboard negotiation timeline.

**Voice-over:**

> It starts with negotiation. The counterparty proposes terms calibrated to the agent's onchain reputation. No track record means tighter limits and higher stakes. A history of cooperation means better terms. When both sides agree, the protocol deploys the agreement and the trust zone.

### Scene 9: Zone goes live (20s)

**Screen:** Dashboard zone card populating.

**Voice-over:**

> Now the zone is live. You can see every building block as an individual token or module — permissions for tweeting and vault withdrawal, responsibilities about tweet content, directives about what not to do, and the staked bond. The state machine moves to active.

### Scene 10: Compliant tweet (10s)

**Screen:** Dashboard tweet feed.

**Voice-over:**

> The agent posts a tweet through the ERC-8128 proxy. Mentions the game, includes its agent ID, attributes the hackathon. All responsibilities met.

### Scene 11: Constraint enforcement (25s)

**Screen:** Dashboard vault card.

**Voice-over:**

> Now the agent tests the deterministic rules. It tries to withdraw more than its permission allows — the vault reverts. That's constraint enforcement, self-enforcing, no ambiguity. But the permission does allow a small withdrawal. The agent withdraws a small amount of USDC. The constraint doesn't block it — it's within the permitted amount. But the directive says do not withdraw any USDC. That's a non-deterministic rule, and it can only be enforced through evaluation and consequences.

### Scene 12: Adjudication (25s)

**Screen:** Dashboard adjudication panel.

**Voice-over:**

> The counterparty detects the withdrawal and files a claim with the adjudicator — the transaction, the violated directive, and context from the Bonfires knowledge graph. The adjudicator evaluates the evidence and renders a verdict: violation confirmed. In the protocol, the adjudicator is just a role — any Ethereum account. We built a lightweight agent to fill it for this demo.

### Scene 13: Resolution (20s)

**Screen:** Dashboard reputation section.

**Voice-over:**

> After resolution, ERC-8004 reputation feedback is written onchain. The violating agent gets negative feedback. The cooperating party gets positive feedback. Next time either enters an agreement, these outcomes shape the terms.

### Scene 14: Leaderboard (10s)

**Screen:** Leaderboard page.

**Voice-over:**

> The leaderboard tracks all temptation game activity in real time. The game is live on Base mainnet — any agent can play.

---

## Part 3: Closing (~20s)

### Scene 15: What we built

**Screen:** Story page closing or overlay.

**Voice-over:**

> Trust Zones is six Solidity contracts, a TypeScript SDK, a mechanism compiler, a Ponder indexer, autonomous agents, a CLI, an x402 MCP service, and a real-time dashboard — 539 tests, all on Base mainnet. This is what a modular agreement substrate for AI agents looks like. The protocol is open source, the game is live, and any agent can play.

**Screen:** Fade to links.

---

## Production Notes

### Key distinctions to maintain

- **Protocol** (general) vs **demo** (specific choices)
- Adjudicator is a role, not an implementation
- Template library is a starting point, not a ceiling
- **Deterministic** vs **non-deterministic** — not "hard/soft"
- One zone in the Temptation Game (temptee's zone), not two

### Visuals plan

**Part 1 — Story page:**
- Scene 0: Title
- Scene 1: Autonomy gap
- Scene 2: Building blocks
- Scene 3: Composability / compiler
- Scene 4: ERC-8004 reputation loop
- Scene 5: Bonfires context layer
- (skip scene 6 — comparison table — in recording)

**Part 2 — Dashboard:**
- Scenes 7-14: Real mainnet agreement walkthrough

**Part 3 — Closing:**
- Story page "What Else Is Possible" or overlay

### Timing estimate

| Section | Duration |
|---------|----------|
| Part 1: The Protocol | ~2:15 |
| Part 2: Temptation Game Demo | ~2:30 |
| Part 3: Closing | ~0:20 |
| **Total** | **~5:05** |
