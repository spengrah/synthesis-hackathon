import { encodeAbiParameters, decodeAbiParameters, type Hex, type Address } from "viem";
import { TZParamType, TZModuleKind } from "@trust-zones/sdk";
import type { MechanismTemplate } from "../types.js";
import { HAT_ID_SENTINEL } from "../types.js";
import { packHatsModuleData, unpackHatsModuleData } from "./hats-module-utils.js";

const initDataParams = [
  { type: "uint256" as const },
  { type: "uint256" as const },
  { type: "address[]" as const },
] as const;

export const allowlistTemplate: MechanismTemplate = {
  name: "allowlist",
  paramType: TZParamType.Eligibility,
  moduleKind: TZModuleKind.HatsModule,

  encodeData(params) {
    const accounts = (params.accounts ?? []) as Address[];
    const initData = encodeAbiParameters(initDataParams, [
      HAT_ID_SENTINEL, // ownerHat — replaced by Agreement.sol
      HAT_ID_SENTINEL, // arbitratorHat — replaced by Agreement.sol
      accounts,
    ]);
    return packHatsModuleData("0x", initData);
  },

  decodeData(data: Hex) {
    const { initData } = unpackHatsModuleData(data);
    const [, , accounts] = decodeAbiParameters(initDataParams, initData);
    return { accounts: [...accounts] };
  },
};
