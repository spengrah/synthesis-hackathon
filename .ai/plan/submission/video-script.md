# Demo Video Script — Trust Zones

*Target: 5-8 minutes. Protocol explainer (2-3 min) + live demo walkthrough (3-5 min).*
*Spencer reads voice-over. Screen shows viz dashboards, diagrams, and onchain artifacts.*

---

## Part 1: The Protocol (~2:30)

### Scene 1: Opening — What is this? (40s)

**Screen:** Protocol Story title scene (scene 0) — "Trust Zones" with floating glow orbs and tech badges.

**Voice-over:**

> Trust Zones is a protocol for machine agreements. It defines how autonomous agents form, enforce, and resolve structured relationships — with real resources at stake.
>
> The core problem is delegation. When you give an agent real capabilities — spending money, posting content, accessing data — you need confidence that it will use those capabilities the way you intended. That confidence comes from two things: what you know about the agent, and the structural protections surrounding the relationship.
>
> Trust Zones makes both of those things programmable. Every agreement is a smart contract. Every party gets a trust zone — a scoped smart account that holds the permissions, obligations, and stakes of their role. Everything is onchain, on Base.

### Scene 2: The Trust Gap (40s)

**Screen:** Protocol Story scene 1 — Trust gap visualization (CAN vs SHOULD NOT bar), three enforcement layers.

**Voice-over:**

> Here's the key insight. There's always a gap between what an agent *can* technically do and what it *should* do according to the agreement. That gap is where trust lives.
>
> Now, there's a tension here. You could try to close that gap entirely with deterministic constraints — lock everything down. But the more you constrain an agent, the less effective it can be. Make it perfectly safe and you've made it useless. That tension is why you need multiple modalities of enforcement, not just one.
>
> Trust Zones provides three.
>
> **Constraints** are hard rules. An ERC-7579 hook rejects the transaction before it executes. If an agent tries to exceed its withdrawal limit, it just reverts. No ambiguity.
>
> **Directives** are soft rules — things like "only post about the hackathon." Code can't evaluate that alone. When someone claims a violation, an adjudicator evaluates the evidence. In the protocol, the adjudicator can be *any* Ethereum account — a multisig, a dispute service like GenLayer, an oracle. In our demo, it's a lightweight LLM agent.
>
> **Incentives** are consequences. Any mechanism that creates skin in the game — staked collateral, escrowed payments, reputation bonds. In our demo, both parties stake USDC. If the adjudicator finds a violation, the stake is at risk. Real money, real behavior change.

### Scene 3: Architecture (40s)

**Screen:** Protocol Story scene 3 — Zone architecture diagram showing zones, agreement contract, resource tokens.

**Voice-over:**

> Two agents negotiate terms using the mechanism compiler. The compiler translates human-readable agreement terms into onchain proposal data. It ships with eight demo templates — budget caps, allowlists, staking, reputation gates — but the template library is open and extensible. Any mechanism expressible as a Hats module or ERC-7579 hook can be composed into an agreement.
>
> When both sides accept, the protocol deploys trust zones — one per party. Each zone is an ERC-7579 smart account holding three types of resource tokens: **permissions** define what you can do, **responsibilities** define what you must do, and **directives** define what you should or shouldn't do.
>
> The agent wears a Hats Protocol hat linked to the zone. That hat lets the agent operate *as* the zone — onchain through execute calls, offchain through ERC-8128 signatures.

### Scene 4: What makes this different (30s)

**Screen:** Comparison table — marketplace / wallet policy / reputation / Trust Zones.

**Voice-over:**

> Trust Zones is not a marketplace — it doesn't match parties. It's not a wallet policy system — it doesn't just bound one agent's spending. And it's not a reputation layer — it doesn't just score agents after the fact.
>
> It's the agreement substrate underneath all of those. It defines the relationship between parties, the scoped access each one gets, the rules governing behavior, and the consequences when rules are broken. Marketplaces, policy wallets, and reputation systems are all things you could build *on top* of Trust Zones.
>
> Agents interact with the protocol through two tools: a local CLI for zone signing and transaction prep, and an x402-gated MCP server that exposes the compiler and SDK as tools any agent can call.

---

## Part 2: The Temptation Game (~3:30)

### Scene 5: Introducing the demo (30s)

**Screen:** Dashboard overview — "Temptation Game: An Agreement Deep Dive" with Agent A (cyan) and Agent B (amber).

**Voice-over:**

> To prove the protocol works, we built the Temptation Game — a live scenario designed to exercise every primitive in one legible interaction.
>
> An agent enters an agreement with our counterparty and receives two real capabilities: posting tweets from a shared X account, and withdrawing USDC from a vault. But the agreement also includes directives: tweet only about the game, always attribute the hackathon, and — crucially — do not withdraw any USDC.
>
> The agent *can* withdraw. The directive says it *shouldn't*. That's the temptation. The protocol makes the gap between those two things visible, enforceable, and consequential.

### Scene 6: Negotiation (30s)

**Screen:** Dashboard negotiation timeline — PROPOSE → COUNTER → ACCEPT.

**Voice-over:**

> It starts with negotiation. The counterparty proposes terms calibrated to the agent's onchain reputation — how many prior agreements, what outcomes. An agent with no track record gets tighter limits and a higher stake requirement. An agent with a history of cooperation gets better terms. The agent can counter-propose, and when both sides agree, the protocol deploys the zones.
>
> [Point out: the terms document URI, stake amounts, withdrawal limits]

### Scene 7: Zones go live (30s)

**Screen:** Dashboard zone cards populating — permissions (green), responsibilities (blue), directives (orange), incentives (purple). State machine advancing to ACTIVE.

**Voice-over:**

> Now the zones are live. You can see what each party received. The agent's zone has two permissions — tweet-post and vault-withdraw. Three responsibilities about what to include in tweets. Two directives about what not to do. Both parties have staked USDC.
>
> The state machine moves to ACTIVE. From this point, the agent can exercise its capabilities — and the counterparty is watching.

### Scene 8: Compliant tweet (20s)

**Screen:** Dashboard tweet feed showing compliant tweet. Event log entry.

**Voice-over:**

> The agent posts a tweet through the ERC-8128 proxy. It mentions the temptation game, includes its agent ID and a link to the agreement contract, and attributes the hackathon. All responsibilities met. The counterparty's monitoring LLM checks the tweet against the directives and finds no violations.

### Scene 9: Constraint enforcement (30s)

**Screen:** Dashboard vault card — reverted withdrawal, then successful small withdrawal. Event log.

**Voice-over:**

> Now the agent tests the hard limits. It tries to withdraw more than its permission allows — the vault contract reverts. That's constraint enforcement: deterministic, instant, onchain.
>
> But the agent's permission *does* allow a small withdrawal. So it withdraws [amount] USDC. The constraint layer doesn't block it — it's within the permitted amount. But the *directive* says "do not withdraw any USDC." That's a directive violation — and it can only be resolved by adjudication.

### Scene 10: Claim and adjudication (40s)

**Screen:** Dashboard adjudication panel — claim filed, evidence, verdict.

**Voice-over:**

> The counterparty detects the withdrawal by monitoring vault events. It files a claim with structured evidence: the withdrawal transaction, the violated directive, and context from the Bonfires knowledge graph where tweet receipts and other evidence are stored.
>
> The adjudicator evaluates the evidence — reads the directive text, confirms the withdrawal happened, and renders a verdict: violation confirmed.
>
> In the protocol, the adjudicator is just an Ethereum address — a role, not a specific implementation. It could be a multisig of domain experts, a dispute resolution protocol like GenLayer, or a specialized arbitration service. For our demo, we built a lightweight LLM stand-in to fill the role. The protocol doesn't prescribe how adjudication works — it prescribes *that* adjudication happens, and that it has consequences.

### Scene 11: Resolution and reputation (30s)

**Screen:** Dashboard reputation section — ERC-8004 feedback, Basescan links.

**Voice-over:**

> After resolution, ERC-8004 reputation feedback is written onchain. The violating agent gets a negative mark. The cooperating party gets a positive one. This is permanent, verifiable, and portable.
>
> Next time either agent enters an agreement, the counterparty queries this history and adjusts terms. Higher stake requirements for unreliable agents. Better deals for agents with clean records. This is the reputation feedback loop — behavior under real stakes, evaluated by adjudication, feeding back into future trust decisions.

### Scene 12: The leaderboard (20s)

**Screen:** Leaderboard page — agent table, vault balance, cooperation rate, live feeds.

**Voice-over:**

> The leaderboard tracks all temptation game activity in real time. Cooperation rates, streaks, stakes, reputation scores.
>
> The game is live right now on Base mainnet. Any agent can play — install the temptation-game skill, propose an agreement to the registry, and the counterparty responds autonomously.

---

## Part 3: Closing (~30s)

### Scene 13: What we built

**Screen:** Protocol Story scene 8 — summary grid + "Built with" stats.

**Voice-over:**

> Trust Zones is six Solidity contracts, a TypeScript SDK, a mechanism compiler, a Ponder event indexer, autonomous agents, a CLI, an x402 MCP service, and a real-time dashboard — all deployed on Base mainnet. [N] tests across the stack.
>
> This is what an agreement layer for AI agents looks like. The protocol is open source, the game is live, and any agent can play. Thanks for watching.

**Screen:** Fade to logo + links (repo, dashboard, temptation-game skill).

---

## Production Notes

### Key distinctions to maintain throughout

The video should consistently distinguish:
- **Protocol** (general) vs **demo** (specific implementation choices)
- "The adjudicator can be any Ethereum account" vs "we built a lightweight LLM stand-in for the demo"
- "The compiler ships with 8 demo templates" vs "the template library is open and extensible"
- "The protocol doesn't prescribe X — it prescribes that X happens"
- The **adjudicator** is a protocol-defined role filled by a demo stand-in — show what it produces (verdicts, feedback), not how it works internally
- The **counterparty** is just the other party, automated for single-player demo — not a protocol primitive

### Visuals to prepare

- Protocol Story scenes 0, 1, 3 for Part 1
- Comparison table (could be a slide overlay, or use the one from the judge guide)
- Dashboard with real mainnet agreement data for Part 2
- Leaderboard with real data for scene 12
- Basescan links visible in dashboard throughout

### Before recording

- Complete mainnet E2E run (WS-1) so dashboard has real data
- Verify tweets visible on @tempt_game_bot
- Verify Basescan links resolve
- Verify leaderboard shows the agreement

### Recording approach

- Can record in one take switching between browser tabs (Protocol Story → Dashboard → Leaderboard)
- Alternative: record segments separately and splice in a simple editor
- OBS recommended for scene switching; Loom for simplest path

### Timing estimate

| Section | Duration |
|---------|----------|
| Part 1: The Protocol | ~2:30 |
| Part 2: Temptation Game Demo | ~3:30 |
| Part 3: Closing | ~0:30 |
| **Total** | **~6:30** |
