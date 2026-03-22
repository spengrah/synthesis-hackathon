/**
 * Simple static file server for the Trust Zones visualization prototypes.
 *
 * Usage:
 *   npx tsx serve.ts [port]
 *
 * Serves:
 *   /                 -> index.html (leaderboard)
 *   /dashboard        -> dashboard.html
 *   /story            -> protocol-story.html
 */

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PORT = parseInt(process.argv[2] || process.env.PORT || "3000", 10);
const DIR = import.meta.dirname;
const PONDER_URL = process.env.PONDER_URL || "";
const TWEET_PROXY_URL = process.env.TWEET_PROXY_URL || "";
const BASE_RPC_URL = process.env.BASE_RPC_URL || "";
const USDC_ADDRESS = process.env.USDC_ADDRESS || "";
const VAULT_ADDRESS = process.env.VAULT_ADDRESS || "";

const ROUTES: Record<string, string> = {
  "/": "index.html",
  "/index.html": "index.html",
  "/dashboard": "dashboard.html",
  "/dashboard.html": "dashboard.html",
  "/story": "protocol-story.html",
  "/story.html": "protocol-story.html",
  "/protocol-story.html": "protocol-story.html",
};

const server = createServer((req, res) => {
  const url = req.url?.split("?")[0] || "/";
  const file = ROUTES[url];

  if (!file) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found. Try / (leaderboard), /dashboard, or /story.");
    return;
  }

  try {
    let content = readFileSync(resolve(DIR, file), "utf-8");
    // Inject deployed Ponder URL as default if set
    if (PONDER_URL) {
      content = content.replace(/value="http:\/\/localhost:42069"/g, `value="${PONDER_URL}"`);
    }
    if (TWEET_PROXY_URL) {
      content = content.replace(/value="http:\/\/localhost:4207[0-9]"/g, `value="${TWEET_PROXY_URL}"`);
    }
    if (BASE_RPC_URL) {
      content = content.replace(/https:\/\/mainnet\.base\.org/g, BASE_RPC_URL);
    }
    if (USDC_ADDRESS) {
      content = content.replace(/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/g, USDC_ADDRESS);
    }
    if (VAULT_ADDRESS) {
      content = content.replace(/0x2608ed95e254f4E57A60455504472feeD77b9552/g, VAULT_ADDRESS);
    }
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(content);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Error reading file");
  }
});

server.listen(PORT, () => {
  console.log(`Trust Zones Viz Server`);
  console.log(`  Leaderboard:     http://localhost:${PORT}/`);
  console.log(`  Dashboard:       http://localhost:${PORT}/dashboard`);
  console.log(`  Protocol Story:  http://localhost:${PORT}/story`);
  console.log();
  console.log("Press Ctrl+C to stop.");
});
