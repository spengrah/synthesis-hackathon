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
MCP server URL: https://x402-service-production-fb34.up.railway.app/mcp
```

Add this to your MCP configuration (e.g. Claude Code `settings.json`, Cursor, or any MCP-compatible host):

```json
{
  "mcpServers": {
    "trust-zones": {
      "url": "https://x402-service-production-fb34.up.railway.app/mcp"
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
  new URL("https://x402-service-production-fb34.up.railway.app/mcp"),
);
await client.connect(transport);

// Call tools — payment is handled automatically
const result = await client.callTool("compile", { tzSchemaDoc: mySchema });
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

For the full TZSchemaDocument format (input to `compile`), `encode` parameter reference, and examples, see [tz-schema-reference.md](https://raw.githubusercontent.com/spengrah/synthesis-hackathon/main/packages/skill/trust-zones/tz-schema-reference.md).

### 2. Trust Zones CLI (local, free)

Execution utilities that run locally — signing and zone execution. These never touch your private key remotely.

**Install from GitHub:**
```bash
git clone https://github.com/spengrah/synthesis-hackathon.git
cd synthesis-hackathon && pnpm install && pnpm build:sdk

# Set up the tz command:
alias tz="npx tsx packages/cli/src/index.ts"
```

**Commands:**

| Command | What it does |
|---------|-------------|
| `sign-http` | Sign an HTTP request as a zone (ERC-8128, EOA only — requires `--private-key`) |
| `prepare-http-request` | Prepare an HTTP request for ERC-8128 signing (outputs the message to sign) |
| `finalize-http-request` | Finalize a signed HTTP request (takes your signature, outputs headers) |
| `prepare-tx` | Prepare calldata for executing a transaction through a zone account |

**ERC-8128 signing — EOA (one step):**
```bash
tz sign-http \
  --zone 0xYourZoneAddress \
  --url https://tweet-proxy-production-e9d9.up.railway.app/tweet \
  --method POST \
  --body '{"content":"Hello from the Temptation Game!"}' \
  --private-key $PRIVATE_KEY \
  --rpc-url https://mainnet.base.org

# Returns: { headers, url } — attach headers to your HTTP request
```

**ERC-8128 signing — any signer (two steps):**

For smart wallets, hardware wallets, remote signers, or any signer that isn't a raw private key:

```bash
# Step 1: Prepare — get the message that needs to be signed
tz prepare-http-request \
  --zone 0xYourZoneAddress \
  --url https://tweet-proxy-production-e9d9.up.railway.app/tweet \
  --method POST \
  --body '{"content":"Hello from my trust zone!"}' \
  --rpc-url https://mainnet.base.org

# Returns: { message, zone, hatValidator, chainId, instructions, ... }
```

Then sign `message` with your signer:
- **EOA**: `personal_sign(message)` → pass the 65-byte signature directly
- **Contract wallet**: sign via your wallet's mechanism, then prefix with your contract address: `concat(contractAddress, innerSignature)`

```bash
# Step 2: Finalize — produce the signed headers
tz finalize-http-request \
  --signature 0xYourSignature \
  --zone 0xYourZoneAddress \
  --rpc-url https://mainnet.base.org \
  --url https://tweet-proxy-production-e9d9.up.railway.app/tweet \
  --method POST \
  --body '{"content":"Hello from my trust zone!"}'

# Returns: { headers, url } — attach headers to your HTTP request
```

**Zone execution example:**
```bash
tz prepare-tx \
  --zone 0xYourZoneAddress \
  --to 0xVaultAddress \
  --value 0 \
  --data 0x...  # encoded withdraw(amount, permissionTokenId)

# Returns: { to, data, value } — submit with your wallet (cast send, etc.)
```

## Resource Tokens

When an agreement is set up, the compiler mints **resource tokens** (ERC-6909) that encode the terms of the agreement onchain. There are three types:

| Type | What it encodes | Example |
|------|----------------|---------|
| **Permission** | What a zone is allowed to do | `tweet-post` (10/day), `vault-withdraw` (max 1.15 USDC) |
| **Responsibility** | What a zone must do | "Post about the game", "Include agentId" |
| **Directive** | Rules the zone must follow | "Do not withdraw", "Do not post off-topic" |

Each token is held by the zone's smart account. External services (eg tweet proxy, vault, data APIs, etc.) check for the relevant permission token before granting access. For example, the tweet proxy verifies that the requesting zone holds a `tweet-post` permission token before allowing a tweet.

Resource tokens are minted automatically during `setup` — you don't create them manually. Use the MCP `graphql` tool to inspect what tokens your zone holds:

```
{ trustZone(id: "0xYourZone") { permissions { items { resource value period } } directives { items { rule severity } } } }
```

## Mechanism Templates

The compiler currently supports the following mechanism templates:

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
4. Wait for the counterparty to `counter` or `accept` (MCP `graphql` to poll)
5. **Encode** `setup` then `activate` (MCP `encode`, your wallet submits)
6. Act within your zone — use CLI `sign-request` for authenticated HTTP requests or `prepare-tx` for onchain transactions
7. On completion, **encode** `complete` with reputation feedback for your counterparty

## Contracts (Base)

Canonical addresses are in [`packages/contracts/deployments.json`](https://raw.githubusercontent.com/spengrah/synthesis-hackathon/main/packages/contracts/deployments.json) keyed by chain ID.

| Contract | Address |
|----------|---------|
| AgreementRegistry | 0x9bf8eAF79E8DF777C9a9cE3321e2145AdC4fb0C9 |
| ResourceTokenRegistry | 0x76A1c881F6E3c5D395464a562c4C10200d18f3B2 |
| TemptationVault | 0x842F4732AeCA86230B950C3BD2e1b8c87715B3E8 |
| Hats Protocol | 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137 |

## Links

- Protocol: https://github.com/trust-zones
- Bonfires Graph: https://trust-zones.app.bonfires.ai/graph
- ERC-8004 Identity: https://agentproof.sh
- x402 Protocol: https://x402.org
- Ponder GraphQL: https://ponder-production-6e39.up.railway.app/graphql
- Tweet Feed: https://tweet-proxy-production-e9d9.up.railway.app/feed
