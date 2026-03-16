# Resource Token Registry Spec

## Overview

Single ERC-6909 contract holding three typed tokens. Non-transferable (except by creator). Max balance of 1 per holder per token ID. Immutable onchain metadata set on mint. Resource tokens are delegated assets — the holder does not control them; the creator (agreement contract) retains transfer and burn authority.

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

## ERC-6909 interface (with restrictions)

Standard ERC-6909 read functions:
- `balanceOf(address owner, uint256 id) → uint256` (always 0 or 1)
- `allowance(address owner, address spender, uint256 id) → uint256`
- `isOperator(address owner, address operator) → bool`

Transfer functions (restricted — only callable by token creator):
- `transfer(address receiver, uint256 id, uint256 amount)` — reverts unless `msg.sender == creator[id]`
- `transferFrom(address sender, address receiver, uint256 id, uint256 amount)` — reverts unless `msg.sender == creator[id]`

Approval functions (disabled — holders have no transfer authority):
- `approve` / `setOperator` — revert unconditionally

## Minting

```solidity
function mint(address to, uint256 id, bytes calldata metadata) external;
```

- Restricted to authorized minters (agreement contracts registered by AgreementRegistry)
- Reverts if `balanceOf(to, id) > 0` (max balance = 1)
- First mint of a token ID sets its creator and metadata permanently
- Subsequent mints of the same token ID to other addresses use the existing metadata (no `metadata` param needed, or ignored)

```solidity
function burn(address from, uint256 id) external;
```

- Only callable by creator of token ID (the agreement contract that minted it)

## Minter registration

```solidity
function registerMinter(address minter) external;  // only callable by registry owner
function isMinter(address minter) external view returns (bool);
```

AgreementRegistry calls `registerMinter(agreementAddress)` when deploying a new agreement.

## Metadata

```solidity
function tokenMetadata(uint256 id) external view returns (bytes memory);
```

- Immutable — set once on first `mint()`, never changed
- Read-only accessor
- ABI-encoded onchain for structured reading by contracts/adjudicators

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

## Events

```solidity
// ERC-6909 standard
event Transfer(address indexed sender, address indexed receiver, uint256 indexed id, uint256 amount);
event OperatorSet(address indexed owner, address indexed operator, bool approved);

// Custom
event TokenCreated(uint256 indexed tokenId, address indexed creator, bytes metadata);
event MinterRegistered(address indexed minter);
```

## State

```solidity
mapping(uint256 id => address) public creator;          // first minter / agreement contract
mapping(uint256 id => bytes) internal _metadata;         // immutable after first mint
mapping(address => bool) public isMinter;                // authorized minters
address public owner;                                     // registry owner (AgreementRegistry or deployer)
```

## Properties

- Tokens are independent artifacts — reusable across multiple trust zones and agreements
- **Non-transferable** except by creator (the agreement contract that minted them)
- **Max balance = 1** per holder per token ID
- **Holders have no authority** — cannot transfer, approve, or modify
- **Metadata is immutable** — set once on first mint
- The TZ account's complete token inventory = full scope of the zone
- No receiver callbacks (ERC-6909 feature) — cheap transfers to contract addresses
