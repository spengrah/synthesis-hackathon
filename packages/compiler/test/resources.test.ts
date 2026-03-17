import { describe, it, expect } from "vitest";
import {
  encodePermission,
  decodePermission,
  encodeResponsibility,
  decodeResponsibility,
  encodeDirective,
  decodeDirective,
  parseRateLimit,
  formatRateLimit,
} from "../src/resources.js";

describe("parseRateLimit", () => {
  it("parses '10/hour'", () => {
    const rl = parseRateLimit("10/hour");
    expect(rl.value).toBe(10n);
    expect(rl.period).toBe("hour");
  });

  it("parses '100/day'", () => {
    const rl = parseRateLimit("100/day");
    expect(rl.value).toBe(100n);
    expect(rl.period).toBe("day");
  });

  it("throws on invalid format", () => {
    expect(() => parseRateLimit("noslash")).toThrow();
  });
});

describe("formatRateLimit", () => {
  it("formats back to string", () => {
    expect(formatRateLimit(10n, "hour")).toBe("10/hour");
  });

  it("returns undefined for zero values", () => {
    expect(formatRateLimit(0n, "")).toBeUndefined();
  });
});

describe("Permission encode/decode", () => {
  it("roundtrips with all fields", () => {
    const entry = {
      resource: "/market-data",
      rateLimit: "10/hour",
      expiry: 1710700000,
      purpose: "Market analysis",
    };
    const encoded = encodePermission(entry);
    const decoded = decodePermission(encoded);
    expect(decoded).toEqual(entry);
  });

  it("roundtrips with only resource", () => {
    const entry = { resource: "/api/v1/data" };
    const encoded = encodePermission(entry);
    const decoded = decodePermission(encoded);
    expect(decoded).toEqual(entry);
  });

  it("roundtrips with rateLimit only", () => {
    const entry = { resource: "/endpoint", rateLimit: "50/day" };
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
