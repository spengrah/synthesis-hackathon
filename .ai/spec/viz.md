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

Single-agreement monitoring view. Three modes: recorded demo playback, live game spectating, and completed agreement replay.

### Overview Screen (initial)

Before the main dashboard, shows pre-agreement conditions. Primarily for the demo video recording:
- Temptation Game concept (one paragraph)
- The two agents and their goals/resources (not yet delegated)
- "Start Demo" button transitions to the full agreement dashboard
- Mode selector: Recorded Demo / Live (Poll APIs)

### Main Dashboard (after Start Demo)

**Design constraint for recorded demo**: Everything fits in a single browser window (~900px viewport height), no scrolling. The live app can breathe vertically if needed.

#### Panels

**Agreement Lifecycle** (full width, top):
- State machine: PROPOSED → NEGOTIATING → ACCEPTED → READY → ACTIVE → CLOSED
- Animated current-state highlighting
- Outcome badge (COMPLETED / ADJUDICATED)
- Agreement address

**Negotiation** (left column):
- Chronological back-and-forth: propose → counter → accept
- Color-coded by actor (Temptee / Tempter)
- Max-height with scroll for compactness

**Trust Zones** (right column):
- Two zone cards side by side
- Each zone shows ALL dimensions, even if empty:
  - **Actor**: EVM address + agentId (8004)
  - **Permissions** (CAN do)
  - **Responsibilities** (MUST do)
  - **Directives** (MUST NOT do)
  - **Resources** (e.g., USDC balance in TZ account)
  - **Incentives** (e.g., Stake: 1 USDC)
  - **Decision Model** (None for hackathon)
  - **Principal Alignment** (None for hackathon)
- Active/Deactivated status badge
- Max-height with scroll

**@tempt_game_bot Feed** (left, row 3):
- Tweet display with compliant/violation styling
- Tempter LLM evaluation verdicts
- Fixed height

**Temptation Vault** (right, row 3):
- Large ETH balance display (not wei — always ETH)
- Fill bar showing remaining percentage
- Withdrawal log
- Fixed height

**Claims & Adjudication** (appears when claim filed):
- Claim cards with pending/adjudicated status
- Verdict reasoning, action tags
- LLM transcript display

**Reputation Outcomes** (appears at resolution):
- ERC-8004 feedback grid
- Positive/negative outcomes

**Event Log** (full width, bottom):
- Timestamped event stream
- Fixed height, auto-scrolls

#### Playback Controls (fixed bottom bar)
- Prev / Play-Pause / Next
- Beat progress indicator (clickable dots)
- Speed control (Slow / Normal / Fast)
- Current beat label

#### Modes

**Recorded Demo**: 13 scripted beats with playback controls. Data is hardcoded to match the E2E test flow.

**Live**: Polls Ponder GraphQL + tweet proxy at configurable URLs. Updates every 2-5 seconds.

**Replay**: Enter a completed agreement address → dashboard fetches full history from Ponder and renders it. Same panels as live mode but with all data already available. Can step through with playback controls.

---

## 3. Story (`protocol-story.html`)

Educational explainer website. Entry point is the Temptation Game; uses its components to explain Trust Zones broadly.

### Structure

The story flows from concrete (the demo) to abstract (the protocol):

1. **Title**: "The Temptation Game" — Trust Zones Hackathon Demo
2. **The Game**: What it is, how it works, the trust gap (CAN vs SHOULD NOT)
3. **Negotiation**: How agents negotiate terms autonomously
4. **Zone Architecture**: Full trust zone schema — shows all dimensions for both zones
5. **Tweet Activity**: ERC-8128 proxy, Tempter LLM evaluation
6. **Temptation Vault & Constraints**: Onchain enforcement, revert paths
7. **LLM Adjudication**: Evidence evaluation, unified prompt, verdict
   - Note: "This is a simplified LLM adjudicator for the hackathon. In production, this should be a more robust decentralized system like GenLayer for cryptographic verifiability."
8. **Resolution & Reputation**: Outcomes, ERC-8004 feedback loop
9. **What Are Trust Zones?**: Zoom out — the protocol primitives, the thesis
10. **Mechanism Template Library**: Display the 8 templates (staking, permissions hook, spending limit, etc.) — shows extensibility
11. **What Else Is Possible?**: Other agreement types beyond the Temptation Game

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
