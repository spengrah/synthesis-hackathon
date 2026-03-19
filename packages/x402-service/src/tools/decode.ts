import { decodeEventLog, type Hex } from "viem";
import { AgreementABI } from "@trust-zones/sdk";

export function handleDecodeEvent(args: {
  eventName: string;
  topics: Hex[];
  data: Hex;
}): Record<string, unknown> {
  const decoded = decodeEventLog({
    abi: AgreementABI,
    topics: args.topics as [Hex, ...Hex[]],
    data: args.data,
  });

  // Convert BigInt values to strings for JSON serialization
  return {
    eventName: decoded.eventName,
    args: JSON.parse(
      JSON.stringify(decoded.args, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    ),
  };
}
