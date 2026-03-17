import { encodePacked, getAddress, type Hex, type Address } from "viem";
import { TZParamType, TZModuleKind } from "@trust-zones/sdk";
import type { MechanismTemplate } from "../types.js";
import { packHatsModuleData, unpackHatsModuleData } from "./hats-module-utils.js";

export const erc20BalanceTemplate: MechanismTemplate = {
  name: "erc20-balance",
  paramType: TZParamType.Eligibility,
  moduleKind: TZModuleKind.HatsModule,

  encodeData(params) {
    const token = params.token as Address;
    const minBalance = BigInt(params.minBalance as string | number);
    const immutableArgs = encodePacked(["address", "uint256"], [token, minBalance]);
    return packHatsModuleData(immutableArgs, "0x");
  },

  decodeData(data: Hex) {
    const { immutableArgs } = unpackHatsModuleData(data);
    // encodePacked(address, uint256) = 20 + 32 = 52 bytes
    const token = getAddress("0x" + immutableArgs.slice(2, 42));
    const minBalance = BigInt("0x" + immutableArgs.slice(42, 106));
    return {
      token,
      minBalance: minBalance.toString(),
    };
  },
};
