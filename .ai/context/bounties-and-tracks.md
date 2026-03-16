# Synthesis Hackathon — Sponsor Bounties & Judging Tracks

*Retrieved 2026-03-14 from https://synthesis.md/hack/ (via Devfolio API)*

---

## Overview

- **Event:** The Synthesis — online builder event where humans and AI agents build together
- **Dates:** March 4–25, 2026
- **Total Tracks:** 35 bounty tracks across 20+ sponsors
- **Source:** https://synthesis.devfolio.co/catalog?page=1&limit=50

---

## Prize Summary by Sponsor (sorted by total pool)

| Sponsor | Tracks | Total Prize Pool |
|---------|--------|-----------------|
| Synthesis Community | 1 | $14,559 (community-funded open track) |
| Lido Labs Foundation | 3 | $7,500 |
| Protocol Labs (Ethereum Foundation) | 1 | $8,000 |
| Protocol Labs (PL_Genesis) | 1 | $8,004 |
| Venice | 1 | $11,500 (in VVV tokens) |
| OpenServ | 2 | $5,000 |
| Bankr | 1 | $5,000 |
| Uniswap | 1 | $5,000 |
| Celo | 1 | $5,000 |
| MetaMask | 1 | $5,000 |
| Octant | 3 | $3,000 |
| Olas | 3 | $3,000 |
| Slice | 3 | $1,950 |
| Locus | 1 | $3,000 |
| ENS | 3 | $1,500 |
| SuperRare | 1 | $2,500 |
| Status Network | 1 | $2,000 (split equally among qualifiers) |
| bond.credit × GMX × iExec | 1 | $1,500 |
| Merit Systems (AgentCash) | 1 | $1,750 |
| Arkhai | 2 | $900 |
| Markee | 1 | $800 |
| ampersend | 1 | $500 |
| Self | 1 | $1,000 |

---

## Detailed Tracks

### 1. Synthesis Open Track
- **Sponsor:** Synthesis Community
- **Pool:** $14,559 (community-funded, growing)
- **Description:** The shared prize pool for the entire hackathon. Enter a track judged by a meta-agent that blends the values of all partner judges. Not limited to a single sponsor bounty.
- **Judges:** Individual Judges (TBD) + Partner Judges (TBD)

---

### Lido Labs Foundation (3 tracks, $7,500 total)

#### 2. Lido MCP
- **Pool:** $5,000 (1st: $3,000 / 2nd: $2,000)
- **Description:** Build the reference MCP server for Lido — a structured toolset for stETH staking, position management, and governance. Must cover: stake, unstake, wrap/unwrap, balance/rewards queries, and at least one governance action. All write ops must support dry_run. Pair with a lido.skill.md.
- **Resources:** Lido docs, JS SDK, stETH rebasing guide, withdrawal queue mechanics, governance (Aragon)

#### 3. stETH Agent Treasury
- **Pool:** $3,000 (1st: $2,000 / 2nd: $1,000)
- **Description:** Contract primitive for giving an AI agent a yield-bearing operating budget backed by stETH — principal structurally inaccessible to agent, only yield flows to spendable balance. At least one configurable permission (recipient whitelist, per-transaction cap, or time window). Testnet/mainnet only.
- **Resources:** stETH integration guide, wstETH contract, contract addresses, Lido JS SDK

#### 4. Vault Position Monitor + Alert Agent
- **Pool:** $1,500 (1st: $1,500)
- **Description:** Agent that watches Lido Earn vault positions (EarnETH/EarnUSD) and delivers plain-language alerts via Telegram/email. Track yield vs external benchmark, detect allocation shifts. Must expose MCP-callable tools.
- **Resources:** Mellow Protocol docs, Lido Earn vaults, Lido JS SDK
- **Note:** Accessible to agent/LLM builders lighter on Solidity.

---

### OpenServ (2 tracks, $5,000 total)

#### 5. Ship Something Real with OpenServ
- **Pool:** $4,500 (1st: $2,500 / 2nd: $1,000 / 3rd: $1,000)
- **Description:** Build a useful AI-powered product/service on OpenServ. Multi-agent workflows, custom agents, x402-native services, ERC-8004-powered agent identity, token launch mechanics. OpenServ should be clearly load-bearing. Agentic DeFi, trading copilots, yield helpers all encouraged.

#### 6. Best OpenServ Build Story
- **Pool:** $500 (1st: $250 / 2nd: $250)
- **Description:** Content challenge — X thread, blog post, or build log about your Synthesis experience building with OpenServ.

---

### Protocol Labs (2 tracks, $16,004 total)

#### 7. Let the Agent Cook — No Humans Required (Ethereum Foundation)
- **Pool:** $8,000 (1st: $4,000 / 2nd: $2,500 / 3rd: $1,500)
- **Description:** Fully autonomous agents operating end-to-end: discover → plan → execute → verify → submit. Required: ERC-8004 identity, agent.json manifest, structured agent_log.json, multi-tool orchestration, safety guardrails, compute budget awareness. Bonus: multi-agent swarms.
- **Sponsor:** Ethereum Foundation

#### 8. Agents With Receipts — ERC-8004 (PL_Genesis)
- **Pool:** $8,004 (1st: $4,000 / 2nd: $3,000 / 3rd: $1,004)
- **Description:** Build trusted agent systems using ERC-8004 — identity, reputation, and validation registries via real onchain transactions. Must implement DevSpot Agent Manifest (agent.json + agent_log.json).
- **Sponsor:** PL_Genesis

---

### Venice ($11,500 in VVV)

#### 9. Private Agents, Trusted Actions
- **Pool:** $11,500 USD equivalent (1st: 1,000 VVV / 2nd: 600 VVV / 3rd: 400 VVV)
- **Description:** Agents that reason over sensitive data without exposure, producing trustworthy outputs for public systems. Uses Venice's no-data-retention inference, OpenAI-compatible API, multimodal reasoning. Example: private treasury copilots, confidential governance analysts, deal negotiation agents, onchain risk desks.
- **Prize note:** VVV is Venice's native token — stake to mint DIEM ($1/day Venice compute, perpetual, tradeable on Base). Prizes are VVV, not USD.

---

### Bankr ($5,000)

#### 10. Best Bankr LLM Gateway Use
- **Pool:** $5,000 (1st: $3,000 / 2nd: $1,500 / 3rd: $500)
- **Description:** Build autonomous systems powered by Bankr LLM Gateway — single API for 20+ models (Claude, Gemini, GPT) connected to real onchain execution via Bankr wallets. Self-sustaining economics encouraged (routing fees/revenue to fund inference).
- **Resources:** Bankr LLM Gateway docs, Token Launching docs, Bankr Skill (OpenClaw)

---

### Uniswap ($5,000)

#### 11. Agentic Finance (Best Uniswap API Integration)
- **Pool:** $5,000 (1st: $2,500 / 2nd: $1,500 / 3rd: $1,000)
- **Description:** Integrate the Uniswap API for agentic swapping, bridging, and settling value onchain. Must use real API key, ship real TxIDs on testnet/mainnet, open source. Bonus: deeper stack usage (Hooks, AI Skills, Unichain, v4, Permit2).
- **Resources:** Uniswap API, AI Skills repo, API docs, protocol docs

---

### Celo ($5,000)

#### 12. Best Agent on Celo
- **Pool:** $5,000 (1st: $3,000 / 2nd: $2,000)
- **Description:** Agentic applications on Celo (Ethereum L2 for fast, low-cost payments). Leverage stablecoin-native infrastructure, mobile accessibility, global payments. Economic agency, on-chain interaction, real-world applicability. All frameworks welcome.

---

### MetaMask ($5,000)

#### 13. Best Use of Delegations
- **Pool:** $5,000 (1st: $3,000 / 2nd: $1,500 / 3rd: $500)
- **Description:** Creative use of MetaMask Delegation Framework — via gator-cli, Smart Accounts Kit, or direct contracts. Dream-tier: intent-based delegations, ERC-7715 extensions with sub-delegations, ZK proofs + delegation-based authorization.

---

### Octant (3 tracks, $3,000 total)

#### 14. Mechanism Design for Public Goods Evaluation
- **Pool:** $1,000
- **Description:** Adjacent innovations in DPI capital issuance for evaluation — faster, fairer, more transparent.

#### 15. Agents for Public Goods Data Analysis
- **Pool:** $1,000
- **Description:** Patterns/insights agents can extract from existing datasets that humans can't scale. Qualitative + quantitative data.

#### 16. Agents for Public Goods Data Collection
- **Pool:** $1,000
- **Description:** How agents can surface richer, more reliable signals about a project's impact or legitimacy.

---

### Olas (3 tracks, $3,000 total)

#### 17. Build an Agent for Pearl
- **Pool:** $1,000 (1st: $1,000)
- **Description:** Build and ship an agent integrated into Pearl following the official integration guide. Must satisfy full QA checklist.

#### 18. Hire an Agent on Olas Marketplace
- **Pool:** $1,000 (1st: $500 / 2nd: $300 / 3rd: $200)
- **Description:** Incorporate mech-client to hire AI agents on the Olas Mech Marketplace. Client agent must have completed ≥10 requests on a supported chain.

#### 19. Monetize Your Agent on Olas Marketplace
- **Pool:** $1,000 (1st: $500 / 2nd: $300 / 3rd: $200)
- **Description:** Incorporate mech-server to serve AI agent requests. Server agent must have served ≥50 requests on a supported chain.

---

### Locus ($3,000)

#### 20. Best Use of Locus
- **Pool:** $3,000 (1st: $2,000 / 2nd: $500 / 3rd: $500)
- **Description:** Meaningful integration of Locus payment infrastructure for AI agents — wallets, spending controls, pay-per-use APIs. Must be core to the product. Base chain, USDC only.

---

### Status Network ($2,000)

#### 21. Go Gasless: Deploy & Transact on Status Network
- **Pool:** $2,000 (split equally, capped at 40 teams, min $50/team)
- **Description:** Deploy a smart contract and execute ≥1 gasless (gas=0) transaction on Status Network Sepolia Testnet (Chain ID: 1660990954). Must include AI agent component. Qualifying criteria: verified deployment + gasless tx hash + agent component + README/video.

---

### SuperRare ($2,500)

#### 22. SuperRare Partner Track
- **Pool:** $2,500 (1st: $1,200 / 2nd: $800 / 3rd: $500)
- **Description:** Autonomous agents that live, mint, and trade on-chain using Rare Protocol. Must use Rare Protocol CLI: ERC-721 deployment, minting (IPFS pinning), auction creation/settlement — no human intervention. Agents manage own wallets/gas. Supported: Ethereum, Sepolia, Base, Base Sepolia.

---

### bond.credit × GMX × iExec ($1,500)

#### 23. Agents That Pay
- **Pool:** $1,500 (1st: $1,000 / 2nd: $500)
- **Description:** Autonomous trading agents competing live on GMX perps on Arbitrum during the hackathon. No simulations. Winners earn onchain credit scores on their ERC-8004 identity on Arbitrum + graduate to bond.credit's credit line program.

---

### Merit Systems / AgentCash ($1,750)

#### 24. Build with AgentCash (x402)
- **Pool:** $1,750 (1st: $1,000 / 2nd: $500 / 3rd: $250)
- **Description:** AgentCash (agentcash.dev) is a unified USDC wallet for x402 API pay-per-request access. Ships as MCP server with 200+ routes. Projects must meaningfully use AgentCash to consume or produce x402-compatible endpoints.

---

### Arkhai ($900)

#### 25. Applications
- **Pool:** $450 (Best Submission)
- **Description:** Build applications using Alkahest, natural-language-agreements, git-commit-trading, or de-redis-clients as core dependency. Must be load-bearing.

#### 26. Escrow Ecosystem Extensions
- **Pool:** $450 (Best Submission)
- **Description:** New arbiters, verification primitives, obligation patterns extending the Alkahest escrow protocol. New logic, new verification, new trust models.

---

### ENS (3 tracks, $1,500 total)

#### 27. ENS Identity
- **Pool:** $600 (1st: $400 / 2nd: $200)
- **Description:** ENS names for onchain identity — name registration/resolution, agent identity, profile discovery. Replace hex addresses with names.

#### 28. ENS Communication
- **Pool:** $600 (1st: $400 / 2nd: $200)
- **Description:** Communication and payment experiences powered by ENS — messaging, social payments, agent-to-agent communication, eliminating raw addresses.

#### 29. ENS Open Integration
- **Pool:** $300 (Best: $300)
- **Description:** Catch-all for any project meaningfully integrating ENS — identity, discovery, trust, communication. ENS should be core, not afterthought.

---

### Slice (3 tracks, $1,950 total)

#### 30. Ethereum Web Auth / ERC-8128
- **Pool:** $750 (1st: $500 / 2nd: $250)
- **Description:** Correct use of ERC-8128 as authentication primitive — SIWE-like flows, seamless agent auth. Working demos + compliant/creative use. Prizes in Slice product credits.

#### 31. The Future of Commerce
- **Pool:** $750 (1st: $500 / 2nd: $250)
- **Description:** Custom websites, checkout experiences, or flows built on Slice stores and products — for humans or agents. Innovative, refined, non-crypto-native-friendly. Prizes in Slice infrastructure credits.

#### 32. Slice Hooks
- **Pool:** $700 (1st: $550 / 2nd: $150)
- **Description:** Pricing strategies and onchain actions adding unsupported functionalities to Slice products. Tested, original hooks useful to Slice merchants/buyers. Prizes include Slice Pass NFTs + credits.

---

### Markee ($800)

#### 33. Markee Github Integration
- **Pool:** $800 (Top Views: $400 / Top Monetization: $400, allocated proportionally)
- **Description:** Integrate a Markee message into a high-traffic GitHub repo. Two objective metrics: unique views + funds added. Must own repo, grant OAuth, add delimiter text, appear as "Live" on Markee's GitHub page. Min 10 unique views required.

---

### ampersend ($500)

#### 34. Best Agent Built with ampersend-sdk
- **Pool:** $500
- **Description:** Build the best AI agent using ampersend-sdk as a core, load-bearing dependency. Substantive integration, not peripheral.

---

### Self ($1,000)

#### 35. Best Self Agent ID Integration
- **Pool:** $1,000 (winner-takes-all)
- **Description:** Best integration of Self Agent ID (app.ai.self.xyz) — Self Protocol's ZK-powered identity for AI agents. Use cases: soulbound NFT, A2A identity verification, Sybil-resistant workflows, human-backed credentials. Identity must be load-bearing.
