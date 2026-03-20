import { encodeFunctionData, parseAbi, type Address, type Hex } from "viem";

const ZONE_ABI = parseAbi([
  "function execute(address to, uint256 value, bytes data)",
]);

interface PrepareTxArgs {
  zone: Address;
  to: Address;
  value?: string;
  data?: Hex;
}

/**
 * Prepare a transaction for executing through a zone account.
 *
 * Returns the transaction parameters (to, data, value) that the agent
 * submits from their EOA. The zone's _checkEntryPointOrSelf verifies
 * the caller is a hat wearer.
 */
export function prepareTx(args: PrepareTxArgs): { to: Address; data: Hex; value: string } {
  const calldata = encodeFunctionData({
    abi: ZONE_ABI,
    functionName: "execute",
    args: [args.to, BigInt(args.value ?? "0"), args.data ?? "0x"],
  });

  return {
    to: args.zone,
    data: calldata,
    value: "0", // ETH value sent to the zone (usually 0 — the zone forwards value from the inner call)
  };
}

export async function runPrepareTx(argv: string[]): Promise<void> {
  const args = parseArgs(argv);

  if (!args.zone || !args.to) {
    console.error("Usage: trust-zones prepare-tx --zone <address> --to <address> [--value <wei>] [--data <hex>]");
    process.exit(1);
  }

  const result = prepareTx({
    zone: args.zone as Address,
    to: args.to as Address,
    value: args.value,
    data: args.data as Hex | undefined,
  });

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
