import { createPublicClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";
import { createTweetProxyFromEnv } from "./counterparty/tweet-proxy.js";

const chainId = Number(process.env.CHAIN_ID ?? 8453);
const rpcUrl = process.env.RPC_URL;
const port = Number(process.env.PORT ?? 42075);

const viemChain = chainId === 84532 ? baseSepolia : base;
const publicClient = rpcUrl
  ? createPublicClient({ chain: viemChain, transport: http(rpcUrl) })
  : undefined;

const proxy = createTweetProxyFromEnv(publicClient as any);
await proxy.start(port);

process.on("SIGINT", async () => {
  console.log("Stopping tweet proxy...");
  await proxy.stop();
  process.exit(0);
});
