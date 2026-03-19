import {
  encodeAbiParameters,
  decodeAbiParameters,
  toHex,
  fromHex,
  stringToHex,
  pad,
  trim,
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
  { name: "value", type: "uint256" as const },
  { name: "period", type: "bytes32" as const },
  { name: "expiry", type: "uint256" as const },
  { name: "params", type: "bytes" as const },
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

// ---- Permission ----

export function encodePermission(entry: PermissionEntry): Hex {
  const value = BigInt(entry.value ?? 0);
  const period: Hex = entry.period
    ? pad(stringToHex(entry.period), { dir: "right", size: 32 })
    : ("0x" + "00".repeat(32)) as Hex;
  let paramsHex: Hex = "0x";
  if (entry.params && Object.keys(entry.params).length > 0) {
    const json = JSON.stringify(entry.params);
    paramsHex = toHex(new TextEncoder().encode(json));
  }
  return encodeAbiParameters(permissionParams, [
    entry.resource,
    value,
    period,
    BigInt(entry.expiry ?? 0),
    paramsHex,
  ]);
}

export function decodePermission(metadata: Hex): PermissionEntry {
  const [resource, value, periodBytes, expiry, paramsBytes] = decodeAbiParameters(permissionParams, metadata);
  const result: PermissionEntry = { resource };

  if (value !== 0n) result.value = Number(value);

  // Decode bytes32 period: trim trailing zeros, decode to string
  const trimmed = trim(periodBytes as Hex, { dir: "right" });
  if (trimmed !== "0x" && trimmed !== "0x00") {
    const decoded = fromHex(trimmed as Hex, "string");
    // Filter out strings that are only null characters
    const cleaned = decoded.replace(/\0/g, "");
    if (cleaned.length > 0) result.period = cleaned;
  }

  if (expiry !== 0n) result.expiry = Number(expiry);

  if (paramsBytes !== "0x" && (paramsBytes as string).length > 2) {
    const bytes = fromHex(paramsBytes as Hex, "bytes");
    const json = new TextDecoder().decode(bytes);
    result.params = JSON.parse(json);
  }
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
