import type { Address, Hex, PublicClient } from "viem";
import { AgreementABI } from "../abis/Agreement.js";
import { ResourceTokenRegistryABI } from "../abis/ResourceTokenRegistry.js";
import { decodeState } from "../decode.js";
import type {
  AgreementState,
  ClaimSummary,
  ContractAddresses,
  ParsedDirective,
  ParsedPermission,
  ProposalSummary,
  ReadBackend,
  ZoneDetails,
} from "../types.js";

// Minimal Hats ABI for isWearerOfHat
const hatsIsWearerAbi = [
  {
    type: "function",
    name: "isWearerOfHat",
    inputs: [
      { name: "_wearer", type: "address" },
      { name: "_hatId", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
] as const;

export function createRpcBackend(
  client: PublicClient,
  addresses: ContractAddresses,
): ReadBackend {
  async function getAgreementState(
    agreement: Address,
  ): Promise<AgreementState> {
    const [
      currentStateRaw,
      outcomeRaw,
      termsHash,
      termsUri,
      adjudicator,
      deadline,
      claimCount,
    ] = await Promise.all([
      client.readContract({
        address: agreement,
        abi: AgreementABI,
        functionName: "currentState",
      }) as Promise<Hex>,
      client.readContract({
        address: agreement,
        abi: AgreementABI,
        functionName: "outcome",
      }) as Promise<Hex>,
      client.readContract({
        address: agreement,
        abi: AgreementABI,
        functionName: "termsHash",
      }) as Promise<Hex>,
      client.readContract({
        address: agreement,
        abi: AgreementABI,
        functionName: "termsUri",
      }) as Promise<string>,
      client.readContract({
        address: agreement,
        abi: AgreementABI,
        functionName: "adjudicator",
      }) as Promise<Address>,
      client.readContract({
        address: agreement,
        abi: AgreementABI,
        functionName: "deadline",
      }) as Promise<bigint>,
      client.readContract({
        address: agreement,
        abi: AgreementABI,
        functionName: "claimCount",
      }) as Promise<bigint>,
    ]);

    const [partyA, partyB] = await Promise.all([
      client.readContract({
        address: agreement,
        abi: AgreementABI,
        functionName: "parties",
        args: [0n],
      }) as Promise<Address>,
      client.readContract({
        address: agreement,
        abi: AgreementABI,
        functionName: "parties",
        args: [1n],
      }) as Promise<Address>,
    ]);

    const [tzA, tzB, hatA, hatB, agentIdA, agentIdB] = await Promise.all([
      client.readContract({
        address: agreement,
        abi: AgreementABI,
        functionName: "trustZones",
        args: [0n],
      }) as Promise<Address>,
      client.readContract({
        address: agreement,
        abi: AgreementABI,
        functionName: "trustZones",
        args: [1n],
      }) as Promise<Address>,
      client.readContract({
        address: agreement,
        abi: AgreementABI,
        functionName: "zoneHatIds",
        args: [0n],
      }) as Promise<bigint>,
      client.readContract({
        address: agreement,
        abi: AgreementABI,
        functionName: "zoneHatIds",
        args: [1n],
      }) as Promise<bigint>,
      client.readContract({
        address: agreement,
        abi: AgreementABI,
        functionName: "agentIds",
        args: [0n],
      }) as Promise<bigint>,
      client.readContract({
        address: agreement,
        abi: AgreementABI,
        functionName: "agentIds",
        args: [1n],
      }) as Promise<bigint>,
    ]);

    const zeroBytes32 =
      "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

    return {
      currentState: decodeState(currentStateRaw),
      outcome: outcomeRaw === zeroBytes32 ? null : decodeState(outcomeRaw),
      parties: [partyA, partyB],
      agentIds: [agentIdA, agentIdB],
      termsHash,
      termsUri,
      adjudicator,
      deadline,
      trustZones: [tzA, tzB],
      zoneHatIds: [hatA, hatB],
      claimCount,
    };
  }

  async function getZoneDetails(
    _zoneAccount: Address,
  ): Promise<ZoneDetails> {
    // RPC fallback: minimal implementation. Full details require Ponder.
    return {
      address: _zoneAccount,
      party: "0x0000000000000000000000000000000000000000",
      hatId: 0n,
      zoneIndex: 0,
      active: false,
      permissions: [],
      responsibilities: [],
      directives: [],
      constraints: [],
    };
  }

  async function getZonePermissions(
    _zoneAccount: Address,
  ): Promise<ParsedPermission[]> {
    // Requires Ponder for parsed data
    return [];
  }

  async function getZoneDirectives(
    _zoneAccount: Address,
  ): Promise<ParsedDirective[]> {
    // Requires Ponder for parsed data
    return [];
  }

  async function getProposalHistory(
    _agreement: Address,
  ): Promise<ProposalSummary[]> {
    // Requires Ponder for event-derived data
    return [];
  }

  async function getClaims(_agreement: Address): Promise<ClaimSummary[]> {
    // Requires Ponder for event-derived data
    return [];
  }

  async function isHatWearer(
    wearer: Address,
    hatId: bigint,
  ): Promise<boolean> {
    return (await client.readContract({
      address: addresses.hats,
      abi: hatsIsWearerAbi,
      functionName: "isWearerOfHat",
      args: [wearer, hatId],
    })) as boolean;
  }

  async function getResourceTokenBalance(
    holder: Address,
    tokenId: bigint,
  ): Promise<bigint> {
    return (await client.readContract({
      address: addresses.resourceTokenRegistry,
      abi: ResourceTokenRegistryABI,
      functionName: "balanceOf",
      args: [holder, tokenId],
    })) as bigint;
  }

  return {
    getAgreementState,
    getZoneDetails,
    getZonePermissions,
    getZoneDirectives,
    getProposalHistory,
    getClaims,
    isHatWearer,
    getResourceTokenBalance,
  };
}
