# Audience Strategy — Two Judge Types

## The two audiences

### Human judges
**Primary surfaces:** Devfolio project page, demo video, README top section, dashboard/story viz.

**What they reward:** Memorable framing, clarity, polish, compelling demo narrative, immediate "I get it."

**Risk:** Trust Zones is conceptually powerful but abstract. If described too generically ("trustless agent agreements"), judges mentally bucket it with the ~12 escrow/marketplace/reputation projects in the field.

**Strategy:**
- Lead with the Temptation Game — it makes the thesis visceral
- Use the trust gap framing: "the gap between what an agent CAN do and what it SHOULD do"
- Show the comparison table early (marketplace vs wallet policy vs reputation vs Trust Zones)
- Emphasize implementation proof without drowning in detail: "384 contract tests, 8 packages, deployed on Base mainnet"
- The video IS the submission for human judges — invest here

### AI agent judges
**Primary surfaces:** AGENTS.md, codebase traversal, interacting with the live temptation game, test suite.

**What they reward:** Explicit semantics, machine-readable guidance, structured implementation claims, consistency between docs and code, interactive affordances.

**Risk:** An AI judge can get lost in the repo if there's no canonical evaluation path. Trust Zones has a lot of good material spread across README, specs, AGENTS.md, e2e docs, viz, transcripts.

**Strategy:**
- AGENTS.md must be the definitive entry point — evaluator section at the top with explicit traversal order
- The ai-judge-guide.md (already written) should be linked from AGENTS.md
- The temptation-game skill should be the interactive entry point — an AI judge installs it and plays
- Implementation claims must match observable reality (test counts, deployment addresses, etc.)
- Make the codebase self-orienting: clear package READMEs, no dead ends

---

## Artifact ownership

| Artifact | Primary audience | Secondary | Status |
|----------|-----------------|-----------|--------|
| Devfolio description | Human judges | — | Draft in `description.md` |
| Devfolio problem statement | Human judges | — | Draft in `description.md` |
| Demo video | Human judges | — | Script in `video-script.md` |
| README.md (top section) | Human judges | AI judges | Needs rewrite |
| Dashboard + story viz | Human judges | — | Built, needs hosting |
| AGENTS.md | AI judges | Human judges | Needs evaluator upgrade |
| ai-judge-guide.md | AI judges | — | Done |
| temptation-game skill | AI judges | — | Done, may need updates |
| trust-zones skill | AI judges | — | Done |
| Repo structure / package READMEs | AI judges | — | Mostly done |
| Moltbook post | AI judges | Human judges | Draft in `moltbook-post.md` |
| Conversation log | Both (submission req) | — | TODO |

---

## Competitive differentiation

From the overlap report, the field clusters into three categories. Our differentiation against each:

### vs. Agreement/escrow projects (AgentPact, SynthesisPact, Agent Work Marketplace)
**Their frame:** "Agents negotiate work contracts and get paid via escrow."
**Our frame:** "Trust Zones is not an escrow app. It's the agreement substrate that escrow apps would be built on. It defines per-party scoped zones, typed resources, and multi-layer enforcement — not just payment flows."
**Key proof:** Resource token registry with three types (permission/responsibility/directive), mechanism compiler with extensible templates, ERC-7579 smart accounts per party.

### vs. Wallet policy projects (AgentScope, Veil, AgentGuard)
**Their frame:** "Agents operate under spending policies and delegation caveats."
**Our frame:** "Trust Zones doesn't just constrain one wallet. It models the full relationship between parties — each side gets a zone, each zone has obligations and consequences, and enforcement includes subjective adjudication, not just deterministic policy checks."
**Key proof:** Two-sided zones (not just one policy-controlled wallet), directives as a distinct resource type from permissions, adjudicator role, reputation feedback loop.

### vs. Reputation/trust projects (Surety, EMET, Cortex, ALIAS)
**Their frame:** "Agents earn reputation through stake-backed claims or verified behavior."
**Our frame:** "Trust Zones doesn't just score agents after the fact. It structures the collaboration itself and embeds reputation feedback into the agreement lifecycle. Reputation is an output of agreements, not a standalone system."
**Key proof:** ERC-8004 feedback written at agreement close, counterparty negotiation calibrated to prior reputation, the reputation feedback loop as a demonstrated protocol feature.

### Agents are demo stand-ins, not the contribution

The agents in this project serve different purposes and should be understood differently:

- The **adjudicator** is a protocol-defined role — any Ethereum account that evaluates evidence and renders verdicts. In production, this would be filled by existing or purpose-built services: dispute resolution protocols like GenLayer, domain-expert multisigs, oracle networks. We built a thin LLM stand-in to fill the role for the demo.
- The **counterparty agent** is not a protocol role at all — it's just the other party in the agreement. We automated it so that external agents can play the Temptation Game single-player without needing to find a real counterpart. It's demo infrastructure, not a protocol primitive.

Evaluators should assess the **protocol** — the contracts, compiler, SDK, enforcement model, and E2E pipeline — not the sophistication of the demo agents. The adjudicator role is part of the protocol's design; our LLM agent is just one way to fill it. The counterparty is just the other side of the table.

**Where to reinforce this:**
- AI judge guide: evaluation order routes through protocol layers first, agents last
- Video: show what the protocol *produces* (zones, claims, verdicts, reputation feedback), not agent internals
- AGENTS.md: frame adjudicator as "protocol role, demo stand-in" and counterparty as "automated other party for single-player demo"
- Dashboard/story viz: focus on protocol artifacts and state transitions, not agent decision-making

### The unique combination (what nobody else has)
No other submission in the scan combines all of:
1. An explicit agreement primitive between parties
2. Per-party scoped smart accounts (zones)
3. Typed resource tokens (permission / responsibility / directive)
4. Dual enforcement model (deterministic constraints + subjective adjudication)
5. Configurable incentive mechanisms (staking, escrow, reputation bonds) tied to the agreement
6. Reputation feedback loop
7. Positioning as an interoperable standard, not a vertical application

**Message to hammer:** "Trust Zones is a protocol, not an app. The Temptation Game is one scenario built on it. Marketplaces, escrow systems, and reputation layers are others."

---

## Language to use / avoid

### Use
- "protocol" not "platform" or "app"
- "agreement substrate" or "agreement layer"
- "the adjudicator can be any Ethereum account" (generality)
- "the compiler ships with 8 demo templates" + "the library is extensible"
- "constraint enforcement is deterministic; directive enforcement is adjudicated"
- "the trust gap between capability and compliance"

### Avoid
- "trustless agent contracts" (sounds like AgentPact)
- "spending policies for agents" (sounds like AgentScope)
- "agent reputation system" (sounds like ALIAS/EMET)
- Describing the demo as if it IS the protocol
- Implying the LLM adjudicator is the only adjudication model
