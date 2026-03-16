# Resource Token Registry Spec

## Overview

Single ERC-6909 contract holding three typed tokens. All types held as balances by TZ accounts. Onchain metadata per token ID.

## Token types

| Type prefix | Name | Meaning | Checked by |
|-------------|------|---------|------------|
| `0x01` | Permission | "What you CAN do" — access to a resource | Resource providers (ERC-8128 servers, contracts) |
| `0x02` | Responsibility | "What you MUST do" — rivalrous obligation | Adjudicators (fulfillment evaluation) |
| `0x03` | Directive | "What you SHOULD/SHOULDN'T do" — behavioral rules, soft prohibitions | Adjudicators (compliance) + resource providers (dynamic rule enforcement) |

## Token ID encoding

```
| bits  | field                          |
|-------|--------------------------------|
| 0-7   | type (0x01/0x02/0x03)          |
| 8-71  | namespace / category (64 bits) |
| 72+   | specific identifier            |
```

Token IDs are self-describing — type is parseable from the ID without storage reads.

## ERC-6909 interface

Standard ERC-6909 functions:
- `transfer(address receiver, uint256 id, uint256 amount)`
- `transferFrom(address sender, address receiver, uint256 id, uint256 amount)`
- `approve(address spender, uint256 id, uint256 amount)`
- `setOperator(address operator, bool approved)`
- `balanceOf(address owner, uint256 id) → uint256`
- `allowance(address owner, address spender, uint256 id) → uint256`
- `isOperator(address owner, address operator) → bool`

## Custom extensions

### Minting

```solidity
function mint(address to, uint256 id, uint256 amount, bytes calldata metadata) external;
```

Open minting (anyone can mint). The token ID prefix determines the type. Metadata is stored onchain.

### Metadata

```solidity
function tokenMetadata(uint256 id) external view returns (bytes memory);
function setTokenMetadata(uint256 id, bytes calldata metadata) external;
```

- Onchain metadata per token ID (for demo simplicity)
- `setTokenMetadata` restricted to token creator (first minter) or current holder
- Metadata format is type-specific (see below)

## Metadata schemas (per type)

### Permission (0x01)
```json
{
  "resource": "string — resource identifier (e.g., endpoint path, contract address)",
  "rules": {
    "rateLimit": { "value": 10, "period": "hour" },
    "expiry": 1234567890,
    "purpose": "string — intended use"
  }
}
```

### Responsibility (0x02)
```json
{
  "obligation": "string — description of what must be done",
  "criteria": "string — success criteria",
  "deadline": 1234567890
}
```

### Directive (0x03)
```json
{
  "rule": "string — the behavioral rule",
  "severity": "minor | moderate | severe",
  "params": {}
}
```

Metadata is ABI-encoded onchain for structured reading by contracts/adjudicators.

## Events

```solidity
// ERC-6909 standard
event Transfer(address indexed sender, address indexed receiver, uint256 indexed id, uint256 amount);
event Approval(address indexed owner, address indexed spender, uint256 indexed id, uint256 amount);
event OperatorSet(address indexed owner, address indexed operator, bool approved);

// Custom
event TokenMetadataSet(uint256 indexed tokenId, bytes metadata);
```

## Properties

- Tokens are independent artifacts — reusable across multiple trust zones and agreements
- All three types held as balances by TZ accounts
- The TZ account's complete token inventory = full scope of the zone
- Per-ID allowances (ERC-6909 feature) allow granular authorization
- No receiver callbacks (ERC-6909 feature) — cheap transfers to contract addresses
