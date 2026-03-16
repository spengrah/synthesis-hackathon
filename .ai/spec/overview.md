# Overview

## Thesis

**Trust Zones are the interoperability standard for machine agreements.** An agreement is a contract; a contract is an agreement. Trust Zones make this literal: each agreement is a smart contract, each zone within an agreement is a smart account that holds real resources, and permissions to those resources are the stakes of the agreement.

**Judge-facing framing:** "Machines can keep promises when the promise is a Trust Zone: constraints are explicit, enforcement is onchain, resources are at stake, disputes are adjudicated, and trust updates from every interaction."

## Core Primitives

| Primitive | What | Onchain form |
|-----------|------|-------------|
| **Agreement** | Commitment between parties with full lifecycle state machine | Smart contract (one per agreement) |
| **Trust Zone** | A party's zone within an agreement — holds resources, has constraints | ERC-7579 smart account (one per zone per agreement) |
| **TZ Token** | Proof of membership in a zone — enables "act as" onchain and offchain | Hats Protocol hat |
| **Resource Tokens** | Typed tokens defining zone scope | ERC-6909 in Resource Token Registry |
|   ↳ Permission | "What you CAN do" | `0x01` prefix |
|   ↳ Responsibility | "What you MUST do" (rivalrous) | `0x02` prefix |
|   ↳ Directive | "What you SHOULD/SHOULDN'T do" (subjective rules) | `0x03` prefix |
| **Mechanisms** | Typed parameters governing zones | ELIGIBILITY, INCENTIVE, CONSTRAINT |

## Relationships

- An agreement comprises one or more trust zones
- A trust zone holds resources (funds, tokens) and resource tokens (permissions, responsibilities, directives)
- Resource tokens are independent artifacts — reusable across multiple trust zones
- An agent wears the zone's hat → can operate *as* the zone (onchain and offchain)
- The agreement contract governs the zones — installs modules, controls lifecycle

## "Act as" resolution model

### Onchain
1. Agent (hat-wearer) calls `execute()` on TZ Account
2. TZ Account routes to HatValidator → checks `hats.isWearerOfHat(caller, hatId)`
3. Hooks run `preCheck` (constraints)
4. TZ Account executes call → `msg.sender` at target = TZ account address
5. Hooks run `postCheck`

### Offchain
1. Agent signs with `keyid="erc8128:<chainId>:<tzAccountAddress>"`
2. Server calls `isValidSignature()` on TZ Account (ERC-1271)
3. OZ routes to HatValidator → checks hat on recovered signer
4. Server authenticates as TZ account address

### Resource authorization
Resource providers check the TZ account's resource token holdings:
1. Permission check: `registry.balanceOf(tzAccount, permTokenId) > 0`
2. Directive read: `registry.tokenMetadata(directiveTokenId)` for usage rules
3. Enforce dynamically based on directive metadata

## Three-layer enforcement model

| Layer | Enforces | How | Example |
|-------|----------|-----|---------|
| **Constraints** | Hard, deterministic | ERC-7579 hooks block pre-execution | Unauthorized target → PermissionsHook blocks |
| **Directives** | Soft, subjective | Action receipts evaluated post-execution by adjudicator | Violated usage rules → dispute |
| **Incentives** | Consequences | Bond slashed, escrow withheld, reputation marked | 35% bond slashed + negative 8004 feedback |

## Chain

Base (USDC, x402, ERC-8004 all on Base).
