import { createSignerClient, type EthHttpSigner, type SignerClient } from "@slicekit/erc8128";
import type { WalletClient, Address } from "viem";

/**
 * Create an ERC-8128 signing client for a zone account.
 * The agent's EOA signs, but the keyid points to the zone smart account.
 */
export function createZoneSignerClient(
  walletClient: WalletClient,
  zoneAddress: Address,
  chainId: number,
  opts?: { ttlSeconds?: number },
): SignerClient {
  const signer: EthHttpSigner = {
    chainId,
    address: zoneAddress,
    signMessage: async (message: Uint8Array) => {
      return walletClient.signMessage({
        account: walletClient.account!,
        message: { raw: message },
      });
    },
  };
  return createSignerClient(signer, { ttlSeconds: opts?.ttlSeconds ?? 60 });
}
