import { encodeAbiParameters, decodeAbiParameters, type Hex } from "viem";
import { TZParamType, TZModuleKind } from "@trust-zones/sdk";
import type { MechanismTemplate } from "../types.js";
import { packHatsModuleData, unpackHatsModuleData } from "./hats-module-utils.js";

// Provisional encoding — 8004ReputationEligibility module is not yet built.
// The initData schema will be finalized when the module is implemented.
const initDataParams = [
  { type: "uint256" as const },
] as const;

export const reputationGateTemplate: MechanismTemplate = {
  name: "reputation-gate",
  paramType: TZParamType.Eligibility,
  moduleKind: TZModuleKind.HatsModule,

  encodeData(params) {
    const minScore = BigInt(params.minScore as string | number);
    const initData = encodeAbiParameters(initDataParams, [minScore]);
    return packHatsModuleData("0x", initData);
  },

  decodeData(data: Hex) {
    const { initData } = unpackHatsModuleData(data);
    const [minScore] = decodeAbiParameters(initDataParams, initData);
    return { minScore: Number(minScore) };
  },
};
