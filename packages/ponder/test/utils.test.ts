import { describe, it, expect } from "vitest";
import {
  keccak256,
  toHex,
  encodeAbiParameters,
  stringToHex,
  pad,
  type Hex,
} from "viem";
import {
  decodeBytes32,
  parseProposalData,
  parsePermissionMetadata,
  parseResponsibilityMetadata,
  parseDirectiveMetadata,
  PARAM_TYPE,
  TOKEN_TYPE,
  MODULE_KIND_LABELS,
} from "../src/utils.js";

// ─── decodeBytes32 ──────────────────────────────────────────────

describe("decodeBytes32", () => {
  const states = ["PROPOSED", "NEGOTIATING", "ACCEPTED", "READY", "ACTIVE", "CLOSED", "REJECTED"] as const;
  const outcomes = ["COMPLETED", "EXITED", "EXPIRED", "ADJUDICATED"] as const;
  const actionTypes = ["PENALIZE", "REWARD", "FEEDBACK", "DEACTIVATE", "CLOSE"] as const;

  describe("states", () => {
    for (const label of states) {
      it(`decodes ${label}`, () => {
        const hash = keccak256(toHex(label));
        expect(decodeBytes32(hash)).toBe(label);
      });
    }
  });

  describe("outcomes", () => {
    for (const label of outcomes) {
      it(`decodes ${label}`, () => {
        const hash = keccak256(toHex(label));
        expect(decodeBytes32(hash)).toBe(label);
      });
    }
  });

  describe("action types", () => {
    for (const label of actionTypes) {
      it(`decodes ${label}`, () => {
        const hash = keccak256(toHex(label));
        expect(decodeBytes32(hash)).toBe(label);
      });
    }
  });

  it("returns the hex string for unknown hashes", () => {
    const unknownHash = keccak256(toHex("UNKNOWN_LABEL"));
    expect(decodeBytes32(unknownHash)).toBe(unknownHash);
  });
});

// ─── PARAM_TYPE ─────────────────────────────────────────────────

describe("PARAM_TYPE", () => {
  it("has correct values", () => {
    expect(PARAM_TYPE.Constraint).toBe(0);
    expect(PARAM_TYPE.Permission).toBe(1);
    expect(PARAM_TYPE.Responsibility).toBe(2);
    expect(PARAM_TYPE.Directive).toBe(3);
    expect(PARAM_TYPE.Eligibility).toBe(4);
    expect(PARAM_TYPE.Reward).toBe(5);
    expect(PARAM_TYPE.Penalty).toBe(6);
    expect(PARAM_TYPE.PrincipalAlignment).toBe(7);
    expect(PARAM_TYPE.DecisionModel).toBe(8);
  });
});

// ─── MODULE_KIND_LABELS ────────────────────────────────────────

describe("MODULE_KIND_LABELS", () => {
  it("has correct values", () => {
    expect(MODULE_KIND_LABELS[0]).toBe("HatsModule");
    expect(MODULE_KIND_LABELS[1]).toBe("ERC7579Hook");
    expect(MODULE_KIND_LABELS[2]).toBe("External");
  });
});

// ─── TOKEN_TYPE ─────────────────────────────────────────────────

describe("TOKEN_TYPE", () => {
  it("has correct values", () => {
    expect(TOKEN_TYPE.Permission).toBe(1);
    expect(TOKEN_TYPE.Responsibility).toBe(2);
    expect(TOKEN_TYPE.Directive).toBe(3);
  });
});

// ─── parseProposalData ──────────────────────────────────────────

const proposalDataAbi = [
  {
    type: "tuple" as const,
    components: [
      { name: "termsDocUri", type: "string" as const },
      {
        name: "zones",
        type: "tuple[]" as const,
        components: [
          { name: "party", type: "address" as const },
          { name: "agentId", type: "uint256" as const },
          { name: "hatMaxSupply", type: "uint32" as const },
          { name: "hatDetails", type: "string" as const },
          {
            name: "mechanisms",
            type: "tuple[]" as const,
            components: [
              { name: "paramType", type: "uint8" as const },
              { name: "moduleKind", type: "uint8" as const },
              { name: "module", type: "address" as const },
              { name: "data", type: "bytes" as const },
            ],
          },
          {
            name: "resources",
            type: "tuple[]" as const,
            components: [
              { name: "tokenType", type: "uint8" as const },
              { name: "metadata", type: "bytes" as const },
            ],
          },
        ],
      },
      { name: "adjudicator", type: "address" as const },
      { name: "deadline", type: "uint256" as const },
    ],
  },
] as const;

describe("parseProposalData", () => {
  const partyA = "0x1111111111111111111111111111111111111111" as Hex;
  const partyB = "0x2222222222222222222222222222222222222222" as Hex;
  const adjudicator = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Hex;

  it("decodes basic proposal with empty mechanisms and resources", () => {
    const encoded = encodeAbiParameters(proposalDataAbi, [
      {
        termsDocUri: "ipfs://test",
        zones: [
          {
            party: partyA,
            agentId: 1n,
            hatMaxSupply: 10,
            hatDetails: "Zone A",
            mechanisms: [],
            resources: [],
          },
          {
            party: partyB,
            agentId: 2n,
            hatMaxSupply: 5,
            hatDetails: "Zone B",
            mechanisms: [],
            resources: [],
          },
        ],
        adjudicator,
        deadline: 1000000n,
      },
    ]);

    const result = parseProposalData(encoded);

    expect(result.termsDocUri).toBe("ipfs://test");
    expect(result.adjudicator.toLowerCase()).toBe(adjudicator.toLowerCase());
    expect(result.deadline).toBe(1000000n);
    expect(result.zones).toHaveLength(2);

    expect(result.zones[0].party.toLowerCase()).toBe(partyA.toLowerCase());
    expect(result.zones[0].agentId).toBe(1n);
    expect(result.zones[0].hatMaxSupply).toBe(10);
    expect(result.zones[0].hatDetails).toBe("Zone A");
    expect(result.zones[0].mechanisms).toEqual([]);
    expect(result.zones[0].resources).toEqual([]);

    expect(result.zones[1].party.toLowerCase()).toBe(partyB.toLowerCase());
    expect(result.zones[1].agentId).toBe(2n);
    expect(result.zones[1].hatMaxSupply).toBe(5);
    expect(result.zones[1].hatDetails).toBe("Zone B");
  });

  it("decodes proposal with mechanisms and resources", () => {
    const moduleAddr = "0x3333333333333333333333333333333333333333" as Hex;
    const encoded = encodeAbiParameters(proposalDataAbi, [
      {
        termsDocUri: "ipfs://terms",
        zones: [
          {
            party: partyA,
            agentId: 0n,
            hatMaxSupply: 1,
            hatDetails: "Agent zone",
            mechanisms: [
              {
                paramType: PARAM_TYPE.Constraint,
                moduleKind: 1, // ERC7579Hook
                module: moduleAddr,
                data: "0xabcd" as Hex,
              },
            ],
            resources: [
              {
                tokenType: TOKEN_TYPE.Permission,
                metadata: "0x1234" as Hex,
              },
            ],
          },
        ],
        adjudicator,
        deadline: 9999n,
      },
    ]);

    const result = parseProposalData(encoded);

    expect(result.zones).toHaveLength(1);
    expect(result.zones[0].mechanisms).toHaveLength(1);
    expect(result.zones[0].mechanisms[0].paramType).toBe(PARAM_TYPE.Constraint);
    expect(result.zones[0].mechanisms[0].moduleKind).toBe(1);
    expect(result.zones[0].mechanisms[0].module.toLowerCase()).toBe(moduleAddr.toLowerCase());
    expect(result.zones[0].mechanisms[0].data).toBe("0xabcd");

    expect(result.zones[0].resources).toHaveLength(1);
    expect(result.zones[0].resources[0].tokenType).toBe(TOKEN_TYPE.Permission);
    expect(result.zones[0].resources[0].metadata).toBe("0x1234");
  });

  it("round-trips consistently", () => {
    const encoded = encodeAbiParameters(proposalDataAbi, [
      {
        termsDocUri: "ipfs://roundtrip",
        zones: [
          {
            party: partyA,
            agentId: 42n,
            hatMaxSupply: 100,
            hatDetails: "details",
            mechanisms: [],
            resources: [],
          },
        ],
        adjudicator,
        deadline: 500n,
      },
    ]);

    const first = parseProposalData(encoded);
    const second = parseProposalData(encoded);
    expect(first).toEqual(second);
  });
});

// ─── parsePermissionMetadata ────────────────────────────────────

const permissionAbi = [
  { name: "resource", type: "string" as const },
  { name: "value", type: "uint256" as const },
  { name: "period", type: "bytes32" as const },
  { name: "expiry", type: "uint256" as const },
  { name: "params", type: "bytes" as const },
] as const;

describe("parsePermissionMetadata", () => {
  it("decodes full permission metadata", () => {
    const periodBytes = pad(stringToHex("hour"), { dir: "right", size: 32 });
    const paramsHex = toHex(new TextEncoder().encode(JSON.stringify({ purpose: "Market data access" })));
    const encoded = encodeAbiParameters(permissionAbi, [
      "/market-data",
      10n,
      periodBytes,
      1710700000n,
      paramsHex,
    ]);

    const result = parsePermissionMetadata(encoded);

    expect(result.resource).toBe("/market-data");
    expect(result.value).toBe(10n);
    expect(result.period).toBe("hour");
    expect(result.expiry).toBe(1710700000n);
    expect(result.params).toBe(paramsHex);
  });

  it("returns null value when zero", () => {
    const zeroPeriod = ("0x" + "00".repeat(32)) as Hex;
    const encoded = encodeAbiParameters(permissionAbi, [
      "/api",
      0n,
      zeroPeriod,
      1710700000n,
      "0x",
    ]);

    const result = parsePermissionMetadata(encoded);
    expect(result.value).toBeNull();
  });

  it("returns null expiry when zero", () => {
    const periodBytes = pad(stringToHex("day"), { dir: "right", size: 32 });
    const encoded = encodeAbiParameters(permissionAbi, [
      "/api",
      5n,
      periodBytes,
      0n,
      "0x",
    ]);

    const result = parsePermissionMetadata(encoded);
    expect(result.expiry).toBeNull();
  });

  it("returns null params when empty", () => {
    const periodBytes = pad(stringToHex("day"), { dir: "right", size: 32 });
    const encoded = encodeAbiParameters(permissionAbi, [
      "/api",
      5n,
      periodBytes,
      1710700000n,
      "0x",
    ]);

    const result = parsePermissionMetadata(encoded);
    expect(result.params).toBeNull();
  });

  it("returns defaults for malformed data", () => {
    const result = parsePermissionMetadata("0xdeadbeef" as Hex);
    expect(result).toEqual({
      resource: "",
      value: null,
      period: null,
      expiry: null,
      params: null,
    });
  });
});

// ─── parseResponsibilityMetadata ────────────────────────────────

const responsibilityAbi = [
  { name: "obligation", type: "string" as const },
  { name: "criteria", type: "string" as const },
  { name: "deadline", type: "uint256" as const },
] as const;

describe("parseResponsibilityMetadata", () => {
  it("decodes full responsibility metadata", () => {
    const encoded = encodeAbiParameters(responsibilityAbi, [
      "Produce analysis report",
      "Must include 3+ data sources",
      1710700000n,
    ]);

    const result = parseResponsibilityMetadata(encoded);

    expect(result.obligation).toBe("Produce analysis report");
    expect(result.criteria).toBe("Must include 3+ data sources");
    expect(result.deadline).toBe(1710700000n);
  });

  it("returns null criteria when empty", () => {
    const encoded = encodeAbiParameters(responsibilityAbi, [
      "Some obligation",
      "",
      1710700000n,
    ]);

    const result = parseResponsibilityMetadata(encoded);
    expect(result.criteria).toBeNull();
  });

  it("returns null deadline when zero", () => {
    const encoded = encodeAbiParameters(responsibilityAbi, [
      "Some obligation",
      "Some criteria",
      0n,
    ]);

    const result = parseResponsibilityMetadata(encoded);
    expect(result.deadline).toBeNull();
  });

  it("returns defaults for malformed data", () => {
    const result = parseResponsibilityMetadata("0xdeadbeef" as Hex);
    expect(result).toEqual({
      obligation: "",
      criteria: null,
      deadline: null,
    });
  });
});

// ─── parseDirectiveMetadata ─────────────────────────────────────

const directiveAbi = [
  { name: "rule", type: "string" as const },
  { name: "severity", type: "string" as const },
  { name: "params", type: "bytes" as const },
] as const;

describe("parseDirectiveMetadata", () => {
  it("decodes full directive metadata", () => {
    const encoded = encodeAbiParameters(directiveAbi, [
      "rateLimit",
      "moderate",
      "0x1234" as Hex,
    ]);

    const result = parseDirectiveMetadata(encoded);

    expect(result.rule).toBe("rateLimit");
    expect(result.severity).toBe("moderate");
    expect(result.params).toBe("0x1234");
  });

  it("returns null severity when empty", () => {
    const encoded = encodeAbiParameters(directiveAbi, [
      "rateLimit",
      "",
      "0x1234" as Hex,
    ]);

    const result = parseDirectiveMetadata(encoded);
    expect(result.severity).toBeNull();
  });

  it("returns null params when 0x", () => {
    const encoded = encodeAbiParameters(directiveAbi, [
      "rateLimit",
      "moderate",
      "0x" as Hex,
    ]);

    const result = parseDirectiveMetadata(encoded);
    expect(result.params).toBeNull();
  });

  it("returns defaults for malformed data", () => {
    const result = parseDirectiveMetadata("0xdeadbeef" as Hex);
    expect(result).toEqual({
      rule: "",
      severity: null,
      params: null,
    });
  });
});
