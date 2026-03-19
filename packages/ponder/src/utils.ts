import { keccak256, toHex, decodeAbiParameters, trim, fromHex, type Hex } from "viem";

// ─── bytes32 lookup table ────────────────────────────────────────

const LABELS = [
  // States
  "PROPOSED",
  "NEGOTIATING",
  "ACCEPTED",
  "READY",
  "ACTIVE",
  "CLOSED",
  "REJECTED",
  // Outcomes
  "COMPLETED",
  "EXITED",
  "EXPIRED",
  "ADJUDICATED",
  // Action types
  "PENALIZE",
  "REWARD",
  "FEEDBACK",
  "DEACTIVATE",
  "CLOSE",
] as const;

const bytes32Lookup = new Map<string, string>();
for (const label of LABELS) {
  const hash = keccak256(toHex(label));
  bytes32Lookup.set(hash, label);
}

export function decodeBytes32(hash: Hex): string {
  return bytes32Lookup.get(hash) ?? hash;
}

// ─── TZParamType enum mapping ────────────────────────────────────

// Matches the Solidity enum TZParamType
export const PARAM_TYPE = {
  Constraint: 0,
  Permission: 1,
  Responsibility: 2,
  Directive: 3,
  Eligibility: 4,
  Reward: 5,
  Penalty: 6,
  PrincipalAlignment: 7,
  DecisionModel: 8,
} as const;

// ─── TZModuleKind enum mapping ──────────────────────────────────

// Matches the Solidity enum TZModuleKind
export const MODULE_KIND_LABELS: Record<number, string> = {
  0: "HatsModule",
  1: "ERC7579Hook",
  2: "External",
};

// Token types for resource tokens (Permission=1, Responsibility=2, Directive=3)
// These match TZParamType values for Permission, Responsibility, Directive
export const TOKEN_TYPE = {
  Permission: 1,
  Responsibility: 2,
  Directive: 3,
} as const;

// ─── ProposalData ABI decoding ───────────────────────────────────

// ProposalData { string termsDocUri, TZConfig[] zones, address adjudicator, uint256 deadline }
// TZConfig { address party, uint256 agentId, uint32 maxActors, string description, TZMechanism[] mechanisms, TZResourceTokenConfig[] resources }
// TZMechanism { uint8 paramType, uint8 moduleKind, address module, bytes data }
// TZResourceTokenConfig { uint8 tokenType, bytes metadata }

const proposalDataParams = [
  {
    type: "tuple",
    components: [
      { name: "termsDocUri", type: "string" },
      {
        name: "zones",
        type: "tuple[]",
        components: [
          { name: "party", type: "address" },
          { name: "agentId", type: "uint256" },
          { name: "maxActors", type: "uint32" },
          { name: "description", type: "string" },
          {
            name: "mechanisms",
            type: "tuple[]",
            components: [
              { name: "paramType", type: "uint8" },
              { name: "moduleKind", type: "uint8" },
              { name: "module", type: "address" },
              { name: "data", type: "bytes" },
            ],
          },
          {
            name: "resources",
            type: "tuple[]",
            components: [
              { name: "tokenType", type: "uint8" },
              { name: "metadata", type: "bytes" },
            ],
          },
        ],
      },
      { name: "adjudicator", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
  },
] as const;

export interface ParsedProposalData {
  termsDocUri: string;
  adjudicator: Hex;
  deadline: bigint;
  zones: Array<{
    party: Hex;
    agentId: bigint;
    maxActors: number;
    description: string;
    mechanisms: Array<{
      paramType: number;
      moduleKind: number;
      module: Hex;
      data: Hex;
    }>;
    resources: Array<{
      tokenType: number;
      metadata: Hex;
    }>;
  }>;
}

export function parseProposalData(data: Hex): ParsedProposalData {
  const [decoded] = decodeAbiParameters(proposalDataParams, data);
  return {
    termsDocUri: decoded.termsDocUri,
    adjudicator: decoded.adjudicator as Hex,
    deadline: decoded.deadline,
    zones: decoded.zones.map((z: any) => ({
      party: z.party as Hex,
      agentId: z.agentId,
      maxActors: z.maxActors,
      description: z.description,
      mechanisms: z.mechanisms.map((m: any) => ({
        paramType: m.paramType,
        moduleKind: m.moduleKind,
        module: m.module as Hex,
        data: m.data as Hex,
      })),
      resources: z.resources.map((r: any) => ({
        tokenType: r.tokenType,
        metadata: r.metadata as Hex,
      })),
    })),
  };
}

// ─── Resource token metadata decoding ────────────────────────────

// Permission: (string resource, uint256 value, bytes32 period, uint256 expiry, bytes params)
const permissionMetadataParams = [
  { name: "resource", type: "string" },
  { name: "value", type: "uint256" },
  { name: "period", type: "bytes32" },
  { name: "expiry", type: "uint256" },
  { name: "params", type: "bytes" },
] as const;

export interface ParsedPermissionMetadata {
  resource: string;
  value: bigint | null;
  period: string | null;
  expiry: bigint | null;
  params: string | null;  // hex string of the raw bytes, or null if empty
}

export function parsePermissionMetadata(data: Hex): ParsedPermissionMetadata {
  try {
    const [resource, value, periodBytes, expiry, params] = decodeAbiParameters(
      permissionMetadataParams,
      data
    );
    // Decode bytes32 period: trim trailing zeros, decode to string
    const trimmed = trim(periodBytes as Hex, { dir: "right" });
    let period: string | null = null;
    if (trimmed !== "0x" && trimmed !== "0x00") {
      const decoded = fromHex(trimmed as Hex, "string");
      const cleaned = decoded.replace(/\0/g, "");
      if (cleaned.length > 0) period = cleaned;
    }

    return {
      resource: resource as string,
      value: (value as bigint) > 0n ? (value as bigint) : null,
      period,
      expiry: (expiry as bigint) > 0n ? (expiry as bigint) : null,
      params: (params as Hex) !== "0x" && (params as string).length > 2 ? (params as string) : null,
    };
  } catch {
    return { resource: "", value: null, period: null, expiry: null, params: null };
  }
}

// Responsibility: (string obligation, string criteria, uint256 deadline)
const responsibilityMetadataParams = [
  { name: "obligation", type: "string" },
  { name: "criteria", type: "string" },
  { name: "deadline", type: "uint256" },
] as const;

export interface ParsedResponsibilityMetadata {
  obligation: string;
  criteria: string | null;
  deadline: bigint | null;
}

export function parseResponsibilityMetadata(
  data: Hex
): ParsedResponsibilityMetadata {
  try {
    const [obligation, criteria, deadline] = decodeAbiParameters(
      responsibilityMetadataParams,
      data
    );
    return {
      obligation: obligation as string,
      criteria: (criteria as string) || null,
      deadline: (deadline as bigint) > 0n ? (deadline as bigint) : null,
    };
  } catch {
    return { obligation: "", criteria: null, deadline: null };
  }
}

// Directive: (string rule, string severity, bytes params)
const directiveMetadataParams = [
  { name: "rule", type: "string" },
  { name: "severity", type: "string" },
  { name: "params", type: "bytes" },
] as const;

export interface ParsedDirectiveMetadata {
  rule: string;
  severity: string | null;
  params: string | null;
}

export function parseDirectiveMetadata(data: Hex): ParsedDirectiveMetadata {
  try {
    const [rule, severity, params] = decodeAbiParameters(
      directiveMetadataParams,
      data
    );
    return {
      rule: rule as string,
      severity: (severity as string) || null,
      params: (params as Hex) !== "0x" ? (params as string) : null,
    };
  } catch {
    return { rule: "", severity: null, params: null };
  }
}
