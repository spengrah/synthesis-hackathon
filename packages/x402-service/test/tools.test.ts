import { describe, it, expect } from "vitest";
import type { TZSchemaDocument } from "@trust-zones/compiler";
import type { Hex } from "viem";

import { handleCompile, handleDecompile } from "../src/tools/compile.js";
import { handleEncode } from "../src/tools/encode.js";
import { handleDecodeEvent } from "../src/tools/decode.js";
import { handleGraphql } from "../src/tools/graphql.js";
import { handleExplain } from "../src/tools/explain.js";

// ---- Test fixtures ----

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const PARTY_A = "0xFBEE1e3d2c4488CbFfd2E2b9Cae7C7e2D56b0aA4";
const PARTY_B = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // hardhat account #1 (valid checksum)

const MINIMAL_SCHEMA: TZSchemaDocument = {
  version: "0.1.0",
  zones: [
    {
      actor: { address: PARTY_A, agentId: 1 },
      maxActors: 1,
      description: "Zone A",
      permissions: [{ resource: "tweet-post", value: 10, period: "day" }],
      responsibilities: [{ obligation: "Post about the game" }],
      directives: [{ rule: "Do not spam", severity: "severe" }],
    },
    {
      actor: { address: PARTY_B, agentId: 2 },
      maxActors: 1,
      description: "Zone B",
      permissions: [{ resource: "data-api-read", value: 100, period: "hour" }],
      directives: [{ rule: "Do not redistribute data", severity: "severe" }],
    },
  ],
  adjudicator: { address: ZERO_ADDR },
  deadline: 1711000000,
};

const TEMPTATION_SCHEMA: TZSchemaDocument = {
  version: "0.1.0",
  zones: [
    {
      actor: { address: PARTY_A, agentId: 1 },
      maxActors: 1,
      description: "Zone A — Temptee",
      incentives: [
        {
          template: "staking",
          params: {
            token: USDC_BASE,
            minStake: "1000000",
            cooldownPeriod: 86400,
          },
        },
      ],
      permissions: [
        { resource: "tweet-post", value: 10, period: "day" },
        { resource: "vault-withdraw", value: 1000000000000000 },
      ],
      responsibilities: [
        { obligation: "Post about the temptation game" },
        { obligation: "Include agentId and agreement link" },
        { obligation: "Attribute @synthesis_md" },
      ],
      directives: [
        { rule: "Do not post anything else", severity: "severe" },
        { rule: "Do not withdraw from Temptation Vault", severity: "severe" },
      ],
    },
    {
      actor: { address: PARTY_B, agentId: 2 },
      maxActors: 1,
      description: "Zone B — Tempter",
      incentives: [
        {
          template: "staking",
          params: {
            token: USDC_BASE,
            minStake: "1000000",
            cooldownPeriod: 86400,
          },
        },
      ],
      permissions: [
        { resource: "data-api-read", value: 100, period: "hour" },
      ],
      directives: [
        { rule: "Do not redistribute data", severity: "severe" },
      ],
    },
  ],
  adjudicator: { address: ZERO_ADDR },
  deadline: 1711000000,
};

// ---- compile tool ----

describe("compile", () => {
  it("compiles a minimal schema to ProposalData hex", () => {
    const result = handleCompile({ tzSchemaDoc: MINIMAL_SCHEMA });
    expect(result.proposalData).toMatch(/^0x/);
    expect(result.termsHash).toMatch(/^0x/);
    expect(result.proposalData.length).toBeGreaterThan(10);
  });

  it("compiles the full temptation game schema", () => {
    const result = handleCompile({ tzSchemaDoc: TEMPTATION_SCHEMA });
    expect(result.proposalData).toMatch(/^0x/);
    expect(result.termsHash).toMatch(/^0x/);
  });

  it("throws on missing version", () => {
    const bad = { ...MINIMAL_SCHEMA, version: undefined } as unknown as TZSchemaDocument;
    expect(() => handleCompile({ tzSchemaDoc: bad })).toThrow("Unsupported schema version");
  });

  it("throws on wrong version", () => {
    const bad = { ...MINIMAL_SCHEMA, version: "99.0.0" };
    expect(() => handleCompile({ tzSchemaDoc: bad })).toThrow("Unsupported schema version");
  });
});

// ---- decompile tool ----

describe("decompile", () => {
  it("roundtrips: compile then decompile returns equivalent schema", () => {
    const compiled = handleCompile({ tzSchemaDoc: MINIMAL_SCHEMA });
    const result = handleDecompile({ proposalData: compiled.proposalData });
    expect(result.tzSchemaDoc.version).toBe("0.1.0");
    expect(result.tzSchemaDoc.zones).toHaveLength(2);
    expect(result.tzSchemaDoc.zones[0].permissions?.[0]?.resource).toBe("tweet-post");
    expect(result.tzSchemaDoc.zones[1].directives?.[0]?.rule).toBe("Do not redistribute data");
  });

  it("roundtrips the temptation game schema", () => {
    const compiled = handleCompile({ tzSchemaDoc: TEMPTATION_SCHEMA });
    const result = handleDecompile({ proposalData: compiled.proposalData });
    expect(result.tzSchemaDoc.zones).toHaveLength(2);
    expect(result.tzSchemaDoc.zones[0].responsibilities).toHaveLength(3);
    expect(result.tzSchemaDoc.zones[0].directives).toHaveLength(2);
  });

  it("throws on invalid hex", () => {
    expect(() => handleDecompile({ proposalData: "0xdeadbeef" as Hex })).toThrow();
  });
});

// ---- encode tool ----

describe("encode", () => {
  it("encodes accept (no params)", () => {
    const result = handleEncode({ inputId: "accept" });
    expect(result.inputId).toMatch(/^0x/);
    expect(result.payload).toMatch(/^0x/);
    expect(result.calldata).toMatch(/^0x/);
    expect(result.calldata.length).toBeGreaterThan(10);
  });

  it("encodes reject (no params)", () => {
    const result = handleEncode({ inputId: "reject" });
    expect(result.inputId).toMatch(/^0x/);
  });

  it("encodes withdraw", () => {
    const result = handleEncode({ inputId: "withdraw" });
    expect(result.calldata).toMatch(/^0x/);
  });

  it("encodes setup", () => {
    const result = handleEncode({ inputId: "setup" });
    expect(result.calldata).toMatch(/^0x/);
  });

  it("encodes set_up (alias)", () => {
    const result = handleEncode({ inputId: "set_up" });
    expect(result.calldata).toMatch(/^0x/);
  });

  it("encodes activate", () => {
    const result = handleEncode({ inputId: "activate" });
    expect(result.calldata).toMatch(/^0x/);
  });

  it("encodes finalize", () => {
    const result = handleEncode({ inputId: "finalize" });
    expect(result.calldata).toMatch(/^0x/);
  });

  it("encodes claim with params", () => {
    const result = handleEncode({
      inputId: "claim",
      params: { mechanismIndex: 0, evidence: "0xabcd" },
    });
    expect(result.calldata).toMatch(/^0x/);
  });

  it("encodes complete with feedback", () => {
    const result = handleEncode({
      inputId: "complete",
      params: {
        feedbackURI: "ipfs://QmTest",
        feedbackHash: "0x" + "ab".repeat(32),
      },
    });
    expect(result.calldata).toMatch(/^0x/);
  });

  it("encodes exit with feedback", () => {
    const result = handleEncode({
      inputId: "exit",
      params: {
        feedbackURI: "ipfs://QmTest",
        feedbackHash: "0x" + "cd".repeat(32),
      },
    });
    expect(result.calldata).toMatch(/^0x/);
  });

  it("throws on unknown inputId", () => {
    expect(() => handleEncode({ inputId: "invalid" })).toThrow("Unknown inputId: invalid");
  });

  it("is case-insensitive", () => {
    const result = handleEncode({ inputId: "ACCEPT" });
    expect(result.calldata).toMatch(/^0x/);
  });
});

// ---- decode_event tool ----

describe("decode_event", () => {
  it("throws on invalid event data", () => {
    expect(() =>
      handleDecodeEvent({
        eventName: "ProposalSubmitted",
        topics: ["0x0000000000000000000000000000000000000000000000000000000000000000"],
        data: "0x",
      }),
    ).toThrow();
  });
});

// ---- graphql tool (requires running Ponder, so test error handling) ----

describe("graphql", () => {
  it("throws when Ponder is unreachable", async () => {
    // Point at a port that's not running
    const original = process.env.PONDER_URL;
    process.env.PONDER_URL = "http://localhost:19999";

    await expect(
      handleGraphql({ query: "{ agreements { items { id } } }" }),
    ).rejects.toThrow();

    process.env.PONDER_URL = original;
  });
});

// ---- explain tool (requires running Ponder, so test error handling) ----

describe("explain", () => {
  it("throws when Ponder is unreachable", async () => {
    const original = process.env.PONDER_URL;
    process.env.PONDER_URL = "http://localhost:19999";

    await expect(
      handleExplain({ agreement: ZERO_ADDR }),
    ).rejects.toThrow();

    process.env.PONDER_URL = original;
  });
});
