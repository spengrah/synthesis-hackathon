import { describe, it, expect } from "vitest";
import { pollUntil } from "../../src/shared/polling.js";

describe("pollUntil", () => {
  it("returns immediately when fn returns non-null", async () => {
    const result = await pollUntil(async () => 42, {
      intervalMs: 100,
      label: "immediate",
    });
    expect(result).toBe(42);
  });

  it("polls until fn returns non-null", async () => {
    let calls = 0;
    const result = await pollUntil(
      async () => {
        calls++;
        return calls >= 3 ? "done" : null;
      },
      { intervalMs: 10, label: "poll-3" },
    );
    expect(result).toBe("done");
    expect(calls).toBe(3);
  });

  it("throws on timeout", async () => {
    await expect(
      pollUntil(async () => null, {
        intervalMs: 10,
        timeoutMs: 50,
        label: "timeout-test",
      }),
    ).rejects.toThrow("pollUntil timed out");
  });

  it("returns objects", async () => {
    const obj = { name: "test", value: 123 };
    const result = await pollUntil(async () => obj, {
      intervalMs: 10,
      label: "object",
    });
    expect(result).toEqual(obj);
  });
});
