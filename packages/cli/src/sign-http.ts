import { createPublicClient, createWalletClient, http, parseAbi, concat, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { createSignerClient, type EthHttpSigner } from "@slicekit/erc8128";

const TRUST_ZONE_ABI = parseAbi([
  "function hatValidator() view returns (address)",
]);

interface SignRequestArgs {
  zone: Address;
  url: string;
  method: string;
  body?: string;
  privateKey: Hex;
  rpcUrl: string;
  ttlSeconds?: number;
}

/**
 * Sign an HTTP request as a zone account using ERC-8128.
 *
 * 1. Reads the zone's HatValidator address from the chain
 * 2. Signs the HTTP message with the agent's EOA
 * 3. Prefixes the signature with the HatValidator address (ERC-7579 routing)
 * 4. Returns the full signed request headers
 */
export async function signRequest(args: SignRequestArgs): Promise<{ headers: Record<string, string>; url: string }> {
  const transport = http(args.rpcUrl);
  const publicClient = createPublicClient({ chain: base, transport });

  // Read HatValidator address from the zone contract
  const hatValidatorAddress = await publicClient.readContract({
    address: args.zone,
    abi: TRUST_ZONE_ABI,
    functionName: "hatValidator",
  }) as Address;

  // Create the ERC-8128 signer
  const account = privateKeyToAccount(args.privateKey);
  const walletClient = createWalletClient({ account, chain: base, transport });

  const signer: EthHttpSigner = {
    chainId: base.id,
    address: args.zone,
    signMessage: async (message: Uint8Array) => {
      const sig = await walletClient.signMessage({
        account,
        message: { raw: message },
      });
      // Prefix with HatValidator address for ERC-7579 isValidSignature routing
      return concat([hatValidatorAddress, sig as Hex]);
    },
  };

  const signerClient = createSignerClient(signer, {
    ttlSeconds: args.ttlSeconds ?? 60,
  });

  // Build the request and sign it
  const fetchArgs: RequestInit = {
    method: args.method,
    headers: { "Content-Type": "application/json" },
  };
  if (args.body) {
    fetchArgs.body = args.body;
  }

  const request = new Request(args.url, fetchArgs);
  const signedRequest = await signerClient.signRequest(request);

  // Extract headers from the signed request
  const headers: Record<string, string> = {};
  signedRequest.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return { headers, url: args.url };
}

/**
 * CLI entry point for sign-request.
 */
export async function runSignHttp(argv: string[]): Promise<void> {
  const args = parseArgs(argv);

  if (!args.zone || !args.url || !args.privateKey || !args.rpcUrl) {
    console.error("Usage: trust-zones sign-http --zone <address> --url <url> --method <method> --body <json> --private-key <hex> --rpc-url <url>");
    process.exit(1);
  }

  const result = await signRequest({
    zone: args.zone as Address,
    url: args.url,
    method: args.method ?? "POST",
    body: args.body,
    privateKey: args.privateKey as Hex,
    rpcUrl: args.rpcUrl,
    ttlSeconds: args.ttlSeconds ? Number(args.ttlSeconds) : undefined,
  });

  // Output as JSON for easy consumption by agents
  console.log(JSON.stringify(result, null, 2));
}

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      result[key] = argv[i + 1];
      i++;
    }
  }
  return result;
}
