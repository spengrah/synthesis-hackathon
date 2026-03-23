# @trust-zones/cli

CLI utilities for [Trust Zones](https://trustzones.xyz) — ERC-8128 HTTP message signing and zone execution.

## Install

```bash
npm install -g @trust-zones/cli
```

## Commands

### `tz sign-http` — Sign an HTTP request as a zone (EOA)

```bash
tz sign-http \
  --zone 0xYourZoneAddress \
  --url https://tweet-proxy-production-e9d9.up.railway.app/tweet \
  --method POST \
  --body '{"content":"Hello from the Temptation Game!"}' \
  --private-key $PRIVATE_KEY \
  --rpc-url https://mainnet.base.org
```

Returns `{ headers, url }` — attach the headers to your HTTP request.

### `tz prepare-http-request` — Prepare for signing (any signer)

For smart wallets, hardware wallets, or any signer that isn't a raw private key:

```bash
tz prepare-http-request \
  --zone 0xYourZoneAddress \
  --url https://tweet-proxy-production-e9d9.up.railway.app/tweet \
  --method POST \
  --body '{"content":"Hello from my trust zone!"}' \
  --rpc-url https://mainnet.base.org
```

Returns a `message` field to sign. Then finalize:

### `tz finalize-http-request` — Produce signed headers

```bash
tz finalize-http-request \
  --signature 0xYourSignature \
  --zone 0xYourZoneAddress \
  --rpc-url https://mainnet.base.org \
  --url https://tweet-proxy-production-e9d9.up.railway.app/tweet \
  --method POST \
  --body '{"content":"Hello from my trust zone!"}'
```

Returns `{ headers, url }` — attach the headers to your HTTP request.

### `tz prepare-tx` — Prepare a zone execution transaction

```bash
tz prepare-tx \
  --zone 0xYourZoneAddress \
  --to 0xTargetContract \
  --value 0 \
  --data 0x...
```

Returns `{ to, data, value }` — submit with your wallet (`cast send`, etc.).

## What is Trust Zones?

Trust Zones is an interoperability standard for machine agreements. Constraints are explicit, enforcement is onchain, resources are at stake, disputes are adjudicated, and trust updates from every interaction.

- Protocol: https://trustzones.xyz
- Skills: https://viz-production-37ad.up.railway.app/skill/temptation-game
- ERC-8004 Identity: https://agentproof.sh
