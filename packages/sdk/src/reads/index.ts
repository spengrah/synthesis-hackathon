import type { Address, PublicClient } from "viem";
import type { ContractAddresses, ReadBackend } from "../types.js";
import { createRpcBackend } from "./rpc.js";
import { createPonderBackend } from "./ponder.js";

/**
 * Create a read backend that dispatches to Ponder (if configured) or falls
 * back to direct RPC. For simple on-chain checks (isHatWearer,
 * getResourceTokenBalance), always uses RPC.
 */
export function createReadBackend(
  client: PublicClient,
  addresses: ContractAddresses,
  ponderUrl?: string,
): ReadBackend {
  const rpc = createRpcBackend(client, addresses);

  if (!ponderUrl) {
    return rpc;
  }

  const ponder = createPonderBackend(ponderUrl);

  return {
    getAgreementState: (a: Address) => ponder.getAgreementState(a),
    getZoneDetails: (z: Address) => ponder.getZoneDetails(z),
    getZonePermissions: (z: Address) => ponder.getZonePermissions(z),
    getZoneDirectives: (z: Address) => ponder.getZoneDirectives(z),
    getProposalHistory: (a: Address) => ponder.getProposalHistory(a),
    getClaims: (a: Address) => ponder.getClaims(a),
    // Simple checks always go through RPC
    isHatWearer: (w: Address, h: bigint) => rpc.isHatWearer(w, h),
    getResourceTokenBalance: (h: Address, t: bigint) =>
      rpc.getResourceTokenBalance(h, t),
  };
}
