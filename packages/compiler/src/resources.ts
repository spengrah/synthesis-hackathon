import {
  encodeAbiParameters,
  decodeAbiParameters,
  toHex,
  fromHex,
  type Hex,
} from "viem";
import type {
  PermissionEntry,
  ResponsibilityEntry,
  DirectiveEntry,
} from "./types.js";

// ---- ABI definitions ----

const permissionParams = [
  { name: "resource", type: "string" as const },
  {
    name: "rateLimit",
    type: "tuple" as const,
    components: [
      { name: "value", type: "uint256" as const },
      { name: "period", type: "string" as const },
    ],
  },
  { name: "expiry", type: "uint256" as const },
  { name: "purpose", type: "string" as const },
] as const;

const responsibilityParams = [
  { name: "obligation", type: "string" as const },
  { name: "criteria", type: "string" as const },
  { name: "deadline", type: "uint256" as const },
] as const;

const directiveParams = [
  { name: "rule", type: "string" as const },
  { name: "severity", type: "string" as const },
  { name: "params", type: "bytes" as const },
] as const;

// ---- Rate limit helpers ----

export function parseRateLimit(s: string): { value: bigint; period: string } {
  const idx = s.indexOf("/");
  if (idx === -1) throw new Error(`Invalid rateLimit format: "${s}" (expected "value/period")`);
  return {
    value: BigInt(s.slice(0, idx)),
    period: s.slice(idx + 1),
  };
}

export function formatRateLimit(value: bigint, period: string): string | undefined {
  if (value === 0n && period === "") return undefined;
  return `${value}/${period}`;
}

// ---- Permission ----

export function encodePermission(entry: PermissionEntry): Hex {
  const rl = entry.rateLimit ? parseRateLimit(entry.rateLimit) : { value: 0n, period: "" };
  return encodeAbiParameters(permissionParams, [
    entry.resource,
    { value: rl.value, period: rl.period },
    BigInt(entry.expiry ?? 0),
    entry.purpose ?? "",
  ]);
}

export function decodePermission(metadata: Hex): PermissionEntry {
  const [resource, rateLimit, expiry, purpose] = decodeAbiParameters(permissionParams, metadata);
  const result: PermissionEntry = { resource };
  const rl = formatRateLimit(rateLimit.value, rateLimit.period);
  if (rl) result.rateLimit = rl;
  if (expiry !== 0n) result.expiry = Number(expiry);
  if (purpose !== "") result.purpose = purpose;
  return result;
}

// ---- Responsibility ----

export function encodeResponsibility(entry: ResponsibilityEntry): Hex {
  return encodeAbiParameters(responsibilityParams, [
    entry.obligation,
    entry.criteria ?? "",
    BigInt(entry.deadline ?? 0),
  ]);
}

export function decodeResponsibility(metadata: Hex): ResponsibilityEntry {
  const [obligation, criteria, deadline] = decodeAbiParameters(responsibilityParams, metadata);
  const result: ResponsibilityEntry = { obligation };
  if (criteria !== "") result.criteria = criteria;
  if (deadline !== 0n) result.deadline = Number(deadline);
  return result;
}

// ---- Directive ----

export function encodeDirective(entry: DirectiveEntry): Hex {
  let paramsHex: Hex = "0x";
  if (entry.params && Object.keys(entry.params).length > 0) {
    const json = JSON.stringify(entry.params);
    paramsHex = toHex(new TextEncoder().encode(json));
  }
  return encodeAbiParameters(directiveParams, [
    entry.rule,
    entry.severity ?? "",
    paramsHex,
  ]);
}

export function decodeDirective(metadata: Hex): DirectiveEntry {
  const [rule, severity, paramsBytes] = decodeAbiParameters(directiveParams, metadata);
  const result: DirectiveEntry = { rule };
  if (severity !== "") result.severity = severity;
  if (paramsBytes !== "0x" && (paramsBytes as string).length > 2) {
    const bytes = fromHex(paramsBytes as Hex, "bytes");
    const json = new TextDecoder().decode(bytes);
    result.params = JSON.parse(json);
  }
  return result;
}
