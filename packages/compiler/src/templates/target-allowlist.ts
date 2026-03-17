import { encodeAbiParameters, decodeAbiParameters, type Hex, type Address } from "viem";
import { TZParamType, TZModuleKind } from "@trust-zones/sdk";
import type { MechanismTemplate } from "../types.js";

const modulePermissionsComponents = [
  { name: "selfCall", type: "bool" as const },
  { name: "moduleCall", type: "bool" as const },
  { name: "hasAllowedTargets", type: "bool" as const },
  { name: "sendValue", type: "bool" as const },
  { name: "hasAllowedFunctions", type: "bool" as const },
  { name: "erc20Transfer", type: "bool" as const },
  { name: "erc721Transfer", type: "bool" as const },
  { name: "moduleConfig", type: "bool" as const },
  { name: "allowedFunctions", type: "bytes4[]" as const },
  { name: "allowedTargets", type: "address[]" as const },
] as const;

const dataParams = [
  { name: "modules", type: "address[]" as const },
  { name: "permissions", type: "tuple[]" as const, components: modulePermissionsComponents },
] as const;

export const targetAllowlistTemplate: MechanismTemplate = {
  name: "target-allowlist",
  paramType: TZParamType.Constraint,
  moduleKind: TZModuleKind.ERC7579Hook,

  encodeData(params) {
    const targets = (params.targets ?? []) as Address[];
    const functions = (params.functions ?? []) as Hex[];

    // The PermissionsHook takes per-module permissions. For our use case,
    // we configure a single "executor" entry with the target/function allowlists.
    // The module address is set to address(0) as a wildcard for all executors.
    const moduleAddr = "0x0000000000000000000000000000000000000000" as Address;

    return encodeAbiParameters(dataParams, [
      [moduleAddr],
      [{
        selfCall: false,
        moduleCall: false,
        hasAllowedTargets: targets.length > 0,
        sendValue: false,
        hasAllowedFunctions: functions.length > 0,
        erc20Transfer: false,
        erc721Transfer: false,
        moduleConfig: false,
        allowedFunctions: functions,
        allowedTargets: targets,
      }],
    ]);
  },

  decodeData(data: Hex) {
    const [, permissions] = decodeAbiParameters(dataParams, data);
    const first = permissions[0];
    const result: Record<string, unknown> = {};
    if (first.allowedTargets.length > 0) result.targets = [...first.allowedTargets];
    if (first.allowedFunctions.length > 0) result.functions = [...first.allowedFunctions];
    return result;
  },
};
