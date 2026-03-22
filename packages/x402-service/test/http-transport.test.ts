import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

let serverHandle: { close: () => Promise<void>; port: number };

beforeAll(async () => {
  // Start server on random port with payment disabled
  process.env.REQUIRE_PAYMENT = "false";
  const { startHttpServer } = await import("../src/server.js");
  serverHandle = await startHttpServer(0); // port 0 = random available port
});

afterAll(async () => {
  await serverHandle?.close();
});

describe("HTTP transport", () => {
  it("responds to ping via MCP client", async () => {
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://localhost:${serverHandle.port}/mcp`),
    );
    const client = new Client({ name: "test-client", version: "0.0.1" });
    await client.connect(transport);

    const result = await client.callTool({ name: "ping", arguments: {} });
    const text = (result.content as { type: string; text: string }[])[0].text;
    const data = JSON.parse(text);

    expect(data.server).toBe("trust-zones");
    expect(data.version).toBe("0.1.0");
    expect(data.tools).toContain("compile");
    expect(data.tools).toContain("staking_info");

    await client.close();
  });

  it("compiles a schema via MCP client", async () => {
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://localhost:${serverHandle.port}/mcp`),
    );
    const client = new Client({ name: "test-client", version: "0.0.1" });
    await client.connect(transport);

    const schema = {
      version: "0.1.0",
      zones: [
        {
          actor: { address: "0xFBEE1e3d2c4488CbFfd2E2b9Cae7C7e2D56b0aA4", agentId: 1 },
          maxActors: 1,
          description: "Zone A",
          permissions: [{ resource: "tweet-post", value: 10, period: "day" }],
          directives: [{ rule: "Do not spam", severity: "severe" }],
        },
        {
          actor: { address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", agentId: 2 },
          maxActors: 1,
          description: "Zone B",
          permissions: [{ resource: "data-api-read", value: 100, period: "hour" }],
          directives: [{ rule: "Do not redistribute data", severity: "severe" }],
        },
      ],
      adjudicator: { address: "0x0000000000000000000000000000000000000000" },
      deadline: 1711000000,
    };

    const result = await client.callTool({
      name: "compile",
      arguments: { tzSchemaDoc: schema },
    });
    const text = (result.content as { type: string; text: string }[])[0].text;
    const data = JSON.parse(text);

    expect(data.proposalData).toMatch(/^0x/);
    expect(data.termsHash).toMatch(/^0x/);

    await client.close();
  });

  it("lists tools via MCP client", async () => {
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://localhost:${serverHandle.port}/mcp`),
    );
    const client = new Client({ name: "test-client", version: "0.0.1" });
    await client.connect(transport);

    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name);

    expect(names).toContain("compile");
    expect(names).toContain("decompile");
    expect(names).toContain("encode");
    expect(names).toContain("graphql");
    expect(names).toContain("staking_info");
    expect(names).toContain("ping");

    await client.close();
  });
});
