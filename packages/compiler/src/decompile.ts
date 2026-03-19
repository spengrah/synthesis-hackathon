import type { Address, Hex } from "viem";
import { TZParamType } from "@trust-zones/sdk";
import type { ProposalData, TZMechanism, TZResourceTokenConfig } from "@trust-zones/sdk";
import type {
  TZSchemaDocument,
  ZoneSchema,
  MechanismEntry,
  AdjudicatorSchema,
  CompilerConfig,
} from "./types.js";
import { SCHEMA_VERSION } from "./types.js";
import { TemplateRegistry } from "./registry.js";
import { decodePermission, decodeResponsibility, decodeDirective } from "./resources.js";

export function decompile(
  proposalData: ProposalData,
  config: CompilerConfig,
  registry: TemplateRegistry,
): TZSchemaDocument {
  const zones: ZoneSchema[] = proposalData.zones.map((zone) =>
    decompileZone(zone.party, zone.agentId, zone.maxActors, zone.description, zone.mechanisms, zone.resources, config, registry),
  );

  const adjudicator = decompileAdjudicator(proposalData.adjudicator, config);

  return {
    version: SCHEMA_VERSION,
    termsDocUri: proposalData.termsDocUri || undefined,
    zones,
    adjudicator,
    deadline: Number(proposalData.deadline),
  };
}

function decompileZone(
  party: Address,
  agentId: bigint,
  maxActors: number,
  description: string,
  mechanisms: readonly TZMechanism[],
  resources: readonly TZResourceTokenConfig[],
  config: CompilerConfig,
  registry: TemplateRegistry,
): ZoneSchema {
  const constraints: MechanismEntry[] = [];
  const eligibilities: MechanismEntry[] = [];
  const incentives: MechanismEntry[] = [];

  for (const mech of mechanisms) {
    const entry = decompileMechanism(mech, config, registry);
    switch (mech.paramType) {
      case TZParamType.Constraint:
        constraints.push(entry);
        break;
      case TZParamType.Eligibility:
        eligibilities.push(entry);
        break;
      case TZParamType.Penalty:
      case TZParamType.Reward:
        incentives.push(entry);
        break;
      default:
        // Future types — place in a catch-all
        incentives.push(entry);
    }
  }

  const zone: ZoneSchema = {
    actor: { address: party, agentId: Number(agentId) },
    maxActors,
    description,
  };

  if (constraints.length > 0) zone.constraints = constraints;
  if (eligibilities.length > 0) zone.eligibilities = eligibilities;
  if (incentives.length > 0) zone.incentives = incentives;

  // Decompile resource tokens
  const permissions = [];
  const responsibilities = [];
  const directives = [];

  for (const res of resources) {
    switch (res.tokenType) {
      case TZParamType.Permission:
        permissions.push(decodePermission(res.metadata));
        break;
      case TZParamType.Responsibility:
        responsibilities.push(decodeResponsibility(res.metadata));
        break;
      case TZParamType.Directive:
        directives.push(decodeDirective(res.metadata));
        break;
    }
  }

  if (permissions.length > 0) zone.permissions = permissions;
  if (responsibilities.length > 0) zone.responsibilities = responsibilities;
  if (directives.length > 0) zone.directives = directives;

  return zone;
}

function decompileMechanism(
  mech: TZMechanism,
  config: CompilerConfig,
  registry: TemplateRegistry,
): MechanismEntry {
  const template = registry.findByAddress(mech.module, config);
  if (!template) {
    // Unknown module — produce a raw fallback entry
    return {
      template: "unknown",
      params: {
        module: mech.module,
        data: mech.data,
        paramType: mech.paramType,
        moduleKind: mech.moduleKind,
      },
    };
  }

  const params = template.decodeData(mech.data);
  return { template: template.name, params };
}

function decompileAdjudicator(
  address: Address,
  config: CompilerConfig,
): AdjudicatorSchema {
  for (const [name, addr] of Object.entries(config.adjudicators)) {
    if (addr.toLowerCase() === address.toLowerCase()) {
      return { template: name };
    }
  }
  return { address };
}
