# Trust Zones SDK Spec

## Overview

TypeScript library (`@trust-zones/sdk`) that wraps all Trust Zones contract interfaces. Provides typed encode/decode helpers for every `submitInput()` payload, agreement state reads, and TZ account operations. Built on viem.

Consumed by: demo agents (directly), x402 service (bundles it), any third-party agent wanting to interact with Trust Zones contracts.

## Core design

The SDK is a thin typed layer over contract ABIs and Ponder's GraphQL API. It does NOT contain mechanism template logic (that's the compiler). It does NOT host an API server (that's the x402 service). It handles:

1. **Payload encoding** — structured TypeScript inputs → ABI-encoded bytes for `submitInput()`
2. **Payload decoding** — ABI-encoded event data → structured TypeScript objects
3. **Contract reads** — typed wrappers around agreement/zone/registry state reads, with two backends:
   - **Ponder GraphQL** (preferred) — single query for rich, parsed, relational data
   - **Direct RPC** (fallback) — individual `readContract` calls via viem
4. **TZ account operations** — execute calls, sign ERC-8128 requests

## Read backends

The SDK supports two read backends. Ponder is preferred — it returns parsed, relational data in a single query (vs 10+ RPC calls for the same data). Direct RPC is the zero-dependency fallback.

```typescript
const sdk = createTrustZonesSDK({
  // Always required — used for writes and RPC fallback reads
  rpcUrl: "https://mainnet.base.org",
  // Optional — preferred read backend (Ponder GraphQL)
  ponderUrl: "https://tz-ponder.example/graphql",
})
```

When `ponderUrl` is set, read helpers use Ponder's GraphQL API. When not set, they fall back to individual `readContract` calls. The SDK abstracts this — callers get the same typed return values regardless of backend.

## Package structure

```
packages/sdk/
├── src/
│   ├── index.ts              # public API + createTrustZonesSDK factory
│   ├── abis/                 # generated from forge artifacts
│   │   ├── Agreement.ts
│   │   ├── AgreementRegistry.ts
│   │   ├── TrustZone.ts
│   │   ├── HatValidator.ts
│   │   └── ResourceTokenRegistry.ts
│   ├── encode.ts             # payload encoders
│   ├── decode.ts             # event/payload decoders
│   ├── reads/
│   │   ├── index.ts          # read interface (dispatches to backend)
│   │   ├── ponder.ts         # Ponder GraphQL read backend
│   │   └── rpc.ts            # direct RPC read backend (viem)
│   ├── zone.ts               # TZ account operations
│   └── types.ts              # TypeScript types mirroring Solidity structs
├── package.json
└── tsconfig.json
```

## Payload encoders

Each encoder takes structured TypeScript input and returns `{ inputId: Hex, payload: Hex }` ready for `submitInput()`.

```typescript
// Negotiation
function encodePropose(data: ProposalData): SubmitInputArgs
function encodeCounter(data: ProposalData): SubmitInputArgs
function encodeAccept(): SubmitInputArgs
function encodeReject(): SubmitInputArgs
function encodeWithdraw(): SubmitInputArgs

// Activation
function encodeActivate(): SubmitInputArgs

// Runtime
function encodeClaim(mechanismIndex: number, evidence: Hex): SubmitInputArgs
function encodeAdjudicate(
  claimId: number,
  actions: AdjudicationAction[]
): SubmitInputArgs
function encodeComplete(feedbackURI: string, feedbackHash: Hex): SubmitInputArgs
function encodeExit(feedbackURI: string, feedbackHash: Hex): SubmitInputArgs
function encodeFinalize(): SubmitInputArgs

// Convenience
function encodeAcceptAndActivate(activationData: Hex): SubmitInputArgs
```

### Types

```typescript
interface SubmitInputArgs {
  inputId: Hex        // bytes32 keccak constant
  payload: Hex        // ABI-encoded payload
}

interface ProposalData {
  termsDocUri: string
  zones: TZConfig[]
  adjudicator: Address
  deadline: bigint
}

interface TZConfig {
  party: Address
  agentId: bigint           // 0 = no 8004
  maxActors: number
  description: string
  mechanisms: TZMechanism[]
  resources: TZResourceTokenConfig[]
}

enum TZModuleKind {
  HatsModule = 0,
  ERC7579Hook = 1,
  External = 2,
}

interface TZMechanism {
  paramType: TZParamType
  moduleKind: TZModuleKind
  module: Address
  data: Hex
}

interface TZResourceTokenConfig {
  tokenType: TZParamType    // Permission (1), Responsibility (2), Directive (3)
  metadata: Hex
}

interface AdjudicationAction {
  mechanismIndex: bigint
  targetIndex: bigint
  actionType: Hex           // bytes32: PENALIZE, REWARD, FEEDBACK, DEACTIVATE, CLOSE
  params: Hex
}

enum TZParamType {
  Constraint = 0,
  Permission = 1,
  Responsibility = 2,
  Directive = 3,
  Eligibility = 4,
  Reward = 5,
  Penalty = 6,
  PrincipalAlignment = 7,
  DecisionModel = 8,
}
```

## Payload decoders

Decode event logs and calldata back into structured types.

```typescript
// Decode ProposalData from ProposalSubmitted event
function decodeProposalData(proposalDataBytes: Hex): ProposalData

// Decode AdjudicationActions from AdjudicationDelivered event
function decodeAdjudicationActions(payload: Hex): AdjudicationAction[]

// Decode claim evidence from ClaimFiled event
function decodeClaim(payload: Hex): { mechanismIndex: bigint; evidence: Hex }

// Decode feedback from CompletionSignaled / ExitSignaled events
function decodeFeedback(payload: Hex): { feedbackURI: string; feedbackHash: Hex }
```

## Contract reads

Typed wrappers around common read patterns. The SDK dispatches to Ponder GraphQL (if configured) or falls back to direct RPC. Callers get the same types either way.

```typescript
// Full agreement state — via Ponder, this is a single GraphQL query
// Via RPC, this is 10+ readContract calls
interface AgreementState {
  currentState: string          // human-readable: "PROPOSED", "ACTIVE", etc.
  outcome: string | null        // "COMPLETED", "EXITED", "EXPIRED", "ADJUDICATED"
  parties: [Address, Address]
  agentIds: [bigint, bigint]
  termsHash: Hex
  termsUri: string
  adjudicator: Address
  deadline: bigint
  trustZones: [Address, Address]
  zoneHatIds: [bigint, bigint]
  claimCount: bigint
}

function getAgreementState(agreement: Address): Promise<AgreementState>

// Full zone details — via Ponder, includes parsed token metadata + mechanisms
interface ZoneDetails {
  address: Address
  party: Address
  hatId: bigint
  zoneIndex: number
  active: boolean
  permissions: ParsedPermission[]
  responsibilities: ParsedResponsibility[]
  directives: ParsedDirective[]
  constraints: ParsedConstraint[]
  claims: ClaimSummary[]
}

function getZoneDetails(zoneAccount: Address): Promise<ZoneDetails>

// Parsed resource token — via Ponder, metadata is already decoded
interface ParsedPermission {
  tokenId: bigint
  resource: string
  rateLimit: string | null      // e.g. "10/hour"
  expiry: bigint | null
  purpose: string | null
}

interface ParsedDirective {
  tokenId: bigint
  rule: string
  severity: string | null
  params: string | null
}

function getZonePermissions(zoneAccount: Address): Promise<ParsedPermission[]>
function getZoneDirectives(zoneAccount: Address): Promise<ParsedDirective[]>

// Negotiation history — via Ponder, all proposals with parsed data
interface ProposalSummary {
  sequence: number
  proposer: Address
  termsHash: Hex
  termsDocUri: string
  adjudicator: Address
  deadline: bigint
  zoneCount: number
  timestamp: bigint
}

function getProposalHistory(agreement: Address): Promise<ProposalSummary[]>

// Claims for an agreement — via Ponder, with adjudication status
function getClaims(agreement: Address): Promise<ClaimSummary[]>

// Simple checks (always RPC — cheap single calls)
function isHatWearer(wearer: Address, hatId: bigint): Promise<boolean>
function getResourceTokenBalance(holder: Address, tokenId: bigint): Promise<bigint>
```

### Ponder GraphQL queries (internal)

When Ponder is configured, the SDK generates GraphQL queries like:

```graphql
query GetAgreementState($id: String!) {
  agreement(id: $id) {
    state
    outcome
    termsHash
    termsUri
    adjudicator
    deadline
    agreementHatId
    activatedAt
    closedAt
    agreementParties {
      items {
        actor { address agentId }
        partyIndex
      }
    }
    trustZones {
      items {
        id
        hatId
        zoneIndex
        active
        permissions { items { resource rateLimit expiry purpose } }
        directives { items { rule severity params } }
        constraints { items { module } }
        claims { items { id verdict adjudicatedAt } }
      }
    }
    proposals {
      items {
        sequence
        proposer { address }
        termsHash
        termsDocUri
        adjudicator
        deadline
        timestamp
      }
    }
  }
}
```

One query, full agreement picture. Compare to 10+ `readContract` calls for the RPC fallback.

## TZ account operations

Helpers for operating as a TZ account.

```typescript
// Build an execute() call on a TZ account
function buildZoneExecute(
  zoneAccount: Address,
  target: Address,
  value: bigint,
  data: Hex
): TransactionRequest

// Build an ERC-8128 signed request as a TZ account
function signAsZone(
  walletClient: WalletClient,
  zoneAccount: Address,
  chainId: number,
  message: Hex
): Promise<ERC8128SignedRequest>

interface ERC8128SignedRequest {
  keyId: string           // "erc8128:<chainId>:<zoneAddress>"
  signature: Hex
  message: Hex
}
```

## Constants

Exported constants matching the Solidity constants for use in TypeScript:

```typescript
// States
export const PROPOSED = keccak256(toHex("PROPOSED"))
export const NEGOTIATING = keccak256(toHex("NEGOTIATING"))
export const ACCEPTED = keccak256(toHex("ACCEPTED"))
export const ACTIVE = keccak256(toHex("ACTIVE"))
export const CLOSED = keccak256(toHex("CLOSED"))
export const REJECTED = keccak256(toHex("REJECTED"))

// Inputs
export const PROPOSE = keccak256(toHex("PROPOSE"))
export const COUNTER = keccak256(toHex("COUNTER"))
// ... etc

// Action types
export const PENALIZE = keccak256(toHex("PENALIZE"))
export const REWARD = keccak256(toHex("REWARD"))
// ... etc

// Deployed addresses (Base)
export const ADDRESSES = {
  hats: "0x...",
  identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
  // ... filled after deployment
} as const
```

## Dependencies

- `viem` — contract reads, ABI encoding/decoding, signing
- No other runtime dependencies. ABIs are generated from forge build artifacts.

## Build

```bash
# Generate ABIs from forge artifacts
pnpm run generate-abis

# Build
pnpm run build
```

ABI generation reads from `packages/contracts/out/` and produces typed ABI constants in `src/abis/`.
