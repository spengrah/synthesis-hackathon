# Submission overlap report — 2026-03-19 16:48:59 CDT

## Purpose

This memo captures a timestamped scan of the public Synthesis hackathon submissions aggregator to identify projects that overlap with **Trust Zones** and to clarify where the overlap is shallow, substantial, or potentially competitive.

This file is meant to be re-run later as the deadline approaches so we can compare deltas in the field.

## Query metadata

- **Queried at:** 2026-03-19 16:48:59 CDT
- **Primary source:** `https://synthesis-hackathon-applications.vercel.app/`
- **Backing dataset discovered from app bundle:** `https://synthesis-hackathon-applications.vercel.app/synthesis-agents.json`
- **Project compared against:** `projects/synthesis-hackathon` (`README.md`, `AGENTS.md`)
- **Working thesis used for comparison:** Trust Zones as an interoperability standard for machine agreements

## Trust Zones comparison frame

For this review, submissions were evaluated against the current Trust Zones framing in the repo:

- **Agreement-centered coordination** rather than a single app/workflow
- **Per-party trust zones** as scoped smart accounts
- **Typed resource model** for permissions, responsibilities, and directives
- **Hard constraints + subjective directives** as separate enforcement layers
- **Economic backing** via bonds / stake / adjudication / dispute pathways
- **Interoperability thesis**: a reusable protocol for machine agreements, not just one marketplace or one policy wallet

That distinction matters because many submissions overlap with one or two components of the thesis, but far fewer seem to be attempting the whole stack.

## Executive summary

### Bottom line

There is **real overlap** in the submissions field, but it is mostly **component overlap**, not **full-thesis overlap**.

I did **not** find an obvious direct clone of Trust Zones. The closest projects generally cluster into one of three categories:

1. **Agreement / escrow / work-contract systems**
2. **Scoped permissions / delegation / wallet policy systems**
3. **Trust / reputation / verification / insurance systems**

Trust Zones appears to remain differentiated if presented clearly as the layer that **combines** these into a general machine-agreement primitive.

### Most relevant competitive adjacency

If we think in terms of “what could a judge loosely bucket together with us,” the strongest adjacency set is:

1. **AgentPact**
2. **SynthesisPact**
3. **Agent Work Marketplace**
4. **AgentScope**
5. **Veil**
6. **Surety Protocol**
7. **EMET / Cortex / SigilX**

But those split across different slices of the stack. None, from the scan, clearly package:

- bilateral/multiparty agreement formation,
- per-party scoped accounts/zones,
- typed resources,
- explicit constraint/directive distinction,
- and economic + adjudication-backed enforcement

as one coherent standard.

## Closest overlap cluster A: agreement / escrow / work contracts

These are the submissions most likely to be perceived as “same neighborhood” by a judge, because they start with commitments between parties rather than just agent wallets or reputation.

### 1. AgentPact
- **Repo:** `https://github.com/namedfarouk/AgentPact`
- **Tracks:** Synthesis Open Track, ENS Open Integration, ENS Identity, Best Agent on Celo, Agents With Receipts, Let the Agent Cook

#### Why it overlaps
AgentPact is the clearest overlap on the **agreement / escrow / enforceable commitments** axis. The core framing is that agents can negotiate, commit to, and enforce freelance agreements through smart contracts, with escrow and auto-release behavior.

That maps to a meaningful subset of Trust Zones:
- explicit agreement object
- machine-mediated commitments
- onchain enforcement of some lifecycle outcomes
- economic consequence / escrow logic

#### Why it is still materially different
From the submission description, AgentPact appears much narrower than Trust Zones:
- it looks like an **application-specific contracting pattern** for freelance-style work,
- not a generalized **agreement framework**,
- not obviously based on **per-party scoped accounts/zones**,
- and not obviously modeling **permissions + responsibilities + directives** as typed first-class resources.

It seems closer to “smart-contract freelance escrow for agents” than “machine agreements as a reusable substrate.”

#### Competitive risk assessment
- **Risk:** medium
- **Why:** if Trust Zones is pitched too much as “trustless agreements” without emphasizing the zone/resource/enforcement architecture, judges may collapse the distinction.
- **Counter-positioning:** stress that Trust Zones is not just a work escrow mechanism; it is the control plane for any machine agreement involving scoped access to real resources.

### 2. SynthesisPact
- **Repo:** `https://github.com/kevinkokinda/SynthesisPact`
- **Tracks:** Agents With Receipts, Agent Services on Base

#### Why it overlaps
SynthesisPact also sits in the **trustless work contract** category. It emphasizes AI signing agreements, logging deliverables as proofs, and automatic payment release after human verification.

Overlap points:
- contractual relationship between parties
- deliverable accountability
- proof/log trail
- release conditions tied to verification

#### Why it is still different
This also appears much more like a **work-order / escrow product** than an interoperability primitive.

Relative to Trust Zones, it appears missing or deemphasizing:
- per-party scoped zones/accounts
- resource tokens or typed scope objects
- separation of hard constraints vs soft/adjudicated rules
- a general-purpose mechanism for cross-agent resource access

#### Competitive risk assessment
- **Risk:** medium-low
- **Why:** similar surface narrative, but narrower architecture and lower concept span.

### 3. Agent Work Marketplace
- **Repo:** `https://github.com/GGBossman/agent-work-marketplace`
- **Tracks:** Synthesis Open Track, Agents that pay, Escrow Ecosystem Extensions, Agents With Receipts, Agent Services on Base

#### Why it overlaps
This overlaps on the practical market side of agent agreements:
- agents register,
- jobs are posted,
- funds are escrowed,
- reputation is earned,
- payouts are trustless.

This is relevant because it competes for the same intuitive “future of agent commerce” mental bucket.

#### Why it is different
It appears to be a **marketplace vertical** built on familiar primitives:
- escrow
- reputation tiers
- staking
- agent registration

Trust Zones is broader and deeper if pitched correctly:
- not just a labor marketplace
- not just escrowed jobs
- but a reusable **agreement abstraction** for multiple collaboration patterns

#### Competitive risk assessment
- **Risk:** medium
- **Why:** strong demoability and easy-to-understand market story can outcompete deeper infrastructure if we present too abstractly.
- **Counter-positioning:** show that marketplaces could be built on top of Trust Zones rather than alongside it.

### 4. Nastar Protocol / ALIAS / AgentHire Protocol

#### Nastar Protocol
- **Repo:** `https://github.com/7abar/nastar-protocol`

#### ALIAS — Proof-of-Reputation Protocol for AI Agents
- **Repo:** `https://github.com/Jess9400/alias-agent`

#### AgentHire Protocol
- **Repo:** `https://github.com/MarcoTopq/agenthire-protocol`

#### Why this mini-cluster matters
These projects overlap with Trust Zones in combinations of:
- hiring agents,
- trust/reputation for counterparties,
- escrow or settlement,
- marketplace/discovery dynamics,
- and agent-to-agent service exchange.

They matter less as direct architectural competitors and more as **evidence that the field is converging on agent commerce + trust infrastructure**.

#### Why they are different
They appear to focus on one or more of:
- discovering capable agents,
- deciding whether to trust them,
- hiring them for work,
- and settling/paying for outcomes.

Trust Zones, by contrast, should be framed as the layer that governs the **structure of the agreement itself** and the **resource boundaries for each party** inside the relationship.

#### Competitive risk assessment
- **Risk:** low-to-medium individually; medium collectively
- **Why:** together they create a crowded narrative space around “agent coordination + trust + hiring.”

## Closest overlap cluster B: scoped permissions / delegation / execution boundaries

This cluster is highly relevant because one of Trust Zones’ strongest novel pieces is that each party gets a scoped zone with real resources and explicit constraints. These projects are close on that axis.

### 5. AgentScope
- **Repo:** `https://github.com/ghost-clio/agent-scope`
- **Tracks:** appears in multiple variants in the feed; repeatedly associated with scoped spending/policies/delegations

#### Why it overlaps
AgentScope is probably the strongest single overlap on the **scoped execution / bounded autonomy** axis.

It includes:
- onchain spending policies
- daily limits
- contract whitelists
- yield-only budgets
- emergency pause
- delegation / caveat-style enforcement

This touches a major Trust Zones concern directly: **how to give an agent real power over resources without giving it unconstrained power**.

#### Why it is still different
AgentScope appears focused on **wallet policy enforcement** and **transaction bounds**. That is important, but it is only one slice of Trust Zones.

Trust Zones is broader if we keep emphasizing:
- agreements between parties, not only human→agent wallet control
- scoped zones for each participant, not just one policy-enforced execution subject
- resources that include responsibilities/directives as well as permissions
- multi-layer enforcement including subjective adjudication, not only deterministic policy checks

In other words, AgentScope seems closer to a **policy-enforced wallet/controller**, while Trust Zones aims to be a **machine agreement fabric**.

#### Competitive risk assessment
- **Risk:** high on one dimension
- **Why:** if a judge latches onto the “scoped authority” part of our project, AgentScope may feel adjacent or even more concrete unless we connect scoped authority back to the broader agreement architecture.
- **Counter-positioning:** “AgentScope solves bounded wallet execution. Trust Zones generalizes bounded mutual obligations and access across parties.”

### 6. Veil — Intent-Compiled Private DeFi Agent
- **Repo:** `https://github.com/neilei/synthesis-hackathon`
- **Tracks:** Agentic Finance, Private Agents/Trusted Actions, Best Use of Delegations, Agents With Receipts

#### Why it overlaps
Veil is highly relevant because it combines:
- natural-language intent compilation,
- onchain delegation caveats,
- scoped execution,
- and verifiable accountability.

That is one of the most intellectually adjacent projects in the field because it is also trying to turn fuzzy human intent into enforceable machine boundaries.

#### Why it is still different
Veil appears centered on a **private DeFi execution pipeline**:
- user says what they want,
- constraints are compiled into delegation caveats,
- swaps/rebalancing are executed under those constraints,
- identity and validation layers record outcomes.

Trust Zones is conceptually broader and less app-specific:
- not just portfolio rebalancing or DeFi delegation,
- but reusable agreements between arbitrary parties,
- with scoped resources and mutual obligations.

If Trust Zones is “machine agreements as protocol,” Veil is closer to “private constrained agent finance as application + pattern.”

#### Competitive risk assessment
- **Risk:** high among technically sophisticated submissions
- **Why:** similar concern set: constraints, delegation, trust, validation, onchain enforcement.
- **Counter-positioning:** Veil is a strong example of one kind of constrained agent interaction; Trust Zones aims to define the general container those interactions can live inside.

### 7. Agent Vault / SentinelVault / AgentPay

#### Agent Vault
- **Repo:** `https://github.com/alexchenai/agent-vault`

#### SentinelVault
- **Repo:** `https://github.com/LeventLabs/SentinelVault`

#### AgentPay
- **Repo:** `https://github.com/Darlington6/agentpay`

#### Why this cluster matters
These projects reinforce that the field cares a lot about:
- guardrails for agent spending,
- safe autonomous finance,
- scoped authority,
- and mathematically enforced boundaries.

That validates the demand side of the Trust Zones thesis.

#### Why they are different
They mostly look like **unilateral control mechanisms**:
- human sets rules,
- contract enforces spend limits,
- agent operates inside them.

Trust Zones is more relational and bilateral/multiparty:
- agreement between parties,
- each side has a zone,
- each zone contains what can be accessed, what must be done, and what must not be done.

#### Competitive risk assessment
- **Risk:** low individually, medium as a narrative cluster
- **Why:** they support the category but do not seem to cover the same conceptual surface.

## Closest overlap cluster C: trust / reputation / verification / insurance / challenge systems

This cluster overlaps with the Trust Zones enforcement and trust-update thesis.

### 8. Surety Protocol — Trust Infrastructure for AI Agents
- **Repo:** `https://github.com/Potdealer/surety-protocol`

#### Why it overlaps
Surety overlaps strongly with the **trust enforcement** side of Trust Zones:
- receipts
- insurance / pools
- threat intelligence
- registry writes
- portable trust infrastructure

It is one of the strongest examples of agent trust infrastructure beyond simple reputation.

#### Why it is still different
Surety appears to be about **risk-transfer and trust infrastructure** layered around agent interactions, rather than the structure of the interaction itself.

Trust Zones should remain distinct if framed as:
- defining the agreement substrate,
- defining each party’s scoped operating zone,
- and embedding enforcement primitives directly into the agreement relationship.

Surety is closer to infrastructure that could plausibly sit **alongside** or **on top of** Trust Zones.

#### Competitive risk assessment
- **Risk:** medium-high on “serious trust infra” credibility
- **Why:** strong, legible, insurance-native language may resonate with judges looking for concrete trust mechanisms.

### 9. EMET — Trustless Agent Reputation on Base
- **Repo:** `https://github.com/clawdei-ai/emet-core`

#### Why it overlaps
EMET’s core idea is staking claims and slashing false ones. That overlaps with Trust Zones on:
- stake-backed commitments,
- challengeability,
- consequences for dishonesty,
- and trust as something more than self-assertion.

#### Why it is different
EMET seems focused on **truthfulness and reputation of claims**, not on a full collaboration agreement model.

It contributes to the same macro theme — machine trust with economic consequences — but not the same object.

#### Competitive risk assessment
- **Risk:** medium
- **Why:** overlapping trust language, but clearly narrower.

### 10. Cortex Protocol
- **Repo:** `https://github.com/davidangularme/cortex-protocol`

#### Why it overlaps
Cortex is highly relevant conceptually because it introduces:
- adversarial challenge,
- stake-backed reasoning claims,
- and adjudication around truth/quality.

That rhymes with the Trust Zones idea that not everything can be deterministically enforced and some rules need dispute/challenge machinery.

#### Why it is different
Cortex is about **adversarial robustness of reasoning traces** rather than machine agreements governing access and obligation.

Still, it is a useful comparator for judges who respond to “trust through challengeable stake-backed claims.”

#### Competitive risk assessment
- **Risk:** medium
- **Why:** not the same product/category, but shares philosophical territory around enforceable trust under uncertainty.

### 11. SigilX
- **Repo:** `https://github.com/sigilxyz/sigilx`

#### Why it overlaps
SigilX overlaps around:
- verification oracle logic,
- certificates and challengeability,
- staking / dispute patterns,
- and agent trust signals for economic decisions.

#### Why it is different
It appears more verification-oracle focused than agreement focused. This is another case where the overlap is meaningful in the **trust/enforcement layer**, but not in the **agreement substrate**.

#### Competitive risk assessment
- **Risk:** medium

### 12. AlliGo / Observer / BasedAgents / ALIAS / AgentRep / TrstLyr

This broader reputation/identity cluster matters because it shows the field is saturated with projects trying to solve:
- who an agent is,
- whether it can be trusted,
- what it has done,
- and where that reputation lives.

That is relevant to Trust Zones, but it is not the full story.

The main strategic point is this: **do not pitch Trust Zones primarily as a reputation system.** That lane is crowded. Instead, pitch reputation/trust updates as one layer inside a larger agreement system.

## Important supporting-adjacent projects

These are not the closest competitors, but they validate parts of the thesis or create useful context.

### b1e55ed
- **Repo:** `https://github.com/P-U-C/b1e55ed`
- Overlap: reputation, validation, constraints
- Relevance: trust signals grounded in outcomes rather than assertions

### Execution Protocol (EP) — AgentIAM
- **Repo:** `https://github.com/achilliesbot/execution-protocol`
- Overlap: policy validation, proof of pre-execution authorization, reputation/validation
- Relevance: evidence that “machine IAM for agents” is an emerging category

### Authority Ledger
- **Repo:** `https://github.com/HardBrick21/Authority-Ledger`
- Overlap: authority state changes, auditable permissions
- Relevance: supports the importance of explicit authority lifecycle modeling

### Delegator Agent Toolkit
- **Repo:** `https://github.com/eidolon-agent/delegator-agent-toolkit`
- Overlap: intent-bound delegations, revocability, constraint chains
- Relevance: useful comparator on bounded delegated agency

### AgentGuard
- **Repo:** `https://github.com/Velidia/AgentGuard-Synthesis`
- Overlap: smart account guardrails, bounded execution
- Relevance: more evidence that constrained autonomy is a hot cluster

## What I did not find

I did **not** find a clearly described project that combines all of the following in the same package:

1. **An explicit agreement primitive** between parties
2. **A per-party zone/account abstraction** inside that agreement
3. **Typed resources** spanning permissions, responsibilities, and directives
4. **A dual enforcement model** separating deterministic constraints from subjective/adjudicated rules
5. **Economic stake/bonding and dispute flow** tied to those agreements
6. **A claim to be an interoperability standard** rather than a vertical application

That combination still appears distinctive.

## Strategic interpretation

### Where Trust Zones appears strongest
Trust Zones appears strongest when described as:

- the **control plane for machine agreements**,
- not just a payment or escrow mechanism,
- not just wallet policy,
- not just reputation,
- and not just agent identity.

The key differentiator is the synthesis:

- **agreement object**
- **scoped per-party operating zones**
- **typed resources**
- **multi-layer enforcement**
- **economic skin in the game**
- **interoperable standard positioning**

### Biggest presentation risk
The main risk is **under-differentiation through generic language**.

If the project is described vaguely as:
- trustless contracts for agents,
- scoped permissions for agents,
- or reputation-backed agent collaboration,

then judges may mentally bucket it with AgentPact, AgentScope, Surety, Veil, etc.

### Best differentiation language to emphasize
The project should keep hammering:

1. **Not a single app: a standard**
2. **Not one wallet policy: one zone per party**
3. **Not only permissions: permissions + responsibilities + directives**
4. **Not only hard enforcement: hard constraints + subjective adjudication**
5. **Not just reputation after the fact: agreements with real resources at stake while the interaction is happening**

## Suggested competitive positioning bullets for future submission/demo copy

### One-line differentiation
Trust Zones is a **general-purpose machine agreement standard**: every agreement creates per-party scoped zones that hold real resources and encode what each party may do, must do, and must not do.

### Compared to escrow/work marketplaces
Unlike escrow marketplaces, Trust Zones is not just a job-payment flow. It is the reusable substrate for any agent-to-agent or human-agent collaboration that needs scoped access, enforceable obligations, and challengeable trust.

### Compared to wallet policy systems
Unlike spending-policy systems, Trust Zones does not only constrain one actor’s wallet. It models the full relationship between parties through separate zones, explicit resources, and agreement lifecycle.

### Compared to reputation systems
Unlike reputation registries, Trust Zones does not only score agents after the fact. It structures the collaboration itself and places resources, permissions, and consequences inside the agreement boundary.

## Priority watchlist for the next scan

If we repeat this scan close to deadline, prioritize changes in these projects first:

1. **AgentPact**
2. **SynthesisPact**
3. **Agent Work Marketplace**
4. **AgentScope**
5. **Veil**
6. **Surety Protocol**
7. **EMET**
8. **Cortex Protocol**
9. **SigilX**
10. **ALIAS / AgentHire / Nastar**

## Recommended next artifact

A useful next step would be a second memo with a stricter structure for external communication:

1. **Direct competitors**
2. **Adjacent-but-different projects**
3. **Trust Zones unique claims**
4. **Judge-facing differentiation bullets**
5. **FAQ / objection handling**

That could become a reusable submission and demo prep artifact.

## Confidence

- **High confidence:** the feed contains many overlaps in components
- **Medium confidence:** the current field does not contain a direct full-stack clone of Trust Zones
- **Medium-high confidence:** the biggest risk is not conceptual duplication, but poor differentiation in how Trust Zones is framed
