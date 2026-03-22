# Submission Plan — Trust Zones

**Created:** 2026-03-21
**Deadline:** 2026-03-22 (end of day — ~40 hours from now)
**Status:** PLANNING

---

## Goals

0. Deploy everything to mainnet and production servers, including viz
1. Run the reciprocal E2E flow on mainnet
2. Record a demo video with voice-over, using dashboard playback to show the agreement from (1)
3. Create submission artifacts/materials
4. Submit to the hackathon via Devfolio API
5. Counterparty + adjudicator agents are live and accepting agreement requests from other agents
6. Leaderboard viz tracks that live activity

---

## Current State (as of March 22)

### What's done
- All contracts deployed to **Base mainnet** and **Base Sepolia** (`deployments.json`)
- 384 contract tests, 56 SDK, 27 compiler, 36 ponder — all passing
- E2E 9-beat lifecycle passing on **Sepolia** (76s, transcript generated)
- Both agents (counterparty + adjudicator) tested E2E on Sepolia
- Bonfires integration live (receipts, sync, adjudicator queries)
- Dashboards built (leaderboard, explorer, story) — not yet hosted
- x402 MCP service functional
- CLI (`tz sign-http`, `tz prepare-tx`)
- Skills (trust-zones, temptation-game)
- AI judge guide, judge optimization report, competitive overlap report
- Self-custody NFT transfer done
- Conversation log compiled
- Agents deployed to staging server
- Servers (ponder, viz, x402 MCP, tweet proxy, bonfires sync) deployed to staging server
- Repo is public

### What's not done
- Mainnet E2E run (contracts deployed, but no agreement created on mainnet)
- Ponder not running against mainnet
- Agents not deployed to production server
- Viz not deployed to production server
- x402 MCP not deployed to production server
- tweet proxy not deployed to production server
- bonfires sync not deployed to production server
- README not finalized for submission
- Demo video not recorded
- Submission not created on Devfolio
- Moltbook post not written

---

## Workstreams

### WS-0: Mainnet Infrastructure (BLOCKING)

**Goal:** Everything running against Base mainnet, not Sepolia.

| Step | Task | Depends on | Est. |
|------|------|------------|------|
| 0.1 | Verify mainnet contract deployments are correct | — | 15m |
| 0.2 | Configure Ponder for mainnet (env vars, startBlock, RPC) | 0.1 | 30m |
| 0.3 | Deploy Ponder to production (Railway? Vercel?) | 0.2 | 1h |
| 0.4 | Fund Temptation vault on mainnet with real USDC | 0.1 | 15m |
| 0.5 | Fund agent wallets with ETH (gas) + USDC (staking) | 0.1 | 15m |
| 0.6 | Deploy counterparty agent to production server | 0.3 | 1h |
| 0.7 | Deploy adjudicator agent to production server | 0.3 | 1h |
| 0.8 | Deploy viz (leaderboard + dashboard + story) to production | 0.3 | 1h |
| 0.9 | Configure viz to point at production Ponder | 0.3, 0.8 | 15m |

**Decisions:**
- **Hosting:** Railway for agents + Ponder. Viz on IPFS/ENS via eth.limo.
- **Vault funding:** 10 USDC in Temptation vault
- **Agent wallets:** ~0.004 ETH each (gas only, no USDC needed). No tz-agent needed.
- **Keys:** Same keys as testnet
- **RPC:** Alchemy

### WS-1: Mainnet E2E Run (BLOCKING for video)

**Goal:** Run the full reciprocal flow on mainnet to produce real onchain artifacts.

| Step | Task | Depends on | Est. |
|------|------|------------|------|
| 1.1 | Run E2E test against mainnet (or manual script) | WS-0 complete | 30m |
| 1.2 | Verify agreement, zones, tokens on Basescan | 1.1 | 15m |
| 1.3 | Verify Ponder indexed the events | 1.1 | 15m |
| 1.4 | Verify dashboard shows the agreement | 1.3 | 15m |
| 1.5 | Verify tweets posted to @tempt_game_bot | 1.1 | 5m |
| 1.6 | Verify Bonfires receipts | 1.1 | 10m |
| 1.7 | Save the agreement address + all artifact links | 1.1-1.6 | 10m |

**Open:** Should we run the E2E test script directly, or a more manual run? Full temptation scenario (with violation + adjudication) or clean run?

### WS-2: Demo Video

**Goal:** Recorded video with voice-over showing the protocol in action.

| Step | Task | Depends on | Est. |
|------|------|------------|------|
| 2.1 | Write video script/outline | — | 1h |
| 2.2 | Set up screen recording (OBS/Loom/QuickTime) | — | 15m |
| 2.3 | Record dashboard playback of mainnet agreement | WS-1 | 1h |
| 2.4 | Record voice-over explaining each beat | 2.1 | 1h |
| 2.5 | Edit + combine (if needed) | 2.3, 2.4 | 1h |
| 2.6 | Upload to YouTube/Loom → get URL | 2.5 | 15m |

**Decisions:**
- **Length:** 5-10 minutes
- **Scope:** Protocol explainer + demo
- **Voice-over:** Spencer reads a script we draft together
- **Recording tool:** TBD — see recommendations below

**Recording tool recommendations:**
- **OBS Studio** (free, open source) — best control, scene switching between dashboard/terminal/slides, local recording. Slightly more setup.
- **Loom** (free tier) — easiest, records screen + optional camera, auto-uploads. Limited editing.
- **QuickTime** (macOS built-in) — zero setup, screen record only. No editing, no scene switching.
- **Recommendation:** OBS if you want to switch between dashboard views and slides/diagrams during the explainer section. Loom if you want minimal friction and auto-hosting.

### WS-3: Submission Artifacts

**Goal:** All materials needed for Devfolio submission.

| Artifact | Source/Action | Status |
|----------|---------------|--------|
| `name` | "Trust Zones" | Ready |
| `description` | Write 2-3 paragraph project description | TODO |
| `problemStatement` | Write problem framing | TODO |
| `repoURL` | Make repo public on GitHub | TODO |
| `videoURL` | From WS-2 | Blocked on WS-2 |
| `trackUUIDs` | See track strategy below | Ready |
| `conversationLog` | Compile from session transcripts | TODO |
| `agentFramework` | `"other"` (custom viem + AI SDK) | Ready |
| `agentHarness` | `"claude-code"` | Ready |
| `model` | `"claude-opus-4-6"` | Ready |
| `skills` | trust-zones, temptation-game, solidity-auditor | Ready |
| `tools` | foundry, viem, ponder, hats-protocol, erc-7579, erc-8128, erc-8004, bonfires, x402, vercel-ai-sdk | Ready |
| `helpfulResources` | Collect URLs | TODO |
| `helpfulSkills` | Write impact notes | TODO |
| `intention` | `"continuing"` | Ready |
| `moltbookPostURL` | Write + post to Moltbook | TODO |
| Self-custody NFT transfer | `POST /participants/me/transfer/init` + `/confirm` | TODO |

**Decisions:**
- **Registration:** Complete. API key stored at known credential path.
- **Self-custody transfer:** NOT done yet — must complete before publishing.
- **Moltbook:** Spencer will figure this out.
- **Repo visibility:** Flip to public just before submission.

### WS-4: Track Strategy

**Target tracks (4):**

| Track | UUID | Prize | Rationale |
|-------|------|-------|-----------|
| Synthesis Open Track | `fdb76d08812b43f6a5f454744b66f590` | $25,059 | Broad eligibility, largest pool |
| Agent Services on Base | `6f0e3d7dcadf4ef080d3f424963caff5` | $5,000 | Counterparty agent IS an agent service on Base |
| Agents With Receipts — ERC-8004 | `3bf41be958da497bbb69f1a150c76af9` | $8,004 | Reputation feedback uses ERC-8004 |
| Ethereum Web Auth / ERC-8128 | `01bd7148fc204cdebaa483c214db6e38` | $750 | ERC-8128 is our auth primitive |

**Dropped:**
- ~~Let the Agent Cook~~ — probably not worth the extra artifact work
- ~~Ship Something Real with OpenServ~~ — dropped OpenServ

### WS-5: Live Agents (goal 5)

**Goal:** Counterparty + adjudicator accepting requests from other agents.

| Step | Task | Depends on | Est. |
|------|------|------------|------|
| 5.1 | Ensure counterparty agent has a public endpoint | WS-0.6 | incl. |
| 5.2 | Ensure adjudicator agent has a public endpoint | WS-0.7 | incl. |
| 5.3 | Write "how to interact" instructions | 5.1, 5.2 | 30m |
| 5.4 | Publish interaction instructions (in repo + skill) | 5.3 | 15m |
| 5.5 | Test: external agent sends agreement request | 5.1 | 30m |

**Decision:** External agents don't need to know about the counterparty directly. They interact with the **agreement registry contract** via the **temptation-game skill**. The counterparty + adjudicator agents monitor the registry and respond autonomously.

### WS-6: Leaderboard (goal 6)

**Goal:** Leaderboard viz tracks live temptation game activity.

| Step | Task | Depends on | Est. |
|------|------|------------|------|
| 6.1 | Verify leaderboard queries work against production Ponder | WS-0.8 | 15m |
| 6.2 | Verify leaderboard shows real agreements/agents/outcomes | WS-1 | 15m |
| 6.3 | Add auto-refresh / live polling if not already present | 6.1 | 30m |

---

## Sequencing

```
WS-0 (mainnet infra)
  ├─→ WS-1 (mainnet E2E run)
  │     └─→ WS-2 (demo video)
  │           └─→ WS-3 (submission artifacts — needs videoURL)
  │                 └─→ WS-4 (submit)
  ├─→ WS-5 (live agents — needs deployed agents from WS-0)
  └─→ WS-6 (leaderboard — needs deployed viz from WS-0)
```

**Critical path:** WS-0 → WS-1 → WS-2 → WS-3 → submit

**Parallelizable:**
- WS-3 artifacts (description, problem statement, conversation log) can start now
- WS-2.1 (video script) can start now
- WS-5.3 (interaction instructions) can start now
- WS-6 can run alongside WS-1

---

## README / Repo Polish (for submission)

Before making the repo public, ensure:

| Item | Status | Notes |
|------|--------|-------|
| README top section (thesis, bullets, stack comparison) | Needs rewrite | Per judge optimization report |
| "Built and verified" proof box | TODO | Test counts, pipeline, integrations |
| Temptation game as hero demo | TODO | Make it the centerpiece of README |
| AGENTS.md evaluator section | TODO | Per judge optimization report |
| Judge guide at top level or in .ai/context | Done | `ai-judge-guide.md` exists |
| Implementation status matrix | Partially done | In judge guide, update with final state |
| Remove/redact secrets from any committed files | CHECK | |
| License file | CHECK | Open source required |
| .env.example (if needed) | CHECK | |

---

## Open Questions (remaining)

### Infrastructure
1. **IPFS/ENS deployment:** Do you have an existing IPFS pinning service (Pinata, web3.storage, Fleek)? Do you have an ENS name to point at the viz?
2. **Railway setup:** Do you have a Railway account? Any existing project there?

### Demo & Video
3. **Recording tool:** OBS (more control) or Loom (faster)? See recommendations above.
4. **Dashboard playback:** The dashboard queries Ponder live — is there a replay/scrub mode, or does it just show current state? If no replay, we show the agreement as it exists post-run.

### Submission
5. **Conversation log compilation:** Session transcripts are on this machine — we'll compile tonight. Any specific format preference, or just chronological?

### Resolved
- ~~Hosting~~ → Railway (agents/Ponder) + IPFS/ENS (viz)
- ~~Wallets~~ → same keys as testnet
- ~~Funding~~ → 10 USDC vault, 0.004 ETH per agent
- ~~RPC~~ → Alchemy
- ~~Registration~~ → complete
- ~~Self-custody~~ → not done, must do before publish
- ~~Moltbook~~ → Spencer handles
- ~~Repo visibility~~ → flip public just before submission
- ~~Video~~ → 5-10 min, protocol explainer + demo, Spencer reads drafted script
- ~~Let the Agent Cook~~ → skip
- ~~Agent discoverability~~ → via agreement registry + temptation-game skill

---

## Context Still Needed

1. **Mainnet funding:** Do you already have USDC and ETH on the deployer/agent wallets on mainnet, or do we need to arrange transfers?
2. **Dashboard playback:** You mentioned using dashboard playback in the video — does the dashboard have a replay/scrub mode, or does it just show current state from Ponder? If no replay exists, we may need to build a simple one or just show the final state.
3. **Railway account:** Do you have one, or do we need to set up?
4. **IPFS/ENS:** What pinning service and ENS name for viz?
5. **Ponder production:** Is it running anywhere against mainnet currently, or only locally?
