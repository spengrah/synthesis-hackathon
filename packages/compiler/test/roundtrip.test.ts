import { describe, it, expect } from "vitest";
import type { Address } from "viem";
import { compile } from "../src/compile.js";
import { decompile } from "../src/decompile.js";
import { createDefaultRegistry } from "../src/templates/index.js";
import type { TZSchemaDocument, CompilerConfig } from "../src/types.js";

// Test addresses
const PARTY_A = "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa" as Address;
const PARTY_B = "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB" as Address;
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address;
const ADJUDICATOR = "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC" as Address;
const TARGET = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as Address;

const config: CompilerConfig = {
  modules: {
    "budget-cap": "0x1111111111111111111111111111111111111111" as Address,
    "target-allowlist": "0x2222222222222222222222222222222222222222" as Address,
    "time-lock": "0x3333333333333333333333333333333333333333" as Address,
    "staking": "0x4444444444444444444444444444444444444444" as Address,
    "reputation-gate": "0x5555555555555555555555555555555555555555" as Address,
    "erc20-balance": "0x6666666666666666666666666666666666666666" as Address,
    "allowlist": "0x7777777777777777777777777777777777777777" as Address,
    "hat-wearing": "0x8888888888888888888888888888888888888888" as Address,
  },
  adjudicators: {
    "stub-adjudicator": ADJUDICATOR,
  },
};

const registry = createDefaultRegistry();

describe("compile → decompile roundtrip", () => {
  it("roundtrips a minimal schema doc", () => {
    const doc: TZSchemaDocument = {
      version: "0.1.0",
      zones: [
        {
          actor: { address: PARTY_A, agentId: 0 },
          hatMaxSupply: 1,
          hatDetails: "Zone A",
        },
      ],
      adjudicator: { template: "stub-adjudicator" },
      deadline: 1710700000,
    };

    const proposalData = compile(doc, config, registry);
    const result = decompile(proposalData, config, registry);
    expect(result).toEqual(doc);
  });

  it("roundtrips a doc with constraints and resources", () => {
    const doc: TZSchemaDocument = {
      version: "0.1.0",
      zones: [
        {
          actor: { address: PARTY_A, agentId: 42 },
          hatMaxSupply: 1,
          hatDetails: "Zone A — A's data exposed to B",
          constraints: [
            { template: "budget-cap", params: { token: USDC, limit: "1000000" } },
            { template: "target-allowlist", params: { targets: [TARGET] } },
          ],
          permissions: [
            { resource: "/market-data", rateLimit: "10/hour", purpose: "Market analysis" },
          ],
          directives: [
            { rule: "attribution", severity: "moderate" },
          ],
        },
      ],
      adjudicator: { template: "stub-adjudicator" },
      deadline: 1710700000,
    };

    const proposalData = compile(doc, config, registry);
    expect(proposalData.termsDocUri).toBe("");
    expect(proposalData.zones.length).toBe(1);
    expect(proposalData.zones[0].mechanisms.length).toBe(2);
    expect(proposalData.zones[0].resources.length).toBe(2);

    const result = decompile(proposalData, config, registry);
    expect(result).toEqual(doc);
  });

  it("roundtrips a doc with incentives and eligibilities", () => {
    const doc: TZSchemaDocument = {
      version: "0.1.0",
      zones: [
        {
          actor: { address: PARTY_A, agentId: 1 },
          hatMaxSupply: 1,
          hatDetails: "Zone A",
          eligibilities: [
            { template: "reputation-gate", params: { minScore: 50 } },
          ],
          incentives: [
            { template: "staking", params: { token: USDC, minStake: "5000000000000000", cooldownPeriod: 86400 } },
          ],
          responsibilities: [
            { obligation: "Uptime guarantee", criteria: "99%" },
          ],
        },
      ],
      adjudicator: { template: "stub-adjudicator" },
      deadline: 1710700000,
    };

    const proposalData = compile(doc, config, registry);
    const result = decompile(proposalData, config, registry);
    expect(result).toEqual(doc);
  });

  it("roundtrips with raw adjudicator address", () => {
    const doc: TZSchemaDocument = {
      version: "0.1.0",
      zones: [
        {
          actor: { address: PARTY_A, agentId: 0 },
          hatMaxSupply: 1,
          hatDetails: "Zone A",
        },
      ],
      adjudicator: { address: "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF" as Address },
      deadline: 1710700000,
    };

    const proposalData = compile(doc, config, registry);
    const result = decompile(proposalData, config, registry);
    expect(result).toEqual(doc);
  });

  it("roundtrips a two-zone doc (demo scenario)", () => {
    const doc: TZSchemaDocument = {
      version: "0.1.0",
      zones: [
        {
          actor: { address: PARTY_A, agentId: 1 },
          hatMaxSupply: 1,
          hatDetails: "Zone 1 — A's data exposed to B",
          constraints: [
            { template: "budget-cap", params: { token: USDC, limit: "1000000" } },
          ],
          incentives: [
            { template: "staking", params: { token: USDC, minStake: "3000000000000000", cooldownPeriod: 86400 } },
          ],
          permissions: [
            { resource: "/market-data", rateLimit: "10/hour" },
            { resource: "/sentiment-analysis", expiry: 1710700000 },
          ],
          directives: [
            { rule: "attribution", severity: "moderate" },
            { rule: "no-redistribution", severity: "severe" },
          ],
        },
        {
          actor: { address: PARTY_B, agentId: 2 },
          hatMaxSupply: 1,
          hatDetails: "Zone 2 — B's data exposed to A",
          constraints: [
            { template: "budget-cap", params: { token: USDC, limit: "2000000" } },
          ],
          incentives: [
            { template: "staking", params: { token: USDC, minStake: "4000000000000000", cooldownPeriod: 86400 } },
          ],
          permissions: [
            { resource: "/social-graph", rateLimit: "20/hour" },
            { resource: "/trend-signals" },
          ],
          directives: [
            { rule: "no-model-training", severity: "severe" },
          ],
        },
      ],
      adjudicator: { template: "stub-adjudicator" },
      deadline: 1710700000,
    };

    const proposalData = compile(doc, config, registry);
    expect(proposalData.zones.length).toBe(2);

    const result = decompile(proposalData, config, registry);
    expect(result).toEqual(doc);
  });
});
