import { BonfiresClient } from "../client.js";
import { writeFile } from "node:fs/promises";

const AGENTS = [
  { username: "tz-sync", name: "Trust Zones Sync Service", context: "Pushes Tier 1 entities from Ponder indexer" },
  { username: "adjudicator", name: "Adjudicator", context: "Evaluates claims, queries evidence" },
  { username: "counterparty-agent", name: "Counterparty Agent", context: "Demo agent, operates zones, files claims" },
];

async function main() {
  const apiUrl = process.env.BONFIRES_API_URL;
  const apiKey = process.env.BONFIRES_API_KEY;
  const bonfireId = process.env.BONFIRES_BONFIRE_ID;

  if (!apiUrl || !apiKey || !bonfireId) {
    console.error("Missing required env vars: BONFIRES_API_URL, BONFIRES_API_KEY, BONFIRES_BONFIRE_ID");
    process.exit(1);
  }

  const client = new BonfiresClient({ apiUrl, apiKey, bonfireId });
  const results: Record<string, unknown> = {};

  for (const agent of AGENTS) {
    try {
      const result = await client.createAgent(agent);
      console.log(`Created agent: ${agent.username}`, result);
      results[agent.username] = result;
    } catch (err) {
      console.error(`Failed to create agent ${agent.username}:`, err);
    }
  }

  await writeFile(".bonfires-agents.json", JSON.stringify(results, null, 2));
  console.log("Saved agent IDs to .bonfires-agents.json");
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
