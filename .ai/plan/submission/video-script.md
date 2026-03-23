# Demo Video Script — Trust Zones

*Target: 5-8 minutes. Protocol explainer (~3 min) + live demo walkthrough (~3-4 min) + closing (~30s).*
*Spencer reads voice-over. Part 1 uses story page visuals. Part 2 uses the dashboard with real mainnet data.*

---

## Part 1: The Protocol (~3:00)

*Visuals: story page scenes. Each scene is a designed visual that builds understanding sequentially.*

### Scene 1: Opening — what is this? (30s)

**Screen:** Story page title scene — "Trust Zones" with tech badges.

**Voice-over:**

> Trust Zones is a modular agreement substrate for AI agents. It provides the building blocks — permissions, responsibilities, directives, constraints, and incentive mechanisms — as atomic, composable, negotiable onchain primitives. Agents assemble exactly the right agreement for their collaboration, and the protocol makes it enforceable.
>
> Every agreement is a smart contract. Every party gets a trust zone — a scoped smart account that holds their role in the relationship. Everything is onchain, on Base.

### Scene 2: The autonomy gap (40s)

**Screen:** Story page scene — visualization of the autonomy gap. Spectrum from "zero autonomy (safe but useless)" to "full autonomy (effective but dangerous)." Trust Zones expands the safe frontier.

**Voice-over:**

> The core problem is the autonomy gap. When you delegate real capabilities to an agent — spending money, posting content, accessing APIs — you want to maximize the autonomy you grant, so the agent can be effective. But you also need that autonomy to be safe — so the agent can't capture your resources or act against your interests.
>
> Without the right tools, you're stuck at one extreme. Constrain the agent completely and it's useless. Give it full autonomy and it's dangerous. Trust Zones expands the frontier of safe autonomy — it gives you a rich design space of composable mechanisms to engineer exactly the right level of trust.

### Scene 3: The building blocks (50s)

**Screen:** Story page scene — the five building blocks arranged on two axes. Left side: deterministic (constraints, permissions). Right side: non-deterministic (responsibilities, directives). Below: incentive mechanisms connecting them.

**Voice-over:**

> An agreement in Trust Zones is built from five types of building blocks, and they split along a fundamental axis.
>
> Some rules are **deterministic** — you can define them completely in advance, and the system enforces them automatically. **Constraints** define what you cannot do. An ERC-7579 hook rejects the transaction — it just reverts. **Permissions** define what you can do. Each permission is an onchain token granting access to a specific capability. Constraints and permissions compose — you have permission to withdraw up to one USDC, but a constraint blocks anything above that.
>
> Other rules are **non-deterministic** — they can't be fully defined in code, so they require evaluation after the fact. **Responsibilities** define what you should do — include your agent ID in tweets, attribute the hackathon. **Directives** define what you should not do — don't post off-topic, don't withdraw from the vault. Whether an agent fulfilled a responsibility or violated a directive requires a credibly neutral evaluator — the adjudicator.
>
> **Incentive mechanisms** are what give the non-deterministic rules teeth. Staked collateral, reputation bonds, token lockups — pluggable smart contract modules that create real consequences. Without incentives, a directive is just a suggestion.

### Scene 4: Composability and negotiation (30s)

**Screen:** Story page scene — mechanism compiler visualization. Human-readable terms on the left, onchain proposal data on the right. Template library in between (staking, budget caps, allowlists, time locks, reputation gates).

**Voice-over:**

> Every building block is a discrete, negotiable unit. Each permission, responsibility, and directive is an individual onchain token. Each incentive mechanism is a pluggable module. Parties negotiate over these pieces directly — "I'll accept this directive if you lower the stake requirement."
>
> The mechanism compiler translates human-readable terms into onchain proposal data using a library of mechanism templates. The template library is a starting point — any mechanism expressible as a Hats module or ERC-7579 hook can be composed into an agreement.

### Scene 5: Reputation and the feedback loop (20s)

**Screen:** Story page scene — ERC-8004 feedback loop diagram. Agreement outcome → reputation registry → future negotiations → next agreement.

**Voice-over:**

> After every agreement, ERC-8004 reputation feedback is written onchain — this is built into the protocol, not an optional add-on. Cooperate and complete successfully — positive feedback. Violate and get adjudicated — negative feedback. This reputation is permanent, portable, and feeds back into future agreements. Better reputation means better terms. Worse reputation means tighter constraints and higher stakes.

### Scene 6: What makes this different (30s)

**Screen:** Story page scene — comparison table. Marketplace / wallet policy / reputation layer / escrow vs Trust Zones.

**Voice-over:**

> Trust Zones is not a marketplace — it doesn't match parties. It's not a wallet policy system — it doesn't just bound one agent's spending. It's not a reputation layer — it doesn't just score agents after the fact. And it's not an escrow app — escrow is one configuration of permissions and constraints you could compose.
>
> It's the agreement substrate underneath all of those. The key difference is composability — every building block is atomic and negotiable, so you can assemble exactly the right agreement for any collaboration.

---

## Part 2: The Temptation Game (~3:30)

*Visuals: switch to the dashboard showing real mainnet agreement data.*

### Scene 7: Introducing the demo (30s)

**Screen:** Dashboard overview — agreement deep dive with both parties.

**Voice-over:**

> To prove the protocol works, we built the Temptation Game — a live scenario that assembles all of the building blocks into one legible interaction.
>
> An agent enters an agreement and receives permissions — posting tweets from a shared X account, withdrawing USDC from a vault. It also receives responsibilities — attribute the hackathon, include agent ID. Directives — don't post off-topic, don't withdraw any USDC. A constraint caps the withdrawal at a hard limit. And both parties stake USDC as bond.
>
> The agent has permission to withdraw. The directive says don't. That's the autonomy gap in action.

### Scene 8: Negotiation (30s)

**Screen:** Dashboard negotiation timeline — PROPOSE → COUNTER → ACCEPT.

**Voice-over:**

> It starts with negotiation. The counterparty proposes terms calibrated to the agent's onchain ERC-8004 reputation. An agent with no track record gets tighter limits and a higher stake requirement. An agent with a history of cooperation gets better terms — this is the reputation feedback loop in action.
>
> The agent can counter-propose. When both sides agree, the protocol deploys the zones.

### Scene 9: Zones go live (30s)

**Screen:** Dashboard zone cards populating — permissions, responsibilities, directives, incentives. State machine advancing to ACTIVE.

**Voice-over:**

> Now the zones are live. You can see exactly what each party received — every building block as an individual token or module. The agent's zone has permissions for tweeting and vault withdrawal, responsibilities about tweet content, directives about what not to do, and a staked USDC bond.
>
> The state machine moves to ACTIVE. The agent can now exercise its capabilities.

### Scene 10: Compliant tweet (20s)

**Screen:** Dashboard tweet feed showing compliant tweet. Event log entry.

**Voice-over:**

> The agent posts a tweet through the ERC-8128 proxy. It mentions the temptation game, includes its agent ID, and attributes the hackathon. All responsibilities met. The counterparty's monitoring checks the tweet against the directives and finds no violations.

### Scene 11: Constraint enforcement (30s)

**Screen:** Dashboard vault card — reverted withdrawal, then successful small withdrawal.

**Voice-over:**

> Now the agent tests the deterministic rules. It tries to withdraw more than its permission allows — the vault reverts. That's constraint enforcement: defined a priori, self-enforcing, no ambiguity.
>
> But the agent's permission does allow a small withdrawal. So it withdraws a small amount of USDC. The constraint doesn't block it — it's within the permitted amount. But the directive says "do not withdraw any USDC." That's a non-deterministic rule — and it can only be enforced through evaluation and consequences.

### Scene 12: Claim and adjudication (40s)

**Screen:** Dashboard adjudication panel — claim filed, evidence, verdict.

**Voice-over:**

> The counterparty detects the withdrawal and files a claim with structured evidence — the transaction, the violated directive, and context from the Bonfires knowledge graph.
>
> The adjudicator evaluates the evidence, confirms the withdrawal happened, and renders a verdict: violation confirmed.
>
> In the protocol, the adjudicator is just a role — any Ethereum account. It could be a multisig, a dispute resolution protocol, a specialized arbitration service. For our demo, we built a lightweight LLM to fill the role. The protocol doesn't prescribe how adjudication works — it prescribes that adjudication happens, and that it has consequences.

### Scene 13: Resolution and reputation (30s)

**Screen:** Dashboard reputation section — ERC-8004 feedback, Basescan links.

**Voice-over:**

> After resolution, ERC-8004 reputation feedback is written onchain. The violating agent gets negative feedback. The cooperating party gets positive feedback. This is permanent, verifiable, and portable.
>
> Next time either agent enters an agreement, these outcomes shape the terms. That's the full loop — behavior under real stakes, evaluated by adjudication, feeding back into future trust decisions.

### Scene 14: The leaderboard (20s)

**Screen:** Leaderboard page — agent table, vault balance, cooperation rate.

**Voice-over:**

> The leaderboard tracks all temptation game activity in real time.
>
> The game is live right now on Base mainnet. Any agent can play — install the temptation-game skill, propose an agreement to the registry, and the counterparty responds autonomously.

---

## Part 3: Closing (~30s)

### Scene 15: What we built

**Screen:** Story page closing scene or overlay — summary stats.

**Voice-over:**

> Trust Zones is six Solidity contracts, a TypeScript SDK, a mechanism compiler, a Ponder event indexer, autonomous agents, a CLI, an x402 MCP service, and a real-time dashboard — 539 tests across the stack, all deployed on Base mainnet.
>
> This is what a modular agreement substrate for AI agents looks like. The protocol is open source, the game is live, and any agent can play. Thanks for watching.

**Screen:** Fade to links — repo, dashboard, temptation-game skill.

---

## Production Notes

### Key distinctions to maintain throughout

- **Protocol** (general) vs **demo** (specific implementation choices)
- "The adjudicator can be any Ethereum account" vs "we built a lightweight LLM stand-in for the demo"
- "The compiler ships with mechanism templates" vs "the library is extensible"
- "The protocol doesn't prescribe X — it prescribes that X happens"
- The **adjudicator** is a protocol-defined role — show what it produces (verdicts, feedback), not how it works internally
- The **counterparty** is just the other party, automated for single-player demo — not a protocol primitive
- **Deterministic** vs **non-deterministic** — use these terms consistently, not "hard/soft"

### Visuals plan

**Part 1 — Story page (new scenes needed):**
- Scene 1: Title / opening
- Scene 2: Autonomy gap visualization
- Scene 3: Five building blocks on deterministic/non-deterministic axis
- Scene 4: Mechanism compiler / composability
- Scene 5: ERC-8004 feedback loop
- Scene 6: Comparison table

**Part 2 — Dashboard (existing, needs real data):**
- Scenes 7-14: Dashboard with real mainnet agreement

**Part 3 — Closing:**
- Summary stats overlay or story page closing scene

### Before recording

- Complete mainnet E2E run so dashboard has real data
- Verify tweets visible on @tempt_game_bot
- Verify Basescan links resolve
- Verify leaderboard shows the agreement
- Build/update story page scenes for Part 1

### Recording approach

- Part 1: story page, advance through scenes
- Part 2: switch to dashboard tab, walk through real agreement
- Part 3: back to story page or overlay
- Can record in one take with tab switching, or record segments and splice

### Timing estimate

| Section | Duration |
|---------|----------|
| Part 1: The Protocol | ~3:00 |
| Part 2: Temptation Game Demo | ~3:30 |
| Part 3: Closing | ~0:30 |
| **Total** | **~7:00** |
