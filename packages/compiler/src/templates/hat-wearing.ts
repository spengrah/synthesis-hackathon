import { encodePacked, type Hex } from "viem";
import { TZParamType, TZModuleKind } from "@trust-zones/sdk";
import type { MechanismTemplate } from "../types.js";
import { packHatsModuleData, unpackHatsModuleData } from "./hats-module-utils.js";

export const hatWearingTemplate: MechanismTemplate = {
  name: "hat-wearing",
  paramType: TZParamType.Eligibility,
  moduleKind: TZModuleKind.HatsModule,

  encodeData(params) {
    const criterionHatId = BigInt(params.criterionHatId as string | number);
    const immutableArgs = encodePacked(["uint256"], [criterionHatId]);
    return packHatsModuleData(immutableArgs, "0x");
  },

  decodeData(data: Hex) {
    const { immutableArgs } = unpackHatsModuleData(data);
    // encodePacked(uint256) = 32 bytes
    const criterionHatId = BigInt("0x" + immutableArgs.slice(2, 66));
    return { criterionHatId: criterionHatId.toString() };
  },
};
