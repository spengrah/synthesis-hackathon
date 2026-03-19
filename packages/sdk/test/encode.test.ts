import { describe, it, expect } from "vitest";
import type { Hex } from "viem";
import type { ProposalData, AdjudicationAction } from "../src/types.js";
import { TZParamType, TZModuleKind } from "../src/types.js";
import {
  encodePropose,
  encodeCounter,
  encodeAccept,
  encodeReject,
  encodeWithdraw,
  encodeActivate,
  encodeFinalize,
  encodeClaim,
  encodeAdjudicate,
  encodeComplete,
  encodeExit,
} from "../src/encode.js";
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
      maxActors: 1,
      description: "Test Zone Hat",
      mechanisms: [],
      resources: [],
    },
    {
      party: fixtures.addresses.partyB as Hex,
      agentId: 0n,
      maxActors: 1,
      description: "Test Zone Hat",
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
      maxActors: 1,
      description: "Test Zone Hat",
      mechanisms: [
        {
          paramType: TZParamType.Penalty,
          moduleKind: TZModuleKind.HatsModule,
          module: "0x000000000000000000000000000000000000dEaD",
          data: "0x1234",
        },
      ],
      resources: [{ tokenType: TZParamType.Permission, metadata: "0xabcd" }],
    },
    {
      party: fixtures.addresses.partyB as Hex,
      agentId: 0n,
      maxActors: 1,
      description: "Test Zone Hat",
      mechanisms: [
        {
          paramType: TZParamType.Reward,
          moduleKind: TZModuleKind.HatsModule,
          module: "0x000000000000000000000000000000000000bEEF",
          data: "0x5678",
        },
      ],
      resources: [
        { tokenType: TZParamType.Responsibility, metadata: "0xef01" },
      ],
    },
  ],
};

describe("encodePropose", () => {
  it("basic proposal payload matches Solidity fixture", () => {
    const result = encodePropose(basicProposal);
    expect(result.inputId.toLowerCase()).toBe(
      fixtures.constants.inputs.PROPOSE.toLowerCase(),
    );
    expect(result.payload.toLowerCase()).toBe(
      fixtures.proposalData.basic.encoded.toLowerCase(),
    );
  });

  it("rich proposal payload matches Solidity fixture", () => {
    const result = encodePropose(richProposal);
    expect(result.payload.toLowerCase()).toBe(
      fixtures.proposalData.rich.encoded.toLowerCase(),
    );
  });
});

describe("encodeCounter", () => {
  it("uses COUNTER inputId with same payload as PROPOSE", () => {
    const result = encodeCounter(basicProposal);
    expect(result.inputId.toLowerCase()).toBe(
      fixtures.constants.inputs.COUNTER.toLowerCase(),
    );
    expect(result.payload.toLowerCase()).toBe(
      fixtures.proposalData.basic.encoded.toLowerCase(),
    );
  });
});

describe("simple input encoders", () => {
  it("encodeAccept returns ACCEPT inputId and empty payload", () => {
    const result = encodeAccept();
    expect(result.inputId.toLowerCase()).toBe(C.ACCEPT.toLowerCase());
    expect(result.payload).toBe("0x");
  });

  it("encodeReject returns REJECT inputId and empty payload", () => {
    const result = encodeReject();
    expect(result.inputId.toLowerCase()).toBe(C.REJECT.toLowerCase());
    expect(result.payload).toBe("0x");
  });

  it("encodeWithdraw returns WITHDRAW inputId and empty payload", () => {
    const result = encodeWithdraw();
    expect(result.inputId.toLowerCase()).toBe(C.WITHDRAW.toLowerCase());
    expect(result.payload).toBe("0x");
  });

  it("encodeActivate returns ACTIVATE inputId and empty payload", () => {
    const result = encodeActivate();
    expect(result.inputId.toLowerCase()).toBe(C.ACTIVATE.toLowerCase());
    expect(result.payload).toBe("0x");
  });

  it("encodeFinalize returns FINALIZE inputId and empty payload", () => {
    const result = encodeFinalize();
    expect(result.inputId.toLowerCase()).toBe(C.FINALIZE.toLowerCase());
    expect(result.payload).toBe("0x");
  });
});

describe("encodeClaim", () => {
  it("matches Solidity fixture", () => {
    const result = encodeClaim(0, "0x65766964656e6365");
    expect(result.inputId.toLowerCase()).toBe(C.CLAIM.toLowerCase());
    expect(result.payload.toLowerCase()).toBe(
      fixtures.claim.encoded.toLowerCase(),
    );
  });
});

describe("encodeAdjudicate", () => {
  it("matches Solidity fixture", () => {
    const actions: AdjudicationAction[] = [
      {
        mechanismIndex: 0n,
        targetIndex: 0n,
        actionType: fixtures.constants.actions.PENALIZE as Hex,
        params: "0x",
      },
      {
        mechanismIndex: 0n,
        targetIndex: 0n,
        actionType: fixtures.constants.actions.CLOSE as Hex,
        params: "0x",
      },
    ];
    const result = encodeAdjudicate(0, actions);
    expect(result.inputId.toLowerCase()).toBe(C.ADJUDICATE.toLowerCase());
    expect(result.payload.toLowerCase()).toBe(
      fixtures.adjudicate.encoded.toLowerCase(),
    );
  });
});

describe("encodeComplete", () => {
  it("matches Solidity fixture", () => {
    const result = encodeComplete(
      "ipfs://test-feedback",
      fixtures.feedback.decoded.feedbackHash as Hex,
    );
    expect(result.inputId.toLowerCase()).toBe(C.COMPLETE.toLowerCase());
    expect(result.payload.toLowerCase()).toBe(
      fixtures.feedback.encoded.toLowerCase(),
    );
  });
});

describe("encodeExit", () => {
  it("uses EXIT inputId with same payload format as COMPLETE", () => {
    const result = encodeExit(
      "ipfs://test-feedback",
      fixtures.feedback.decoded.feedbackHash as Hex,
    );
    expect(result.inputId.toLowerCase()).toBe(C.EXIT.toLowerCase());
    expect(result.payload.toLowerCase()).toBe(
      fixtures.feedback.encoded.toLowerCase(),
    );
  });
});
