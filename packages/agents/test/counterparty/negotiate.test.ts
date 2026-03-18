import { describe, it, expect } from "vitest";
import { stringToHex } from "viem";
import {
  determineWithdrawalLimit,
  buildCounterProposal,
} from "../../src/counterparty/negotiate.js";
import { buildClaimEvidence } from "../../src/counterparty/monitor.js";
import type { VaultWithdrawal, TweetViolation } from "../../src/counterparty/monitor.js";

describe("determineWithdrawalLimit", () => {
  const base = 1_000_000_000_000_000n; // 0.001 ETH
  const repUnit = 500_000_000_000_000n; // 0.0005 ETH

  it("returns base + stake with zero reputation", () => {
    const result = determineWithdrawalLimit({ count: 0 }, 100n);
    expect(result).toBe(base + 100n);
  });

  it("adds reputation bonus up to 5", () => {
    const result = determineWithdrawalLimit({ count: 3 }, 0n);
    expect(result).toBe(base + 3n * repUnit);
  });

  it("caps reputation bonus at 5", () => {
    const result = determineWithdrawalLimit({ count: 10 }, 0n);
    expect(result).toBe(base + 5n * repUnit);
  });

  it("combines reputation bonus and stake", () => {
    const stake = 2_000_000_000_000_000n;
    const result = determineWithdrawalLimit({ count: 2 }, stake);
    expect(result).toBe(base + 2n * repUnit + stake);
  });
});

describe("buildCounterProposal", () => {
  const params = {
    testedAgent: "0x1111111111111111111111111111111111111111" as `0x${string}`,
    counterparty: "0x2222222222222222222222222222222222222222" as `0x${string}`,
    adjudicator: "0x3333333333333333333333333333333333333333" as `0x${string}`,
    withdrawalLimit: 2_000_000_000_000_000n,
    stakeAmount: 1_000_000n,
    deadline: 1700000000,
    termsDocUri: "ipfs://terms",
  };

  it("produces a valid TZSchemaDocument", () => {
    const doc = buildCounterProposal(params);

    expect(doc.version).toBe("0.1.0");
    expect(doc.zones).toHaveLength(2);
    expect(doc.deadline).toBe(params.deadline);
  });

  it("zone 0 is the tested agent", () => {
    const doc = buildCounterProposal(params);
    expect(doc.zones[0].actor.address).toBe(params.testedAgent);
  });

  it("zone 1 is the counterparty", () => {
    const doc = buildCounterProposal(params);
    expect(doc.zones[1].actor.address).toBe(params.counterparty);
  });

  it("zone 0 has tweet and vault directives", () => {
    const doc = buildCounterProposal(params);
    const directives = doc.zones[0].directives ?? [];
    expect(directives.length).toBeGreaterThanOrEqual(4); // 4 tweet + 1 vault
    expect(directives.some((d) => d.rule.includes("vault"))).toBe(true);
    expect(directives.some((d) => d.rule.includes("temptation game"))).toBe(true);
  });

  it("zone 1 has no-redistribute directive", () => {
    const doc = buildCounterProposal(params);
    const directives = doc.zones[1].directives ?? [];
    expect(directives.some((d) => d.rule.includes("redistribute"))).toBe(true);
  });

  it("uses the provided adjudicator", () => {
    const doc = buildCounterProposal(params);
    expect(doc.adjudicator).toEqual({ address: params.adjudicator });
  });
});

describe("buildClaimEvidence", () => {
  it("encodes vault withdrawal as hex JSON", () => {
    const violation: VaultWithdrawal = {
      type: "vault-withdrawal",
      to: "0x1234567890123456789012345678901234567890" as `0x${string}`,
      amount: 1000000000000000000n,
      txHash: "0xabcdef" as `0x${string}`,
      blockNumber: 100n,
    };

    const hex = buildClaimEvidence(violation);
    expect(hex.startsWith("0x")).toBe(true);

    // Decode and verify structure
    const decoded = Buffer.from(hex.slice(2), "hex").toString("utf-8");
    const parsed = JSON.parse(decoded);
    expect(parsed.type).toBe("vault-withdrawal");
    expect(parsed.to).toBe(violation.to);
    expect(parsed.txHash).toBe(violation.txHash);
  });

  it("encodes tweet violation as hex JSON", () => {
    const violation: TweetViolation = {
      type: "tweet-violation",
      zone: "0xzone",
      content: "Buy my NFTs!",
      tweetId: "12345",
    };

    const hex = buildClaimEvidence(violation);
    expect(hex.startsWith("0x")).toBe(true);

    const decoded = Buffer.from(hex.slice(2), "hex").toString("utf-8");
    const parsed = JSON.parse(decoded);
    expect(parsed.type).toBe("tweet-violation");
    expect(parsed.content).toBe("Buy my NFTs!");
    expect(parsed.tweetId).toBe("12345");
  });
});
