import { createPublicClient, http } from "viem";
import type { TrustZonesSDKConfig } from "./types.js";
import { createReadBackend } from "./reads/index.js";
import * as encode from "./encode.js";
import * as decode from "./decode.js";
import * as zone from "./zone.js";
import * as constants from "./constants.js";
import { AgreementABI } from "./abis/Agreement.js";
import { AgreementRegistryABI } from "./abis/AgreementRegistry.js";
import { TrustZoneABI } from "./abis/TrustZone.js";
import { HatValidatorABI } from "./abis/HatValidator.js";
import { ResourceTokenRegistryABI } from "./abis/ResourceTokenRegistry.js";

// Re-export everything for direct imports
export * from "./types.js";
export * from "./constants.js";
export * from "./encode.js";
export * from "./decode.js";
export * from "./zone.js";
export { createPonderBackend } from "./reads/ponder.js";
export {
  AgreementABI,
  AgreementRegistryABI,
  TrustZoneABI,
  HatValidatorABI,
  ResourceTokenRegistryABI,
};

/**
 * Create a Trust Zones SDK instance.
 *
 * Provides encode/decode helpers, contract reads (via Ponder or RPC),
 * TZ account operations, constants, and ABIs.
 */
export function createTrustZonesSDK(config: TrustZonesSDKConfig) {
  const client = createPublicClient({
    transport: http(config.rpcUrl),
  });

  const read = createReadBackend(client, config.addresses, config.ponderUrl);

  return {
    encode: {
      encodePropose: encode.encodePropose,
      encodeCounter: encode.encodeCounter,
      encodeAccept: encode.encodeAccept,
      encodeReject: encode.encodeReject,
      encodeWithdraw: encode.encodeWithdraw,
      encodeSetUp: encode.encodeSetUp,
      encodeActivate: encode.encodeActivate,
      encodeClaim: encode.encodeClaim,
      encodeAdjudicate: encode.encodeAdjudicate,
      encodeComplete: encode.encodeComplete,
      encodeExit: encode.encodeExit,
      encodeFinalize: encode.encodeFinalize,
    },
    decode: {
      decodeProposalData: decode.decodeProposalData,
      decodeAdjudicationActions: decode.decodeAdjudicationActions,
      decodeClaim: decode.decodeClaim,
      decodeFeedback: decode.decodeFeedback,
      decodeState: decode.decodeState,
    },
    read,
    zone: {
      buildZoneExecute: zone.buildZoneExecute,
      signAsZone: zone.signAsZone,
    },
    constants,
    abis: {
      AgreementABI,
      AgreementRegistryABI,
      TrustZoneABI,
      HatValidatorABI,
      ResourceTokenRegistryABI,
    },
    client,
  };
}
