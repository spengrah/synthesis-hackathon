import { describe, it, expect } from "vitest";
import type { Hex } from "viem";
import { TZParamType } from "../src/types.js";
import {
  decodeProposalData,
  decodeAdjudicationActions,
  decodeClaim,
  decodeFeedback,
  decodeState,
} from "../src/decode.js";
import * as C from "../src/constants.js";
import fixtures from "./fixtures/abi-fixtures.json";

describe("decodeProposalData", () => {
  it("decodes basic proposal from fixture bytes", () => {
    const data = decodeProposalData(
      fixtures.proposalData.basic.encoded as Hex,
    );
    expect(data.termsDocUri).toBe("");
    expect(data.adjudicator.toLowerCase()).toBe(
      fixtures.addresses.adjudicator.toLowerCase(),
    );
    expect(data.deadline).toBe(1000000n);
    expect(data.zones).toHaveLength(2);

    expect(data.zones[0].party.toLowerCase()).toBe(
      fixtures.addresses.partyA.toLowerCase(),
    );
    expect(data.zones[0].agentId).toBe(0n);
    expect(data.zones[0].hatMaxSupply).toBe(1);
    expect(data.zones[0].hatDetails).toBe("Test Zone Hat");
    expect(data.zones[0].mechanisms).toHaveLength(0);
    expect(data.zones[0].resources).toHaveLength(0);

    expect(data.zones[1].party.toLowerCase()).toBe(
      fixtures.addresses.partyB.toLowerCase(),
    );
  });

  it("decodes rich proposal from fixture bytes", () => {
    const data = decodeProposalData(fixtures.proposalData.rich.encoded as Hex);
    expect(data.zones).toHaveLength(2);

    // Zone A mechanisms
    expect(data.zones[0].mechanisms).toHaveLength(1);
    expect(data.zones[0].mechanisms[0].paramType).toBe(TZParamType.Penalty);
    expect(data.zones[0].mechanisms[0].module.toLowerCase()).toBe(
      "0x000000000000000000000000000000000000dead",
    );
    expect(data.zones[0].mechanisms[0].initData.toLowerCase()).toBe("0x1234");

    // Zone A resources
    expect(data.zones[0].resources).toHaveLength(1);
    expect(data.zones[0].resources[0].tokenType).toBe(TZParamType.Permission);
    expect(data.zones[0].resources[0].metadata.toLowerCase()).toBe("0xabcd");

    // Zone B mechanisms
    expect(data.zones[1].mechanisms).toHaveLength(1);
    expect(data.zones[1].mechanisms[0].paramType).toBe(TZParamType.Reward);
    expect(data.zones[1].mechanisms[0].module.toLowerCase()).toBe(
      "0x000000000000000000000000000000000000beef",
    );

    // Zone B resources
    expect(data.zones[1].resources).toHaveLength(1);
    expect(data.zones[1].resources[0].tokenType).toBe(
      TZParamType.Responsibility,
    );
  });
});

describe("decodeAdjudicationActions", () => {
  it("decodes adjudicate fixture bytes", () => {
    const actions = decodeAdjudicationActions(
      fixtures.adjudicate.encoded as Hex,
    );
    expect(actions).toHaveLength(2);

    expect(actions[0].mechanismIndex).toBe(0n);
    expect(actions[0].targetIndex).toBe(0n);
    expect(actions[0].actionType.toLowerCase()).toBe(
      fixtures.constants.actions.PENALIZE.toLowerCase(),
    );
    expect(actions[0].params).toBe("0x");

    expect(actions[1].actionType.toLowerCase()).toBe(
      fixtures.constants.actions.CLOSE.toLowerCase(),
    );
  });
});

describe("decodeClaim", () => {
  it("decodes claim fixture bytes", () => {
    const result = decodeClaim(fixtures.claim.encoded as Hex);
    expect(result.mechanismIndex).toBe(0n);
    expect(result.evidence.toLowerCase()).toBe(
      fixtures.claim.decoded.evidence.toLowerCase(),
    );
  });
});

describe("decodeFeedback", () => {
  it("decodes feedback fixture bytes", () => {
    const result = decodeFeedback(fixtures.feedback.encoded as Hex);
    expect(result.feedbackURI).toBe("ipfs://test-feedback");
    expect(result.feedbackHash.toLowerCase()).toBe(
      fixtures.feedback.decoded.feedbackHash.toLowerCase(),
    );
  });
});

describe("decodeState", () => {
  it("decodes all known state hashes", () => {
    for (const [name, hash] of Object.entries(fixtures.constants.states)) {
      expect(decodeState(hash as Hex)).toBe(name);
    }
  });

  it("decodes all known outcome hashes", () => {
    for (const [name, hash] of Object.entries(fixtures.constants.outcomes)) {
      expect(decodeState(hash as Hex)).toBe(name);
    }
  });

  it("decodes all known action hashes", () => {
    for (const [name, hash] of Object.entries(fixtures.constants.actions)) {
      expect(decodeState(hash as Hex)).toBe(name);
    }
  });

  it("returns hex string for unknown hash", () => {
    const unknownHash =
      "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex;
    expect(decodeState(unknownHash)).toBe(unknownHash);
  });
});
