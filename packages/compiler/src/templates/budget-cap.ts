import { encodeAbiParameters, decodeAbiParameters, type Hex, type Address } from "viem";
import { TZParamType, TZModuleKind } from "@trust-zones/sdk";
import type { MechanismTemplate } from "../types.js";

const tokenConfigComponents = [
  { name: "token", type: "address" as const },
  { name: "limit", type: "uint256" as const },
] as const;

const dataParams = [
  { type: "tuple[]" as const, components: tokenConfigComponents },
] as const;

export const budgetCapTemplate: MechanismTemplate = {
  name: "budget-cap",
  paramType: TZParamType.Constraint,
  moduleKind: TZModuleKind.ERC7579Hook,

  encodeData(params) {
    const token = params.token as Address;
    const limit = BigInt(params.limit as string | number);
    return encodeAbiParameters(dataParams, [[{ token, limit }]]);
  },

  decodeData(data: Hex) {
    const [configs] = decodeAbiParameters(dataParams, data);
    const first = configs[0];
    return {
      token: first.token,
      limit: first.limit.toString(),
    };
  },
};
