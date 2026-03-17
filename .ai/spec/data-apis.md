# Data APIs Spec

## Overview

Mock resource provider APIs that demonstrate the offchain "act as" model. Each data API:
1. Authenticates requests via ERC-8128 + ERC-1271 (agent signs as TZ account)
2. Authorizes access by checking resource token holdings on the TZ account
3. Enforces directive rules dynamically (rate limits, usage restrictions)
4. Logs action receipts to the Bonfires context graph (Tier 2)

For the demo, there are two data APIs — one per party — serving mock data that the other party's agent accesses through their TZ account.

## Architecture

```
Agent (hat-wearer)
  │
  │  HTTP request with ERC-8128 signature
  │  keyId = "erc8128:<chainId>:<tzAccountAddress>"
  │
  ▼
Data API Server
  │
  ├── 1. Verify ERC-8128 signature
  │      └── call isValidSignature(hash, sig) on TZ account (ERC-1271)
  │          └── TZ account routes to HatValidator
  │              └── HatValidator checks hats.isWearerOfHat(signer, hatId)
  │
  ├── 2. Check resource token authorization
  │      └── registry.balanceOf(tzAccount, permissionTokenId) > 0?
  │
  ├── 3. Enforce directive rules
  │      └── registry.tokenMetadata(directiveTokenId)
  │          └── check rate limit, usage restrictions, etc.
  │
  ├── 4. Serve the request
  │
  └── 5. Log action receipt to Bonfires (Tier 2)
```

## ERC-8128 authentication

### Request signing (agent-side)

Agent signs HTTP requests using ERC-8128 with the TZ account as the key identity:

```
Authorization: ERC-8128
  keyId="erc8128:8453:<tzAccountAddress>"
  signature="<hex-encoded signature>"
  headers="(request-target) host date digest"
```

The signature is an EIP-191 personal sign over the canonical request string. The `keyId` identifies the TZ account address on the specified chain.

### Signature verification (server-side)

```typescript
async function verifyERC8128(req: Request, client: PublicClient): Promise<{
  valid: boolean
  signer: Address
  zoneAccount: Address
  chainId: number
}> {
  // 1. Parse Authorization header
  const { keyId, signature, signedHeaders } = parseERC8128Header(req)
  const [, chainId, zoneAccount] = keyId.split(":")

  // 2. Reconstruct the canonical signing string from signedHeaders
  const message = buildCanonicalString(req, signedHeaders)
  const messageHash = hashMessage(message)

  // 3. Call isValidSignature on the TZ account (ERC-1271)
  const result = await client.readContract({
    address: zoneAccount as Address,
    abi: TrustZoneABI,
    functionName: "isValidSignature",
    args: [messageHash, signature]
  })

  // 4. Check magic value (0x1626ba7e = valid)
  return {
    valid: result === "0x1626ba7e",
    signer: recoverAddress(messageHash, signature),
    zoneAccount: zoneAccount as Address,
    chainId: Number(chainId)
  }
}
```

## Resource token authorization

After verifying the signature, the server checks that the TZ account holds the required permission token:

```typescript
async function checkPermission(
  client: PublicClient,
  registry: Address,
  zoneAccount: Address,
  endpoint: string
): Promise<{ authorized: boolean; tokenId?: bigint; metadata?: ResourceTokenMetadata }> {
  // Look up the permission token ID for this endpoint
  // (mapping maintained by the data API server)
  const tokenId = endpointToTokenId[endpoint]
  if (!tokenId) return { authorized: false }

  const balance = await client.readContract({
    address: registry,
    abi: ResourceTokenRegistryABI,
    functionName: "balanceOf",
    args: [zoneAccount, tokenId]
  })

  if (balance === 0n) return { authorized: false }

  // Fetch metadata for directive enforcement
  const metadata = await client.readContract({
    address: registry,
    abi: ResourceTokenRegistryABI,
    functionName: "tokenMetadata",
    args: [tokenId]
  })

  return { authorized: true, tokenId, metadata: decodeMetadata(metadata) }
}
```

## Directive enforcement

Directive tokens (0x03) bound to the TZ account encode behavioral rules. The server reads directive metadata and enforces dynamically:

```typescript
async function enforceDirectives(
  client: PublicClient,
  registry: Address,
  zoneAccount: Address,
  request: Request,
  receiptStore: ReceiptStore
): Promise<{ allowed: boolean; violation?: string }> {
  // Get all directive tokens held by this zone
  const directives = await getZoneDirectives(client, registry, zoneAccount)

  for (const directive of directives) {
    const meta = decodeDirectiveMetadata(directive.metadata)

    switch (meta.rule) {
      case "rateLimit": {
        const recentCount = await receiptStore.countRecent(
          zoneAccount,
          directive.resource,
          meta.params.period
        )
        if (recentCount >= meta.params.value) {
          return { allowed: false, violation: `Rate limit exceeded: ${recentCount}/${meta.params.value} per ${meta.params.period}` }
        }
        break
      }
      case "attribution":
        // Checked post-hoc by adjudicator, not blocked at request time
        break
      case "noRedistribution":
        // Checked post-hoc by adjudicator
        break
    }
  }

  return { allowed: true }
}
```

Note: Some directives (rate limits) can be enforced at request time. Others (attribution, usage quality) can only be evaluated post-hoc by the adjudicator using action receipts.

## Action receipt logging

After serving a request, the data API logs a receipt to the Bonfires context graph:

```typescript
async function logReceipt(
  bonfires: BonfiresClient,
  receipt: ActionReceipt
): Promise<void> {
  await bonfires.createEpisode({
    bonfire_id: BONFIRE_ID,
    agent_id: receipt.actor,  // mapped to Bonfires agent ID
    content: JSON.stringify(receipt)
  })
}
```

See `context-graph.md` for the full ActionReceipt schema.

## Demo data APIs

### Agent A's data API

Endpoints exposed to Agent B (via Zone 1 TZ account):

| Endpoint | Description | Permission token | Directive tokens |
|----------|-------------|-----------------|-----------------|
| `GET /market-data` | Market trend data | `0x01` permission | Rate limit: 10/hr |
| `GET /sentiment-analysis` | Sentiment scores | `0x01` permission | Rate limit: 5/hr |
| `GET /raw-export` | Raw data dump | **No permission** (used to demo constraint enforcement) | — |

Directives on Zone 1:
- Rate limit per endpoint (enforced at request time)
- "Must attribute source in derived outputs" (evaluated post-hoc)
- "No redistribution of raw data" (evaluated post-hoc)

### Agent B's data API

Endpoints exposed to Agent A (via Zone 2 TZ account):

| Endpoint | Description | Permission token | Directive tokens |
|----------|-------------|-----------------|-----------------|
| `GET /social-graph` | Social connection data | `0x01` permission | Rate limit: 8/hr |
| `GET /trend-signals` | Trend signal data | `0x01` permission | Rate limit: 10/hr |

Directives on Zone 2:
- Rate limit per endpoint
- "No model training on raw data" (evaluated post-hoc)
- "No caching beyond 24 hours" (evaluated post-hoc)

### Mock data format

Endpoints return JSON with plausible mock data:

```json
// GET /market-data
{
  "data": [
    { "symbol": "ETH", "trend": "bullish", "confidence": 0.82, "timestamp": 1710600000 },
    { "symbol": "BTC", "trend": "neutral", "confidence": 0.65, "timestamp": 1710600000 }
  ],
  "source": "agent-a-market-intelligence",
  "generated_at": 1710600000
}
```

## Implementation

### Package structure

```
packages/data-apis/
├── src/
│   ├── server.ts             # Express server setup
│   ├── middleware/
│   │   ├── erc8128.ts        # ERC-8128 signature verification
│   │   ├── permission.ts     # Resource token authorization
│   │   └── directive.ts      # Directive enforcement
│   ├── receipts/
│   │   └── logger.ts         # Bonfires receipt logging
│   ├── routes/
│   │   ├── market-data.ts    # Agent A's endpoints
│   │   └── social-graph.ts   # Agent B's endpoints
│   └── config.ts             # Contract addresses, Bonfires config
├── package.json
└── tsconfig.json
```

### Tech stack

- Express.js
- viem (contract reads for auth)
- Bonfires API client (receipt logging)

### Middleware chain

```typescript
app.get("/market-data",
  verifyERC8128,       // 1. verify signature → attach zoneAccount to req
  checkPermission,     // 2. check permission token → attach tokenId to req
  enforceDirectives,   // 3. check rate limits → block or pass
  serveMarketData,     // 4. serve mock data
  logReceipt           // 5. log receipt to Bonfires
)
```

### Configuration

```typescript
interface DataAPIConfig {
  // Chain
  rpcUrl: string
  chainId: number

  // Contracts
  resourceTokenRegistry: Address
  hats: Address

  // Bonfires
  bonfiresApiUrl: string
  bonfiresApiKey: string
  bonfireId: string

  // Endpoint → token ID mapping (set after deployment)
  endpointTokenMap: Record<string, bigint>
}
```

## Rate limit state

Rate limit enforcement requires counting recent receipts for a zone+resource pair. Two options:

1. **Bonfires query** — search recent episodes for the zone. Simple but adds latency per request.
2. **Local in-memory counter** — maintained by the data API server. Fast but not shared across server instances. Resets on restart.

For hackathon: use local in-memory counters. The receipts in Bonfires serve as the authoritative record for post-hoc adjudication, not for real-time enforcement.
