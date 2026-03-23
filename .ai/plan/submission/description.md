# Submission Description — Trust Zones

*Draft for Devfolio project description field.*

---

## Description

**Trust Zones is a modular agreement substrate for AI agents.** It provides the building blocks — permissions, responsibilities, directives, constraints, and incentive mechanisms — as atomic, composable, negotiable onchain primitives. Agents assemble exactly the right agreement for their collaboration, and the protocol makes it enforceable.

The core challenge is the **autonomy gap**: when you delegate real capabilities to an agent, you want to maximize the autonomy you grant (so the agent can be effective) while ensuring that autonomy is safe (so the agent can't capture your resources or act against your interests). Without the right tools, you're stuck at one extreme — zero autonomy or full autonomy. Trust Zones expands the frontier of safe autonomy by giving parties a rich design space of composable mechanisms.

### The protocol

An **agreement** is a smart contract between parties. Each party gets a **Trust Zone** — a scoped ERC-7579 smart account that holds the resources, permissions, and obligations of that party's role. The building blocks plug into zones as typed resource tokens and mechanism modules:

- **Constraints** — what you CANNOT do. Deterministic rules enforced automatically by ERC-7579 hooks.
- **Permissions** — what you CAN do. ERC-6909 tokens granting scoped access to specific capabilities.
- **Responsibilities** — what you SHOULD do. ERC-6909 tokens defining positive obligations.
- **Directives** — what you SHOULD NOT do. ERC-6909 tokens defining negative obligations.

Constraints and permissions are deterministic — definable a priori and self-enforcing. Responsibilities and directives are non-deterministic — they require post-hoc evaluation by a credibly neutral third party. The **adjudicator** is a protocol-defined role that can be filled by any Ethereum account: a multisig, a dispute resolution protocol, an oracle service, or any purpose-built arbitration system.

**Incentive mechanisms** give the non-deterministic rules teeth. Staked collateral, escrowed payments, reputation bonds, token lockups — pluggable smart contract modules that create real consequences. **ERC-8004 reputation feedback** is built into the protocol itself: after every agreement, the outcome is written to the ERC-8004 Reputation Registry, feeding back into future trust decisions.

Every element is a discrete, negotiable unit. Parties negotiate over individual pieces — "I'll accept this directive if you lower the stake requirement" — and the **mechanism compiler** assembles them into onchain proposal data. The template library ships with 8 mechanism templates (budget caps, allowlists, time locks, staking, reputation gates), but any mechanism expressible as a Hats module or ERC-7579 hook can be composed into an agreement.

### Agent tooling

Agents interact with Trust Zones through two interfaces:

- **`@trust-zones/cli`** — a local CLI for ERC-8128 zone signing and transaction preparation. Free, no dependencies.
- **x402 MCP server** — a pay-per-request protocol service exposing the compiler and SDK as MCP tools (compile, decompile, encode, decode, explain, staking info). Any agent with an MCP-compatible harness can use it.

### The demo: Temptation Game

To prove the protocol, we built the **Temptation Game** — a live scenario that assembles the building blocks into one legible interaction. An agent enters an agreement and receives real capabilities (posting tweets from [@tempt_game_bot](https://x.com/tempt_game_bot), withdrawing USDC from a vault), along with responsibilities (attribute the hackathon, include agent ID), directives (don't post off-topic, don't withdraw USDC), constraints (hard withdrawal cap), and incentives (staked USDC bond, ERC-8004 reputation).

The agent has *permission* to withdraw — the deterministic rules allow it. But a *directive* says don't — and that's enforced by evaluation and consequences. The Temptation Game makes the autonomy gap visible: how much freedom can you safely grant an agent when the mechanisms backing the rules are real?

The game runs on Base mainnet. An automated counterparty responds to proposals, calibrating terms to the agent's onchain ERC-8004 reputation. An adjudicator monitors for violations.

### What we built

The protocol is implemented end-to-end across 11 packages: 6 Solidity contracts (394 tests), a TypeScript SDK (56 tests), a mechanism compiler (23 tests), a Ponder event indexer (36 tests), 30 end-to-end tests, autonomous counterparty and adjudicator agents, an x402 MCP service, a CLI, a Bonfires knowledge graph integration, and a real-time visualization suite — all deployed on Base.

---

## Problem Statement

AI agents are gaining the ability to act autonomously — spend money, access APIs, post content, move data. But there is no general-purpose protocol for the agreements under which agents collaborate. Existing approaches address fragments: marketplaces match parties, wallet policies bound spending, reputation systems track history after the fact. None of them define the agreement itself — the scoped access, mutual obligations, enforcement rules, and economic consequences that make a collaboration trustworthy.

This is a delegation problem — the **autonomy gap**. When you delegate capabilities to an agent, you want to maximize the autonomy you grant while ensuring that autonomy is safe. Trust comes from the combination of reputation (what you know about the agent) and structural mechanisms (deterministic rules, incentive-backed non-deterministic rules, adjudication). Without a protocol that provides these as composable, negotiable building blocks, every agent interaction is stuck at one extreme: zero autonomy (safe but useless) or full autonomy (effective but dangerous).

Trust Zones fills the gap: a modular agreement substrate where every permission, responsibility, directive, constraint, and incentive mechanism is an atomic, negotiable onchain primitive — so agents can compose exactly the right agreement and the protocol makes it enforceable.
