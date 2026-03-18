# Trust Zones Context Graph Spec

## Overview

The Trust Zones Context Graph is a 3-tier knowledge structure that captures the full operational context of agreements. All tiers share the same schema (derived from the Trust Zones data model). They differ in where they live, who writes, and integrity model.

**Two query surfaces:**

- **Ponder GraphQL** -- the primary structured query interface for Tier 1 onchain data. Typed, relational, fast. Returns parsed entities (agreements, zones, typed permissions/directives/constraints, claims, proposals). Used by the SDK, data APIs, and agents for structured reads.
- **Bonfires** -- the unified semantic search interface across all 3 tiers. Receives Tier 1 entities from Ponder, Tier 2 action receipts from data APIs, and Tier 3 beliefs from agent stacks. Used by the adjudicator for evidence queries and by agents for cross-tier search.

Ponder is the source of truth for Tier 1. Bonfires is the search layer that combines all tiers.

## Architecture

```
+---------------------------------------------------------+
|                      CONSUMERS                          |
|  Agents (query state)  |  Adjudicator (query evidence)  |
|  Demo UI / logs        |  Bonfires semantic search      |
+---------------------------+-----------------------------+
                            |
              BONFIRES KNOWLEDGE GRAPH
              (unified query surface)
                            |
   +----------------------------------------------------+
   |  /delve -- unified search (entities + episodes)     |
   |  /knowledge_graph/entity -- entity lookup            |
   |  /knowledge_graph/expand/entity -- graph traversal   |
   |  /knowledge_graph/episodes/expand -- episode detail  |
   +----------------------------------------------------+
                            |
   INGESTION PIPELINES
                            |
   Tier 1 (onchain)        Tier 2 (offchain)
   +------------------+   +------------------------+
   | Ponder indexer    |   | Data API servers        |
   | indexes events    |   | validate ERC-8128       |
   | +- GraphQL API    |   | signatures, push        |
   | |  (primary T1    |   | receipts as episodes    |
   | |   reads)        |   |                         |
   | +- push to KG as  |   |                         |
   |    entities+edges  |   |                         |
   +------------------+   +------------------------+
                            |
   Tier 3 (agent-local)
   +----------------------------------------------------+
   | Agent episodic stacks (private per-agent)           |
   | Beliefs, evaluations, private receipts              |
   | Selectively disclosed -> Tier 2 as evidence         |
   +----------------------------------------------------+
```

---

## Entity Schema

Each Ponder entity maps to a Bonfires KG entity. Entities are created via `POST /knowledge_graph/entity` with structured `attributes` for typed fields and a human-readable `summary` for semantic search.

### Agreement

Represents an onchain agreement contract.

| Field | Source | KG representation |
|-------|--------|-------------------|
| address | Ponder `agreement.id` | Entity `name` = `agreement:<address>` |
| state | Ponder `agreement.state` | `attributes.state` (e.g., "ACTIVE") |
| outcome | Ponder `agreement.outcome` | `attributes.outcome` |
| termsHash | Ponder `agreement.termsHash` | `attributes.termsHash` |
| termsUri | Ponder `agreement.termsUri` | `attributes.termsUri` |
| adjudicator | Ponder `agreement.adjudicator` | `attributes.adjudicator` |
| deadline | Ponder `agreement.deadline` | `attributes.deadline` |
| agreementHatId | Ponder `agreement.agreementHatId` | `attributes.agreementHatId` |
| createdAt | Ponder `agreement.createdAt` | `attributes.createdAt` |
| activatedAt | Ponder `agreement.activatedAt` | `attributes.activatedAt` |
| closedAt | Ponder `agreement.closedAt` | `attributes.closedAt` |

```
Labels: ["Agreement"]
Summary: "Agreement <address> between <partyA> and <partyB>. State: <state>. Terms: <termsUri>."
```

### TrustZone

Represents a party's zone within an agreement -- an ERC-7579 smart account.

| Field | Source | KG representation |
|-------|--------|-------------------|
| address | Ponder `trustZone.id` | Entity `name` = `zone:<address>` |
| agreementId | Ponder `trustZone.agreementId` | Edge to Agreement entity |
| party (actorId) | Ponder `trustZone.actorId` | Edge to Actor entity |
| hatId | Ponder `trustZone.hatId` | `attributes.hatId` |
| active | Ponder `trustZone.active` | `attributes.active` |

```
Labels: ["TrustZone"]
Summary: "Trust Zone <address> in agreement <agreementAddr>. Operated by <partyAddr>. Hat ID: <hatId>. Active: <active>."
```

### Actor

Represents an agent/party (EOA address, possibly with an ERC-8004 agent ID).

| Field | Source | KG representation |
|-------|--------|-------------------|
| address | Ponder `actor.address` | Entity `name` = `actor:<address>` |
| agentId | Ponder `actor.agentId` | `attributes.agentId` |

```
Labels: ["Actor"]
Summary: "Actor <address>. Agent ID: <agentId>."
```

### Permission (Resource Token type 0x01)

What a zone holder CAN do -- access rights to counterparty resources.

| Field | Source | KG representation |
|-------|--------|-------------------|
| resource | Ponder `permission.resource` | `attributes.resource` |
| rateLimit | Ponder `permission.rateLimit` | `attributes.rateLimit` |
| expiry | Ponder `permission.expiry` | `attributes.expiry` |
| purpose | Ponder `permission.purpose` | `attributes.purpose` |
| resourceTokenId | Ponder `permission.resourceTokenId` | `attributes.resourceTokenId` |
| status | Derived from proposalId/trustZoneId | `attributes.status` ("tentative" or "deployed") |

```
Labels: ["Permission", "ResourceToken"]
Summary: "Permission for <resource>. Rate limit: <rateLimit>. Purpose: <purpose>. Status: <status>."
```

### Responsibility (Resource Token type 0x02)

What a zone holder MUST do -- obligations.

| Field | Source | KG representation |
|-------|--------|-------------------|
| obligation | Ponder `responsibility.obligation` | `attributes.obligation` |
| criteria | Ponder `responsibility.criteria` | `attributes.criteria` |
| deadline | Ponder `responsibility.deadline` | `attributes.deadline` |
| resourceTokenId | Ponder `responsibility.resourceTokenId` | `attributes.resourceTokenId` |
| status | Derived | `attributes.status` |

```
Labels: ["Responsibility", "ResourceToken"]
Summary: "Responsibility: <obligation>. Criteria: <criteria>. Deadline: <deadline>. Status: <status>."
```

### Directive (Resource Token type 0x03)

What a zone holder SHOULD/SHOULDN'T do -- subjective behavioral rules.

| Field | Source | KG representation |
|-------|--------|-------------------|
| rule | Ponder `directive.rule` | `attributes.rule` |
| severity | Ponder `directive.severity` | `attributes.severity` |
| params | Ponder `directive.params` | `attributes.params` |
| resourceTokenId | Ponder `directive.resourceTokenId` | `attributes.resourceTokenId` |
| status | Derived | `attributes.status` |

```
Labels: ["Directive", "ResourceToken"]
Summary: "Directive: <rule>. Severity: <severity>. Status: <status>."
```

### Claim

A dispute filed against a zone, referencing a mechanism (incentive).

| Field | Source | KG representation |
|-------|--------|-------------------|
| claimId | Ponder `claim.id` | Entity `name` = `claim:<agreement>:<claimId>` |
| mechanismIndex | Ponder `claim.mechanismIndex` | `attributes.mechanismIndex` |
| claimant | Ponder `claim.claimantId` | Edge to Actor entity |
| evidence | Ponder `claim.evidence` | `attributes.evidence` |
| verdict | Ponder `claim.verdict` | `attributes.verdict` |
| actionTypes | Ponder `claim.actionTypes` | `attributes.actionTypes` |
| timestamp | Ponder `claim.timestamp` | `attributes.timestamp` |
| adjudicatedAt | Ponder `claim.adjudicatedAt` | `attributes.adjudicatedAt` |

```
Labels: ["Claim"]
Summary: "Claim <id> in agreement <agreementAddr>. Filed by <claimant>. Verdict: <verdict>. Actions: <actionTypes>."
```

### Receipt

Data access events from ERC-8128-gated APIs. These are NOT Ponder entities -- they originate from data API servers and are ingested as episodes (see Tier 2).

| Field | Source | KG representation |
|-------|--------|-------------------|
| id | Data API receipt logger | Episode `name` |
| type | "access" / "execute" / "evidence" | Episode body field |
| actor | Agent EOA address | Episode body field |
| zone | TZ account address (keyId subject) | Episode body field, links to TrustZone entity |
| agreement | Parent agreement address | Episode body field, links to Agreement entity |
| resource | Endpoint path | Episode body field |
| method | HTTP method | Episode body field |
| timestamp | Unix timestamp | Episode `reference_time` |
| signature | ERC-8128 signature | Episode body field |
| keyId | "erc8128:\<chainId\>:\<zoneAddress\>" | Episode body field |
| responseHash | Hash of the response | Episode body field |
| status | HTTP status code | Episode body field |

Receipts are stored as episodes, not entities. Graphiti automatically extracts entity mentions (zone address, agreement address) and creates MENTIONS edges to the corresponding entities.

### ReputationFeedback

ERC-8004 reputation entries written at agreement closure.

| Field | Source | KG representation |
|-------|--------|-------------------|
| agentId | Ponder `reputationFeedback.actorId` | Edge to Actor entity |
| tag | Ponder `reputationFeedback.tag` | `attributes.tag` |
| feedbackURI | Ponder `reputationFeedback.feedbackURI` | `attributes.feedbackURI` |
| feedbackHash | Ponder `reputationFeedback.feedbackHash` | `attributes.feedbackHash` |

```
Labels: ["ReputationFeedback"]
Summary: "Reputation feedback for agent <agentId> in agreement <agreementAddr>. Tag: <tag>."
```

### Constraint / Eligibility / Incentive / DecisionModel / PrincipalAlignment

Mechanism-type entities. These share a similar structure: module address, module kind, hex-encoded config data.

| Field | Source | KG representation |
|-------|--------|-------------------|
| module | Ponder entity `.module` | `attributes.module` |
| moduleKind | Ponder entity `.moduleKind` | `attributes.moduleKind` |
| data | Ponder entity `.data` | `attributes.data` |
| status | Derived from proposalId/trustZoneId | `attributes.status` |

```
Labels: ["<Type>", "Mechanism"]  // e.g., ["Constraint", "Mechanism"]
Summary: "<Type> mechanism. Module: <module>. Kind: <moduleKind>. Status: <status>."
```

---

## Edge Schema

Edges are created via `POST /knowledge_graph/edge`. Each edge has an `edge_name` (the relationship type) and a `fact` (human-readable description).

| Edge name | Source entity | Target entity | Description |
|-----------|--------------|---------------|-------------|
| `HAS_ZONE` | Agreement | TrustZone | Agreement contains this trust zone |
| `PARTY_OF` | Actor | Agreement | Actor is a party to this agreement |
| `OPERATES` | Actor | TrustZone | Actor operates (wears the hat for) this zone |
| `HOLDS_PERMISSION` | TrustZone | Permission | Zone holds this permission token |
| `HOLDS_RESPONSIBILITY` | TrustZone | Responsibility | Zone holds this responsibility token |
| `HOLDS_DIRECTIVE` | TrustZone | Directive | Zone holds this directive token |
| `HAS_CONSTRAINT` | TrustZone | Constraint | Zone has this constraint mechanism |
| `HAS_ELIGIBILITY` | TrustZone | Eligibility | Zone has this eligibility mechanism |
| `HAS_INCENTIVE` | TrustZone | Incentive | Zone has this incentive mechanism |
| `HAS_DECISION_MODEL` | TrustZone | DecisionModel | Zone uses this decision model |
| `HAS_PRINCIPAL_ALIGNMENT` | TrustZone | PrincipalAlignment | Zone has this principal alignment |
| `FILED_BY` | Claim | Actor | Claim was filed by this actor |
| `CLAIM_IN` | Claim | Agreement | Claim is in this agreement |
| `FEEDBACK_FOR` | ReputationFeedback | Actor | Feedback is about this actor |
| `FEEDBACK_IN` | ReputationFeedback | Agreement | Feedback is from this agreement |
| `PROPOSED_IN` | Permission/Responsibility/Directive | Agreement | Tentative entity was proposed in this agreement (pre-deployment) |

### Episode-to-entity links (automatic)

When episodes (receipts, state transitions, agent observations) are created via `POST /knowledge_graph/episode/create`, Graphiti automatically extracts entity mentions from the episode body and creates `MENTIONS` edges. This means:

- A receipt episode mentioning `zone:0x1234` automatically links to the TrustZone entity named `zone:0x1234`
- A state transition episode mentioning `agreement:0x5678` links to that Agreement entity
- No manual edge creation is needed for episode-to-entity links

To make this work reliably, episode bodies must reference entities using their canonical names (e.g., `zone:0xABC`, `agreement:0xDEF`).

---

## Sync Approach

### Tier 1: Ponder -> Bonfires

**What syncs:** All Ponder entities (agreements, trust zones, actors, resource tokens, claims, reputation feedback, and all typed mechanism/resource entities).

**Method:** A lightweight sync service polls Ponder's GraphQL API and pushes entities/edges to Bonfires.

**Entity creation strategy:**
- Ponder entities -> Bonfires entities via `POST /knowledge_graph/entity`
- Relationships -> Bonfires edges via `POST /knowledge_graph/edge`
- State transitions and proposals -> Bonfires episodes via `POST /knowledge_graph/episode/create`

**Why entities + edges (not episodes)?** Ponder entities represent persistent state (an agreement exists, a zone is active). These are best modeled as KG entities with relationships. Episodes are for temporal events (state changed, proposal submitted, data accessed).

**Why not triplets?** The `add_triples` and `add-triplet` endpoints are deprecated in the Bonfires API. The recommended approach is entities + edges for structural data and episodes with Graphiti auto-extraction for temporal data.

**Sync trigger:** Poll-based. The sync service queries Ponder for entities updated since the last sync timestamp. For the hackathon, a simple interval (e.g., every 10 seconds) is sufficient.

**Idempotency:** Entity names are deterministic (`agreement:<address>`, `zone:<address>`, etc.). The sync service tracks Bonfires UUIDs returned from entity creation and skips entities that already exist. On state changes, the sync service updates the entity by creating a new entity with the same name (Bonfires deduplicates by name within a bonfire).

**Sync service pseudocode:**

```typescript
async function syncPonderToBonfires(lastSyncTimestamp: number) {
  // 1. Query Ponder for updated agreements
  const { agreements } = await ponderGQL(`{
    agreements(where: { createdAt_gte: "${lastSyncTimestamp}" }) {
      items {
        id state outcome termsUri adjudicator deadline
        agreementHatId createdAt activatedAt closedAt
        agreementParties { items { actor { id address agentId } partyIndex } }
        trustZones { items {
          id hatId zoneIndex active actorId createdAt
          permissions { items { id resource rateLimit expiry purpose resourceTokenId } }
          responsibilities { items { id obligation criteria deadline resourceTokenId } }
          directives { items { id rule severity params resourceTokenId } }
          constraints { items { id module moduleKind data } }
          eligibilities { items { id module moduleKind data } }
          incentives { items { id incentiveType module moduleKind data } }
        }}
        claims { items { id mechanismIndex claimantId evidence verdict actionTypes timestamp adjudicatedAt } }
        reputationFeedbacks { items { id actorId tag feedbackURI feedbackHash timestamp } }
      }
    }
  }`)

  for (const agr of agreements.items) {
    // 2. Upsert Agreement entity
    const agrUuid = await upsertEntity({
      name: `agreement:${agr.id}`,
      labels: ["Agreement"],
      summary: buildAgreementSummary(agr),
      attributes: { state: agr.state, outcome: agr.outcome, ... },
      bonfire_id: BONFIRE_ID,
    })

    // 3. Upsert Actor entities + PARTY_OF edges
    for (const party of agr.agreementParties.items) {
      const actorUuid = await upsertEntity({
        name: `actor:${party.actor.address}`,
        labels: ["Actor"],
        ...
      })
      await upsertEdge(actorUuid, agrUuid, "PARTY_OF", ...)
    }

    // 4. Upsert TrustZone entities + edges + nested resource/mechanism entities
    for (const zone of agr.trustZones.items) {
      const zoneUuid = await upsertEntity({
        name: `zone:${zone.id}`,
        labels: ["TrustZone"],
        ...
      })
      await upsertEdge(agrUuid, zoneUuid, "HAS_ZONE", ...)

      // Permissions, Responsibilities, Directives, Constraints, etc.
      for (const perm of zone.permissions.items) {
        const permUuid = await upsertEntity({
          name: `permission:${perm.id}`,
          labels: ["Permission", "ResourceToken"],
          ...
        })
        await upsertEdge(zoneUuid, permUuid, "HOLDS_PERMISSION", ...)
      }
      // ... same pattern for other typed entities
    }

    // 5. Upsert Claim entities + edges
    for (const claim of agr.claims.items) {
      const claimUuid = await upsertEntity({
        name: `claim:${claim.id}`,
        labels: ["Claim"],
        ...
      })
      await upsertEdge(claimUuid, agrUuid, "CLAIM_IN", ...)
    }
  }
}
```

**State transitions as episodes:**

When Ponder records a state change (e.g., PROPOSED -> ACTIVE), the sync service also creates an episode:

```typescript
await bonfires.createEpisode({
  bonfire_id: BONFIRE_ID,
  name: `state-change:${agreement.id}:${toState}`,
  episode_body: JSON.stringify({
    type: "state_transition",
    agreement: `agreement:${agreement.id}`,
    fromState,
    toState,
    timestamp,
    blockNumber,
    txHash,
  }),
  source: "json",
  source_description: "ponder_indexer",
  reference_time: new Date(Number(timestamp) * 1000).toISOString(),
})
```

### Tier 2: Data API receipts -> Bonfires

**What syncs:** Action receipts from ERC-8128-gated data API servers. Each successful (or failed) API request produces a receipt.

**Method:** Data API servers push receipts directly to Bonfires as episodes via `POST /knowledge_graph/episode/create`.

**Why episodes (not entities)?** Receipts are temporal events -- "Agent B accessed /market-data at time T." They don't represent persistent state. Episodes are the natural fit. Graphiti auto-extracts entity mentions, so the receipt episode automatically links to the referenced zone and agreement entities (created by Tier 1 sync).

**Receipt episode creation:**

```typescript
async function logReceipt(receipt: ActionReceipt) {
  await bonfires.post("/knowledge_graph/episode/create", {
    bonfire_id: BONFIRE_ID,
    name: `receipt:${receipt.id}`,
    episode_body: JSON.stringify({
      type: receipt.type,           // "access", "execute", "evidence"
      actor: receipt.actor,
      zone: `zone:${receipt.zone}`,            // canonical entity name
      agreement: `agreement:${receipt.agreement}`,  // canonical entity name
      resource: receipt.resource,
      method: receipt.method,
      timestamp: receipt.timestamp,
      requestHash: receipt.requestHash,
      responseHash: receipt.responseHash,
      status: receipt.status,
      signature: receipt.signature,
      keyId: receipt.keyId,
    }),
    source: "json",
    source_description: "data_api_receipt",
    reference_time: new Date(receipt.timestamp * 1000).toISOString(),
  })
}
```

**Key design choice:** The episode body uses canonical entity names (`zone:0x1234`, `agreement:0x5678`) so Graphiti can extract these as mentions and link to the Tier 1 entities. This is what enables cross-tier queries.

### Tier 3: Agent observations -> Bonfires

**What syncs:** Private agent beliefs, evaluations, and observations. These live in each agent's episodic stack.

**Method:** Agents push to their own stack via `POST /agents/{agent_id}/stack/add`.

**Storage:**

```typescript
await bonfires.post(`/agents/${agentId}/stack/add`, {
  messages: [{
    text: JSON.stringify({
      type: "observation",
      subject: `zone:${zoneAddress}`,
      observation: "Data from this zone found on public endpoint https://example.com/leaked-data",
      confidence: 0.92,
      evidence_urls: ["https://example.com/leaked-data"],
      related_receipts: ["receipt:abc123"],
      timestamp: Date.now(),
    }),
    userId: agentId,
    chatId: `agreement:${agreementAddress}`,
    timestamp: new Date().toISOString(),
    role: "agent",
  }],
})
```

**Selective disclosure:** When an agent files a CLAIM, it discloses relevant Tier 3 observations to Tier 2 by creating episodes in the shared bonfire:

```typescript
// Promote private observation to shared evidence
await bonfires.post("/knowledge_graph/episode/create", {
  bonfire_id: BONFIRE_ID,
  name: `evidence:${claimId}:${evidenceIndex}`,
  episode_body: JSON.stringify({
    type: "evidence",
    claim: `claim:${agreementAddress}:${claimId}`,
    zone: `zone:${zoneAddress}`,
    agreement: `agreement:${agreementAddress}`,
    observation: "Data from zone found on public endpoint",
    evidence_urls: ["https://example.com/leaked-data"],
    related_receipts: ["receipt:abc123"],
    disclosedAt: Date.now(),
  }),
  source: "json",
  source_description: "agent_disclosure",
  reference_time: new Date().toISOString(),
})
```

---

## Bonfires Setup

### Bonfire provisioning

One bonfire per Trust Zones deployment. Created during deployment setup.

```typescript
// Step 1: Provision bonfire
const provision = await bonfires.post("/provision", {
  tx_hash: provisionTxHash,      // onchain provision tx
  wallet_address: deployerAddress,
  agent_name: "Trust Zones Context Graph",
  description: "Unified context graph for Trust Zones protocol agreements",
  capabilities: ["knowledge_graph", "semantic_search", "episodic_memory"],
})
const BONFIRE_ID = provision.bonfire_id
```

### Agent registration

Each Trust Zones participant is registered as a Bonfires agent.

| Agent | Username | Role | Capabilities |
|-------|----------|------|-------------|
| System sync | `tz-system` | Pushes Tier 1 entities from Ponder | Entity creation, edge creation, episode creation |
| Data API A | `data-api-a` | Logs receipts from Agent A's data API | Episode creation |
| Data API B | `data-api-b` | Logs receipts from Agent B's data API | Episode creation |
| Agent A | `agent-a` | Demo agent A, operates Zone A | Stack access, delve queries |
| Agent B | `agent-b` | Demo agent B, operates Zone B | Stack access, delve queries |
| Adjudicator | `adjudicator` | Evaluates claims | Delve queries, entity/episode expansion |

```typescript
// Create agent
const agent = await bonfires.post("/agents", {
  username: "agent-a",
  name: "Agent A (Market Data Provider)",
  context: "Trust Zones demo agent. Provides market data, consumes social graph data.",
  capabilities: ["trust_zones", "data_provider", "data_consumer"],
})

// Register agent to bonfire
await bonfires.post("/agents/register", {
  agent_id: agent.id,
  bonfire_id: BONFIRE_ID,
})
```

---

## API Mapping

Concrete mapping of every Trust Zones operation to a Bonfires API call.

### Setup operations

| Operation | Bonfires endpoint | When |
|-----------|-------------------|------|
| Create bonfire | `POST /provision` | Deployment |
| Create agent | `POST /agents` | Deployment |
| Register agent to bonfire | `POST /agents/register` | Deployment |

### Tier 1 sync operations

| Operation | Bonfires endpoint | Triggered by |
|-----------|-------------------|-------------|
| Create/update Agreement entity | `POST /knowledge_graph/entity` | Ponder: AgreementCreated, AgreementStateChanged |
| Create/update TrustZone entity | `POST /knowledge_graph/entity` | Ponder: ZoneDeployed |
| Create/update Actor entity | `POST /knowledge_graph/entity` | Ponder: AgreementCreated (parties) |
| Create Permission entity | `POST /knowledge_graph/entity` | Ponder: ResourceTokenAssigned (type 0x01) |
| Create Responsibility entity | `POST /knowledge_graph/entity` | Ponder: ResourceTokenAssigned (type 0x02) |
| Create Directive entity | `POST /knowledge_graph/entity` | Ponder: ResourceTokenAssigned (type 0x03) |
| Create Constraint entity | `POST /knowledge_graph/entity` | Ponder: MechanismRegistered (CONSTRAINT) |
| Create Incentive entity | `POST /knowledge_graph/entity` | Ponder: MechanismRegistered (INCENTIVE) |
| Create Claim entity | `POST /knowledge_graph/entity` | Ponder: ClaimFiled |
| Update Claim (verdict) | `POST /knowledge_graph/entity` | Ponder: AdjudicationDelivered |
| Create ReputationFeedback entity | `POST /knowledge_graph/entity` | Ponder: ReputationFeedbackWritten |
| Create any edge | `POST /knowledge_graph/edge` | After creating both source + target entities |
| Log state transition episode | `POST /knowledge_graph/episode/create` | Ponder: AgreementStateChanged |
| Log proposal episode | `POST /knowledge_graph/episode/create` | Ponder: ProposalSubmitted |
| Log claim filed episode | `POST /knowledge_graph/episode/create` | Ponder: ClaimFiled |
| Log adjudication episode | `POST /knowledge_graph/episode/create` | Ponder: AdjudicationDelivered |
| Log agreement closed episode | `POST /knowledge_graph/episode/create` | Ponder: AgreementClosed |

### Tier 2 operations

| Operation | Bonfires endpoint | Triggered by |
|-----------|-------------------|-------------|
| Log data access receipt | `POST /knowledge_graph/episode/create` | Data API: successful request served |
| Log access denied receipt | `POST /knowledge_graph/episode/create` | Data API: 403 (constraint fired) |
| Log rate limit exceeded | `POST /knowledge_graph/episode/create` | Data API: directive enforcement |

### Tier 3 operations

| Operation | Bonfires endpoint | Triggered by |
|-----------|-------------------|-------------|
| Store private observation | `POST /agents/{id}/stack/add` | Agent: notices something |
| Search own observations | `POST /agents/{id}/stack/search` | Agent: preparing a claim |
| Disclose evidence | `POST /knowledge_graph/episode/create` | Agent: filing a claim |

### Query operations

| Operation | Bonfires endpoint | Used by |
|-----------|-------------------|---------|
| Unified search | `POST /delve` | Adjudicator, agents |
| Expand entity (get connections) | `POST /knowledge_graph/expand/entity` | Adjudicator |
| Expand episodes (get detail) | `POST /knowledge_graph/episodes/expand` | Adjudicator |
| Get entity by UUID | `GET /knowledge_graph/entity/{uuid}` | Any consumer |
| Get episode by UUID | `GET /knowledge_graph/episode/{uuid}` | Any consumer |
| Get episodes for node | `GET /knowledge_graph/node/{node_uuid}/episodes` | Adjudicator |
| Search agent episodes by time | `POST /knowledge_graph/agents/{id}/episodes/search` | Adjudicator |
| Get latest agent episodes | `GET /knowledge_graph/agents/{id}/episodes/latest` | Any consumer |
| Batch get entities | `POST /knowledge_graph/entities/batch` | Sync service (verification) |

---

## Query Patterns

### "What are the directives for zone X in agreement Y?"

The adjudicator needs the behavioral rules that govern a zone to evaluate whether a violation occurred.

```typescript
// Option A: Delve (semantic search -- natural language)
const results = await bonfires.post("/delve", {
  bonfire_id: BONFIRE_ID,
  query: "directive rules for zone:0x1234 in agreement:0x5678",
  num_results: 20,
  relationship_types: ["HOLDS_DIRECTIVE"],
})

// Option B: Graph traversal (structured -- expand from zone entity)
// Step 1: Find the zone entity UUID
const zoneSearch = await bonfires.post("/delve", {
  bonfire_id: BONFIRE_ID,
  query: "zone:0x1234",
  num_results: 1,
})
const zoneUuid = zoneSearch.results[0].uuid

// Step 2: Expand to get all connected entities
const expansion = await bonfires.post("/knowledge_graph/expand/entity", {
  entity_uuid: zoneUuid,
  bonfire_id: BONFIRE_ID,
  limit: 50,
})
// Filter edges for HOLDS_DIRECTIVE to get directive entities
const directives = expansion.edges
  .filter(e => e.edge_name === "HOLDS_DIRECTIVE")
  .map(e => expansion.nodes.find(n => n.uuid === e.target_uuid))
```

### "What data access receipts exist for zone X?"

The adjudicator needs to see all data API interactions for a zone.

```typescript
// Option A: Delve with time window
const receipts = await bonfires.post("/delve", {
  bonfire_id: BONFIRE_ID,
  query: "data access receipts for zone:0x1234",
  num_results: 100,
  window_start: "2026-03-17T00:00:00Z",
  window_end: "2026-03-19T00:00:00Z",
})

// Option B: Get episodes for the zone entity node
// (requires knowing the zone entity UUID)
const episodes = await bonfires.get(
  `/knowledge_graph/node/${zoneUuid}/episodes?bonfire_id=${BONFIRE_ID}`
)
// Filter for receipt episodes
const receiptEpisodes = episodes.filter(e =>
  e.source_description === "data_api_receipt"
)
```

### "Has any data from zone X appeared on public endpoints?"

The adjudicator is looking for evidence of a "no redistribution" directive violation.

```typescript
// Search for evidence episodes (disclosed by the claimant)
const evidence = await bonfires.post("/delve", {
  bonfire_id: BONFIRE_ID,
  query: "evidence of data redistribution from zone:0x1234 on public endpoints",
  num_results: 20,
})

// Also search for agent observations about this zone
const agentObs = await bonfires.post("/delve", {
  bonfire_id: BONFIRE_ID,
  query: "observation: data from zone:0x1234 found on public endpoint",
  num_results: 20,
})
```

### "What claims have been filed against zone X?"

```typescript
// Delve for claims mentioning the zone
const claims = await bonfires.post("/delve", {
  bonfire_id: BONFIRE_ID,
  query: "claims filed against zone:0x1234",
  num_results: 20,
  relationship_types: ["CLAIM_IN"],
})
```

### "Full adjudication context for claim C"

The complete query sequence an adjudicator runs when evaluating a claim:

```typescript
async function getAdjudicationContext(claimId: string, agreementAddr: string) {
  // 1. Get the claim entity
  const claim = await bonfires.post("/delve", {
    bonfire_id: BONFIRE_ID,
    query: `claim:${agreementAddr}:${claimId}`,
    num_results: 1,
  })

  // 2. Get the agreement entity with all zones, directives, permissions
  const agreement = await bonfires.post("/knowledge_graph/expand/entity", {
    entity_uuid: agreementEntityUuid,
    bonfire_id: BONFIRE_ID,
    limit: 100,
  })

  // 3. Get action receipts for the relevant zone in the claim period
  const receipts = await bonfires.post("/delve", {
    bonfire_id: BONFIRE_ID,
    query: `data access receipts for zone:${zoneAddr}`,
    num_results: 100,
    window_start: agreementActivatedAt,
    window_end: claimTimestamp,
  })

  // 4. Get disclosed evidence
  const evidence = await bonfires.post("/delve", {
    bonfire_id: BONFIRE_ID,
    query: `evidence for claim:${agreementAddr}:${claimId}`,
    num_results: 50,
  })

  // 5. Get the specific directive that was allegedly violated
  const directives = await bonfires.post("/delve", {
    bonfire_id: BONFIRE_ID,
    query: `directive tokens held by zone:${zoneAddr}`,
    num_results: 20,
  })

  return { claim, agreement, receipts, evidence, directives }
}
```

---

## Demo Scenario Walkthrough

How the context graph is populated during the 9-beat demo.

### Beat 1: NEGOTIATE

- **Ponder indexes:** AgreementCreated, ProposalSubmitted (x2-3 with counter)
- **Sync service creates:**
  - Agreement entity (state: PROPOSED -> NEGOTIATING -> ACCEPTED)
  - 2 Actor entities
  - 2 PARTY_OF edges
  - State transition episodes (PROPOSED -> NEGOTIATING, NEGOTIATING -> ACCEPTED)
  - Proposal episodes (initial proposal, counter, acceptance)
  - Tentative Permission, Responsibility, Directive entities (status: "tentative", linked to proposals)

### Beat 2: SET UP + STAKE + ACTIVATE

- **Ponder indexes:** AgreementSetUp, ZoneDeployed (x2), ResourceTokenAssigned (multiple), MechanismRegistered (multiple), AgreementActivated
- **Sync service creates:**
  - 2 TrustZone entities
  - HAS_ZONE edges
  - OPERATES edges (Actor -> TrustZone)
  - Deployed Permission, Responsibility, Directive entities (status: "deployed")
  - HOLDS_PERMISSION, HOLDS_RESPONSIBILITY, HOLDS_DIRECTIVE edges
  - Constraint, Eligibility, Incentive entities + HAS_* edges
  - State transition episodes (ACCEPTED -> READY, READY -> ACTIVE)
  - Agreement entity updated (state: ACTIVE, activatedAt set)

### Beat 3: HAPPY PATH

- **Data APIs log receipts:**
  - Receipt episode: Agent B accesses /market-data (status 200)
  - Receipt episode: Agent A accesses /social-graph (status 200)
  - Each receipt automatically linked to zone and agreement entities via Graphiti

### Beat 4: CONSTRAINT FIRES

- **Data API logs receipt:**
  - Receipt episode: Agent B attempts /raw-export (status 403)
  - Episode body includes `status: 403` and reason "no permission token for resource"

### Beat 5: DIRECTIVE VIOLATION + CLAIM

- **Agent A observes violation:**
  - Tier 3: Agent A stores observation in private stack ("Found Agent B's public endpoint with verbatim market data")
- **Agent A files claim:**
  - Agent A discloses observation to Tier 2 (evidence episode)
  - Ponder indexes: ClaimFiled
  - Sync service creates: Claim entity, FILED_BY edge, CLAIM_IN edge, claim filed episode

### Beat 6: ADJUDICATION

- **Adjudicator queries Bonfires:** Uses the full adjudication context pattern (above)
- **Ponder indexes:** AdjudicationDelivered
- **Sync service updates:** Claim entity (verdict: true, actionTypes: ["CLOSE"]), adjudication episode

### Beat 7: RESOLUTION

- **Ponder indexes:** AgreementClosed, ReputationFeedbackWritten (x2)
- **Sync service creates:**
  - Agreement entity updated (state: CLOSED, outcome: ADJUDICATED)
  - TrustZone entities updated (active: false)
  - ReputationFeedback entities (x2) + FEEDBACK_FOR, FEEDBACK_IN edges
  - Agreement closed episode

### Beat 8-9: TRUST UPDATE + RENEGOTIATION

- New agreement creates new entities. Both agreements coexist in the KG.
- Adjudicator can query across agreements to see reputation history.

---

## Design Decisions

### Zone identifiers: address, not zoneIndex

The canonical identifier for a zone is its **smart account address** (`trustZone.id`). The `zoneIndex` in Ponder is just the positional index within an agreement (0, 1, ...) — it's not globally unique and is only meaningful within its parent agreement. All KG entity names use the zone address: `zone:0x1234`.

`zoneIndex` is NOT stored as an attribute on zone entities. It adds no information beyond what the `HAS_ZONE` edge ordering already provides.

### Entity properties vs edges

**Design principle:** Use edges for relationships between entities. Use properties for intrinsic/scalar data that belongs to the entity itself.

| Pattern | Use when | Example |
|---------|----------|---------|
| Property on entity | Scalar data intrinsic to the entity | `attributes.state = "ACTIVE"` on Agreement |
| Edge between entities | Relationship between two entities | `HAS_ZONE` (Agreement → TrustZone) |

**Why not put `zoneAddress` as a property on a Receipt?** Because the zone is its own entity with relationships, history, and attributes. An edge (`MENTIONS` via Graphiti auto-extraction) connects the receipt episode to the zone entity, enabling graph traversal. A flat property would require string matching to find related entities.

**Exception:** When the relationship is very high-cardinality and the related entity doesn't need its own node (e.g., a raw hash value), a property is fine.

---

## Authentication and Access Control

### How Bonfires auth works

Bonfires uses **Bearer token authentication** (API keys). The top-level security scheme is `BearerAuth`:

```
Authorization: Bearer <api-key>
```

API keys are created during bonfire provisioning and can be revealed via the EIP-191 signature challenge flow:
1. `GET /provision/reveal_nonce?tx_hash=<tx>` → returns a nonce + canonical message
2. Sign the message with the provisioning wallet (EIP-191)
3. `POST /provision/reveal_api_key` with `{ tx_hash, nonce, signature }` → returns the raw API key

Some endpoints are public (no auth): `GET /agents`, `GET /provision`, `GET /microsubs`.

### Registering data sources to write

Each writer needs to be registered as a Bonfires agent, then registered to the bonfire:

| Writer | Agent username | What it writes | Auth |
|--------|---------------|----------------|------|
| Ponder sync service | `tz-sync` | Tier 1 entities, edges, state episodes | Bearer token (bonfire API key) |
| Data API A | `data-api-a` | Tier 2 receipt episodes | Bearer token |
| Data API B | `data-api-b` | Tier 2 receipt episodes | Bearer token |
| Agent A | `agent-a` | Tier 3 observations (stack), disclosed evidence | Bearer token |
| Agent B | `agent-b` | Tier 3 observations (stack) | Bearer token |
| Adjudicator | `adjudicator` | Verdict reasoning (episodes) | Bearer token |

Each gets its own API key via `POST /agents` (which accepts an `apiKey` field, default `"bonfires-ai"`). The `bonfireId` field on `CreateAgentRequest` links the agent to a bonfire.

### Registering agents to read

Any agent registered to a bonfire can query it via `/delve`, `/knowledge_graph/expand/entity`, etc. The `bonfire_id` parameter scopes all queries. Agents cannot read across bonfires they're not registered to (strict isolation).

### Setup flow

```typescript
// 1. Bonfires team provisions the bonfire and provides:
const BONFIRE_ID = process.env.BONFIRES_BONFIRE_ID  // from Bonfires team
const API_KEY = process.env.BONFIRES_API_KEY        // from Bonfires team

// 2. Create and register initial agents
const initialAgents = ["tz-sync", "adjudicator", "counterparty-agent"]
for (const agent of initialAgents) {
  await fetch(`${BONFIRES_URL}/agents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      username: agent,
      name: agent,
      bonfireId: BONFIRE_ID,
      isActive: true,
    }),
  })
}

// 3. Counterparty agent dynamically registers new agents as agreements form
async function registerAgreementAgents(agreementAddress: string, parties: string[]) {
  for (const party of parties) {
    await fetch(`${BONFIRES_URL}/agents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        username: `zone-${party.slice(0, 10)}`,
        name: `Zone agent for ${party}`,
        bonfireId: BONFIRE_ID,
        isActive: true,
        metadata: { agreementAddress, partyAddress: party },
      }),
    })
  }
}
```

---

## Bonfire Scoping: Shared vs Per-Agreement

### Option A: One bonfire per agreement

Each agreement gets its own bonfire. Parties can only see data about their own agreement.

**Pros:** Strong privacy isolation. Party to agreement A cannot see evidence from agreement B.
**Cons:** More bonfires to manage. Cannot query cross-agreement reputation. Setup overhead per agreement.

### Option B: One bonfire per deployment (shared)

One bonfire holds all agreements. All registered agents can see all data.

**Pros:** Simple setup. Cross-agreement queries (reputation history, pattern detection). Single bonfire to manage.
**Cons:** Party to agreement A can see data about agreement B. Privacy leak risk.

### Option C: Hybrid — shared entities, scoped episodes

One bonfire, but:
- Tier 1 entities (agreements, zones, actors) are shared — they're already public onchain
- Tier 2 receipts use `group_id` per agreement to scope episode visibility
- Tier 3 agent stacks are always private to the agent

**Recommendation for hackathon: Option B (shared).** Rationale:
1. All our data is already public onchain — there's no real privacy to protect
2. Cross-agreement queries are needed for the adjudicator and reputation
3. One bonfire = one setup script, one BONFIRE_ID, minimal complexity
4. Privacy-scoped access is a post-hackathon feature

**Post-hackathon consideration:** If Trust Zones supports private agreements (terms not onchain), switch to Option A or C. The Bonfires `bonfire_id` scoping makes this a straightforward migration.

### Open questions for Bonfires team

1. **Agent `apiKey` field:** What is the `apiKey` field on `CreateAgentRequest` for? Is it the key the platform uses to call the agent, or the key the agent uses to call the API? The default `"bonfires-ai"` looks like a dev placeholder — should each agent have a unique key? If it's the auth token, that default is insecure.
2. **Access scoping:** Can agent-level permissions be scoped? (e.g., sync service can create entities, but zone agents can only create episodes and query)
3. **Dynamic agent registration:** Our counterparty agent needs to create and register new Bonfires agents as new agreements form. Is `POST /agents` + `POST /agents/register` sufficient with the bonfire Bearer token?

---

## Implementation Plan

### Phase 1: Bonfire setup (prerequisite)

- Bonfires team provisions the bonfire and provides API key (no need for us to call `POST /provision`)
- Register initial agents (`tz-sync`, `adjudicator`, `counterparty-agent`)
- Store bonfire ID and agent IDs in `packages/ponder/.env` and `packages/data-apis/.env`
- Write a setup script (`scripts/setup-bonfires.ts`) that does all of this

### Phase 2: Ponder -> Bonfires sync service

- Build in `packages/ponder/src/bonfires-sync/`
- Implement entity upsert logic (entity creation + UUID tracking)
- Implement edge creation for all relationship types
- Implement episode creation for state transitions and proposals
- Poll Ponder GraphQL on interval (10s)
- Test with a local Anvil fork + Ponder running

### Phase 3: Data API receipt logging

- Add Bonfires client to `packages/data-apis/src/receipts/logger.ts`
- Implement `logReceipt()` that creates episodes
- Wire into the Express middleware chain (after serving request)
- Test receipt creation and verify Graphiti auto-links to zone entities

### Phase 4: Adjudicator queries

- Build query helpers in a shared package or in `packages/agents/`
- Implement `getAdjudicationContext()` using the query patterns above
- Test with seeded data: create agreement entities, receipt episodes, evidence episodes, then run adjudicator queries
- Verify that `/delve` returns cross-tier results (Tier 1 entities + Tier 2 receipts + disclosed Tier 3 evidence)

### Phase 5: Agent observation + disclosure

- Implement Tier 3 stack operations in agent code (`packages/agents/`)
- Implement selective disclosure flow (private stack -> shared episode)
- Wire into the demo claim-filing flow

### Cut line

Phases 1-4 are required for the demo (Phase 4 is needed for the GenLayer adjudicator integration). Phase 5 is a nice-to-have that demonstrates the full 3-tier architecture.
