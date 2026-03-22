# Track Guide: Ethereum Web Auth / ERC-8128

**Sponsor:** Slice

## Bounty requirements

> Projects that correctly use and make the most of ERC-8128 as an authentication primitive. Looking for working demos and compliant, creative use of the unique characteristics of this new auth standard.

## How Trust Zones uses ERC-8128

ERC-8128 is a load-bearing auth primitive in Trust Zones. It's what makes the protocol work offchain — and the way we use it demonstrates the power of the standard beyond simple user-to-app authentication.

### ERC-8128 as a token-gating primitive

The fundamental power of ERC-8128 is that it recovers an **Ethereum account** from an HTTP request signature. Once you have an Ethereum account, you can check anything onchain about it — its token balances, its roles, its permissions. That's what Trust Zones does: ERC-8128 resolves the requester's identity to an Ethereum account, then the server checks that account's balance of the relevant permission token. Authentication and token-gated authorization in one flow, with no API keys, no allowlists, no centralized auth server.

The flow:

1. Agent signs an HTTP request with ERC-8128, setting `keyid` to a Trust Zone smart account address
2. Server recovers the Ethereum account from the signature — calling `isValidSignature()` (ERC-1271) on the `keyid` address, which routes through the `HatValidator` module to verify the signer wears the zone's Hats Protocol hat
3. Server now has an authenticated Ethereum account (the zone)
4. Server queries the `ResourceTokenRegistry` to check whether that account holds the relevant **permission token** (e.g., `tweet-post`)
5. Access granted only if the account has the right token

The permission tokens are the access control — minted when the agreement activates, burned when it closes. No separate authorization layer needed.

### What this demonstrates about ERC-8128

ERC-8128 is not just "SIWE for HTTP." Its power comes from the fact that resolving an HTTP request to an Ethereum account opens up the entire onchain state as an authorization backend:

- **Token-gating from a signature** — recover the account, check its token balances, done. Any ERC-20, ERC-721, ERC-1155, or ERC-6909 token can gate any API.
- **Delegated identity via smart accounts** — the `keyid` can be a smart account, so the authenticated identity is not the signer's EOA but a delegated account with its own onchain state. Trust Zones uses this so agents act *as* their zone, not as themselves.
- **Programmable auth via ERC-1271** — the smart account's validation logic decides who can sign on its behalf. Trust Zones uses hat-wearing, but it could be a multisig, a timelock, or any other condition.
- **Composable auth + authorization** — ERC-8128 handles "who is this?" (recover the account), onchain state handles "what can they do?" (check tokens/roles/balances). The two compose without either system knowing about the other.

This is the pattern Trust Zones uses for all offchain resource access. The tweet proxy is the live demo, but the same pattern works for any API, data service, or offchain resource that wants to gate access based on onchain state.

### Live demo: tweet proxy

The Temptation Game's tweet posting capability is gated by ERC-8128. The tweet proxy server verifies the agent's ERC-8128 signature, confirms the zone holds a `tweet-post` permission token, then posts to X on behalf of the zone. Without a valid ERC-8128 signature from a hat-wearing agent whose zone holds the right token, no tweets.

### CLI support

The Trust Zones CLI (`packages/cli/`) provides three commands for ERC-8128 signing:
- `sign-http` — signs a full HTTP request with ERC-8128 (EOA signer)
- `prepare-http-request` — prepares the signing payload for external/smart-account signers
- `finalize-http-request` — attaches the signature to the request

### Compliance

The implementation follows the ERC-8128 spec for HTTP message signing. The `HatValidator` module implements ERC-1271 `isValidSignature` for signature verification. The CLI generates spec-compliant ERC-8128 headers.

## Key paths

| What | Where |
|------|-------|
| HatValidator (ERC-1271 + hat check) | `packages/contracts/src/modules/HatValidator.sol` |
| CLI ERC-8128 signing commands | `packages/cli/src/index.ts` |
| ERC-8128 zone signer client | `packages/agents/src/shared/erc8128.ts` |
| Tweet proxy (ERC-8128 gated) | `packages/agents/src/counterparty/` — tweet proxy route |
| ResourceTokenRegistry (permission check) | `packages/contracts/src/ResourceTokenRegistry.sol` |
| ERC-8128 spec reference | `.ai/spec/erc8128.md` |
| Live demo (uses ERC-8128 for tweets) | `packages/skill/temptation-game/SKILL.md` — Step 4 |
