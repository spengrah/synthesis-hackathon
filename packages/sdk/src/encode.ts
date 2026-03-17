import { encodeAbiParameters, type Hex } from "viem";
import type {
  ProposalData,
  AdjudicationAction,
  SubmitInputArgs,
} from "./types.js";
import {
  PROPOSE,
  COUNTER,
  ACCEPT,
  REJECT,
  WITHDRAW,
  ACTIVATE,
  CLAIM,
  ADJUDICATE,
  COMPLETE,
  EXIT,
  FINALIZE,
} from "./constants.js";

// ---- ABI parameter definitions for encoding ----

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
  { name: "hatMaxSupply", type: "uint32" as const },
  { name: "hatDetails", type: "string" as const },
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

// ---- Encoders ----

function encodeProposalPayload(data: ProposalData): Hex {
  return encodeAbiParameters(proposalDataParams, [
    {
      termsDocUri: data.termsDocUri,
      zones: data.zones.map((z) => ({
        party: z.party,
        agentId: z.agentId,
        hatMaxSupply: z.hatMaxSupply,
        hatDetails: z.hatDetails,
        mechanisms: z.mechanisms.map((m) => ({
          paramType: m.paramType,
          moduleKind: m.moduleKind,
          module: m.module,
          data: m.data,
        })),
        resources: z.resources.map((r) => ({
          tokenType: r.tokenType,
          metadata: r.metadata,
        })),
      })),
      adjudicator: data.adjudicator,
      deadline: data.deadline,
    },
  ]);
}

export function encodePropose(data: ProposalData): SubmitInputArgs {
  return { inputId: PROPOSE, payload: encodeProposalPayload(data) };
}

export function encodeCounter(data: ProposalData): SubmitInputArgs {
  return { inputId: COUNTER, payload: encodeProposalPayload(data) };
}

export function encodeAccept(): SubmitInputArgs {
  return { inputId: ACCEPT, payload: "0x" };
}

export function encodeReject(): SubmitInputArgs {
  return { inputId: REJECT, payload: "0x" };
}

export function encodeWithdraw(): SubmitInputArgs {
  return { inputId: WITHDRAW, payload: "0x" };
}

export function encodeActivate(): SubmitInputArgs {
  return { inputId: ACTIVATE, payload: "0x" };
}

export function encodeClaim(
  mechanismIndex: number,
  evidence: Hex,
): SubmitInputArgs {
  const payload = encodeAbiParameters(
    [{ type: "uint256" }, { type: "bytes" }],
    [BigInt(mechanismIndex), evidence],
  );
  return { inputId: CLAIM, payload };
}

export function encodeAdjudicate(
  claimId: number,
  actions: AdjudicationAction[],
): SubmitInputArgs {
  const payload = encodeAbiParameters(
    [
      { type: "uint256" },
      { type: "bool" },
      { type: "tuple[]", components: adjudicationActionComponents },
    ],
    [
      BigInt(claimId),
      true,
      actions.map((a) => ({
        mechanismIndex: a.mechanismIndex,
        targetIndex: a.targetIndex,
        actionType: a.actionType,
        params: a.params,
      })),
    ],
  );
  return { inputId: ADJUDICATE, payload };
}

export function encodeComplete(
  feedbackURI: string,
  feedbackHash: Hex,
): SubmitInputArgs {
  const payload = encodeAbiParameters(
    [{ type: "string" }, { type: "bytes32" }],
    [feedbackURI, feedbackHash],
  );
  return { inputId: COMPLETE, payload };
}

export function encodeExit(
  feedbackURI: string,
  feedbackHash: Hex,
): SubmitInputArgs {
  const payload = encodeAbiParameters(
    [{ type: "string" }, { type: "bytes32" }],
    [feedbackURI, feedbackHash],
  );
  return { inputId: EXIT, payload };
}

export function encodeFinalize(): SubmitInputArgs {
  return { inputId: FINALIZE, payload: "0x" };
}

export function encodeAcceptAndActivate(
  activationData: Hex,
): SubmitInputArgs {
  // acceptAndActivate is a convenience that bundles ACCEPT + ACTIVATE
  // The inputId is ACCEPT, payload carries activation data
  const payload = activationData;
  return { inputId: ACCEPT, payload };
}
