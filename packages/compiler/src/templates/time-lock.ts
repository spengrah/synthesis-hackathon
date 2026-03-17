import { encodePacked, type Hex, type Address, hexToNumber, slice } from "viem";
import { TZParamType, TZModuleKind } from "@trust-zones/sdk";
import type { MechanismTemplate } from "../types.js";

export const timeLockTemplate: MechanismTemplate = {
  name: "time-lock",
  paramType: TZParamType.Constraint,
  moduleKind: TZModuleKind.ERC7579Hook,

  encodeData(params) {
    const waitPeriod = BigInt(params.waitPeriod as string | number);
    const owner = params.owner as Address;
    return encodePacked(["uint128", "address"], [waitPeriod, owner]);
  },

  decodeData(data: Hex) {
    // ColdStorageHook uses encodePacked: 16 bytes uint128 + 20 bytes address = 36 bytes
    const waitPeriod = hexToNumber(slice(data, 0, 16));
    const owner = slice(data, 16, 36) as Address;
    return {
      waitPeriod,
      owner,
    };
  },
};
