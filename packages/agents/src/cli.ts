import type { Hex } from "viem";
import { startAdjudicator } from "./adjudicator/index.js";
import { startCounterparty } from "./counterparty/index.js";
import type { LLMConfig } from "./shared/llm.js";

const role = process.argv.includes("--role")
  ? process.argv[process.argv.indexOf("--role") + 1]
  : undefined;

if (role === "adjudicator") {
  const llmConfig: LLMConfig = {
    baseUrl: process.env.LLM_BASE_URL ?? "https://api.openai.com/v1",
    apiKey: process.env.LLM_API_KEY ?? "",
    model: process.env.LLM_MODEL ?? "gpt-4o",
  };

  if (!llmConfig.apiKey) {
    console.error("LLM_API_KEY is required for adjudicator");
    process.exit(1);
  }

  const { stop } = await startAdjudicator({
    rpcUrl: process.env.RPC_URL ?? "",
    ponderUrl: process.env.PONDER_URL ?? "",
    privateKey: (process.env.PRIVATE_KEY ?? "") as Hex,
    chainId: Number(process.env.CHAIN_ID ?? 8453),
    vaultAddress: (process.env.VAULT_ADDRESS ?? "") as `0x${string}` || undefined,
    llm: llmConfig,
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? "10000"),
    bonfiresUrl: process.env.BONFIRES_API_URL,
    bonfiresApiKey: process.env.BONFIRES_API_KEY,
    bonfireId: process.env.BONFIRES_BONFIRE_ID,
  });

  process.on("SIGINT", () => {
    console.log("Stopping adjudicator...");
    stop();
    process.exit(0);
  });
} else if (role === "counterparty") {
  const llmConfig: LLMConfig | undefined = process.env.LLM_API_KEY
    ? {
        baseUrl: process.env.LLM_BASE_URL ?? "https://api.openai.com/v1",
        apiKey: process.env.LLM_API_KEY,
        model: process.env.LLM_MODEL ?? "gpt-4o",
      }
    : undefined;

  const { stop } = await startCounterparty({
    rpcUrl: process.env.RPC_URL ?? "",
    ponderUrl: process.env.PONDER_URL ?? "",
    privateKey: (process.env.PRIVATE_KEY ?? "") as Hex,
    chainId: Number(process.env.CHAIN_ID ?? 8453),
    adjudicatorAddress: (process.env.ADJUDICATOR_ADDRESS ?? "") as `0x${string}`,
    vaultAddress: (process.env.VAULT_ADDRESS ?? "") as `0x${string}`,
    tweetProxyUrl: process.env.TWEET_PROXY_URL ?? "",
    usdc: (process.env.USDC_ADDRESS ?? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") as `0x${string}`,
    stakingModuleAddress: process.env.STAKING_MODULE_ADDRESS as `0x${string}` | undefined,
    llm: llmConfig,
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? "10000"),
    bonfiresUrl: process.env.BONFIRES_API_URL,
    bonfiresApiKey: process.env.BONFIRES_API_KEY,
    bonfireId: process.env.BONFIRES_BONFIRE_ID,
  });

  process.on("SIGINT", () => {
    console.log("Stopping counterparty...");
    stop();
    process.exit(0);
  });
} else {
  console.error("Usage: --role adjudicator|counterparty");
  process.exit(1);
}
