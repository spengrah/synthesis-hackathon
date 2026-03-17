import {
  encodeFunctionData,
  type Address,
  type Hex,
  type WalletClient,
} from "viem";
import type { ERC8128SignedRequest } from "./types.js";

// Minimal TrustZone execute ABI (convenience overload)
const tzExecuteAbi = [
  {
    type: "function",
    name: "execute",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

/**
 * Build a transaction request to call execute() on a TZ account.
 * The caller (hat-wearer) sends this transaction directly.
 */
export function buildZoneExecute(
  zoneAccount: Address,
  target: Address,
  value: bigint,
  data: Hex,
): { to: Address; data: Hex; value: bigint } {
  const calldata = encodeFunctionData({
    abi: tzExecuteAbi,
    functionName: "execute",
    args: [target, value, data],
  });

  return {
    to: zoneAccount,
    data: calldata,
    value: 0n, // msg.value to the TZ account itself (not forwarded value)
  };
}

/**
 * Build an ERC-8128 signed request as a TZ account.
 *
 * ERC-8128 lets offchain services verify that a request comes from a
 * specific smart account by checking isValidSignature(). The agent signs
 * with their EOA key, and the server verifies via the TZ account's
 * HatValidator (which checks hat-wearing).
 */
export async function signAsZone(
  walletClient: WalletClient,
  zoneAccount: Address,
  chainId: number,
  message: Hex,
): Promise<ERC8128SignedRequest> {
  if (!walletClient.account) {
    throw new Error("WalletClient must have an account");
  }

  const signature = await walletClient.signMessage({
    account: walletClient.account,
    message: { raw: message },
  });

  return {
    keyId: `erc8128:${chainId}:${zoneAccount}`,
    signature: signature as Hex,
    message,
  };
}
