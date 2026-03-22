# Ponder Indexer Spec

## Role

Indexes contract events into a queryable store. Materializes the Tier 1 Context Graph — the onchain truth layer that downstream consumers build on.

## Design principles

- **The indexer IS the Tier 1 context graph.** Schema mirrors the Context Graph data model, not the raw event structure.
- **Parse everything at index time.** ABI-decode ProposalData, resource token metadata, and adjudication actions so consumers never touch raw bytes.
- **Proposed vs deployed.** Typed entities (Permission, Directive, Constraint, etc.) are created at proposal time (proposed) and activation time (deployed). Consumers distinguish via `proposal` vs `trustZone` references.
- **TrustZone is the hub.** The TrustZone entity is the primary query target — the full surface of delegated resources and mechanisms that secure them.

## Stack

- **Ponder**: latest stable
- **Database**: SQLite (sufficient for hackathon — switch to Postgres is a config change)
- **API**: GraphQL (consumed by OpenServ agents, mock data APIs, GenLayer, Bonfires)
- **Dev**: Anvil fork for local development

## Consumers

| Consumer | Primary queries |
|----------|----------------|
| OpenServ demo agents | "Agreements involving me" (via AgreementParty), current state, trust zone details, claims |
| Mock data APIs | Permission tokens on TZ account — resource + rateLimit + expiry for ERC-8128 gating |
| GenLayer | Directive details + claims for adjudication evaluation |
| Bonfires | Full entity graph as KG triplets — TrustZone → mechanisms/resources as relationships |
| Demo logs | Negotiation history (parsed proposals), activation events, claim/adjudication timeline |

## Events indexed

### From Agreement Registry

```solidity
AgreementCreated(address indexed agreement, address indexed creator, uint256 agreementHatId, address partyA, address partyB)
```

### From Agreement Contract (factory pattern — discovered via AgreementCreated)

```solidity
// State
AgreementStateChanged(bytes32 indexed fromState, bytes32 indexed toState)

// Negotiation
ProposalSubmitted(address indexed proposer, bytes32 termsHash, bytes proposalData)

// Setup + Activation
AgreementSetUp(address indexed agreement, address[2] trustZones, uint256[2] zoneHatIds)
AgreementActivated(address indexed agreement, address[2] trustZones, uint256[2] zoneHatIds)
ZoneDeployed(address indexed agreement, address indexed tzAccount, uint256 indexed zoneHatId, address party, uint256 agentId)
ResourceTokenAssigned(address indexed tzAccount, uint256 indexed tokenId, uint8 tokenType)
MechanismRegistered(uint256 indexed mechanismIndex, uint8 paramType, address module, uint256 zoneIndex)

// Claims + Adjudication
ClaimFiled(uint256 indexed claimId, uint256 indexed mechanismIndex, address indexed claimant, bytes evidence)
AdjudicationDelivered(uint256 indexed claimId, bool verdict, bytes32[] actionTypes)

// Close
CompletionSignaled(address indexed party, string feedbackURI, bytes32 feedbackHash)
ExitSignaled(address indexed party, string feedbackURI, bytes32 feedbackHash)
AgreementClosed(bytes32 indexed outcome)
ReputationFeedbackWritten(uint256 indexed agentId, string tag2, string feedbackURI, bytes32 feedbackHash)
```

### From Resource Token Registry

```solidity
Transfer(address caller, address indexed sender, address indexed receiver, uint256 indexed id, uint256 amount)
TokenCreated(uint256 indexed tokenId, address indexed creator, uint8 tokenType, bytes metadata)
```

### From Temptation (vault contract)

```solidity
Deposited(address indexed from, uint256 amount)
Withdrawn(address indexed to, uint256 amount, uint256 indexed permissionTokenId)
```

### Events NOT indexed

- `InputAccepted` — duplicative of domain-specific events (ProposalSubmitted, AgreementStateChanged, ClaimFiled, etc.)
- `MinterRegistered` — admin event (registry registering agreements as minters), low value for consumers

## Entities

### Core lifecycle

```
Agreement {
  id: address                    // contract address
  state: string                  // bytes32 decoded to human-readable (PROPOSED, ACTIVE, etc.)
  outcome: string?               // COMPLETED | EXITED | EXPIRED | ADJUDICATED
  termsHash: hex                 // bytes32
  termsUri: string
  adjudicator: address?
  deadline: bigint?
  agreementHatId: bigint
  partyACompleted: boolean
  partyBCompleted: boolean
  partyAExited: boolean
  partyBExited: boolean
  createdAt: bigint              // block.timestamp
  setUpAt: bigint?               // block.timestamp when SET_UP transitions to READY
  activatedAt: bigint?           // block.timestamp when ACTIVATE transitions to ACTIVE
  closedAt: bigint?

  // Relations
  trustZones: [TrustZone]
  proposals: [Proposal]
  claims: [Claim]
  reputationFeedbacks: [ReputationFeedback]
  agreementParties: [AgreementParty]
}

Actor {
  id: string                     // address (lowercase)
  address: address
  agentId: bigint?               // ERC-8004 identity, 0 or null = no agent identity

  // Relations
  agreementParties: [AgreementParty]
  reputationFeedback: [ReputationFeedback]
}

AgreementParty {
  id: string                     // `${agreement}:${address}`
  agreement: Agreement
  actor: Actor
  partyIndex: int                // 0 or 1
}

Proposal {
  id: string                     // `${agreement}:${sequence}`
  agreement: Agreement
  proposer: Actor
  sequence: int                  // 0-indexed, incremented per ProposalSubmitted
  termsHash: hex
  timestamp: bigint

  // Parsed from ProposalData (ABI-decoded from event payload)
  termsDocUri: string
  adjudicator: address
  deadline: bigint
  zoneCount: int
  rawProposalData: hex?            // ABI-encoded ProposalData bytes from the event
  txHash: hex?                     // transaction hash

  // Relations — proposed typed entities link back here
  permissions: [Permission]
  responsibilities: [Responsibility]
  directives: [Directive]
  constraints: [Constraint]
  eligibilities: [Eligibility]
  incentives: [Incentive]
  decisionModels: [DecisionModel]
  principalAlignments: [PrincipalAlignment]
}

TrustZone {
  id: address                    // TZ account address
  agreement: Agreement
  actor: Actor                   // the party who operates this zone
  hatId: bigint
  zoneIndex: int                 // 0 or 1 within the agreement
  active: boolean                // set false on CLOSED
  createdAt: bigint
  txHash: hex?                   // transaction hash

  // Relations — deployed typed entities link here
  permissions: [Permission]
  responsibilities: [Responsibility]
  directives: [Directive]
  constraints: [Constraint]
  resourceTokenHoldings: [ResourceTokenHolding]
}
```

### Context graph typed entities

Each typed entity has `proposal?` + `trustZone?` references for the proposed/deployed distinction:
- **Proposed**: `proposal` is set, `trustZone` is null → created from parsed ProposalData
- **Deployed**: `trustZone` is set → created from activation events
- Both may be set if the entity was proposed and then deployed

```
Permission {
  id: string
  agreement: Agreement
  proposal: Proposal?            // proposed (from ProposalSubmitted)
  trustZone: TrustZone?          // deployed (from ResourceTokenAssigned)
  resourceToken: ResourceToken?  // linked after activation
  zoneIndex: int

  // Parsed from resource token metadata (ABI-decoded)
  resource: string               // resource identifier (endpoint path, contract address)
  value: bigint?                 // rate limit value
  period: string?                // rate limit period (decoded from bytes32)
  expiry: bigint?                // unix timestamp
  params: string?                // additional parameters (JSON)

  createdAt: bigint
}

Responsibility {
  id: string
  agreement: Agreement
  proposal: Proposal?
  trustZone: TrustZone?
  resourceToken: ResourceToken?
  zoneIndex: int

  // Parsed from resource token metadata
  obligation: string             // what must be done
  criteria: string?              // success criteria
  deadline: bigint?              // completion deadline

  createdAt: bigint
}

Directive {
  id: string
  agreement: Agreement
  proposal: Proposal?
  trustZone: TrustZone?
  resourceToken: ResourceToken?
  zoneIndex: int

  // Parsed from resource token metadata
  rule: string                   // the behavioral rule
  severity: string?              // minor | moderate | severe
  params: string?                // JSON blob for additional parameters

  createdAt: bigint
}

Constraint {
  id: string
  agreement: Agreement
  proposal: Proposal?
  trustZone: TrustZone?
  zoneIndex: int

  moduleKind: string             // "HatsModule", "ERC7579Hook", "External"
  module: address                // deployed address (clone or singleton)
  data: hex                      // module-specific config

  createdAt: bigint
}

Eligibility {
  id: string
  agreement: Agreement
  proposal: Proposal?
  trustZone: TrustZone?
  zoneIndex: int

  moduleKind: string
  module: address
  data: hex

  createdAt: bigint
}

Incentive {
  id: string
  agreement: Agreement
  proposal: Proposal?
  trustZone: TrustZone?
  zoneIndex: int

  incentiveType: string          // "Reward" or "Penalty"
  moduleKind: string
  module: address
  data: hex

  createdAt: bigint
}

DecisionModel {
  id: string
  agreement: Agreement
  proposal: Proposal?
  trustZone: TrustZone?
  zoneIndex: int

  moduleKind: string
  module: address
  data: hex

  createdAt: bigint
}

PrincipalAlignment {
  id: string
  agreement: Agreement
  proposal: Proposal?
  trustZone: TrustZone?
  zoneIndex: int

  moduleKind: string
  module: address
  data: hex

  createdAt: bigint
}
```

### Token layer

```
ResourceToken {
  id: bigint                     // ERC-6909 token ID
  tokenType: int                 // 0x01 (Permission), 0x02 (Responsibility), 0x03 (Directive)
  creator: address               // agreement contract that minted it
  metadata: hex                  // raw ABI-encoded metadata
  createdAt: bigint
}

ResourceTokenHolding {
  id: string                     // `${trustZone}:${tokenId}`
  trustZone: TrustZone
  resourceToken: ResourceToken
  balance: bigint                // 0 or 1
}
```

### Claims + feedback

```
Claim {
  id: string                     // `${agreement}:${claimId}`
  agreement: Agreement           // claims are agreement-scoped (not zone-scoped)
  mechanismIndex: bigint         // indirectly links to a zone via the mechanism's zoneIndex
  claimant: Actor
  evidence: hex                  // raw bytes
  verdict: boolean?              // null until adjudicated
  actionTypes: [string]?         // decoded bytes32[] (PENALIZE, REWARD, etc.)
  timestamp: bigint
  adjudicatedAt: bigint?
}

ReputationFeedback {
  id: string                     // `${agreement}:${agentId}`
  agreement: Agreement
  actor: Actor                   // resolved from agentId
  tag: string                    // outcome string (COMPLETED, EXITED, etc.)
  value: int                     // inferred from tag: COMPLETED=1, ADJUDICATED=-1, else 0
  feedbackURI: string
  feedbackHash: hex
  timestamp: bigint
}
```

### Vault events

```
VaultDeposit {
  id: string                     // `${txHash}:${logIndex}`
  vault: address                 // vault contract address
  depositor: address
  amount: bigint
  timestamp: bigint
  txHash: hex?
}

VaultWithdrawal {
  id: string                     // `${txHash}:${logIndex}`
  vault: address
  recipient: address
  amount: bigint
  permissionTokenId: bigint      // the permission token that authorized withdrawal
  timestamp: bigint
  txHash: hex?
}
```

## Event → Entity mapping

### AgreementCreated
- Creates: `Agreement`, 2x `Actor` (upsert), 2x `AgreementParty`

### ProposalSubmitted
- Creates: `Proposal`, `Actor` (upsert for proposer)
- Updates: `Agreement.termsHash`
- **ABI-decodes `proposalData`** into `ProposalData { termsDocUri, TZConfig[], adjudicator, deadline }`
- For each `TZConfig.mechanisms[]`: creates proposed typed entity (Constraint, Eligibility, Incentive, DecisionModel, PrincipalAlignment) based on `paramType`
- For each `TZConfig.resources[]`: creates proposed typed entity (Permission, Responsibility, Directive) based on `tokenType`, ABI-decodes metadata into parsed fields

### AgreementStateChanged
- Updates: `Agreement.state` (decode bytes32 to human-readable string)

### AgreementSetUp
- Updates: `Agreement.setUpAt`

### AgreementActivated
- Updates: `Agreement.activatedAt`

### ZoneDeployed
- Creates: `TrustZone`
- Updates: `Actor.agentId` (upsert)

### MechanismRegistered
- Creates: deployed typed entity (Constraint, Eligibility, Incentive, DecisionModel, PrincipalAlignment) based on `paramType`
- Links to `TrustZone` (resolved from `zoneIndex` → TrustZone with matching zoneIndex for this agreement)

### ResourceTokenAssigned
- Creates: `ResourceTokenHolding`
- Creates: deployed typed entity (Permission, Responsibility, Directive) based on `tokenType`
- Links to `TrustZone`

### TokenCreated
- Creates: `ResourceToken` with raw metadata
- If a corresponding typed entity exists (from ResourceTokenAssigned), links it and ABI-decodes metadata into parsed fields

### Transfer (ERC-6909)
- Updates: `ResourceTokenHolding.balance`
- On mint (sender = address(0)): creates holding if needed
- On burn (receiver = address(0)): sets balance to 0

### ClaimFiled
- Creates: `Claim`
- Links to `TrustZone` (resolved from mechanismIndex → mechanism's zoneIndex)

### AdjudicationDelivered
- Updates: `Claim.verdict`, `Claim.actionTypes`, `Claim.adjudicatedAt`
- Decodes `bytes32[]` action types to human-readable strings

### CompletionSignaled
- Updates: `Agreement.partyACompleted` or `Agreement.partyBCompleted` (based on party address)

### ExitSignaled
- Updates: `Agreement.partyAExited` or `Agreement.partyBExited`

### AgreementClosed
- Updates: `Agreement.outcome`, `Agreement.closedAt`
- Updates: all `TrustZone.active = false` for this agreement

### ReputationFeedbackWritten
- Creates: `ReputationFeedback`
- Links to `Actor` (resolved from agentId)

### Deposited (Temptation)
- Creates: `VaultDeposit`

### Withdrawn (Temptation)
- Creates: `VaultWithdrawal`

## ProposalData parsing

The `proposalData` bytes in `ProposalSubmitted` are ABI-encoded as:

```solidity
struct ProposalData {
    string termsDocUri;
    TZConfig[] zones;
    address adjudicator;
    uint256 deadline;
}

struct TZConfig {
    address party;
    uint256 agentId;
    uint32 maxActors;
    string description;
    TZMechanism[] mechanisms;
    TZResourceTokenConfig[] resources;
}

struct TZMechanism {
    TZParamType paramType;
    TZModuleKind moduleKind;  // HatsModule(0), ERC7579Hook(1), External(2)
    address module;
    bytes data;
}
```

The indexer ABI-decodes this and:
1. Stores parsed fields on the `Proposal` entity (termsDocUri, adjudicator, deadline, zoneCount)
2. For each zone, iterates `mechanisms[]` and creates proposed typed entities based on `paramType`
3. For each zone, iterates `resources[]` and creates proposed typed entities based on `tokenType`, ABI-decoding the inner `metadata` bytes into parsed fields per the metadata schemas below

## Resource token metadata schemas

Metadata is ABI-encoded `bytes`. The indexer decodes based on token type:

### Permission (0x01)
```
(string resource, uint256 value, bytes32 period, uint256 expiry, bytes params)
```
→ `Permission.resource`, `Permission.value`, `Permission.period` (bytes32 decoded to string), `Permission.expiry`, `Permission.params` (hex or JSON)

### Responsibility (0x02)
```
(string obligation, string criteria, uint256 deadline)
```
→ `Responsibility.obligation`, `Responsibility.criteria`, `Responsibility.deadline`

### Directive (0x03)
```
(string rule, string severity, bytes params)
```
→ `Directive.rule`, `Directive.severity`, `Directive.params` (hex or JSON)

## bytes32 decoding

Agreement states and input IDs are `keccak256` hashes. The indexer maintains a lookup table:

```
keccak256("PROPOSED")    → "PROPOSED"
keccak256("NEGOTIATING") → "NEGOTIATING"
keccak256("ACCEPTED")    → "ACCEPTED"
keccak256("READY")       → "READY"
keccak256("ACTIVE")      → "ACTIVE"
keccak256("CLOSED")      → "CLOSED"
keccak256("REJECTED")    → "REJECTED"

keccak256("COMPLETED")   → "COMPLETED"
keccak256("EXITED")      → "EXITED"
keccak256("EXPIRED")     → "EXPIRED"
keccak256("ADJUDICATED") → "ADJUDICATED"

keccak256("PENALIZE")    → "PENALIZE"
keccak256("REWARD")      → "REWARD"
keccak256("FEEDBACK")    → "FEEDBACK"
keccak256("DEACTIVATE")  → "DEACTIVATE"
keccak256("CLOSE")       → "CLOSE"
```

## Entity count

20 entities total:
- **Core lifecycle** (7): Agreement, Actor, AgreementParty, Proposal, TrustZone, Claim, ReputationFeedback
- **Context graph typed** (8): Permission, Responsibility, Directive, Constraint, Eligibility, Incentive, DecisionModel, PrincipalAlignment
- **Token layer** (2): ResourceToken, ResourceTokenHolding
- **Vault events** (2): VaultDeposit, VaultWithdrawal
- **Join** (1): AgreementParty

## Ponder configuration notes

- **Factory pattern**: AgreementRegistry is indexed directly. Each `AgreementCreated` event registers the new agreement address as a child contract source for Agreement events.
- **Four contract sources**: AgreementRegistry (singleton) + Agreement (factory children) + ResourceTokenRegistry (singleton) + Temptation (singleton vault)
- **Start block**: deployment block of AgreementRegistry and ResourceTokenRegistry
- **Chain**: Base Sepolia (testnet) / Base (mainnet)
