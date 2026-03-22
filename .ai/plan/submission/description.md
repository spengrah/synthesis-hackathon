# Submission Description — Trust Zones

*Draft for Devfolio project description field. Optimized for human judges.*

---

## Description

**Trust Zones is a protocol for machine agreements.** It defines how autonomous agents form, enforce, and resolve structured relationships with real resources at stake.

The core idea: when agents collaborate, trust is the gap between what each party *can* do and what it *should* do. There is a fundamental tension in trying to close that gap purely with deterministic constraints — the more you lock down, the more secure but the less effective the agent becomes. Navigating this tension correctly for any given scenario requires a range of trust-building mechanisms and the flexibility to compose them. That is what Trust Zones provides: a general protocol with multiple modalities — constraints for hard limits, directives for subjective rules, incentives for consequences, reputation for history — so parties can engineer exactly the right trust profile for each relationship.

### The protocol

An **agreement** is a smart contract between parties. Each party gets a **Trust Zone** — a scoped ERC-7579 smart account that holds the resources, permissions, and obligations of that party's role in the relationship. Three types of **resource tokens** define the zone's scope: *permissions* (what you can do), *responsibilities* (what you must do), and *directives* (what you should or shouldn't do).

Enforcement works in three layers. **Constraints** are deterministic — an ERC-7579 hook rejects unauthorized transactions before they execute. **Directives** are subjective — when a party claims a violation, an adjudicator evaluates the evidence and renders a verdict. The adjudicator is a protocol-defined role that can be filled by any Ethereum account: a multisig, an oracle service, a dispute resolution protocol like GenLayer, or any purpose-built arbitration system. For our hackathon demo, we built a lightweight LLM stand-in to fill the role. **Incentives** make verdicts consequential. The protocol supports any mechanism that creates skin in the game — staked collateral, escrowed payments, reputation bonds, token lockups. In our demo, parties stake USDC through Hats Protocol eligibility modules. After every agreement, ERC-8004 reputation feedback records the outcome onchain, shaping the terms of future agreements.

The protocol is designed to be general-purpose. Agreements can govern data exchanges, API access, collaborative research, escrow, SLA enforcement, or any structured collaboration between agents. The mechanism compiler ships with 8 demo templates (budget caps, allowlists, time locks, staking, reputation gates), but the template library is open and extensible — any mechanism that can be expressed as a Hats module or ERC-7579 hook can be composed into an agreement.

### Agent tooling

Agents interact with Trust Zones through two interfaces:

- **`@trust-zones/cli`** — a local CLI for ERC-8128 zone signing and transaction preparation. Free, no dependencies.
- **x402 MCP server** — a pay-per-request protocol service exposing the compiler and SDK as MCP tools (compile, decompile, encode, decode, explain, staking info). Any agent with an MCP-compatible harness can use it.

### The demo: Temptation Game

To prove the protocol, we built the **Temptation Game** — a live, interactive scenario where an agent receives real capabilities (posting tweets from [@tempt_game_bot](https://x.com/tempt_game_bot), withdrawing USDC from a vault) but is also given directives restricting how those capabilities can be used. The trust test is whether the agent follows the rules when it has the power not to.

The game runs on Base mainnet. We automated the other side of the agreement so any agent can play single-player: propose an agreement to the registry, and an automated counterparty responds — negotiating terms based on the agent's onchain ERC-8004 reputation. An adjudicator (a protocol-defined role, filled here by a lightweight LLM stand-in) monitors for violations. A real-time leaderboard and agreement dashboard track all activity.

### What we built

The protocol is implemented end-to-end across 8 packages: 6 Solidity contracts (384 tests), a TypeScript SDK (56 tests), a mechanism compiler (27 tests), a Ponder event indexer (36 tests), 13 end-to-end lifecycle tests, autonomous counterparty and adjudicator agents, an x402 MCP service, a CLI, and a real-time visualization suite — all deployed on Base.

---

## Problem Statement

AI agents are gaining the ability to act autonomously — spend money, access APIs, post content, move data. But there is no general-purpose protocol for the agreements under which agents collaborate. Existing approaches address fragments: marketplaces match parties, wallet policies bound spending, reputation systems track history after the fact. None of them define the agreement itself — the scoped access, mutual obligations, enforcement rules, and economic consequences that make a collaboration trustworthy.

This is a delegation problem. When you delegate capabilities to an agent, you need confidence that its actions will align with your interests. That confidence comes from a combination of reputation (what you know about the agent) and hardness (structural protections that constrain or incentivize behavior). You could try to close the trust gap entirely with hard constraints — lock everything down. But the tighter the constraints, the less effective the agent becomes. Full constraint means full safety but zero usefulness. Full autonomy means full effectiveness but zero safety. Without a protocol that provides multiple modalities of trust — hard constraints, subjective rules, economic consequences, reputation — every agent interaction is stuck at one extreme or the other.

Trust Zones fills the gap: a protocol where agreements are smart contracts, zones are smart accounts, trust is the measurable distance between capability and compliance, and reputation updates from every interaction.
