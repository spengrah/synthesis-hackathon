export { compile } from "./compile.js";
export { decompile } from "./decompile.js";
export { TemplateRegistry } from "./registry.js";
export { createDefaultRegistry } from "./templates/index.js";
export { BASE_MAINNET_CONFIG } from "./defaults.js";
export { packHatsModuleData, unpackHatsModuleData } from "./templates/hats-module-utils.js";

export {
  encodePermission,
  decodePermission,
  encodeResponsibility,
  decodeResponsibility,
  encodeDirective,
  decodeDirective,
} from "./resources.js";

export type {
  TZSchemaDocument,
  ZoneSchema,
  ActorSchema,
  AdjudicatorSchema,
  MechanismEntry,
  PermissionEntry,
  ResponsibilityEntry,
  DirectiveEntry,
  MechanismTemplate,
  CompilerConfig,
} from "./types.js";

export { SCHEMA_VERSION, HAT_ID_SENTINEL } from "./types.js";

// Re-export individual templates for advanced use
export {
  budgetCapTemplate,
  targetAllowlistTemplate,
  timeLockTemplate,
  stakingTemplate,
  reputationGateTemplate,
  erc20BalanceTemplate,
  allowlistTemplate,
  hatWearingTemplate,
} from "./templates/index.js";
