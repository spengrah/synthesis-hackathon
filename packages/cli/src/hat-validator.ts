import { createPublicClient, http, parseAbi, type Address } from "viem";
import { base } from "viem/chains";

const TRUST_ZONE_ABI = parseAbi([
  "function hatValidator() view returns (address)",
]);

export async function runHatValidator(argv: string[]): Promise<void> {
  const args: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      args[key] = argv[i + 1];
      i++;
    }
  }

  if (!args.zone || !args.rpcUrl) {
    console.error("Usage: trust-zones hat-validator --zone <address> --rpc-url <url>");
    process.exit(1);
  }

  const publicClient = createPublicClient({
    chain: base,
    transport: http(args.rpcUrl),
  });

  const hatValidatorAddress = await publicClient.readContract({
    address: args.zone as Address,
    abi: TRUST_ZONE_ABI,
    functionName: "hatValidator",
  });

  console.log(JSON.stringify({ zone: args.zone, hatValidator: hatValidatorAddress }));
}
