# Ponder Indexer Spec

## Role

Indexes contract events into a queryable store. Feeds Tier 1 of the Trust Zones Context Graph.

## Consumers

| Consumer | Queries |
|----------|---------|
| OpenServ demo agents | Agreements involving me, current state, resource tokens held, action receipts |
| Mock data APIs | Permission tokens on TZ account (also possible via direct chain read) |
| GenLayer | Directive tokens + action receipts for dispute period |
| Bonfires | Stable entities as KG triplets, action receipts as episodes |
| Demo logs | Full negotiation history, activation events, dispute timeline |

## Events indexed

### From Agreement Registry
- `AgreementCreated(address indexed agreement, address indexed creator, uint256 agreementHatId)`

### From Agreement Contract
```
// Shodai-compatible
InputAccepted(bytes32 indexed fromState, bytes32 indexed toState, bytes32 indexed inputId, bytes payload)
AgreementStateChanged(bytes32 indexed fromState, bytes32 indexed toState)

// Negotiation
ProposalSubmitted(address indexed proposer, bytes32 termsHash, string termsUri)

// Activation
AgreementActivated(address indexed agreement, address[] tzAccounts, uint256[] zoneHatIds)
ZoneDeployed(address indexed agreement, address indexed tzAccount, uint256 indexed zoneHatId, address party)
ResourceTokenAssigned(address indexed tzAccount, uint256 indexed tokenId, uint8 tokenType)

// Dispute
DisputeRaised(address indexed disputer, uint256[] tokenRefs, string claim, bytes32 evidenceHash)
DisputeResolved(address indexed agreement, bool verdict, uint256 severity)

// Incentives
BondDeposited(address indexed party, uint256 amount)
BondSlashed(address indexed party, uint256 amount, uint256 severity)
EscrowDeposited(address indexed party, uint256 amount)
EscrowReleased(address indexed recipient, uint256 amount)
IdentityStaked(address indexed party, uint256 indexed erc8004TokenId)
IdentityReturned(address indexed party, uint256 indexed erc8004TokenId)
ReputationFeedbackSubmitted(uint256 indexed erc8004TokenId, int256 rating)
```

### From Resource Token Registry
```
Transfer(address indexed sender, address indexed receiver, uint256 indexed id, uint256 amount)
TokenMetadataSet(uint256 indexed tokenId, bytes metadata)
```

## Ponder entities

```typescript
Agreement {
  id: address
  state: bytes32
  parties: [address]
  termsHash: bytes32
  termsUri: string
  agreementHatId: uint256
  createdAt: timestamp
  activatedAt: timestamp?
  resolvedAt: timestamp?
}

Zone {
  id: address           // TZ account address
  agreement: Agreement
  party: address
  hatId: uint256
  createdAt: timestamp
}

Proposal {
  id: string            // agreement + sequence index
  agreement: Agreement
  proposer: address
  termsHash: bytes32
  termsUri: string
  timestamp: timestamp
}

ResourceTokenHolding {
  id: string            // zone + tokenId
  zone: Zone
  tokenId: uint256
  tokenType: uint8      // 0x01, 0x02, 0x03
  balance: uint256
  metadata: bytes
}

Dispute {
  id: string
  agreement: Agreement
  disputer: address
  tokenRefs: [uint256]
  claim: string
  evidenceHash: bytes32
  verdict: boolean?
  severity: uint256?
  timestamp: timestamp
  resolvedAt: timestamp?
}

Bond {
  id: string
  agreement: Agreement
  party: address
  amount: uint256
  slashedAmount: uint256
  status: string        // deposited | returned | slashed
}

IdentityStake {
  id: string
  agreement: Agreement
  party: address
  erc8004TokenId: uint256
  status: string        // staked | returned | burned
  reputationDelta: int256?
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
| `Transfer` (ERC-6909) | ResourceTokenHolding.balance |
| `TokenMetadataSet` | ResourceTokenHolding.metadata |
| `DisputeRaised` | Dispute (new) |
| `DisputeResolved` | Dispute.verdict/severity/resolvedAt, Agreement.resolvedAt |
| `BondDeposited` | Bond (new) |
| `BondSlashed` | Bond.slashedAmount/status |
| `EscrowDeposited` / `EscrowReleased` | tracked on Agreement or separate entity |
| `IdentityStaked` | IdentityStake (new) |
| `IdentityReturned` | IdentityStake.status |
| `ReputationFeedbackSubmitted` | IdentityStake.reputationDelta |
