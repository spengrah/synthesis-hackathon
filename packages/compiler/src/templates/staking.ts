import {
  encodeAbiParameters,
  decodeAbiParameters,
  encodePacked,
  getAddress,
  type Hex,
  type Address,
} from "viem";
import { TZParamType, TZModuleKind } from "@trust-zones/sdk";
import type { MechanismTemplate } from "../types.js";
import { HAT_ID_SENTINEL } from "../types.js";
import { packHatsModuleData, unpackHatsModuleData } from "./hats-module-utils.js";

const initDataParams = [
  { type: "uint248" as const },
  { type: "uint256" as const },
  { type: "uint256" as const },
  { type: "uint256" as const },
] as const;

export const stakingTemplate: MechanismTemplate = {
  name: "staking",
  paramType: TZParamType.Penalty,
  moduleKind: TZModuleKind.HatsModule,

  encodeData(params) {
    const token = params.token as Address;
    const minStake = BigInt(params.minStake as string | number);
    const cooldownPeriod = BigInt(params.cooldownPeriod as string | number);

    const immutableArgs = encodePacked(["address"], [token]);
    const initData = encodeAbiParameters(initDataParams, [
      minStake,
      HAT_ID_SENTINEL, // judgeHat — replaced by Agreement.sol
      HAT_ID_SENTINEL, // recipientHat — replaced by Agreement.sol
      cooldownPeriod,
    ]);

    return packHatsModuleData(immutableArgs, initData);
  },

  decodeData(data: Hex) {
    const { immutableArgs, initData } = unpackHatsModuleData(data);

    // immutableArgs = encodePacked(address token) = 20 bytes
    const token = getAddress("0x" + immutableArgs.slice(2, 42));

    const [minStake, , , cooldownPeriod] = decodeAbiParameters(initDataParams, initData);

    return {
      token,
      minStake: minStake.toString(),
      cooldownPeriod: Number(cooldownPeriod),
    };
  },
};
