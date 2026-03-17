import type { Address, Hex } from "viem";
import { TZParamType, TZModuleKind } from "@trust-zones/sdk";
import type { TZMechanism, TZConfig, TZResourceTokenConfig, ProposalData } from "@trust-zones/sdk";
import type {
  TZSchemaDocument,
  ZoneSchema,
  MechanismEntry,
  CompilerConfig,
} from "./types.js";
import { SCHEMA_VERSION } from "./types.js";
import { TemplateRegistry } from "./registry.js";
import { encodePermission, encodeResponsibility, encodeDirective } from "./resources.js";

/** Category → expected paramTypes for validation */
const CATEGORY_PARAM_TYPES: Record<string, number[]> = {
  constraints: [TZParamType.Constraint],
  eligibilities: [TZParamType.Eligibility],
  incentives: [TZParamType.Penalty, TZParamType.Reward],
};

export function compile(
  schemaDoc: TZSchemaDocument,
  config: CompilerConfig,
  registry: TemplateRegistry,
): ProposalData {
  if (schemaDoc.version !== SCHEMA_VERSION) {
    throw new Error(`Unsupported schema version: ${schemaDoc.version} (expected ${SCHEMA_VERSION})`);
  }

  const zones: TZConfig[] = schemaDoc.zones.map((zone) => compileZone(zone, config, registry));
  const adjudicator = resolveAdjudicator(schemaDoc.adjudicator, config);

  return {
    termsDocUri: "",
    zones,
    adjudicator,
    deadline: BigInt(schemaDoc.deadline),
  };
}

function compileZone(
  zone: ZoneSchema,
  config: CompilerConfig,
  registry: TemplateRegistry,
): TZConfig {
  const mechanisms: TZMechanism[] = [];

  // Compile mechanisms from each category
  for (const [category, entries] of Object.entries({
    constraints: zone.constraints ?? [],
    eligibilities: zone.eligibilities ?? [],
    incentives: zone.incentives ?? [],
  })) {
    for (const entry of entries) {
      mechanisms.push(compileMechanism(entry, category, config, registry));
    }
  }

  // Compile resource tokens
  const resources: TZResourceTokenConfig[] = [];
  for (const p of zone.permissions ?? []) {
    resources.push({ tokenType: TZParamType.Permission, metadata: encodePermission(p) });
  }
  for (const r of zone.responsibilities ?? []) {
    resources.push({ tokenType: TZParamType.Responsibility, metadata: encodeResponsibility(r) });
  }
  for (const d of zone.directives ?? []) {
    resources.push({ tokenType: TZParamType.Directive, metadata: encodeDirective(d) });
  }

  return {
    party: zone.actor.address,
    agentId: BigInt(zone.actor.agentId),
    hatMaxSupply: zone.hatMaxSupply,
    hatDetails: zone.hatDetails,
    mechanisms,
    resources,
  };
}

function compileMechanism(
  entry: MechanismEntry,
  category: string,
  config: CompilerConfig,
  registry: TemplateRegistry,
): TZMechanism {
  const template = registry.get(entry.template);
  if (!template) {
    throw new Error(`Unknown template: "${entry.template}"`);
  }

  const expectedTypes = CATEGORY_PARAM_TYPES[category];
  if (expectedTypes && !expectedTypes.includes(template.paramType)) {
    throw new Error(
      `Template "${entry.template}" has paramType ${template.paramType}, ` +
      `which is not valid in "${category}"`,
    );
  }

  const moduleAddr = config.modules[entry.template];
  if (!moduleAddr) {
    throw new Error(`No module address configured for template "${entry.template}"`);
  }

  const data = template.encodeData(entry.params);

  return {
    paramType: template.paramType,
    moduleKind: template.moduleKind,
    module: moduleAddr,
    data,
  };
}

function resolveAdjudicator(
  adj: { template: string } | { address: Address },
  config: CompilerConfig,
): Address {
  if ("address" in adj) return adj.address;
  const addr = config.adjudicators[adj.template];
  if (!addr) {
    throw new Error(`No adjudicator address configured for template "${adj.template}"`);
  }
  return addr;
}
