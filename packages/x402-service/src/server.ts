import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

import { handleCompile, handleDecompile } from "./tools/compile.js";
import { handleEncode } from "./tools/encode.js";
import { handleDecodeEvent } from "./tools/decode.js";
import { handleGraphql } from "./tools/graphql.js";
import { handleExplain } from "./tools/explain.js";
import { handleStakingInfo } from "./tools/staking.js";

const REQUIRE_PAYMENT = process.env.REQUIRE_PAYMENT === "true" || process.env.REQUIRE_PAYMENT === "1";
const X402_NETWORK = process.env.X402_NETWORK ?? "eip155:84532";
const PORT = Number(process.env.PORT ?? 3000);

// ---- Payment wrapper (conditional) ----

type ToolHandler<T> = (args: T) => unknown | Promise<unknown>;

async function setupPayment() {
  if (!REQUIRE_PAYMENT) return null;

  const { createPaymentWrapper, x402ResourceServer } = await import("@x402/mcp");
  const { HTTPFacilitatorClient } = await import("@x402/core/server");
  const { ExactEvmScheme } = await import("@x402/evm/exact/server");

  const facilitatorUrl = process.env.FACILITATOR_URL || "https://x402.org/facilitator";
  const treasury = process.env.TREASURY_ADDRESS;
  if (!treasury) throw new Error("TREASURY_ADDRESS required when REQUIRE_PAYMENT=true");

  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitatorClient);
  resourceServer.register(X402_NETWORK, new ExactEvmScheme());
  await resourceServer.initialize();

  return { resourceServer, treasury };
}

function jsonContent(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2),
      },
    ],
  };
}

export async function createMcpServer() {
  const server = new McpServer({
    name: "trust-zones",
    version: "0.1.0",
  });

  const payment = await setupPayment();

  async function buildPaidWrapper(price: string) {
    if (!payment) return null;
    const { createPaymentWrapper } = await import("@x402/mcp");
    const accepts = await payment.resourceServer.buildPaymentRequirements({
      scheme: "exact",
      network: X402_NETWORK,
      payTo: payment.treasury,
      price,
    });
    return createPaymentWrapper(payment.resourceServer, { accepts });
  }

  const paidCompile = await buildPaidWrapper("$0.01");
  const paidEncode = await buildPaidWrapper("$0.005");
  const paidGraphql = await buildPaidWrapper("$0.005");
  const paidExplain = await buildPaidWrapper("$0.01");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function wrap<T>(handler: ToolHandler<T>, paid: any) {
    const fn = async (args: T) => jsonContent(await handler(args));
    return paid ? paid(fn) : fn;
  }

  // ---- Register tools ----

  server.tool(
    "compile",
    "Compile a Trust Zones schema document into ABI-encoded ProposalData. Input: a TZSchemaDocument with zones, permissions, responsibilities, directives, mechanisms, adjudicator, and deadline.",
    {
      tzSchemaDoc: z.any().describe("TZSchemaDocument JSON object"),
    },
    wrap(handleCompile, paidCompile),
  );

  server.tool(
    "decompile",
    "Decompile ABI-encoded ProposalData back into a Trust Zones schema document.",
    {
      proposalData: z.string().describe("Hex-encoded ProposalData bytes"),
    },
    wrap(handleDecompile, paidCompile),
  );

  server.tool(
    "encode",
    "Encode parameters into submitInput() calldata for an Agreement contract. Returns inputId, payload, and full calldata. Valid inputIds: propose, counter, accept, reject, withdraw, setup, activate, claim, adjudicate, complete, exit, finalize.",
    {
      inputId: z.string().describe("Input type: propose, counter, accept, reject, withdraw, setup, activate, claim, adjudicate, complete, exit, finalize"),
      params: z.any().optional().describe("Parameters for the input (varies by type). Required for propose/counter (ProposalData), claim ({mechanismIndex, evidence}), adjudicate ({claimId, actions}), complete/exit ({feedbackURI, feedbackHash})."),
    },
    wrap(handleEncode, paidEncode),
  );

  server.tool(
    "decode_event",
    "Decode an Agreement contract event log into structured data.",
    {
      eventName: z.string().describe("Event name (e.g. ProposalSubmitted, AgreementStateChanged)"),
      topics: z.array(z.string()).describe("Event log topics array"),
      data: z.string().describe("Hex-encoded event log data"),
    },
    wrap(handleDecodeEvent, paidEncode),
  );

  server.tool(
    "graphql",
    "Query the Trust Zones Ponder GraphQL API. Returns agreements, zones, permissions, directives, claims, proposals, reputation feedback, and transaction hashes.",
    {
      query: z.string().describe("GraphQL query string"),
      variables: z.record(z.any()).optional().describe("GraphQL variables"),
    },
    wrap(handleGraphql, paidGraphql),
  );

  server.tool(
    "explain",
    "Get a human-readable summary of an agreement's current state including parties, zones, permissions, directives, claims, and reputation feedback.",
    {
      agreement: z.string().describe("Agreement contract address (0x...)"),
    },
    wrap(handleExplain, paidExplain),
  );

  server.tool(
    "staking_info",
    "Get the eligibility module address and staking instructions for your zone in an agreement. Call this after setup to know where to stake.",
    {
      agreement: z.string().describe("Agreement contract address (0x...)"),
      agentAddress: z.string().describe("Your agent's EOA address (0x...)"),
    },
    wrap(handleStakingInfo, paidGraphql),
  );

  server.tool(
    "ping",
    "Health check. Returns server version and available tools.",
    {},
    async () =>
      jsonContent({
        server: "trust-zones",
        version: "0.1.0",
        payment: REQUIRE_PAYMENT ? "enabled" : "disabled",
        tools: ["compile", "decompile", "encode", "decode_event", "graphql", "explain", "staking_info", "ping"],
      }),
  );

  return server;
}

/** Start the MCP server over HTTP using Streamable HTTP transport. */
export async function startHttpServer(port: number = PORT) {
  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    if (url.pathname !== "/mcp") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found. Use POST /mcp for MCP requests." }));
      return;
    }

    if (req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body = JSON.parse(Buffer.concat(chunks).toString());

      // Stateless: each request gets a fresh transport + server.
      // This is simple and works well for tool calls (no server-initiated messages needed).
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
      });
      const mcpServer = await createMcpServer();
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, body);
      await transport.close();
      await mcpServer.close();
    } else {
      res.writeHead(405);
      res.end();
    }
  });

  return new Promise<{ server: typeof httpServer; port: number; close: () => Promise<void> }>((resolve) => {
    httpServer.listen(port, () => {
      const actualPort = (httpServer.address() as { port: number }).port;
      console.log(`Trust Zones MCP server running on port ${actualPort} (payment: ${REQUIRE_PAYMENT ? "enabled" : "disabled"}, network: ${X402_NETWORK})`);
      resolve({
        server: httpServer,
        port: actualPort,
        close: () => new Promise<void>((r) => {
          httpServer.close(() => r());
        }),
      });
    });
  });
}

// ---- Entry point (only when run directly) ----

const isDirectRun = process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js");
if (isDirectRun) {
  startHttpServer().catch((err) => {
    console.error("Failed to start Trust Zones MCP server:", err);
    process.exit(1);
  });
}
