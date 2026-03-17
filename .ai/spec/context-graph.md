# Trust Zones Context Graph Spec

## Overview

The Trust Zones Context Graph is a 3-tier knowledge structure that captures the full operational context of agreements. All tiers share the same schema (derived from the Trust Zones data model). They differ in where they live, who writes, and integrity model.

**Two query surfaces:**

- **Ponder GraphQL** — the primary structured query interface for Tier 1 onchain data. Typed, relational, fast. Returns parsed entities (agreements, zones, typed permissions/directives/constraints, claims, proposals). Used by the SDK, data APIs, and agents for structured reads. Can be x402-gated via the x402 service.
- **Bonfires** — the unified semantic search interface across all 3 tiers. Receives Tier 1 entities from Ponder, Tier 2 action receipts from data APIs, and Tier 3 beliefs from agent stacks. Used by the adjudicator for evidence queries and by agents for cross-tier search.

Ponder is the source of truth for Tier 1. Bonfires is the search layer that combines all tiers.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    CONSUMERS                          │
│  Agents (query state)  │  Adjudicator (query evidence)│
│  Demo UI / logs        │  Bonfires semantic search    │
├──────────────────────────────────────────────────────┤
│                                                        │
│              BONFIRES KNOWLEDGE GRAPH                  │
│              (unified query surface)                   │
│                                                        │
│   ┌──────────────────────────────────────────────┐    │
│   │  /delve — unified search (entities+episodes)  │    │
│   │  /knowledge_graph/entity — entity lookup       │    │
│   │  /knowledge_graph/episodes/expand — episode    │    │
│   │    expansion with connections                  │    │
│   │  /vector_store/search — semantic search        │    │
│   └──────────────────────────────────────────────┘    │
│                                                        │
│   INGESTION PIPELINES                                  │
│                                                        │
│   Tier 1 (onchain)        Tier 2 (offchain)            │
│   ┌─────────────────┐    ┌──────────────────────┐     │
│   │ Ponder indexer   │    │ Data API servers      │     │
│   │ indexes events   │    │ validate ERC-8128     │     │
│   │ ┌─ GraphQL API   │    │ signatures, push      │     │
│   │ │  (primary T1   │    │ receipts as episodes  │     │
│   │ │   reads)       │    │                       │     │
│   │ └─ push to KG as │    │                       │     │
│   │    entities+edges│    │                       │     │
│   └─────────────────┘    └──────────────────────┘     │
│                                                        │
│   Tier 3 (agent-local)                                 │
│   ┌──────────────────────────────────────────────┐    │
│   │ Agent episodic stacks (private per-agent)     │    │
│   │ Beliefs, evaluations, private receipts        │    │
│   │ Selectively disclosed → Tier 2 as evidence    │    │
│   └──────────────────────────────────────────────┘    │
│                                                        │
└──────────────────────────────────────────────────────┘
```

## Bonfires setup

### Bonfire scoping

One Bonfires instance (bonfire) per Trust Zones deployment. All agreements, zones, and receipts within that deployment share a bonfire. Scoped via `x-bonfire-id` header on all API calls.

### Agent registration

Each Trust Zones agent (both demo agents and the adjudicator) is registered as a Bonfires agent:

```
POST /agents
{
  "username": "agent-a",
  "bonfire_id": "<trust-zones-bonfire-id>",
  "config": { ... }
}
```

This gives each agent:
- An agent ID for scoping episodes
- An episodic stack for Tier 3 private memory
- Access to the shared bonfire KG

### Adjudicator access

The adjudicator is registered as a Bonfires agent with read access to the bonfire. When a CLAIM is filed:

1. Agreement contract emits `ClaimFiled` event
2. Ponder indexes the claim → pushes to Bonfires KG
3. Adjudicator queries Bonfires via `/delve` for:
   - Agreement terms (KG entities)
   - Resource token metadata (KG entities)
   - Action receipts for relevant zone and time period (episodes)
   - Any disclosed evidence from parties (episodes)
4. Adjudicator delivers verdict via `submitInput(ADJUDICATE, ...)`

---

## Tier 1: Onchain source of truth

### Data source
Contract events indexed by Ponder.

### Push pipeline

Ponder → Bonfires sync service. Queries Ponder's GraphQL API for parsed, typed entities and pushes them to Bonfires KG. Uses Ponder's parsed output (not raw events) — metadata is already ABI-decoded, states are human-readable strings, proposals are fully structured.

The sync can be triggered by:
- Polling Ponder GraphQL on an interval (simple, hackathon-appropriate)
- Ponder webhook on new indexed data (if supported)

### Entity mapping (Ponder → Bonfires KG)

Each Ponder entity becomes a Bonfires KG entity. The sync service queries Ponder for the full parsed data and pushes structured descriptions.

```typescript
// Sync service queries Ponder for new/updated agreements
const { agreements } = await ponderGraphQL(`{
  agreements(where: { updatedAt_gt: ${lastSync} }) {
    items {
      id state outcome termsUri adjudicator deadline
      agreementParties { items { actor { address agentId } partyIndex } }
      trustZones { items {
        id hatId zoneIndex active
        permissions { items { resource rateLimit expiry purpose } }
        directives { items { rule severity params } }
        constraints { items { module } }
      }}
    }
  }
}`)

// Push to Bonfires KG — parsed data, not raw bytes
for (const agreement of agreements.items) {
  await bonfires.createEntity({
    bonfire_id: BONFIRE_ID,
    name: `agreement:${agreement.id}`,
    type: "Agreement",
    description: JSON.stringify({
      address: agreement.id,
      state: agreement.state,           // "ACTIVE" not bytes32
      parties: agreement.agreementParties.items.map(p => p.actor.address),
      adjudicator: agreement.adjudicator,
      deadline: agreement.deadline,
      termsUri: agreement.termsUri,
    })
  })

  for (const zone of agreement.trustZones.items) {
    await bonfires.createEntity({
      bonfire_id: BONFIRE_ID,
      name: `zone:${zone.id}`,
      type: "TrustZone",
      description: JSON.stringify({
        address: zone.id,
        agreement: agreement.id,
        party: zone.actor?.address,
        hatId: zone.hatId,
        // Parsed permissions — no raw bytes
        permissions: zone.permissions.items,
        directives: zone.directives.items,
        constraints: zone.constraints.items,
      })
    })
  }
}
```

### Edge mapping

```typescript
// Agreement → Zone
await bonfires.createEdge({
  bonfire_id: BONFIRE_ID,
  source_uuid: agreementEntityUuid,
  target_uuid: zoneEntityUuid,
  relation: "HAS_ZONE"
})

// Zone → Party (Actor)
await bonfires.createEdge({
  bonfire_id: BONFIRE_ID,
  source_uuid: zoneEntityUuid,
  target_uuid: actorEntityUuid,
  relation: "OPERATED_BY"
})
```

### Tentative vs deployed

Ponder distinguishes tentative entities (from proposals) and deployed entities (from activation). The sync service preserves this:
- Tentative entities: pushed with `status: "tentative"` in description, linked to proposal
- Deployed entities: pushed with `status: "deployed"`, linked to trust zone
- The adjudicator sees both — can compare what was proposed vs what was deployed

### State transition episodes

State changes are logged as episodes (temporal events in the KG):

```typescript
// On AgreementStateChanged event
POST /knowledge_graph/episode/create
{
  "bonfire_id": BONFIRE_ID,
  "agent_id": SYSTEM_AGENT_ID,
  "content": JSON.stringify({
    type: "state_transition",
    agreement: address,
    fromState, toState,
    timestamp, blockNumber, txHash
  })
}
```

### Proposal episodes

```typescript
// On ProposalSubmitted event
POST /knowledge_graph/episode/create
{
  "bonfire_id": BONFIRE_ID,
  "agent_id": proposerAgentId,
  "content": JSON.stringify({
    type: "proposal",
    agreement: address,
    proposer, termsHash, proposalData,
    timestamp
  })
}
```

---

## Tier 2: Offchain provenance layer

### Data source
Signed action receipts from ERC-8128-gated data API servers.

### Receipt schema

Each action receipt is a structured object with cryptographic provenance:

```typescript
interface ActionReceipt {
  // Identity
  id: string                    // unique receipt ID
  type: "access" | "execute" | "evidence"

  // Parties
  actor: Address                // agent EOA that signed
  zone: Address                 // TZ account address (keyId subject)
  agreement: Address            // parent agreement

  // Action
  resource: string              // resource identifier (e.g., endpoint path)
  method: string                // HTTP method or call type
  timestamp: number             // Unix timestamp
  requestHash: Hex              // hash of the full request

  // Provenance
  signature: Hex                // ERC-8128 signature
  keyId: string                 // "erc8128:<chainId>:<zoneAddress>"

  // Response (optional, provider-attested)
  responseHash?: Hex            // hash of the response
  status?: number               // HTTP status code
}
```

### Ingestion flow

1. Agent sends ERC-8128-signed request to data API
2. Data API validates signature via `isValidSignature()` on the TZ account
3. Data API serves the request
4. Data API constructs an `ActionReceipt` and pushes to Bonfires:

```typescript
POST /knowledge_graph/episode/create
{
  "bonfire_id": BONFIRE_ID,
  "agent_id": actorBonfiresAgentId,
  "content": JSON.stringify(actionReceipt)
}
```

5. Receipt is now queryable via `/delve` and connected to the zone entity in the KG

### Signature verification

ERC-8128 signatures are verified by the data API server before ingestion. Bonfires stores the receipt content including the signature — the cryptographic proof is preserved in the data itself but not re-verified by Bonfires. Consumers who need to re-verify can extract the signature and call `isValidSignature()` on the TZ account.

### Linking receipts to entities

After creating a receipt episode, the ingestion service links it to the relevant zone entity:

```typescript
// Look up the zone entity in the KG
POST /delve
{
  "bonfire_id": BONFIRE_ID,
  "query": `zone:${zoneAddress}`,
  "limit": 1
}

// The episode is automatically connected to entities mentioned in its content
// via Bonfires' built-in entity extraction (Graphiti)
```

---

## Tier 3: Agent-local subgraphs

### Data source
Agent's own observations, beliefs, and evaluations. Private to each agent.

### Storage
Bonfires agent episodic stack (`/agents/{agent_id}/stack/add`).

```typescript
// Agent logs a private belief
POST /agents/{agent_id}/stack/add
{
  "agent_id": agentId,
  "messages": [{
    "role": "assistant",
    "content": JSON.stringify({
      type: "belief",
      subject: "agent-b",
      claim: "Exceeded rate limit on /market-data — 47 requests in 2 hours vs 10/hr limit",
      confidence: 0.95,
      evidence: ["receipt:abc123", "receipt:def456"],
      timestamp: 1710600000
    })
  }]
}
```

### Selective disclosure

When filing a CLAIM, an agent can disclose Tier 3 beliefs as Tier 2 evidence by pushing them to the shared bonfire as episodes:

```typescript
// Disclose a belief as evidence
POST /knowledge_graph/episode/create
{
  "bonfire_id": BONFIRE_ID,
  "agent_id": agentId,
  "content": JSON.stringify({
    type: "evidence",
    claim: "Rate limit exceeded on /market-data",
    receiptRefs: ["receipt:abc123", ...],
    analysis: "47 requests in 2 hours vs 10/hr limit per directive token 0x03..42",
    disclosedAt: 1710600000
  })
}
```

This evidence is then available to the adjudicator via `/delve`.

---

## Query patterns

### Adjudicator: "What happened in this agreement?"

```typescript
// 1. Get agreement entity and connected zones
POST /knowledge_graph/expand/entity
{
  "bonfire_id": BONFIRE_ID,
  "entity_uuid": agreementEntityUuid
}
// Returns: agreement entity + all connected zones, tokens, state transitions

// 2. Search for action receipts in a time window
POST /delve
{
  "bonfire_id": BONFIRE_ID,
  "query": "action receipts for zone:0x1234... between March 17 and March 19",
  "limit": 100
}

// 3. Get specific evidence episodes
POST /knowledge_graph/episodes/expand
{
  "bonfire_id": BONFIRE_ID,
  "episode_uuids": [evidenceEpisodeUuid1, evidenceEpisodeUuid2]
}
```

### Agent: "What's the current state of my agreements?"

```typescript
POST /delve
{
  "bonfire_id": BONFIRE_ID,
  "query": "agreements involving party 0xMyAddress in ACTIVE state",
  "limit": 20
}
```

### Agent: "What are the directive rules for my zone?"

```typescript
POST /delve
{
  "bonfire_id": BONFIRE_ID,
  "query": "directive tokens held by zone:0xMyZoneAddress",
  "limit": 10
}
```

---

## Implementation notes

### Ponder → Bonfires sync service

A lightweight process that:
1. Subscribes to Ponder's indexed data (webhook or polling)
2. Maps Ponder entities to Bonfires KG entities/edges/episodes
3. Pushes to Bonfires API

This can be a simple script in `packages/ponder/` or a standalone service. It runs alongside Ponder.

### Data API → Bonfires receipt logging

Each data API server includes a receipt logger that:
1. Constructs ActionReceipt after serving a request
2. Pushes to Bonfires as an episode
3. Optionally links to zone entities

This is a shared utility used by all data API servers.

### Bonfire provisioning

On deployment:
1. Create a Bonfires bonfire for the Trust Zones deployment
2. Register system agent (for Tier 1 events)
3. Register adjudicator agent
4. Store bonfire ID and agent IDs in deployment config

---

## Bonfires API endpoints used

| Endpoint | Purpose | Tier |
|----------|---------|------|
| `POST /knowledge_graph/entity` | Create agreement/zone/token entities | 1 |
| `POST /knowledge_graph/edge` | Create relationships between entities | 1 |
| `POST /knowledge_graph/episode/create` | Log state transitions, proposals, receipts, evidence | 1, 2, 3 |
| `POST /delve` | Unified search across entities and episodes | All |
| `POST /knowledge_graph/expand/entity` | Expand entity connections | All |
| `POST /knowledge_graph/episodes/expand` | Expand episode with connections | 2, 3 |
| `POST /agents` | Register agents (setup) | Setup |
| `POST /agents/{id}/stack/add` | Agent-local beliefs (Tier 3) | 3 |
| `POST /agents/{id}/stack/search` | Search agent's private memory | 3 |
| `GET /agents/{id}/episodes/latest` | Recent agent activity | 2, 3 |
| `POST /vector_store/search` | Semantic search over all content | All |
