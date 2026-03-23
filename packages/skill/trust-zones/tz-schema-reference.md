# TZSchemaDocument Reference

This is the input format for the `compile` MCP tool. Pass this as the `tzSchemaDoc` argument.

## TypeScript Types

```typescript
interface TZSchemaDocument {
  version: string;           // Always "0.1.0"
  termsDocUri?: string;      // Optional URI to human-readable terms
  zones: ZoneSchema[];       // One per party (typically 2)
  adjudicator: { address: string } | { template: string };
  deadline: number;          // Unix timestamp
}

interface ZoneSchema {
  actor: {
    address: string;         // Party's EOA address (0x...)
    agentId: number;         // ERC-8004 identity token ID
  };
  maxActors: number;         // Usually 1
  description: string;       // Human-readable zone name
  permissions?: PermissionEntry[];
  responsibilities?: ResponsibilityEntry[];
  directives?: DirectiveEntry[];
  incentives?: MechanismEntry[];     // e.g. staking
  constraints?: MechanismEntry[];    // e.g. budget-cap, target-allowlist
  eligibilities?: MechanismEntry[];  // e.g. erc20-balance, allowlist
}

interface PermissionEntry {
  resource: string;          // e.g. "tweet-post", "vault-withdraw", "data-api-read"
  value?: number | string;   // Rate limit count, max amount, etc.
  period?: string;           // "hour", "day", "total"
  expiry?: number;           // Unix timestamp
  params?: object;           // Resource-specific params (e.g. { temptation: "0xVaultAddr" })
}

interface ResponsibilityEntry {
  obligation: string;        // What the party must do
  criteria?: string;         // How compliance is measured
  deadline?: number;         // Unix timestamp
}

interface DirectiveEntry {
  rule: string;              // What the party must NOT do (or must do)
  severity?: string;         // "severe", "low"
  params?: object;
}

interface MechanismEntry {
  template: string;          // Template name (see Mechanism Templates in SKILL.md)
  params: object;            // Template-specific parameters
}
```

## Example: Two-Zone Agreement

```json
{
  "version": "0.1.0",
  "termsDocUri": "data:application/json,%7B%22title%22%3A%22My%20Agreement%22%7D",
  "zones": [
    {
      "actor": { "address": "0xYourAddress", "agentId": 42 },
      "maxActors": 1,
      "description": "Zone A — Requester",
      "permissions": [
        { "resource": "tweet-post", "value": 10, "period": "day" },
        { "resource": "data-api-read", "value": 100, "period": "hour" }
      ],
      "responsibilities": [
        { "obligation": "Post about the agreement" }
      ],
      "directives": [
        { "rule": "Do not redistribute data", "severity": "severe" }
      ],
      "incentives": [
        {
          "template": "staking",
          "params": {
            "token": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            "minStake": "1000000",
            "cooldownPeriod": 86400
          }
        }
      ]
    },
    {
      "actor": { "address": "0xCounterpartyAddress", "agentId": 99 },
      "maxActors": 1,
      "description": "Zone B — Provider",
      "permissions": [
        { "resource": "data-api-read", "value": 50, "period": "hour" }
      ],
      "directives": [
        { "rule": "Do not modify data without notice", "severity": "severe" }
      ]
    }
  ],
  "adjudicator": { "address": "0x0000000000000000000000000000000000000000" },
  "deadline": 1774900000
}
```

## Example: Temptation Game Schema (Bare Proposal)

A bare proposal is a minimal schema with just the actor addresses — the counterparty fills in the full terms via counter-proposal.

```json
{
  "version": "0.1.0",
  "termsDocUri": "data:application/json,%7B%22message%22%3A%22I%20want%20to%20play%22%7D",
  "zones": [
    {
      "actor": { "address": "0xYourAddress", "agentId": 42 },
      "maxActors": 1,
      "description": "Temptee"
    }
  ],
  "adjudicator": { "address": "0x0000000000000000000000000000000000000000" },
  "deadline": 1774900000
}
```

## MCP `encode` Tool — inputId Reference

| inputId | params required | Notes |
|---------|----------------|-------|
| `propose` | `{ proposalData: "0x..." }` | The hex output from `compile` |
| `counter` | `{ proposalData: "0x..." }` | Counter-proposal (also from `compile`) |
| `accept` | `{ proposalData: "0x..." }` | Accepts — pass the counter-proposal's `rawProposalData` |
| `reject` | none | Rejects and closes |
| `withdraw` | none | Withdraws from negotiation |
| `setup` | none | Deploys zones and eligibility modules |
| `activate` | none | Mints zone hats, activates agreement |
| `claim` | `{ mechanismIndex: 0, evidence: "0x..." }` | File a violation claim |
| `adjudicate` | `{ claimId: 0, actions: [...] }` | Deliver verdict |
| `complete` | `{ feedbackURI: "ipfs://...", feedbackHash: "0x..." }` | Signal completion with reputation feedback |
| `exit` | `{ feedbackURI: "ipfs://...", feedbackHash: "0x..." }` | Exit with feedback |
| `finalize` | none | Finalize after all parties complete/exit |

## Exact Tool Call Examples

Use these exact argument shapes. Do not add extra fields — the tools will reject unknown arguments.

### compile

```json
MCP call: compile({
  "tzSchemaDoc": { ... }   // TZSchemaDocument object (see examples above)
})

Returns: { "proposalData": "0x...", "termsHash": "0x..." }
```

### encode — accept (requires counter-proposal data)

```json
MCP call: encode({
  "inputId": "accept",
  "proposalData": "0x..."   // rawProposalData from the counter-proposal (query via graphql)
})

Returns: { "inputId": "0x...", "payload": "0x...", "calldata": "0x..." }
```

To get the rawProposalData, query Ponder:
```
{ agreement(id: "0xYourAgreement") { proposals(orderBy: "sequence", orderDirection: "desc", limit: 1) { items { rawProposalData } } } }
```

### encode — parameterless actions

```json
MCP call: encode({ "inputId": "setup" })
MCP call: encode({ "inputId": "activate" })
MCP call: encode({ "inputId": "finalize" })

Returns: { "inputId": "0x...", "payload": "0x...", "calldata": "0x..." }
```

### encode — with params

```json
MCP call: encode({
  "inputId": "complete",
  "params": { "feedbackURI": "ipfs://Qm...", "feedbackHash": "0xabcd..." }
})

Returns: { "inputId": "0x...", "payload": "0x...", "calldata": "0x..." }
```

### decompile

```json
MCP call: decompile({ "proposalData": "0x..." })

Returns: { "tzSchemaDoc": { ... } }    // TZSchemaDocument object
```

### graphql

```json
MCP call: graphql({
  "query": "{ agreement(id: \"0xagreementaddress\") { state trustZones { items { id actor { address } } } } }"
})

Returns: { "data": { "agreement": { ... } } }
```

### staking_info

```json
MCP call: staking_info({
  "agreement": "0xAgreementAddress",       // agreement contract address
  "agentAddress": "0xYourEOAAddress"       // your EOA, NOT your zone address
})

Returns: {
  "zoneAddress": "0x...",
  "eligibilityModule": "0x...",
  "stakeToken": "0x...",
  "instructions": "..."
}
```

## Wallet Transactions

The `encode` tool returns `inputId` and `payload` (both hex). Submit them as follows:

- **Creating a new agreement**: call `createAgreement(counterpartyAddress, proposalPayload)` on the **AgreementRegistry** contract. `proposalPayload` is the `payload` from `encode({ inputId: "propose", params: { proposalData } })`.
- **All other inputs** (accept, setup, activate, etc.): call `submitInput(inputId, payload)` on the **Agreement** contract (the address returned from createAgreement). Use the `inputId` and `payload` from the `encode` result directly.
