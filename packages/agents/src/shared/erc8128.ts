import { createSignerClient, type EthHttpSigner, type SignerClient } from "@slicekit/erc8128";
import { createPublicClient, http, parseAbi, concat, type WalletClient, type PublicClient, type Address, type Hex } from "viem";
import { base } from "viem/chains";

const TRUST_ZONE_ABI = parseAbi([
  "function hatValidator() view returns (address)",
]);

/**
 * Create an ERC-8128 signing client for a zone account.
 * The agent's EOA signs, but the keyid points to the zone smart account.
 *
 * Reads the zone's HatValidator address from the chain and prefixes
 * signatures for ERC-7579 isValidSignature routing automatically.
 */
export async function createZoneSignerClient(
  walletClient: WalletClient,
  zoneAddress: Address,
  chainId: number,
  opts?: { ttlSeconds?: number; publicClient?: PublicClient; rpcUrl?: string },
): Promise<SignerClient> {
  // Read HatValidator address from the zone contract
  const pub = opts?.publicClient ?? createPublicClient({
    chain: base,
    transport: http(opts?.rpcUrl ?? "http://127.0.0.1:8545"),
  });

  const hatValidatorAddress = await pub.readContract({
    address: zoneAddress,
    abi: TRUST_ZONE_ABI,
    functionName: "hatValidator",
  }) as Address;

  const signer: EthHttpSigner = {
    chainId,
    address: zoneAddress,
    signMessage: async (message: Uint8Array) => {
      const sig = await walletClient.signMessage({
        account: walletClient.account!,
        message: { raw: message },
      });
      // Prefix signature with HatValidator address for ERC-7579 routing
      return concat([hatValidatorAddress, sig as Hex]);
    },
  };
  return createSignerClient(signer, { ttlSeconds: opts?.ttlSeconds ?? 60 });
}
