# Ponder Indexer Spec

## Role

Indexes contract events into a queryable store. Feeds Tier 1 of the Trust Zones Context Graph.

## Consumers

| Consumer | Queries |
|----------|---------|
| OpenServ demo agents | Agreements involving me, current state, resource tokens held, claims |
| Mock data APIs | Permission tokens on TZ account (also possible via direct chain read) |
| GenLayer | Directive tokens + claims for adjudication |
| Bonfires | Stable entities as KG triplets, action receipts as episodes |
| Demo logs | Full negotiation history, activation events, claim/adjudication timeline |

## Events indexed

### From Agreement Registry
- `AgreementCreated(address indexed agreement, address indexed creator, uint256 agreementHatId, address partyA, address partyB)`

### From Agreement Contract
```
// Shodai-compatible
InputAccepted(bytes32 indexed fromState, bytes32 indexed toState, bytes32 indexed inputId, bytes payload)
AgreementStateChanged(bytes32 indexed fromState, bytes32 indexed toState)

// Negotiation
ProposalSubmitted(address indexed proposer, bytes32 termsHash, string termsUri)

// Activation
AgreementActivated(address indexed agreement, address[] tzAccounts, uint256[] zoneHatIds)
ZoneDeployed(address indexed agreement, address indexed tzAccount, uint256 indexed zoneHatId, address party, uint256 agentId)
ResourceTokenAssigned(address indexed tzAccount, uint256 indexed tokenId, uint8 tokenType)
MechanismRegistered(uint8 indexed mechanismIndex, uint8 paramType, address module, uint8 zoneIndex)

// Claims + Adjudication
ClaimFiled(uint256 indexed claimId, uint8 indexed mechanismIndex, address indexed claimant, bytes evidence)
AdjudicationDelivered(uint256 indexed claimId, bool verdict, bytes32[] actionTypes)

// Close
AgreementClosed(bytes32 indexed outcome)
CompletionSignaled(address indexed party, string feedbackURI, bytes32 feedbackHash)
ExitSignaled(address indexed party, string feedbackURI, bytes32 feedbackHash)
ReputationFeedbackWritten(uint256 indexed agentId, string tag2, string feedbackURI, bytes32 feedbackHash)
```

### From Resource Token Registry
```
Transfer(address indexed sender, address indexed receiver, uint256 indexed id, uint256 amount)
TokenCreated(uint256 indexed tokenId, address indexed creator, bytes metadata)
MinterRegistered(address indexed minter)
```

## Ponder entities

```typescript
Agreement {
  id: address
  state: bytes32
  outcome: bytes32?
  parties: [address]
  agentIds: [uint256]         // from TZConfig, 0 = no 8004
  termsHash: bytes32
  termsUri: string
  adjudicator: address
  deadline: uint256
  agreementHatId: uint256
  createdAt: timestamp
  activatedAt: timestamp?
  closedAt: timestamp?
}

Zone {
  id: address                 // TZ account address
  agreement: Agreement
  party: address
  agentId: uint256            // 0 = no 8004
  hatId: uint256
  createdAt: timestamp
}

Proposal {
  id: string                  // agreement + sequence index
  agreement: Agreement
  proposer: address
  termsHash: bytes32
  termsUri: string
  timestamp: timestamp
}

ResourceTokenHolding {
  id: string                  // zone + tokenId
  zone: Zone
  tokenId: uint256
  tokenType: uint8            // 0x01, 0x02, 0x03
  balance: uint256
  metadata: bytes
}

RegisteredMechanism {
  id: string                  // agreement + mechanismIndex
  agreement: Agreement
  mechanismIndex: uint8
  paramType: uint8            // ELIGIBILITY, INCENTIVE, CONSTRAINT
  module: address
  zoneIndex: uint8
}

Claim {
  id: string                  // agreement + claimId
  agreement: Agreement
  mechanism: RegisteredMechanism
  claimant: address
  evidence: bytes
  verdict: boolean?
  actionTypes: [bytes32]?
  timestamp: timestamp
  adjudicatedAt: timestamp?
}
```

## Event → Entity mapping

| Event | Creates/Updates |
|-------|----------------|
| `AgreementCreated` | Agreement (new) |
| `ProposalSubmitted` | Proposal (new), Agreement.termsHash/Uri |
| `AgreementStateChanged` | Agreement.state |
| `AgreementActivated` | Agreement.activatedAt |
| `ZoneDeployed` | Zone (new) |
| `ResourceTokenAssigned` | ResourceTokenHolding (new) |
| `MechanismRegistered` | RegisteredMechanism (new) |
| `Transfer` (ERC-6909) | ResourceTokenHolding.balance |
| `TokenCreated` | ResourceTokenHolding (new, with metadata) |
| `ClaimFiled` | Claim (new) |
| `AdjudicationDelivered` | Claim.verdict/actionTypes/adjudicatedAt |
| `CompletionSignaled` | tracked on Agreement |
| `ExitSignaled` | tracked on Agreement |
| `AgreementClosed` | Agreement.outcome/closedAt |
| `ReputationFeedbackWritten` | tracked on Agreement or Zone |
