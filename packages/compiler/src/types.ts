import type { Address, Hex } from "viem";

// ---- TZ Schema Document (the negotiation artifact) ----

export interface TZSchemaDocument {
  version: string;
  termsDocUri?: string;
  zones: ZoneSchema[];
  adjudicator: AdjudicatorSchema;
  deadline: number;
}

export interface ZoneSchema {
  actor: ActorSchema;
  maxActors: number;
  description: string;
  constraints?: MechanismEntry[];
  eligibilities?: MechanismEntry[];
  incentives?: MechanismEntry[];
  permissions?: PermissionEntry[];
  responsibilities?: ResponsibilityEntry[];
  directives?: DirectiveEntry[];
}

export interface ActorSchema {
  address: Address;
  agentId: number;
}

export type AdjudicatorSchema =
  | { template: string }
  | { address: Address };

export interface MechanismEntry {
  template: string;
  params: Record<string, unknown>;
}

// ---- Resource token entries (human-readable) ----

export interface PermissionEntry {
  resource: string;
  value?: bigint | number | string;  // numeric value (rate limit count, max withdrawal, etc.)
  period?: string;                    // short string fitting bytes32 ("hour", "day", "total")
  expiry?: number;                    // unix timestamp
  params?: Record<string, unknown> | Hex;  // JSON object (auto-encoded) or raw hex bytes (passed through)
}

export interface ResponsibilityEntry {
  obligation: string;
  criteria?: string;
  deadline?: number;
}

export interface DirectiveEntry {
  rule: string;
  severity?: string;
  params?: Record<string, unknown>;
}

// ---- Template definition ----

export interface MechanismTemplate {
  name: string;
  paramType: number; // TZParamType enum value
  moduleKind: number; // TZModuleKind enum value
  encodeData: (params: Record<string, unknown>) => Hex;
  decodeData: (data: Hex) => Record<string, unknown>;
}

// ---- Compiler config ----

export interface CompilerConfig {
  modules: Record<string, Address>;
  adjudicators: Record<string, Address>;
}

// ---- Constants ----

export const SCHEMA_VERSION = "0.1.0";

/** Sentinel value for hat IDs unknown at compile time. Agreement.sol replaces with actual hat ID. */
export const HAT_ID_SENTINEL = (2n ** 256n - 1n);
