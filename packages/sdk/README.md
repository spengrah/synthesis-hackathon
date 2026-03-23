# @trust-zones/sdk

TypeScript SDK for the [Trust Zones](https://trustzones.xyz) protocol — typed contract ABIs, payload encoders/decoders, Ponder query backend, and zone execution helpers.

## Install

```bash
npm install @trust-zones/sdk
```

## Usage

```typescript
import {
  encodePropose,
  encodeAccept,
  encodeSetUp,
  encodeActivate,
  encodeComplete,
  decodeProposalData,
  createPonderBackend,
  AgreementABI,
  AgreementRegistryABI,
} from "@trust-zones/sdk";
```

### Encode agreement inputs

```typescript
// Encode a propose input for submitInput()
const { inputId, payload } = encodePropose(compiledProposalData);

// Accept, set up, activate
const accept = encodeAccept();
const setUp = encodeSetUp();
const activate = encodeActivate();
```

### Query agreement state via Ponder

```typescript
const backend = createPonderBackend("https://ponder-production-6e39.up.railway.app/graphql");
const state = await backend.getAgreementState("0xAgreementAddress");
// { currentState, parties, trustZones, ... }
```

### Contract ABIs

All contract ABIs are exported as typed constants for use with viem:

- `AgreementABI`
- `AgreementRegistryABI`
- `TrustZoneABI`
- `HatValidatorABI`
- `ResourceTokenRegistryABI`

### Zone execution

```typescript
import { buildZoneExecute } from "@trust-zones/sdk";

// Build calldata for executing a transaction through a zone account
const { to, data, value } = buildZoneExecute(zoneAddress, targetAddress, calldata, ethValue);
```

## Links

- Protocol: https://trustzones.xyz
- Contracts: https://github.com/spengrah/synthesis-hackathon/blob/main/packages/contracts/deployments.json
- Ponder GraphQL: https://ponder-production-6e39.up.railway.app/graphql
