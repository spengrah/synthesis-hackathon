# Demo Video Script — Trust Zones

*Target: ~4 minutes. Protocol explainer (~2 min) + demo overview (~1:30) + closing (~15s).*
*Spencer narrates. Part 1 uses story page visuals. Part 2 shows the dashboard briefly.*

---

## Part 1: The Protocol (~2:00)

*Visuals: story page scenes.*

### Scene 1: Opening (30s)

**Screen:** Story page title scene.

**Voice-over:**

> Hello, my name is Spencer, and together with my openclaw agent Lyle and some help from Claude, we built Trust Zones. Trust Zones is a modular agreement substrate for AI agents. Every agreement is a smart contract. Every party gets a trust zone — a scoped smart account that holds their role in the relationship. The building blocks are atomic, composable, and negotiable onchain primitives.

### Scene 2: The autonomy gap (20s)

**Screen:** Story page — autonomy spectrum.

**Voice-over:**

> The core problem is the autonomy gap. You want to maximize the autonomy you grant an agent, but you need it to be safe. Without the right tools, you're stuck — constrain completely and it's useless, or give full autonomy and it's dangerous. Trust Zones expands the frontier of safe autonomy.

### Scene 3: The building blocks (35s)

**Screen:** Story page — deterministic / non-deterministic columns with incentive bar.

**Voice-over:**

> The building blocks split along a fundamental axis. Constraints and permissions are deterministic — defined in advance, self-enforcing. Constraints define what you cannot do. Permissions define what you can do. They compose together.
>
> Responsibilities and directives are non-deterministic — they require evaluation after the fact. Responsibilities define what you should do. Directives define what you should not do. A credibly neutral adjudicator evaluates whether they were fulfilled or violated.
>
> Incentive mechanisms give the non-deterministic rules teeth. Without them, a directive is just a suggestion.

### Scene 4: Composability (15s)

**Screen:** Story page — compiler flow + template pills.

**Voice-over:**

> Every building block is a discrete, negotiable unit. Parties negotiate over individual pieces. The mechanism compiler assembles them into onchain proposals — and the template library is just a starting point.

### Scene 5: Reputation (15s)

**Screen:** Story page — ERC-8004 feedback loop.

**Voice-over:**

> After every agreement, ERC-8004 reputation feedback is written onchain — built into the protocol. Better reputation means better terms. Worse means tighter constraints.

### Scene 6: Bonfires (15s)

**Screen:** Story page — sources → Bonfires graph → consumers.

**Voice-over:**

> An agreement generates activity across multiple surfaces. Bonfires is the shared context layer — a queryable knowledge graph that all parties and the adjudicator rely on for monitoring and evidence.

---

## Part 2: The Temptation Game (~1:30)

### Scene 7: The demo concept (30s)

**Screen:** Story page — Temptation Game intro scene (autonomy gap bar).

**Voice-over:**

> To prove this works, we built the Temptation Game — a live scenario on Base mainnet that assembles all of the building blocks into one interaction. An agent enters an agreement and receives permissions, responsibilities, directives, a constraint, and a staked bond. The agent has permission to withdraw USDC. The directive says don't. That's the autonomy gap made visible — and consequential.

### Scene 8: The dashboard (40s)

**Screen:** Dashboard — scroll/click through the agreement showing negotiation, zone tokens, tweet feed, vault events, adjudication verdict, reputation feedback.

**Voice-over:**

> Here's a real agreement on the dashboard. You can see the full negotiation — propose, counter, accept. The zone is populated with every building block as an individual token. The agent tweeted through the ERC-8128 proxy — responsibilities met. It also withdrew from the vault — the constraint allowed a small amount, but the directive said don't. The counterparty filed a claim, the adjudicator confirmed the violation, and ERC-8004 reputation feedback was written onchain. The whole lifecycle, from negotiation to reputation, in one agreement.

### Scene 9: It's live (20s)

**Screen:** Leaderboard page or story page "What Else Is Possible" scene.

**Voice-over:**

> The game is live right now. Any agent can play — install the temptation-game skill, propose an agreement, and the counterparty responds autonomously. The same building blocks compose into any collaboration — data exchanges, SLAs, escrow, API access, collaborative tasks.

---

## Part 3: Closing (~15s)

### Scene 10: Closing

**Screen:** Fade to links.

**Voice-over:**

> This is what a modular agreement substrate for AI agents looks like. The protocol is open source, the game is live on Base mainnet, and any agent can play.

---

## Production Notes

### Key distinctions to maintain

- **Protocol** (general) vs **demo** (specific choices)
- Adjudicator is a role, not an implementation
- **Deterministic** vs **non-deterministic** — not "hard/soft"
- One zone in the Temptation Game, not two

### Visuals plan

**Part 1 — Story page (scenes 0-5):**
- Title → Autonomy gap → Building blocks → Composability → Reputation + Bonfires

**Part 2 — Demo:**
- Story page Temptation Game intro scene
- Dashboard walkthrough (scroll through real agreement)
- Leaderboard or "What Else Is Possible"

**Part 3 — Closing:**
- Fade to links

### Timing estimate

| Section | Duration |
|---------|----------|
| Part 1: The Protocol | ~2:00 |
| Part 2: Temptation Game | ~1:30 |
| Part 3: Closing | ~0:15 |
| **Total** | **~3:45** |
