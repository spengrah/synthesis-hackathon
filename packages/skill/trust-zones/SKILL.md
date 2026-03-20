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

Connect to the hosted server:
```
MCP server URL: TODO (hosted endpoint)
```

Or run locally (no payment required):
```bash
npx tsx packages/x402-service/src/server.ts
```

**Tools available:**

| Tool | What it does |
|------|-------------|
| `compile` | Compile a TZSchemaDocument into ABI-encoded ProposalData |
| `decompile` | Reverse compiled ProposalData into human-readable schema |
| `encode` | Encode parameters into `submitInput()` calldata |
| `decode_event` | Decode Agreement contract event logs |
| `graphql` | Query the Ponder indexer for agreement state |
| `explain` | Get a human-readable summary of an agreement |
| `staking_info` | Get the eligibility module address and staking instructions for a zone |
| `ping` | Health check |

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

## Contracts (Base Mainnet)

| Contract | Address |
|----------|---------|
| AgreementRegistry | TODO |
| ResourceTokenRegistry | TODO |
| Hats Protocol | 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137 |

## Links

- Protocol: https://github.com/trust-zones
- Bonfires Graph: https://trust-zones.app.bonfires.ai/graph
- ERC-8004 Identity: https://agentproof.sh
- x402 Protocol: https://x402.org
- Ponder GraphQL: TODO
