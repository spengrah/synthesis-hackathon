import { describe, it, expect } from "vitest";
import type { Address } from "viem";
import { TZParamType, TZModuleKind } from "@trust-zones/sdk";
import { compile } from "../src/compile.js";
import { createDefaultRegistry } from "../src/templates/index.js";
import type { TZSchemaDocument, CompilerConfig } from "../src/types.js";

const PARTY_A = "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa" as Address;
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address;
const ADJUDICATOR = "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC" as Address;

const config: CompilerConfig = {
  modules: {
    "budget-cap": "0x1111111111111111111111111111111111111111" as Address,
    "staking": "0x4444444444444444444444444444444444444444" as Address,
  },
  adjudicators: {
    "stub-adjudicator": ADJUDICATOR,
  },
};

const registry = createDefaultRegistry();

describe("compile", () => {
  it("sets termsDocUri to empty string", () => {
    const doc: TZSchemaDocument = {
      version: "0.1.0",
      zones: [{ actor: { address: PARTY_A, agentId: 0 }, hatMaxSupply: 1, hatDetails: "Z" }],
      adjudicator: { template: "stub-adjudicator" },
      deadline: 1710700000,
    };
    const result = compile(doc, config, registry);
    expect(result.termsDocUri).toBe("");
  });

  it("converts deadline to bigint", () => {
    const doc: TZSchemaDocument = {
      version: "0.1.0",
      zones: [{ actor: { address: PARTY_A, agentId: 0 }, hatMaxSupply: 1, hatDetails: "Z" }],
      adjudicator: { template: "stub-adjudicator" },
      deadline: 1710700000,
    };
    const result = compile(doc, config, registry);
    expect(result.deadline).toBe(1710700000n);
  });

  it("resolves adjudicator template to address", () => {
    const doc: TZSchemaDocument = {
      version: "0.1.0",
      zones: [{ actor: { address: PARTY_A, agentId: 0 }, hatMaxSupply: 1, hatDetails: "Z" }],
      adjudicator: { template: "stub-adjudicator" },
      deadline: 1710700000,
    };
    const result = compile(doc, config, registry);
    expect(result.adjudicator).toBe(ADJUDICATOR);
  });

  it("passes through raw adjudicator address", () => {
    const raw = "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF" as Address;
    const doc: TZSchemaDocument = {
      version: "0.1.0",
      zones: [{ actor: { address: PARTY_A, agentId: 0 }, hatMaxSupply: 1, hatDetails: "Z" }],
      adjudicator: { address: raw },
      deadline: 1710700000,
    };
    const result = compile(doc, config, registry);
    expect(result.adjudicator).toBe(raw);
  });

  it("produces correct paramType and moduleKind for constraint", () => {
    const doc: TZSchemaDocument = {
      version: "0.1.0",
      zones: [{
        actor: { address: PARTY_A, agentId: 0 },
        hatMaxSupply: 1,
        hatDetails: "Z",
        constraints: [{ template: "budget-cap", params: { token: USDC, limit: "1000" } }],
      }],
      adjudicator: { template: "stub-adjudicator" },
      deadline: 1710700000,
    };
    const result = compile(doc, config, registry);
    expect(result.zones[0].mechanisms[0].paramType).toBe(TZParamType.Constraint);
    expect(result.zones[0].mechanisms[0].moduleKind).toBe(TZModuleKind.ERC7579Hook);
  });

  it("produces correct paramType and moduleKind for incentive (staking)", () => {
    const doc: TZSchemaDocument = {
      version: "0.1.0",
      zones: [{
        actor: { address: PARTY_A, agentId: 0 },
        hatMaxSupply: 1,
        hatDetails: "Z",
        incentives: [{ template: "staking", params: { token: USDC, minStake: "1000", cooldownPeriod: 86400 } }],
      }],
      adjudicator: { template: "stub-adjudicator" },
      deadline: 1710700000,
    };
    const result = compile(doc, config, registry);
    expect(result.zones[0].mechanisms[0].paramType).toBe(TZParamType.Penalty);
    expect(result.zones[0].mechanisms[0].moduleKind).toBe(TZModuleKind.HatsModule);
  });

  it("throws on unknown template", () => {
    const doc: TZSchemaDocument = {
      version: "0.1.0",
      zones: [{
        actor: { address: PARTY_A, agentId: 0 },
        hatMaxSupply: 1,
        hatDetails: "Z",
        constraints: [{ template: "nonexistent", params: {} }],
      }],
      adjudicator: { template: "stub-adjudicator" },
      deadline: 1710700000,
    };
    expect(() => compile(doc, config, registry)).toThrow('Unknown template: "nonexistent"');
  });

  it("throws on missing module address", () => {
    const sparseConfig: CompilerConfig = { modules: {}, adjudicators: { "stub-adjudicator": ADJUDICATOR } };
    const doc: TZSchemaDocument = {
      version: "0.1.0",
      zones: [{
        actor: { address: PARTY_A, agentId: 0 },
        hatMaxSupply: 1,
        hatDetails: "Z",
        constraints: [{ template: "budget-cap", params: { token: USDC, limit: "1000" } }],
      }],
      adjudicator: { template: "stub-adjudicator" },
      deadline: 1710700000,
    };
    expect(() => compile(doc, sparseConfig, registry)).toThrow('No module address');
  });

  it("throws on unsupported version", () => {
    const doc = {
      version: "99.0.0",
      zones: [],
      adjudicator: { template: "stub-adjudicator" },
      deadline: 1710700000,
    } as unknown as TZSchemaDocument;
    expect(() => compile(doc, config, registry)).toThrow("Unsupported schema version");
  });
});
