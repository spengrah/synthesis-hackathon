import {
  encodePropose,
  encodeCounter,
  encodeAccept,
  encodeReject,
  encodeWithdraw,
  encodeSetUp,
  encodeActivate,
  encodeClaim,
  encodeAdjudicate,
  encodeComplete,
  encodeExit,
  encodeFinalize,
  PROPOSE,
  COUNTER,
} from "@trust-zones/sdk";
import { encodeFunctionData, type Hex } from "viem";
import type { ProposalData, AdjudicationAction } from "@trust-zones/sdk";

const AGREEMENT_ABI_SUBMIT = [
  {
    name: "submitInput",
    type: "function",
    inputs: [
      { name: "inputId", type: "bytes32" },
      { name: "payload", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
] as const;

export function handleEncode(args: {
  inputId: string;
  params?: Record<string, unknown>;
  proposalData?: string;
}): { inputId: Hex; payload: Hex; calldata: Hex } {
  const { inputId, params, proposalData } = args;
  let result: { inputId: Hex; payload: Hex };

  switch (inputId.toLowerCase()) {
    case "propose": {
      // Accept hex proposalData (from compile) or structured ProposalData
      const propHex = (proposalData || (params as any)?.proposalData) as Hex | undefined;
      result = propHex
        ? { inputId: PROPOSE, payload: propHex }
        : encodePropose(params as unknown as ProposalData);
      break;
    }
    case "counter": {
      const propHex = (proposalData || (params as any)?.proposalData) as Hex | undefined;
      result = propHex
        ? { inputId: COUNTER, payload: propHex }
        : encodeCounter(params as unknown as ProposalData);
      break;
    }
    case "accept": {
      // Accept requires the raw counter-proposal data as payload (for terms hash verification)
      const acceptPayload = (proposalData || (params as any)?.proposalData) as Hex | undefined;
      const { inputId: acceptId } = encodeAccept();
      result = { inputId: acceptId, payload: acceptPayload || ("0x" as Hex) };
      break;
    }
    case "reject":
      result = encodeReject();
      break;
    case "withdraw":
      result = encodeWithdraw();
      break;
    case "setup":
    case "set_up":
      result = encodeSetUp();
      break;
    case "activate":
      result = encodeActivate();
      break;
    case "claim": {
      const p = params as { mechanismIndex: number; evidence: Hex };
      result = encodeClaim(p.mechanismIndex, p.evidence);
      break;
    }
    case "adjudicate": {
      const p = params as { claimId: number; actions: AdjudicationAction[] };
      result = encodeAdjudicate(p.claimId, p.actions);
      break;
    }
    case "complete": {
      const p = params as { feedbackURI: string; feedbackHash: Hex };
      result = encodeComplete(p.feedbackURI, p.feedbackHash);
      break;
    }
    case "exit": {
      const p = params as { feedbackURI: string; feedbackHash: Hex };
      result = encodeExit(p.feedbackURI, p.feedbackHash);
      break;
    }
    case "finalize":
      result = encodeFinalize();
      break;
    default:
      throw new Error(`Unknown inputId: ${inputId}. Valid: propose, counter, accept, reject, withdraw, setup, activate, claim, adjudicate, complete, exit, finalize`);
  }

  const calldata = encodeFunctionData({
    abi: AGREEMENT_ABI_SUBMIT,
    functionName: "submitInput",
    args: [result.inputId, result.payload],
  });

  return { ...result, calldata };
}
