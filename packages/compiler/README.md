# @trust-zones/compiler

Schema compiler for the [Trust Zones](https://trustzones.xyz) protocol — compile human-readable agreement schemas into ABI-encoded proposal data for onchain submission.

## Install

```bash
npm install @trust-zones/compiler
```

## Usage

### Compile a schema document

```typescript
import { compile, createDefaultRegistry, BASE_MAINNET_CONFIG } from "@trust-zones/compiler";
import type { TZSchemaDocument } from "@trust-zones/compiler";

const schema: TZSchemaDocument = {
  zones: [
    {
      actor: { address: "0xAgentAddress", agentId: 12345 },
      permissions: [{ resource: "tweet-post", value: 10, period: 86400 }],
      responsibilities: [{ obligation: "Post about the game" }],
      directives: [{ rule: "Do not post anything else", severity: "severe" }],
      mechanisms: [{ template: "staking", params: { token: "0xUSDC", minStake: "1000000" } }],
    },
  ],
  adjudicator: { address: "0xAdjudicatorAddress" },
  deadline: Math.floor(Date.now() / 1000) + 7 * 86400,
};

const registry = createDefaultRegistry();
const proposalData = compile(schema, BASE_MAINNET_CONFIG, registry);
```

### Decompile proposal data

```typescript
import { decompile } from "@trust-zones/compiler";

const schema = decompile(proposalData, registry);
```

### Mechanism templates

8 built-in templates:

| Template | Category | What it does |
|----------|----------|-------------|
| `budget-cap` | Constraint | Limits total spend per period |
| `target-allowlist` | Constraint | Restricts callable addresses |
| `time-lock` | Constraint | Enforces delay between actions |
| `staking` | Incentive | Requires collateral deposit, slashable on violation |
| `reputation-gate` | Qualification | Requires minimum ERC-8004 score |
| `erc20-balance` | Qualification | Requires minimum token balance |
| `allowlist` | Qualification | Gates zone to selected addresses |
| `hat-wearing` | Qualification | Requires Hats Protocol role |

### Resource token encoding

```typescript
import { encodePermission, decodePermission, encodeDirective } from "@trust-zones/compiler";

const encoded = encodePermission("tweet-post", 10, 86400);
const decoded = decodePermission(encoded); // { resource, value, period }
```

## Links

- Protocol: https://trustzones.xyz
- Schema reference: https://viz-production-37ad.up.railway.app/skills/trust-zones/tz-schema-reference.md
- Contracts: https://github.com/spengrah/synthesis-hackathon/blob/main/packages/contracts/deployments.json
