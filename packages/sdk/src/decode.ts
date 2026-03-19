import { decodeAbiParameters, type Hex } from "viem";
import type { ProposalData, AdjudicationAction } from "./types.js";
import { TZParamType, TZModuleKind } from "./types.js";
import { BYTES32_LABELS } from "./constants.js";

// ---- ABI parameter definitions for decoding ----

const tzMechanismComponents = [
  { name: "paramType", type: "uint8" as const },
  { name: "moduleKind", type: "uint8" as const },
  { name: "module", type: "address" as const },
  { name: "data", type: "bytes" as const },
] as const;

const tzResourceTokenConfigComponents = [
  { name: "tokenType", type: "uint8" as const },
  { name: "metadata", type: "bytes" as const },
] as const;

const tzConfigComponents = [
  { name: "party", type: "address" as const },
  { name: "agentId", type: "uint256" as const },
  { name: "maxActors", type: "uint32" as const },
  { name: "description", type: "string" as const },
  {
    name: "mechanisms",
    type: "tuple[]" as const,
    components: tzMechanismComponents,
  },
  {
    name: "resources",
    type: "tuple[]" as const,
    components: tzResourceTokenConfigComponents,
  },
] as const;

const proposalDataParams = [
  {
    type: "tuple" as const,
    components: [
      { name: "termsDocUri", type: "string" as const },
      {
        name: "zones",
        type: "tuple[]" as const,
        components: tzConfigComponents,
      },
      { name: "adjudicator", type: "address" as const },
      { name: "deadline", type: "uint256" as const },
    ] as const,
  },
] as const;

const adjudicationActionComponents = [
  { name: "mechanismIndex", type: "uint256" as const },
  { name: "targetIndex", type: "uint256" as const },
  { name: "actionType", type: "bytes32" as const },
  { name: "params", type: "bytes" as const },
] as const;

// ---- Decoders ----

/**
 * Decode ABI-encoded ProposalData from a ProposalSubmitted event payload.
 */
export function decodeProposalData(proposalDataBytes: Hex): ProposalData {
  const [raw] = decodeAbiParameters(proposalDataParams, proposalDataBytes);

  return {
    termsDocUri: raw.termsDocUri,
    zones: raw.zones.map((z) => ({
      party: z.party,
      agentId: z.agentId,
      maxActors: z.maxActors,
      description: z.description,
      mechanisms: z.mechanisms.map((m) => ({
        paramType: m.paramType as TZParamType,
        moduleKind: m.moduleKind as TZModuleKind,
        module: m.module,
        data: m.data,
      })),
      resources: z.resources.map((r) => ({
        tokenType: r.tokenType as TZParamType,
        metadata: r.metadata,
      })),
    })),
    adjudicator: raw.adjudicator,
    deadline: raw.deadline,
  };
}

/**
 * Decode ABI-encoded AdjudicationAction[] from an AdjudicationDelivered event.
 */
export function decodeAdjudicationActions(
  payload: Hex,
): AdjudicationAction[] {
  const [, , actions] = decodeAbiParameters(
    [
      { type: "uint256" },
      { type: "bool" },
      { type: "tuple[]", components: adjudicationActionComponents },
    ],
    payload,
  );

  return actions.map((a) => ({
    mechanismIndex: a.mechanismIndex,
    targetIndex: a.targetIndex,
    actionType: a.actionType,
    params: a.params,
  }));
}

/**
 * Decode claim data from a ClaimFiled event payload.
 */
export function decodeClaim(
  payload: Hex,
): { mechanismIndex: bigint; evidence: Hex } {
  const [mechanismIndex, evidence] = decodeAbiParameters(
    [{ type: "uint256" }, { type: "bytes" }],
    payload,
  );
  return { mechanismIndex, evidence: evidence as Hex };
}

/**
 * Decode feedback from CompletionSignaled / ExitSignaled event payload.
 */
export function decodeFeedback(
  payload: Hex,
): { feedbackURI: string; feedbackHash: Hex } {
  const [feedbackURI, feedbackHash] = decodeAbiParameters(
    [{ type: "string" }, { type: "bytes32" }],
    payload,
  );
  return { feedbackURI, feedbackHash: feedbackHash as Hex };
}

/**
 * Decode a bytes32 hash to a human-readable state/outcome/action string.
 * Returns the hex string if no match is found.
 */
export function decodeState(bytes32: Hex): string {
  return BYTES32_LABELS[bytes32] ?? bytes32;
}
