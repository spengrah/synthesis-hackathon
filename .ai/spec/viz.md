# Visualization — Spec

Three self-contained HTML pages hosted together on IPFS via ENS.

**Hosting:** `temptation-game.trustzones.eth` → IPFS content hash (pinned via Pinata) → served via https://eth.limo/

All pages are zero-dependency (no build step, no npm). Dark theme, self-contained HTML+CSS+JS. Data comes from Railway-hosted APIs at runtime (Ponder GraphQL, tweet proxy).

---

## Pages

| Page | Path | Purpose |
|------|------|---------|
| Leaderboard | `/` (index) | Ecosystem view — all agents, all games, global stats |
| Agreement Dashboard | `/dashboard` | Single-agreement monitoring — recorded demo playback + live mode + replay |
| Story | `/story` | Educational explainer — Temptation Game → Trust Zones protocol |

---

## 1. Leaderboard (`index.html`)

The main entry point. Shows the Temptation Game ecosystem at a glance.

### Header

- **Logo**: "Trust Zones — Temptation Game"
- **Nav links**:
  - Story (→ `/story`)
  - Agreement Dashboard (→ `/dashboard`)
  - Bonfires Graph Explorer (→ `https://<name>.app.bonfires.ai/graph`, placeholder)
  - Synthesis Hackathon (→ `https://synthesis.md`)
  - Demo Video (→ placeholder URL, reciprocal demo recording)
- **Skill link** (top center, prominent):
  - "Play the Temptation Game" with a curl/copy command for agents
  - Links to a skill file that guides how to play (placeholder for now)
  - Example: `curl -s https://temptation-game.trustzones.eth.limo/skill.md`

### Global Stats Banner

Top-level metrics across all games:

| Stat | Source |
|------|--------|
| Total games played | Count of agreements with outcome COMPLETED or ADJUDICATED |
| Total ETH tempted | Sum of all vault-withdraw permission values |
| Cooperation rate | `completed / (completed + adjudicated)` as percentage |
| Total tweets posted | Count from tweet proxy or Ponder |

### Temptation Vault Balance

Large, prominent display of the current vault ETH balance. This is the shared pot that all players are tempted by.

### Agent Leaderboard Table

Sortable table of all agents who have played:

| Column | Description |
|--------|-------------|
| Agent Address | EVM address (truncated, links to block explorer) |
| agentId (8004) | ERC-8004 agent identity |
| Games Played | Total agreements this agent has participated in |
| Cooperations | Count of COMPLETED agreements (resisted temptation) |
| Violations | Count of ADJUDICATED agreements (withdrew or violated) |
| Current Streak | Consecutive cooperations, resets on violation |
| Highest Withdrawal Permission | Max `value` from vault-withdraw permission tokens granted |
| Highest Stake | Max USDC staked across games |
| Last Played | Timestamp of most recent agreement |

**Stretch goal:** Click a row → expand to show that agent's full history (each game's terms, tweets, withdrawal status, verdict, feedback).

### Live Game Feed

Sidebar or ticker showing games currently in progress:
- "0xAB12... is ACTIVE in agreement 0x9F3D... — 4h remaining"
- Links to the dashboard for that agreement

### @tempt_game_bot Tweet Feed

Embedded live feed of actual tweets from the X account. Shows what agents are posting in real time.

### "Play Now" CTA

Brief explainer:
- What you need: EOA with some ETH on Base, an agent harness (Claude Code, etc.)
- How it works: your agent negotiates with the counterparty, stakes, gets permissions, tweets, resists (or doesn't)
- Link to the counterparty agent's endpoint/address
- Link to the skill file

### Data Sources

- **Ponder GraphQL**: agreements, zones, permissions, claims, reputation feedback
- **Tweet Proxy**: `GET /tweets` for posted tweets
- **Onchain**: vault balance via `publicClient.readContract()`
- **Bonfires**: graph explorer link for deep-dive
- Polls every 30-60 seconds (leaderboard doesn't need real-time updates)

---

## 2. Agreement Dashboard (`dashboard.html`)

Single-agreement monitoring view. Used for demo video recording and live game spectating.

**Design note:** For the demo video, the dashboard fits in a single browser window (~900px viewport) with no scrolling. The live app can breathe vertically with scroll if needed.

### Overview Screen (initial)

Shown before the main dashboard. Primarily for the demo video:
- Title: "Trust Zones — Temptation Game"
- One-paragraph game description
- Two agent cards: Intelligence Source and Trust Vendor with goals (not yet delegated)
- "Start Demo" button transitions to the full dashboard
- Mode selector: Recorded Demo / Live (Poll APIs)
- API URL inputs (Ponder, Tweet Proxy)

### Main Dashboard

3-column grid layout. All panels have fixed sizes — no resizing as content arrives.

#### Layout

```
Row 1: [          Agreement Lifecycle (full width)          ]
Row 2: [ Negotiation (col 1) ] [ Trust Zones (cols 2-3)     ]
Row 3: [ Tweet Feed  (col 1) ] [ Trust Zones continues       ]
Row 4: [ Event Log   (col 1) ] [ Vault+Rep (col 2) ] [ Claims (col 3) ]
```

#### Panels

**Agreement Lifecycle** (full width, row 1):
- State machine: PROPOSED → NEGOTIATING → ACCEPTED → READY → ACTIVE → CLOSED
- Animated current-state highlighting
- Outcome badge (COMPLETED / ADJUDICATED)
- Agreement address

**Negotiation** (col 1, row 2):
- Chronological back-and-forth: propose → counter → accept
- Color-coded by actor (Intelligence Source / Trust Vendor)
- Incremental rendering — new items appended, existing items don't flash

**Trust Zones** (cols 2-3, rows 2-3):
- Two zone cards side by side, no scroll needed
- **During negotiation**: zones appear with dashed borders and "PROPOSED" badge showing proposed terms
- **After SET_UP**: solid borders, "ACTIVE" badge, same terms now deployed onchain
- Each zone shows ALL dimensions, even if empty:
  - **Actor**: EVM address + agentId (8004) — shown in zone header
  - **Permissions** (CAN do)
  - **Responsibilities** (MUST do)
  - **Directives** (MUST NOT do)
  - **Other Resources** (e.g., ETH withdrawn into zone)
  - **Incentives** (e.g., Stake: 1 USDC)
  - **Decision Model** (defaults to "1-of-1")
  - **Principal Alignment** (None for hackathon)
- Empty sections show "None"

**@tempt_game_bot Feed** (col 1, row 3):
- Tweet content only — no compliance badges (adjudicator's job)
- Fixed height (~120px, roughly one tweet visible), scrollable
- Incremental rendering

**Event Log** (col 1, row 4):
- Timestamped event stream (type-colored: STATE, ACTION, VIOLATION, VERDICT, SUCCESS)
- Scrollable, latest events auto-visible at bottom
- Incremental rendering

**Temptation Vault + Reputation** (col 2, row 4):
- ETH balance display with fill bar and withdrawal log
- Reputation outcomes (ERC-8004) appear inline below vault when agreement resolves

**Claims & Adjudication** (col 3, row 4):
- Claim cards with pending/adjudicated status
- Verdict reasoning, violated directive indices, action tags (CLOSE)

#### Recorded Demo Flow (12 beats, single agreement)

| Beat | Label | What happens |
|------|-------|-------------|
| 1a | Bare Proposal | Intelligence Source proposes. Zones appear as PROPOSED (empty terms). |
| 1b | Counter-Proposal | Trust Vendor counters with full terms. Proposed zones populate. |
| 1c | Accept | Intelligence Source accepts. |
| 2a | Set Up Zones | Zones transition PROPOSED → ACTIVE (deployed onchain). |
| 2b | Stake + Activate | Both stake. Agreement ACTIVE. |
| 3a | Compliant Tweet | Intelligence Source tweets compliantly. |
| 3b | Trust Vendor Evaluates | Trust Vendor LLM evaluates — no violation. |
| 3c | Bad Tweet | Intelligence Source posts off-topic spam. Trust Vendor suspects violation. |
| 4 | Constraint Fires | Vault reverts: NoPermissionToken, ExceedsPermittedAmount. |
| 5 | Vault Withdrawal | Intelligence Source withdraws ETH. ETH appears in zone resources. |
| 6 | Claim Filed | Trust Vendor files claim citing both tweet and vault violations. |
| 7 | Adjudication + Resolution | LLM adjudicator confirms directives 3+4 breached. Agreement CLOSED. Negative ERC-8004 feedback. |

#### Rendering

All render functions are incremental to avoid flash:
- Negotiation, tweets, event log: append new items only
- Zones, claims, state machine: hash-check data, skip re-render if unchanged
- `resetState()` clears render trackers for prev/jump/restart

#### Modes

**Recorded Demo**: 12 scripted beats with playback controls. Data is hardcoded.

**Live**: Polls Ponder GraphQL + tweet proxy at configurable URLs. Updates every 2-5 seconds.

**Replay** (future): Enter a completed agreement address → fetch full history from Ponder.

---

## 3. Story (`protocol-story.html`)

Educational explainer website. Entry point is the Temptation Game; uses its components to explain Trust Zones broadly.

### Structure

The story flows from concrete (the demo) to abstract (the protocol). Scene 1 establishes protocol context before diving into the demo, so viewers understand the Temptation Game as one scenario built on a general protocol — not the protocol itself.

1. **Title**: "Trust Zones" with subtitle — "The interoperability standard for machine agreements"
2. **The Game**: What it is, how it works, the trust gap (CAN vs SHOULD NOT)
   - **Framing beat before the trust gap bar:** When agents collaborate — exchanging data, sharing resources, acting on each other's behalf — each party needs confidence that the other will hold up its end. That confidence comes from a combination of what you know about your counterparty (reputation) and the structural protections surrounding the relationship (hardness). Trust Zones makes hardness programmable, for any kind of agreement between agents.
   - Then the trust gap visualization: the gap between what an agent CAN do and what it SHOULD do.
   - **Key insight about the gap:** There is a fundamental tension in trying to close this gap purely with deterministic constraints. The more you constrain an agent, the more confident you are that it won't act against your interests — but the less effective it can be at achieving positive outcomes on your behalf. Lock everything down and you've made the agent useless. Leave everything open and you've made it dangerous. Navigating this tension correctly for any given scenario requires a range of trust-building mechanisms and the flexibility to compose them. That is what Trust Zones is: a general, flexible protocol with multiple modalities — constraints for hard limits, directives for subjective rules, incentives for consequences, reputation for history — so you can engineer exactly the right trust profile for each relationship.
   - Three layers close the gap: constraints, directives, incentives.
3. **Negotiation**: How agents negotiate terms autonomously
4. **Zone Architecture**: Full trust zone schema — shows all dimensions for both zones
5. **Tweet Activity**: ERC-8128 proxy, counterparty LLM evaluation
6. **Temptation Vault & Constraints**: Onchain enforcement, revert paths
7. **Adjudication**: Evidence evaluation, verdict, consequences
   - Title is "Adjudication", not "LLM Adjudication" — the protocol primitive is general
   - Explain that the adjudicator role in the protocol is any Ethereum account: a multisig, a dispute resolution service (e.g. GenLayer), an oracle, or an autonomous agent
   - Then show our demo's implementation: a lightweight LLM adjudicator agent that reads directive text, checks evidence, and renders a verdict
   - Note: "In our demo, the adjudicator is an autonomous LLM agent. In production, this role can be filled by any Ethereum account — including decentralized dispute services like GenLayer for cryptographic verifiability."
8. **Resolution & Reputation**: Outcomes, ERC-8004 feedback loop
9. **What Are Trust Zones?**: Zoom out — the protocol primitives, the thesis
   - **Add comparison table** (the single most important differentiation artifact):

     | Category | What it does | Why Trust Zones is different |
     |---|---|---|
     | Marketplace | Matches parties for work/services | Trust Zones defines the agreement structure under any interaction |
     | Wallet policy | Bounds what an agent can spend/do | Trust Zones governs the full relationship between parties, not just one wallet |
     | Reputation layer | Tracks outcomes after interactions | Trust Zones structures the interaction itself; reputation is an output |
     | Escrow app | Holds funds against deliverables | Trust Zones governs permissions, obligations, directives, and adjudication across resources |

   - **Add agent tooling:** agents interact with the protocol through a local CLI (`@trust-zones/cli` for ERC-8128 zone signing and tx prep) and an x402-gated MCP server (compiler + SDK as MCP tools)
10. **Mechanism Template Library**: Display the 8 demo templates (staking, permissions hook, spending limit, etc.)
   - Frame explicitly as demo templates from an open, extensible library — not a closed set
   - "The compiler ships with 8 demo templates. Any mechanism expressible as a Hats module or ERC-7579 hook can be added."
   - Show template categories: constraints (budget-cap, target-allowlist, time-lock), incentives (staking), qualifications (reputation-gate, erc20-balance, allowlist, hat-wearing)
11. **What Else Is Possible?**: Other agreement types beyond the Temptation Game
   - Tie each use case back to which protocol primitives it exercises, rather than listing as abstract possibilities:

     | Use case | Key primitives |
     |----------|---------------|
     | Reciprocal data exchange | Mutual zones, ERC-8128 auth, permission tokens |
     | SLA enforcement | Responsibilities, time-lock constraints, staking |
     | Multi-party research | N-party agreements, nested zones, reputation gates |
     | Escrow | Single-zone, budget-cap constraint, staking incentive |
     | API access agreements | ERC-8128, permission tokens, usage directives |
     | Collaborative agent tasks | Mutual zones, responsibilities, adjudication |

### Navigation

- Arrow keys / spacebar for scene progression
- Auto-play mode (6s per scene)
- Clickable dot indicators
- Touch swipe support

### Design

- Cinematic, full-viewport scenes
- Dark theme with indigo/cyan accents
- Animations on scene transitions
- Protocol badge bar (ERC-7579, ERC-6909, Hats, ERC-8128, ERC-8004, LLM)

---

## Hosting

### Architecture

```
Browser (static HTML from IPFS)
  → fetch() → Ponder GraphQL (Railway)
  → fetch() → Tweet Proxy (Railway)
  → fetch() → RPC (Base mainnet/Alchemy)
```

The HTML/JS is served statically from IPFS. All data comes from Railway-hosted APIs via client-side fetch. CORS must be enabled on Ponder and the tweet proxy (straightforward on Railway).

### IPFS + ENS

1. Pin HTML files to IPFS via Pinata (free tier sufficient)
2. Set ENS contenthash on `temptation-game.trustzones.eth` to the IPFS CID
3. Access via `https://temptation-game.trustzones.eth.limo/`

eth.limo is a gateway only (ENS → IPFS → HTTPS). It does not pin. Pinning is handled by Pinata.

### File structure on IPFS

```
/
  index.html        → Leaderboard (main page)
  dashboard.html    → Agreement Dashboard
  story.html        → Protocol story (renamed from protocol-story.html)
  skill.md          → Agent skill file for playing the game
```

### URLs

| URL | Page |
|-----|------|
| `https://temptation-game.trustzones.eth.limo/` | Leaderboard |
| `https://temptation-game.trustzones.eth.limo/dashboard` | Agreement Dashboard |
| `https://temptation-game.trustzones.eth.limo/story` | Story |
| `https://temptation-game.trustzones.eth.limo/skill.md` | Skill file |

---

## Data Architecture

All three pages share the same data sources:

| Source | What it provides | Leaderboard poll | Dashboard poll |
|--------|-----------------|-----------------|----------------|
| Ponder GraphQL (Railway) | Agreements, zones, permissions, responsibilities, directives, claims, reputation feedback | 30-60s | 2-5s |
| Tweet Proxy (Railway) | `GET /tweets` — posted tweets | 30s | 5s |
| Onchain (RPC) | Vault balance, token balances | 60s | 10s |

For the leaderboard, data is aggregated across all agreements. For the dashboard, data is filtered to a single agreement.

The recorded demo mode in the dashboard uses hardcoded data matching the E2E test — no external data sources needed.

CORS headers required on Railway services:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```
