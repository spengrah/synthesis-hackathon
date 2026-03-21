import { describe, it, expect } from "vitest";
import {
  encodePermission,
  decodePermission,
  encodeResponsibility,
  decodeResponsibility,
  encodeDirective,
  decodeDirective,
} from "../src/resources.js";

describe("Permission encode/decode", () => {
  it("roundtrips with all fields", () => {
    const entry = {
      resource: "/market-data",
      value: 10,
      period: "hour",
      expiry: 1710700000,
      params: { purpose: "Market analysis" },
    };
    const encoded = encodePermission(entry);
    const decoded = decodePermission(encoded);
    expect(decoded).toEqual(entry);
  });

  it("roundtrips with only resource", () => {
    const entry = { resource: "/api" };
    const encoded = encodePermission(entry);
    const decoded = decodePermission(encoded);
    expect(decoded).toEqual(entry);
  });

  it("roundtrips with value+period only", () => {
    const entry = { resource: "/endpoint", value: 50, period: "day" };
    const encoded = encodePermission(entry);
    const decoded = decodePermission(encoded);
    expect(decoded).toEqual(entry);
  });

  it("roundtrips with params containing an address", () => {
    const entry = {
      resource: "vault-withdraw",
      value: 1_150_000,
      period: "total",
      params: { temptation: "0x1234567890abcdef1234567890abcdef12345678" },
    };
    const encoded = encodePermission(entry);
    const decoded = decodePermission(encoded);
    expect(decoded).toEqual(entry);
  });
});

describe("Responsibility encode/decode", () => {
  it("roundtrips with all fields", () => {
    const entry = {
      obligation: "Provide uptime guarantee",
      criteria: "99% over agreement period",
      deadline: 1710700000,
    };
    const encoded = encodeResponsibility(entry);
    const decoded = decodeResponsibility(encoded);
    expect(decoded).toEqual(entry);
  });

  it("roundtrips with only obligation", () => {
    const entry = { obligation: "Deliver report" };
    const encoded = encodeResponsibility(entry);
    const decoded = decodeResponsibility(encoded);
    expect(decoded).toEqual(entry);
  });
});

describe("Directive encode/decode", () => {
  it("roundtrips with all fields", () => {
    const entry = {
      rule: "attribution",
      severity: "moderate",
      params: { source: "required", format: "APA" },
    };
    const encoded = encodeDirective(entry);
    const decoded = decodeDirective(encoded);
    expect(decoded).toEqual(entry);
  });

  it("roundtrips with only rule", () => {
    const entry = { rule: "no-redistribution" };
    const encoded = encodeDirective(entry);
    const decoded = decodeDirective(encoded);
    expect(decoded).toEqual(entry);
  });

  it("roundtrips with severity, no params", () => {
    const entry = { rule: "rate-limit", severity: "severe" };
    const encoded = encodeDirective(entry);
    const decoded = decodeDirective(encoded);
    expect(decoded).toEqual(entry);
  });
});
