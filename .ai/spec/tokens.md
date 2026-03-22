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
ID = (counter << 8) | typePrefix
```

- `counter` is per-type, auto-incremented by the registry on each `mint()`
- `typePrefix` is the low byte (0x01, 0x02, 0x03)
- No namespace concept — IDs are simply `(counter << 8) | typePrefix`

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
function mint(address to, uint8 tokenType, bytes calldata metadata) external returns (uint256 id);
```

- Restricted to authorized minters (agreement contracts registered by AgreementRegistry)
- `tokenType` is the type prefix (0x01, 0x02, 0x03)
- ID is auto-generated: `(++counter << 8) | typePrefix`
- Reverts if `balanceOf(to, id) > 0` (max balance = 1)
- Sets creator and metadata permanently on mint

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

ABI: `(string resource, uint256 value, bytes32 period, uint256 expiry, bytes params)`

```json
{
  "resource": "string — resource identifier (e.g., 'tweet-post', 'vault-withdraw', endpoint path)",
  "value": "uint256 — numeric value (rate limit count, max withdrawal amount, etc.)",
  "period": "bytes32 — time period or qualifier ('hour', 'day', 'total'). Packed as bytes32.",
  "expiry": "uint256 — unix timestamp, 0 = no expiry",
  "params": "bytes — freeform encoded parameters (e.g., abi.encode(address temptation) for vault-withdraw)"
}
```

The format is intentionally generic: `resource` names the capability, `value` + `period` quantify it, `expiry` bounds it in time, and `params` carries any additional data the resource provider needs to decode. Different permission consumers interpret these fields differently:

| Resource | value | period | params |
|----------|-------|--------|--------|
| `tweet-post` | 10 (tweets) | `"day"` | — |
| `vault-withdraw` | maxAmount (wei) | `"total"` | `abi.encode(address temptation)` |
| `data-api-read` | 100 (requests) | `"hour"` | — |

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
// ERC-6909 standard (with leading non-indexed caller per ERC-6909)
event Transfer(address caller, address indexed sender, address indexed receiver, uint256 indexed id, uint256 amount);

// Custom
event TokenCreated(uint256 indexed tokenId, address indexed creator, uint8 tokenType, bytes metadata);
event MinterRegistered(address indexed minter);
```

## Errors

```solidity
error NotAuthorizedMinter();
error NotTokenCreator();
error NotOwner();
error BalanceExceedsMax();
error InsufficientBalance(address from, uint256 id);
error InvalidTokenType(uint8 tokenType);
error ApprovalsDisabled();
```

## Getters

```solidity
/// @notice Returns the last minted ID for a given token type
function lastId(uint8 tokenType) external view returns (uint256);
```

## Helper functions

```solidity
/// @notice Extract the token type from a token ID
function tokenType(uint256 id) external pure returns (uint8);

/// @notice Check if a token ID is a Permission
function isPermission(uint256 id) external pure returns (bool);

/// @notice Check if a token ID is a Responsibility
function isResponsibility(uint256 id) external pure returns (bool);

/// @notice Check if a token ID is a Directive
function isDirective(uint256 id) external pure returns (bool);
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
