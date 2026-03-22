# Track Guide: Agent Services on Base

**Sponsor:** Base

## Bounty requirements

> Build an agent service (an agent that provides services to other agents or humans) which can be easily discovered on Base and accepts payments via x402 for its services. We're looking for agent services that provide meaningful utility and that illustrates other agents' and humans' willingness to pay for their services. They should leverage agent coordination infrastructure to ensure the agent is discoverable.

## How Trust Zones meets each requirement

### Agent service providing meaningful utility

The **x402 MCP server** (`packages/x402-service/`) exposes the Trust Zones compiler and SDK as pay-per-request MCP tools. Any agent with an MCP-compatible harness can:

- `compile` — convert human-readable agreement terms into onchain proposal data
- `decompile` — convert onchain proposal data back into readable terms
- `encode` — encode SDK operations (propose, accept, activate, claim, etc.) into ready-to-submit transactions
- `decode_event` — decode contract events into structured data
- `explain` — get natural language explanations of agreement state
- `staking_info` — look up staking requirements and module addresses for an agreement
- `graphql` — query the Ponder indexer for agreement state, zones, tokens, reputation

These are the tools an agent needs to participate in any Trust Zones agreement.

### Accepts payments via x402

The MCP server is gated with `@x402/mcp`. Each tool call requires a USDC micropayment on Base via the x402 protocol. Pricing is per-tool (e.g., compile costs more than ping).

### Discoverable on Base

The service is discoverable through:
- The `trust-zones` skill (`packages/skill/trust-zones/SKILL.md`) — any Claude Code agent can install it
- The `temptation-game` skill — references the MCP server as required tooling
- The MCP server URL is published in repo docs and skills

### On Base

All contracts are deployed on Base mainnet. The x402 payment layer uses USDC on Base.

## Key paths

| What | Where |
|------|-------|
| x402 MCP server | `packages/x402-service/` |
| MCP tool definitions | `packages/x402-service/src/tools/` |
| x402 payment config | `packages/x402-service/src/server.ts` |
| Trust Zones skill (discovery) | `packages/skill/trust-zones/SKILL.md` |
| Temptation Game skill (discovery) | `packages/skill/temptation-game/SKILL.md` |
| Contracts on Base mainnet | `packages/contracts/deployments.json` (chain 8453) |
