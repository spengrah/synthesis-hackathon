import { describe, it, expect } from "vitest";
import type { Hex } from "viem";
import type { ProposalData, AdjudicationAction } from "../src/types.js";
import { TZParamType } from "../src/types.js";
import {
  encodePropose,
  encodeClaim,
  encodeAdjudicate,
  encodeComplete,
  encodeExit,
} from "../src/encode.js";
import {
  decodeProposalData,
  decodeAdjudicationActions,
  decodeClaim,
  decodeFeedback,
} from "../src/decode.js";
import * as C from "../src/constants.js";
import fixtures from "./fixtures/abi-fixtures.json";

const basicProposal: ProposalData = {
  termsDocUri: "",
  adjudicator: fixtures.addresses.adjudicator as Hex,
  deadline: 1000000n,
  zones: [
    {
      party: fixtures.addresses.partyA as Hex,
      agentId: 0n,
      hatMaxSupply: 1,
      hatDetails: "Test Zone Hat",
      mechanisms: [],
      resources: [],
    },
    {
      party: fixtures.addresses.partyB as Hex,
      agentId: 0n,
      hatMaxSupply: 1,
      hatDetails: "Test Zone Hat",
      mechanisms: [],
      resources: [],
    },
  ],
};

const richProposal: ProposalData = {
  termsDocUri: "",
  adjudicator: fixtures.addresses.adjudicator as Hex,
  deadline: 1000000n,
  zones: [
    {
      party: fixtures.addresses.partyA as Hex,
      agentId: 0n,
      hatMaxSupply: 1,
      hatDetails: "Test Zone Hat",
      mechanisms: [
        {
          paramType: TZParamType.Penalty,
          module: "0x000000000000000000000000000000000000dEaD",
          initData: "0x1234",
        },
      ],
      resources: [{ tokenType: TZParamType.Permission, metadata: "0xabcd" }],
    },
    {
      party: fixtures.addresses.partyB as Hex,
      agentId: 0n,
      hatMaxSupply: 1,
      hatDetails: "Test Zone Hat",
      mechanisms: [
        {
          paramType: TZParamType.Reward,
          module: "0x000000000000000000000000000000000000bEEF",
          initData: "0x5678",
        },
      ],
      resources: [
        { tokenType: TZParamType.Responsibility, metadata: "0xef01" },
      ],
    },
  ],
};

describe("roundtrip: ProposalData", () => {
  it("basic proposal encode -> decode", () => {
    const encoded = encodePropose(basicProposal);
    const decoded = decodeProposalData(encoded.payload);

    expect(decoded.termsDocUri).toBe(basicProposal.termsDocUri);
    expect(decoded.adjudicator.toLowerCase()).toBe(
      basicProposal.adjudicator.toLowerCase(),
    );
    expect(decoded.deadline).toBe(basicProposal.deadline);
    expect(decoded.zones).toHaveLength(2);
    expect(decoded.zones[0].party.toLowerCase()).toBe(
      basicProposal.zones[0].party.toLowerCase(),
    );
    expect(decoded.zones[0].hatDetails).toBe(
      basicProposal.zones[0].hatDetails,
    );
    expect(decoded.zones[0].mechanisms).toHaveLength(0);
    expect(decoded.zones[0].resources).toHaveLength(0);
  });

  it("rich proposal encode -> decode", () => {
    const encoded = encodePropose(richProposal);
    const decoded = decodeProposalData(encoded.payload);

    expect(decoded.zones[0].mechanisms).toHaveLength(1);
    expect(decoded.zones[0].mechanisms[0].paramType).toBe(TZParamType.Penalty);
    expect(decoded.zones[0].mechanisms[0].module.toLowerCase()).toBe(
      "0x000000000000000000000000000000000000dead",
    );
    expect(decoded.zones[0].mechanisms[0].initData.toLowerCase()).toBe(
      "0x1234",
    );

    expect(decoded.zones[0].resources).toHaveLength(1);
    expect(decoded.zones[0].resources[0].tokenType).toBe(
      TZParamType.Permission,
    );
    expect(decoded.zones[0].resources[0].metadata.toLowerCase()).toBe(
      "0xabcd",
    );

    expect(decoded.zones[1].mechanisms[0].paramType).toBe(TZParamType.Reward);
    expect(decoded.zones[1].resources[0].tokenType).toBe(
      TZParamType.Responsibility,
    );
  });
});

describe("roundtrip: CLAIM", () => {
  it("encode -> decode", () => {
    const evidence = "0x65766964656e6365" as Hex;
    const encoded = encodeClaim(0, evidence);
    const decoded = decodeClaim(encoded.payload);

    expect(decoded.mechanismIndex).toBe(0n);
    expect(decoded.evidence.toLowerCase()).toBe(evidence.toLowerCase());
  });
});

describe("roundtrip: ADJUDICATE", () => {
  it("encode -> decode", () => {
    const actions: AdjudicationAction[] = [
      {
        mechanismIndex: 0n,
        targetIndex: 0n,
        actionType: C.PENALIZE,
        params: "0x",
      },
      {
        mechanismIndex: 0n,
        targetIndex: 0n,
        actionType: C.CLOSE,
        params: "0x",
      },
    ];
    const encoded = encodeAdjudicate(0, actions);
    const decoded = decodeAdjudicationActions(encoded.payload);

    expect(decoded).toHaveLength(2);
    expect(decoded[0].mechanismIndex).toBe(0n);
    expect(decoded[0].actionType.toLowerCase()).toBe(C.PENALIZE.toLowerCase());
    expect(decoded[1].actionType.toLowerCase()).toBe(C.CLOSE.toLowerCase());
  });
});

describe("roundtrip: COMPLETE", () => {
  it("encode -> decode", () => {
    const feedbackHash = fixtures.feedback.decoded.feedbackHash as Hex;
    const encoded = encodeComplete("ipfs://test-feedback", feedbackHash);
    const decoded = decodeFeedback(encoded.payload);

    expect(decoded.feedbackURI).toBe("ipfs://test-feedback");
    expect(decoded.feedbackHash.toLowerCase()).toBe(
      feedbackHash.toLowerCase(),
    );
  });
});

describe("roundtrip: EXIT", () => {
  it("encode -> decode", () => {
    const feedbackHash = fixtures.feedback.decoded.feedbackHash as Hex;
    const encoded = encodeExit("ipfs://test-feedback", feedbackHash);
    const decoded = decodeFeedback(encoded.payload);

    expect(decoded.feedbackURI).toBe("ipfs://test-feedback");
    expect(decoded.feedbackHash.toLowerCase()).toBe(
      feedbackHash.toLowerCase(),
    );
  });
});
