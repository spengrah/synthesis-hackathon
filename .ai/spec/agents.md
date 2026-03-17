# Demo Agents Spec

## Overview

Two autonomous agents (Agent A and Agent B) that drive the 9-beat demo scenario. Each agent is a TypeScript process that uses the SDK to interact with contracts and the Bonfires API for context graph reads/writes.

Agents call contracts directly via viem (using the SDK for encoding). No separate CLI layer.

## Agent architecture

```
┌─────────────────────────────────────────────┐
│                  AGENT                       │
│                                              │
│  ┌──────────────┐  ┌─────────────────────┐  │
│  │  SDK          │  │  Bonfires client     │  │
│  │  (encode/     │  │  (query context,     │  │
│  │   decode/     │  │   log beliefs,       │  │
│  │   read)       │  │   search evidence)   │  │
│  └──────┬───────┘  └──────────┬──────────┘  │
│         │                      │              │
│  ┌──────┴──────────────────────┴──────────┐  │
│  │           Agent logic                   │  │
│  │  - Negotiation strategy                 │  │
│  │  - Data access (ERC-8128 signed reqs)   │  │
│  │  - Monitoring (receipt analysis)         │  │
│  │  - Dispute filing                       │  │
│  │  - Completion signaling                 │  │
│  └──────┬──────────────────────┬──────────┘  │
│         │                      │              │
│  ┌──────┴───────┐  ┌──────────┴──────────┐  │
│  │  viem         │  │  HTTP client         │  │
│  │  (contract    │  │  (data API access,   │  │
│  │   calls)      │  │   x402 service)      │  │
│  └──────────────┘  └─────────────────────┘  │
│                                              │
└─────────────────────────────────────────────┘
```

## Agent identity

Each agent has:
- An EOA wallet (private key) for signing transactions and ERC-8128 requests
- An ERC-8004 agent identity on Base (registered via the hackathon platform)
- A Bonfires agent ID (registered during setup)

## Agent A: Data provider + dispute filer

**Role:** Owns proprietary market data. Proposes an agreement to exchange data access with Agent B. Monitors B's usage. Files a claim when directives are violated.

### Capabilities

1. **Propose agreement** — construct ProposalData (via compiler or manually), call `submitInput(PROPOSE, ...)`
2. **Respond to counters** — read counterparty's proposal (decode via SDK), evaluate, accept or counter
3. **Activate** — call `submitInput(ACTIVATE, ...)` or `acceptAndActivate()`
4. **Access data** — sign ERC-8128 requests to Agent B's data API as TZ Account 2
5. **Monitor counterparty** — query Bonfires for B's action receipts on Zone 1, check directive compliance
6. **File claim** — when violation detected, call `submitInput(CLAIM, abi.encode(mechanismIndex, evidence))`
7. **Signal completion** — call `submitInput(COMPLETE, abi.encode(feedbackURI, feedbackHash))`
8. **Renegotiate** — after resolution, propose a new agreement with adjusted terms based on B's updated reputation

### Negotiation strategy

Agent A's strategy for the demo:
- Proposes initial terms with moderate constraints
- Accepts B's counter if bond threshold is within acceptable range
- After resolution: checks B's 8004 reputation, increases bond requirement proportionally

## Agent B: Data consumer + directive violator

**Role:** Owns proprietary social data. Receives agreement proposal from A. Accesses A's data within (and sometimes outside) the agreed terms.

### Capabilities

1. **Receive proposal** — read ProposalData from contract events (decode via SDK)
2. **Counter-propose** — modify terms, recompile, call `submitInput(COUNTER, ...)`
3. **Access data** — sign ERC-8128 requests to Agent A's data API as TZ Account 1
4. **Violate directives** (scripted for demo) — exceed rate limits, omit attribution
5. **Attempt unauthorized access** (scripted for demo) — try to access /raw-export (permission denied)
6. **Signal completion/exit** — call `submitInput(COMPLETE, ...)` or `submitInput(EXIT, ...)`

### Demo behavior (scripted)

For the demo, Agent B's behavior is partially scripted to trigger the enforcement layers:
- **Beat 3:** Normal data access (happy path)
- **Beat 4:** Attempt unauthorized endpoint → blocked by permission check
- **Beat 5:** Exceed rate limit + omit attribution → A detects via receipts → claim filed

## Agent lifecycle (per demo beat)

### Beat 1: NEGOTIATE

```typescript
// Agent A
const proposalData = compiler.compile(tzSchemaDoc)
const { inputId, payload } = sdk.encodePropose(proposalData)
await walletClient.writeContract({
  address: agreementRegistry,
  abi: AgreementRegistryABI,
  functionName: "createAgreement",
  args: [partyB, payload]
})

// Agent B (after reading ProposalSubmitted event)
const proposal = sdk.decodeProposalData(eventData)
const modified = modifyTerms(proposal)  // adjust bond, etc.
const { inputId, payload } = sdk.encodeCounter(modified)
await walletClient.writeContract({
  address: agreement,
  abi: AgreementABI,
  functionName: "submitInput",
  args: [inputId, payload]
})

// Agent A accepts
const { inputId, payload } = sdk.encodeAccept()
await walletClient.writeContract({ ... })
```

### Beat 2: STAKE + ACTIVATE

```typescript
// Agent A activates (or uses acceptAndActivate)
const { inputId, payload } = sdk.encodeActivate()
await walletClient.writeContract({
  address: agreement,
  abi: AgreementABI,
  functionName: "submitInput",
  args: [inputId, payload]
})
```

### Beat 3: HAPPY PATH

```typescript
// Agent B accesses A's data API as TZ Account 1
const signedRequest = await sdk.signAsZone(
  walletClient, zoneAccount1, 8453, requestHash
)
const response = await fetch("https://agent-a-api.example/market-data", {
  headers: {
    "Authorization": buildERC8128Header(signedRequest)
  }
})
```

### Beat 4: CONSTRAINT FIRES

```typescript
// Agent B tries unauthorized endpoint
const response = await fetch("https://agent-a-api.example/raw-export", {
  headers: { "Authorization": buildERC8128Header(signedRequest) }
})
// → 403 Forbidden (no permission token for /raw-export)
```

### Beat 5: DIRECTIVE VIOLATION + CLAIM

```typescript
// Agent A queries Bonfires for B's receipts
const receipts = await bonfires.delve({
  bonfire_id: BONFIRE_ID,
  query: `action receipts for zone:${zone1Address} type:access`,
  limit: 100
})

// Agent A detects violation
const violations = analyzeReceipts(receipts, directiveTokens)
// → { rateLimit: { actual: 47, limit: 10, period: "hour" }, attribution: missing }

// Agent A files claim
const evidence = encodeEvidence(violations, receiptIds)
const { inputId, payload } = sdk.encodeClaim(mechanismIndex, evidence)
await walletClient.writeContract({
  address: agreement,
  abi: AgreementABI,
  functionName: "submitInput",
  args: [inputId, payload]
})
```

### Beat 6: ADJUDICATION

```typescript
// Adjudicator (GenLayer or stub) queries Bonfires
const context = await bonfires.delve({
  bonfire_id: BONFIRE_ID,
  query: `agreement ${agreementAddress} zone ${zone1Address} directives and receipts`,
  limit: 200
})

// Adjudicator delivers verdict
const actions = [
  { mechanismIndex: 0n, targetIndex: 1n, actionType: PENALIZE, params: encodePenalizeParams(35) },
  { mechanismIndex: 0n, targetIndex: 0n, actionType: CLOSE, params: "0x" }
]
const { inputId, payload } = sdk.encodeAdjudicate(claimId, actions)
await walletClient.writeContract({
  address: agreement,
  abi: AgreementABI,
  functionName: "submitInput",
  args: [inputId, payload]
})
```

### Beats 7-8: RESOLUTION + TRUST UPDATE

Handled by the contract (emits events). Agents observe the results.

### Beat 9: RENEGOTIATION

```typescript
// Agent A reads B's updated 8004 reputation
const reputation = await getReputationFeedback(client, reputationRegistry, agentBId)

// Agent A adjusts terms: higher bond requirement for B
const newTerms = adjustTermsForReputation(baseTerms, reputation)
const proposalData = compiler.compile(newTerms)
// ... create new agreement with stricter terms
```

## Package structure

```
packages/agents/
├── src/
│   ├── agent-a.ts            # Agent A main logic
│   ├── agent-b.ts            # Agent B main logic
│   ├── shared/
│   │   ├── bonfires.ts       # Bonfires API client wrapper
│   │   ├── erc8128.ts        # ERC-8128 request signing
│   │   ├── monitoring.ts     # Receipt analysis + violation detection
│   │   └── negotiation.ts    # Shared negotiation utilities
│   ├── strategies/
│   │   ├── propose.ts        # Proposal construction logic
│   │   ├── evaluate.ts       # Counter-proposal evaluation
│   │   └── renegotiate.ts    # Post-resolution term adjustment
│   └── config.ts             # Wallet keys, contract addresses, Bonfires config
├── package.json
└── tsconfig.json
```

## Dependencies

- `@trust-zones/sdk` — contract encoding/decoding/reads
- `@trust-zones/compiler` — TZ schema ↔ ProposalData (for PROPOSE/COUNTER)
- `viem` — contract calls, signing
- Bonfires API client (HTTP)

## Configuration

```typescript
interface AgentConfig {
  // Identity
  privateKey: Hex               // EOA private key
  agentId: bigint               // ERC-8004 agent identity
  bonfiresAgentId: string       // Bonfires agent ID

  // Contracts (set after deployment)
  agreementRegistry: Address
  resourceTokenRegistry: Address
  hats: Address
  identityRegistry: Address
  reputationRegistry: Address

  // Services
  rpcUrl: string
  bonfiresApiUrl: string
  bonfiresApiKey: string
  bonfireId: string
  counterpartyDataApiUrl: string

  // Behavior (demo-specific)
  violateDirectives: boolean    // Agent B: true (for demo)
  attemptUnauthorized: boolean  // Agent B: true (for demo)
}
```

## Execution model

For the hackathon demo, agents run as sequential scripts — each beat is a function call in a linear sequence. No event-driven loops or persistent processes.

```typescript
// demo.ts — orchestrates the full 9-beat demo
async function runDemo() {
  // Beat 1: Negotiate
  const agreement = await agentA.propose(agentB.address, terms)
  await agentB.counter(agreement, modifiedTerms)
  await agentA.accept(agreement)

  // Beat 2: Activate
  await agentA.activate(agreement)

  // Beat 3: Happy path
  await agentB.accessData(zone1, "/market-data")
  await agentA.accessData(zone2, "/social-graph")

  // Beat 4: Constraint fires
  await agentB.accessData(zone1, "/raw-export")  // → denied

  // Beat 5: Directive violation + claim
  await agentB.excessiveAccess(zone1, "/market-data", 47)
  await agentA.monitorAndClaim(agreement, zone1)

  // Beat 6: Adjudication
  await adjudicator.evaluate(agreement, claimId)

  // Beats 7-8: Automatic (contract handles)

  // Beat 9: Renegotiation
  const agreement2 = await agentA.renegotiate(agentB.address)
}
```
