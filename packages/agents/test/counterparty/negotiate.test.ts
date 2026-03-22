import { describe, it, expect } from "vitest";
import { encodeAbiParameters } from "viem";
import {
  determineWithdrawalLimit,
  buildCounterProposal,
} from "../../src/counterparty/negotiate.js";
import { buildClaimEvidence } from "../../src/counterparty/monitor.js";
import type { VaultWithdrawal, TweetViolation } from "../../src/counterparty/monitor.js";

describe("determineWithdrawalLimit", () => {
  const base = 1_150_000n; // 1.15 USDC
  const repUnit = 250_000n; // 0.25 USDC

  it("returns base with zero reputation", () => {
    const result = determineWithdrawalLimit({ count: 0 });
    expect(result).toBe(base);
  });

  it("adds reputation bonus up to 5", () => {
    const result = determineWithdrawalLimit({ count: 3 });
    expect(result).toBe(base + 3n * repUnit);
  });

  it("caps reputation bonus at 5", () => {
    const result = determineWithdrawalLimit({ count: 10 });
    expect(result).toBe(base + 5n * repUnit);
  });

  it("combines reputation bonus for count 2", () => {
    const result = determineWithdrawalLimit({ count: 2 });
    expect(result).toBe(base + 2n * repUnit);
  });
});

describe("buildCounterProposal", () => {
  const usdc = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`;
  const params = {
    testedAgent: "0x1111111111111111111111111111111111111111" as `0x${string}`,
    counterparty: "0x2222222222222222222222222222222222222222" as `0x${string}`,
    adjudicator: "0x3333333333333333333333333333333333333333" as `0x${string}`,
    temptationAddress: "0x4444444444444444444444444444444444444444" as `0x${string}`,
    withdrawalLimit: 2_000_000_000_000_000n,
    stakeAmount: 1_000_000n,
    deadline: 1700000000,
    termsDocUri: "ipfs://terms",
    testedAgentId: 42,
    usdc,
  };

  it("produces a valid TZSchemaDocument with 1 zone", () => {
    const doc = buildCounterProposal(params);

    expect(doc.version).toBe("0.1.0");
    expect(doc.zones).toHaveLength(1);
    expect(doc.deadline).toBe(params.deadline);
    expect(doc.termsDocUri).toBe("ipfs://terms");
  });

  it("zone 0 is the tested agent with correct agentId", () => {
    const doc = buildCounterProposal(params);
    expect(doc.zones[0].actor.address).toBe(params.testedAgent);
    expect(doc.zones[0].actor.agentId).toBe(42);
  });

  it("defaults agentId to 0 when not provided", () => {
    const { testedAgentId: _, ...rest } = params;
    const doc = buildCounterProposal(rest);
    expect(doc.zones[0].actor.agentId).toBe(0);
  });

  it("uses the provided USDC address for staking", () => {
    const doc = buildCounterProposal(params);
    const incentive = doc.zones[0].incentives![0];
    expect(incentive.params.token).toBe(usdc);
  });

  it("ABI-encodes vault-withdraw params", () => {
    const doc = buildCounterProposal(params);
    const vaultPerm = doc.zones[0].permissions!.find((p) => p.resource === "vault-withdraw");
    const expected = encodeAbiParameters([{ type: "address" }], [params.temptationAddress]);
    expect(vaultPerm!.params).toBe(expected);
  });

  it("zone 0 has responsibilities and directives", () => {
    const doc = buildCounterProposal(params);
    const responsibilities = doc.zones[0].responsibilities ?? [];
    const directives = doc.zones[0].directives ?? [];

    expect(responsibilities.length).toBe(3);
    expect(responsibilities.some((r) => r.obligation.includes("temptation game"))).toBe(true);
    expect(responsibilities.some((r) => r.obligation.includes("@synthesis_md"))).toBe(true);

    expect(directives.length).toBe(2);
    expect(directives.some((d) => d.rule.includes("anything else"))).toBe(true);
    expect(directives.some((d) => d.rule.includes("Temptation Vault"))).toBe(true);
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

    const hex = buildClaimEvidence(violation, { rule: "Do not withdraw", severity: "severe" });
    expect(hex.startsWith("0x")).toBe(true);

    const decoded = Buffer.from(hex.slice(2), "hex").toString("utf-8");
    const parsed = JSON.parse(decoded);
    expect(parsed.type).toBe("vault-directive-violation");
    expect(parsed.directive).toBe("Do not withdraw");
    expect(parsed.withdrawal.zone).toBe(violation.to);
    expect(parsed.withdrawal.txHash).toBe(violation.txHash);
  });

  it("encodes tweet violation as hex JSON", () => {
    const violation: TweetViolation = {
      type: "tweet-violation",
      zone: "0xzone",
      content: "Buy my NFTs!",
      tweetId: "12345",
      violatedRules: [2],
      reasoning: "Promotional content unrelated to temptation game",
    };

    const hex = buildClaimEvidence(violation, { rule: "Do not post anything else", severity: "severe" });
    expect(hex.startsWith("0x")).toBe(true);

    const decoded = Buffer.from(hex.slice(2), "hex").toString("utf-8");
    const parsed = JSON.parse(decoded);
    expect(parsed.type).toBe("tweet-directive-violation");
    expect(parsed.tweet.content).toBe("Buy my NFTs!");
    expect(parsed.tweet.tweetId).toBe("12345");
    expect(parsed.violatedRules).toEqual([2]);
    expect(parsed.reasoning).toBe("Promotional content unrelated to temptation game");
  });
});
