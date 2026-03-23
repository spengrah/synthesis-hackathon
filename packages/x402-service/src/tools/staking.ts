import { createPublicClient, http, parseAbi, type Address } from "viem";
import { base } from "viem/chains";
import { handleGraphql } from "./graphql.js";

const HATS = "0x3bc1A0Ad72417f2d411118085256fC53CBdDd137" as Address;

const agreementAbi = parseAbi([
  "function zoneHatIds(uint256 index) view returns (uint256)",
]);

const hatsAbi = parseAbi([
  "function getHatEligibilityModule(uint256 _hatId) view returns (address)",
]);

export async function handleStakingInfo(args: {
  agreement: string;
  agentAddress: string;
}): Promise<{
  agreement: string;
  zoneIndex: number;
  zoneAddress: string;
  hatId: string;
  eligibilityModule: string;
  stakeToken: string;
  instructions: string;
}> {
  const rpcUrl = process.env.RPC_URL || process.env.PONDER_RPC_URL || "http://127.0.0.1:8545";
  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });

  // Find the agent's zone via Ponder
  const result = await handleGraphql({
    query: `query($id: String!) {
      agreement(id: $id) {
        trustZones { items { id zoneIndex actor { address } } }
      }
    }`,
    variables: { id: args.agreement.toLowerCase() },
  }) as { data: { agreement: { trustZones: { items: { id: string; zoneIndex: number; actor: { address: string } }[] } } } };

  const zones = result.data?.agreement?.trustZones?.items ?? [];
  const myZone = zones.find(
    (z) => z.actor.address.toLowerCase() === args.agentAddress.toLowerCase(),
  );
  if (!myZone) {
    throw new Error(`No zone found for agent ${args.agentAddress} in agreement ${args.agreement}`);
  }

  const hatId = await publicClient.readContract({
    address: args.agreement as Address,
    abi: agreementAbi,
    functionName: "zoneHatIds",
    args: [BigInt(myZone.zoneIndex)],
  });

  const eligibilityModule = await publicClient.readContract({
    address: HATS,
    abi: hatsAbi,
    functionName: "getHatEligibilityModule",
    args: [hatId],
  });

  return {
    agreement: args.agreement,
    zoneIndex: myZone.zoneIndex,
    zoneAddress: myZone.id,
    hatId: hatId.toString(),
    eligibilityModule: eligibilityModule as string,
    stakeToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    instructions: `To stake: 1) approve USDC to ${eligibilityModule}, 2) call stake(uint248 _amount) on ${eligibilityModule} (selector: 0xef2d7831). IMPORTANT: the function signature is stake(uint248), NOT stake(uint256). Amount is in 6-decimal USDC units (1 USDC = 1000000). Example calldata for 1 USDC: 0xef2d783100000000000000000000000000000000000000000000000000000000000f4240`,
  };
}
