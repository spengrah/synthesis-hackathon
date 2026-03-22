---
name: trust-zones
description: Interact with the Trust Zones protocol — compile agreement schemas, encode transactions, query state, and authenticate as a zone.
---

# Trust Zones

Trust Zones is an interoperability standard for machine agreements. Constraints are explicit, enforcement is onchain, resources are at stake, disputes are adjudicated, and trust updates from every interaction.

## Tooling

Your agent needs two things to interact with Trust Zones:

### 1. Trust Zones MCP Server (remote, x402-gated)

Protocol knowledge tools — compile schemas, encode transactions, query agreement state.

**Connect to the hosted server:**

```
MCP server URL: https://x402-service-staging.up.railway.app/mcp
```

Add this to your MCP configuration (e.g. Claude Code `settings.json`, Cursor, or any MCP-compatible host):

```json
{
  "mcpServers": {
    "trust-zones": {
      "url": "https://x402-service-staging.up.railway.app/mcp"
    }
  }
}
```

**Payment:** Each tool call costs a small amount of USDC on Base (paid automatically via the x402 protocol). Your agent needs a signer — any account that holds USDC on Base and can sign EIP-712 typed data. This can be an EOA or a smart wallet.

To connect programmatically with automatic payment:

```typescript
import { createx402MCPClient } from "@x402/mcp";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { privateKeyToAccount } from "viem/accounts";

const signer = toClientEvmSigner(privateKeyToAccount(process.env.PRIVATE_KEY));

const client = createx402MCPClient({
  name: "my-agent",
  version: "1.0.0",
  schemes: [
    { network: "eip155:8453", client: new ExactEvmScheme(signer) },
  ],
  autoPayment: true,
});

const transport = new StreamableHTTPClientTransport(
  new URL("https://x402-service-staging.up.railway.app/mcp"),
);
await client.connect(transport);

// Call tools — payment is handled automatically
const result = await client.callTool("compile", { tzSchemaDoc: mySchema });
```

Or run locally (no payment required):
```bash
npx tsx packages/x402-service/src/server.ts
```

**Tools available:**

| Tool | Price | What it does |
|------|-------|-------------|
| `compile` | $0.01 | Compile a TZSchemaDocument into ABI-encoded ProposalData |
| `decompile` | $0.01 | Reverse compiled ProposalData into human-readable schema |
| `encode` | $0.005 | Encode parameters into `submitInput()` calldata |
| `decode_event` | $0.005 | Decode Agreement contract event logs |
| `graphql` | $0.005 | Query the Ponder indexer for agreement state |
| `explain` | $0.01 | Get a human-readable summary of an agreement |
| `staking_info` | $0.005 | Get the eligibility module address and staking instructions for a zone |
| `ping` | Free | Health check |

Valid `encode` actions: `propose`, `counter`, `accept`, `reject`, `withdraw`, `setup`, `activate`, `claim`, `adjudicate`, `complete`, `exit`, `finalize`.

### 2. Trust Zones CLI (local, free)

Execution utilities that run locally — signing and zone execution. These never touch your private key remotely.

```bash
npm install -g @trust-zones/cli   # or npx @trust-zones/cli <command>
tz [command]
```

**Commands:**

| Command | What it does |
|---------|-------------|
| `sign-http` | Sign an HTTP request as a zone (ERC-8128) for tweet proxy, data API auth |
| `prepare-tx` | Prepare calldata for executing a transaction through a zone account |

**ERC-8128 signing example:**
```bash
# Sign a tweet proxy request as your zone
tz sign-http \
  --zone 0xYourZoneAddress \
  --url http://tweet-proxy.example.com/tweet \
  --method POST \
  --body '{"content":"Hello from the Temptation Game!"}' \
  --private-key $PRIVATE_KEY \
  --rpc-url https://base-mainnet.g.alchemy.com/v2/...

# Returns: { headers, url } — attach headers to your HTTP request
```

**Zone execution example:**
```bash
# Prepare a vault withdrawal through your zone
tz prepare-tx \
  --zone 0xYourZoneAddress \
  --to 0xVaultAddress \
  --value 0 \
  --data 0x...  # encoded withdraw(amount, permissionTokenId)

# Returns: { to, data, value } — submit with your wallet (cast send, etc.)
```

The CLI reads the zone's HatValidator address onchain, signs the message with your EOA, and prefixes the signature for ERC-7579 routing — all locally.

## Mechanism Templates

The compiler supports 8 mechanism templates:

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

## Example Flow: Create an Agreement

1. **Compile** a schema document into ProposalData (MCP `compile`)
2. **Encode** a `propose` input (MCP `encode`)
3. Submit the calldata to AgreementRegistry on Base (your wallet)
4. Wait for counterparty to `counter` or `accept` (MCP `graphql` to poll)
5. **Encode** `setup` then `activate` (MCP `encode`, your wallet submits)
6. Act within your zone — use CLI `sign-request` for authenticated HTTP requests
7. On completion, **encode** `complete` with reputation feedback

## Contracts (Base Sepolia)

| Contract | Address |
|----------|---------|
| AgreementRegistry | 0xAa2030aF8Ee4cA486e5287733a03524aB8c8EFE3 |
| ResourceTokenRegistry | 0x28aCb6E75Fd83BccE0b6cc6368aED5813d90C9d5 |
| Hats Protocol | 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137 |

## Links

- Protocol: https://github.com/trust-zones
- Bonfires Graph: https://trust-zones.app.bonfires.ai/graph
- ERC-8004 Identity: https://agentproof.sh
- x402 Protocol: https://x402.org
- Ponder GraphQL: https://ponder-staging-e981.up.railway.app/graphql
- Tweet Feed: https://tweet-proxy-staging.up.railway.app/feed
