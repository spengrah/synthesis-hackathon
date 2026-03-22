import { createPublicClient, http, parseAbi, concat, toHex, type Address, type Hex } from "viem";
import { base, baseSepolia } from "viem/chains";
import { signRequest as erc8128SignRequest, type EthHttpSigner } from "@slicekit/erc8128";

const TRUST_ZONE_ABI = parseAbi([
  "function hatValidator() view returns (address)",
]);

interface PrepareArgs {
  zone: Address;
  url: string;
  method: string;
  body?: string;
  rpcUrl: string;
  chainId?: number;
  ttlSeconds?: number;
}

interface PrepareResult {
  /** The raw bytes that must be signed (hex-encoded). Sign this with your signer. */
  message: Hex;
  /** The zone account address (used as ERC-8128 keyid). */
  zone: Address;
  /** The HatValidator address (must be prefixed to the signature). */
  hatValidator: Address;
  /** The chain ID. */
  chainId: number;
  /** The target URL. */
  url: string;
  /** The HTTP method. */
  method: string;
  /** The request body (if any). */
  body?: string;
  /** TTL in seconds. */
  ttlSeconds: number;
  /** Instructions for the agent. */
  instructions: string;
}

interface FinalizeArgs {
  /** The signature from the agent's signer (hex-encoded, without HatValidator prefix). */
  signature: Hex;
  /** The zone address. */
  zone: Address;
  /** The chain ID. */
  chainId: number;
  /** RPC URL for reading the zone's HatValidator address. */
  rpcUrl: string;
  /** The target URL. */
  url: string;
  /** The HTTP method. */
  method: string;
  /** The request body (if any). */
  body?: string;
  /** TTL in seconds. */
  ttlSeconds: number;
}

/**
 * Phase 1: Prepare an HTTP request for ERC-8128 signing.
 *
 * Returns the message that needs to be signed and metadata needed to finalize.
 * The agent signs the message with whatever signer they have, then calls
 * finalizeHttpRequest with the signature.
 */
export async function prepareHttpRequest(args: PrepareArgs): Promise<PrepareResult> {
  const chainId = args.chainId ?? 8453;
  const chain = chainId === 84532 ? baseSepolia : base;
  const transport = http(args.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const ttlSeconds = args.ttlSeconds ?? 60;

  // Read HatValidator address from the zone contract
  const hatValidator = await publicClient.readContract({
    address: args.zone,
    abi: TRUST_ZONE_ABI,
    functionName: "hatValidator",
  }) as Address;

  // Capture the message that ERC-8128 would sign by using a spy signer
  let capturedMessage: Uint8Array | null = null;

  const spySigner: EthHttpSigner = {
    chainId,
    address: args.zone,
    signMessage: async (message: Uint8Array) => {
      capturedMessage = message;
      // Return a dummy signature — we just need the message
      return "0x" + "00".repeat(65) as Hex;
    },
  };

  const fetchArgs: RequestInit = {
    method: args.method,
    headers: { "Content-Type": "application/json" },
  };
  if (args.body) {
    fetchArgs.body = args.body;
  }

  const request = new Request(args.url, fetchArgs);
  // This calls spySigner.signMessage with the canonical ERC-8128 message
  await erc8128SignRequest(request, spySigner, { ttlSeconds });

  if (!capturedMessage) {
    throw new Error("Failed to capture ERC-8128 message");
  }

  const messageHex = toHex(capturedMessage);

  return {
    message: messageHex,
    zone: args.zone,
    hatValidator,
    chainId,
    url: args.url,
    method: args.method,
    body: args.body,
    ttlSeconds,
    instructions: [
      "Sign the 'message' field and pass the result to 'finalize-http-request'.",
      "",
      "EOA signer:",
      "  1. Sign 'message' with personal_sign → rawSignature (65 bytes)",
      "  2. finalize-http-request --signature <rawSignature> ...",
      "",
      "Contract wallet signer:",
      "  1. Sign 'message' via your contract's signing mechanism → innerSignature",
      "  2. Prepend your contract address: signature = concat(contractAddress, innerSignature)",
      "  3. finalize-http-request --signature <prefixedSignature> ...",
      "",
      "The CLI handles the HatValidator routing prefix automatically.",
    ].join("\n"),
  };
}

/**
 * Phase 2: Finalize an HTTP request with a pre-signed signature.
 *
 * Takes the agent's signature (without HatValidator prefix) and produces
 * the final signed HTTP headers ready to attach to the request.
 */
export async function finalizeHttpRequest(args: FinalizeArgs): Promise<{ headers: Record<string, string>; url: string }> {
  const chain = args.chainId === 84532 ? baseSepolia : base;
  const transport = http(args.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });

  // Look up HatValidator from the zone contract
  const hatValidator = await publicClient.readContract({
    address: args.zone,
    abi: TRUST_ZONE_ABI,
    functionName: "hatValidator",
  }) as Address;

  const signer: EthHttpSigner = {
    chainId: args.chainId,
    address: args.zone,
    signMessage: async () => {
      // Prefix signature with HatValidator address for ERC-7579 routing
      return concat([hatValidator, args.signature]);
    },
  };

  const fetchArgs: RequestInit = {
    method: args.method,
    headers: { "Content-Type": "application/json" },
  };
  if (args.body) {
    fetchArgs.body = args.body;
  }

  const request = new Request(args.url, fetchArgs);
  const signedRequest = await erc8128SignRequest(request, signer, {
    ttlSeconds: args.ttlSeconds,
  });

  const headers: Record<string, string> = {};
  signedRequest.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return { headers, url: args.url };
}

// ---- CLI entry points ----

export async function runPrepareHttpRequest(argv: string[]): Promise<void> {
  const args = parseCliArgs(argv);

  if (!args.zone || !args.url || !args.rpcUrl) {
    console.error("Usage: tz prepare-http-request --zone <address> --url <url> --method <method> --body <json> --rpc-url <url> [--chain-id <number>] [--ttl <seconds>]");
    process.exit(1);
  }

  const result = await prepareHttpRequest({
    zone: args.zone as Address,
    url: args.url,
    method: args.method ?? "POST",
    body: args.body,
    rpcUrl: args.rpcUrl,
    chainId: args.chainId ? Number(args.chainId) : undefined,
    ttlSeconds: args.ttl ? Number(args.ttl) : undefined,
  });

  console.log(JSON.stringify(result, null, 2));
}

export async function runFinalizeHttpRequest(argv: string[]): Promise<void> {
  const args = parseCliArgs(argv);

  if (!args.signature || !args.zone || !args.url || !args.rpcUrl) {
    console.error("Usage: tz finalize-http-request --signature <hex> --zone <address> --rpc-url <url> [--chain-id <number>] --url <url> --method <method> [--body <json>] [--ttl <seconds>]");
    process.exit(1);
  }

  const result = await finalizeHttpRequest({
    signature: args.signature as Hex,
    zone: args.zone as Address,
    chainId: Number(args.chainId ?? 8453),
    rpcUrl: args.rpcUrl,
    url: args.url,
    method: args.method ?? "POST",
    body: args.body,
    ttlSeconds: args.ttl ? Number(args.ttl) : undefined,
  });

  console.log(JSON.stringify(result, null, 2));
}

function parseCliArgs(argv: string[]): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      result[key] = argv[i + 1];
      i++;
    }
  }
  return result;
}
