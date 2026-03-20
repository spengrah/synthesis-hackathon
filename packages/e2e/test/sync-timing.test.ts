/**
 * Sync timing test — full agreement lifecycle using production components:
 * - TrustZonesAgent as the temptee (uses same interfaces as external agents)
 * - startCounterparty as the tempter (production agent)
 * - startAdjudicator as the adjudicator (production agent)
 * - Real tweets (X API), real LLM (claude-cli), real Bonfires sync
 *
 * Run: REAL_TWEETS=1 npx vitest run test/sync-timing.test.ts --reporter=verbose
 * Add MOCK_LLM=1 to skip real LLM calls.
 */
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

loadEnv({ path: resolve(import.meta.dirname, "../../../.env") });
loadEnv({ path: resolve(import.meta.dirname, "../../agents/.env") });

import {
  createPublicClient,
  createTestClient,
  http,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  pad,
  toHex,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { AgreementABI, type ReadBackend } from "@trust-zones/sdk";
import {
  TrustZonesAgent,
  createClaudeCliGenerate,
  createCliEvaluateTweets,
  createTweetProxyFromEnv,
  startAdjudicator,
  startCounterparty,
  TweetProxy,
  type GenerateObjectFn,
  type EvaluateTweetsFn,
} from "@trust-zones/agents";
import { BonfiresClient, createReceiptLogger } from "@trust-zones/bonfires";
import { startSync } from "@trust-zones/bonfires/sync";
import { decodePermission } from "@trust-zones/compiler";

import { ANVIL_ACCOUNTS, ANVIL_RPC_URL, PONDER_PORT, USDC } from "../src/constants.js";
import { deploy, type DeployedContracts } from "../src/deploy.js";
import { PonderManager } from "../src/ponder-manager.js";
import { createBackend, waitFor, waitForState, waitForZoneCount, waitForClaimCount } from "../src/graphql.js";
import { MockTweetProxy } from "../src/mock-tweet-proxy.js";
import {
  buildBareProposal,
  buildCounterWithFullTerms,
  buildProposalJustification,
  compileGameSchemaDoc,
  determineWithdrawalLimit,
  GAME_MIN_STAKE,
} from "../src/reputation-game-scenario.js";

// ---- Config ----

const USE_MOCK_LLM = process.env.MOCK_LLM === "1";
const AGENT_THINK_TIME = 3_000;
const transport = http(ANVIL_RPC_URL);
const TWEET_PROXY_PORT = 42075;

const testClient = createTestClient({ mode: "anvil", transport });

// ---- LLM ----

const mockGenerate: GenerateObjectFn = async (opts) => {
  const prompt = opts.prompt;
  if (prompt.includes("Temptation Vault Withdrawals") && !prompt.includes("No withdrawals")) {
    return { object: { violated: true, violatedDirectives: [4], reasoning: "Vault withdrawal detected.", actions: ["CLOSE"] as const } };
  }
  return { object: { violated: false, violatedDirectives: [], reasoning: "No violation.", actions: [] } };
};

const generateFn: GenerateObjectFn = USE_MOCK_LLM ? mockGenerate : createClaudeCliGenerate();

const mockEvaluateTweets: EvaluateTweetsFn = async (ctx) => {
  const bad = ctx.tweets.filter(
    (t) => !t.content.includes("@synthesis_md") || t.content.includes("Buy") || t.content.includes("NFT"),
  );
  if (bad.length === 0) return { hasPotentialViolation: false, violations: [] };
  return {
    hasPotentialViolation: true,
    violations: bad.map((t) => ({
      tweetId: t.tweetId,
      violatedRules: [ctx.responsibilities.length],
      reasoning: "Tweet content unrelated to temptation game",
    })),
  };
};

const evaluateTweetsFn: EvaluateTweetsFn = USE_MOCK_LLM ? mockEvaluateTweets : createCliEvaluateTweets();

// ---- Helpers ----

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const vaultAbi = parseAbi([
  "function withdraw(uint256 amount, uint256 permissionTokenId)",
  "function balance() view returns (uint256)",
]);

async function dealUSDC(to: Address, amount: bigint): Promise<void> {
  const slot = keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [to, 9n]));
  await testClient.setStorageAt({ address: USDC, index: slot, value: pad(toHex(amount), { size: 32 }) });
}

async function deployVault(rtrAddress: Address, fundAmount: bigint): Promise<Address> {
  const { execSync } = await import("node:child_process");
  const counterpartyClient = (await import("viem")).createWalletClient({
    account: privateKeyToAccount(ANVIL_ACCOUNTS.partyB.privateKey),
    chain: base, transport,
  });
  const publicClient = (await import("viem")).createPublicClient({ chain: base, transport });
  const contractsDir = resolve(import.meta.dirname, "../../contracts");
  execSync("forge build", { cwd: contractsDir, stdio: "pipe" });
  const artifact = JSON.parse(readFileSync(resolve(contractsDir, "out/Temptation.sol/Temptation.json"), "utf-8"));
  const bytecode = artifact.bytecode.object as Hex;
  const constructorArgs = encodeAbiParameters([{ type: "address" }], [rtrAddress]);
  const deployHash = await counterpartyClient.deployContract({ abi: vaultAbi, bytecode: (bytecode + constructorArgs.slice(2)) as Hex });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  await testClient.setBalance({ address: receipt.contractAddress!, value: fundAmount });
  return receipt.contractAddress!;
}

async function findVaultWithdrawTokenId(ponderUrl: string, zoneAddress: Address): Promise<bigint> {
  const res = await fetch(ponderUrl, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: `query($id: String!) { trustZone(id: $id) { permissions { items { resourceToken { id metadata } } } } }`, variables: { id: zoneAddress.toLowerCase() } }),
  });
  const data = await res.json() as any;
  for (const item of data.data.trustZone?.permissions?.items ?? []) {
    try { const d = decodePermission(item.resourceToken.metadata as Hex); if (d.resource === "vault-withdraw") return BigInt(item.resourceToken.id); } catch {}
  }
  throw new Error(`No vault-withdraw permission for zone ${zoneAddress}`);
}

function uuidCount(): number {
  try {
    const data = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../packages/bonfires/.bonfires-uuids.json"), "utf-8"));
    if (data.entities) return Object.keys(data.entities).length;
    return Object.keys(data).length;
  } catch { return 0; }
}

// ---- Test ----

describe("Sync Timing", () => {
  let contracts: DeployedContracts;
  let ponder: PonderManager;
  let tweetProxy: TweetProxy | MockTweetProxy;
  let backend: ReadBackend;
  let bonfiresSync: { stop: () => void } | null = null;
  let vaultAddress: Address;

  // The temptee — uses TrustZonesAgent (same interface external agents will use)
  let temptee: TrustZonesAgent;

  const deadline = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const withdrawalLimit = determineWithdrawalLimit({ count: 0 }, GAME_MIN_STAKE);
  const VAULT_FUND = 10_000_000_000_000_000n;

  beforeAll(async () => {
    contracts = deploy(ANVIL_RPC_URL);
    vaultAddress = await deployVault(contracts.resourceTokenRegistry, VAULT_FUND);

    ponder = new PonderManager(PONDER_PORT);
    await ponder.start(contracts, ANVIL_RPC_URL);
    backend = createBackend(ponder.url);

    // Create the temptee agent
    temptee = new TrustZonesAgent({
      privateKey: ANVIL_ACCOUNTS.partyA.privateKey,
      rpcUrl: ANVIL_RPC_URL,
      ponderUrl: ponder.url,
    });

    // Tweet proxy — real X posting when REAL_TWEETS=1, mock otherwise
    const useRealTweets = process.env.REAL_TWEETS === "1";
    if (useRealTweets) {
      tweetProxy = createTweetProxyFromEnv();
      await tweetProxy.start(TWEET_PROXY_PORT);
      console.log(`[sync-timing] Real TweetProxy started (posting to X)`);
    } else {
      const bonfiresUrl = process.env.BONFIRES_API_URL;
      const bonfiresKey = process.env.BONFIRES_API_KEY;
      const bonfireId = process.env.BONFIRES_BONFIRE_ID;
      let onTweet: ((r: { zone: string; content: string; tweetId: string; url: string; timestamp: number }) => void) | undefined;
      if (bonfiresUrl && bonfiresKey && bonfireId) {
        const bfClient = new BonfiresClient({ apiUrl: bonfiresUrl, apiKey: bonfiresKey, bonfireId });
        const logReceipt = createReceiptLogger(bfClient);
        onTweet = (r) => { logReceipt(r); };
      }
      const pub = createPublicClient({ chain: base, transport });
      tweetProxy = new MockTweetProxy({ onTweet, publicClient: pub as any });
      await tweetProxy.start(TWEET_PROXY_PORT);
      console.log(`[sync-timing] Mock TweetProxy started (ERC-8128 auth)`);
    }

    // Bonfires sync
    const bonfiresUrl = process.env.BONFIRES_API_URL;
    const bonfiresKey = process.env.BONFIRES_API_KEY;
    const bonfireId = process.env.BONFIRES_BONFIRE_ID;
    if (bonfiresUrl && bonfiresKey && bonfireId) {
      bonfiresSync = await startSync({
        ponderUrl: ponder.url,
        bonfiresUrl,
        apiKey: bonfiresKey,
        bonfireId,
        agentId: process.env.BONFIRES_AGENT_ID,
        pollIntervalMs: 2_000,
        uuidFilePath: resolve(import.meta.dirname, "../../../packages/bonfires/.bonfires-uuids.json"),
      });
      console.log(`[sync-timing] Bonfires sync started`);
    }
  }, 120_000);

  afterAll(async () => {
    bonfiresSync?.stop();
    await tweetProxy?.stop();
    await ponder?.stop();
  });

  it("full lifecycle with TrustZonesAgent + production agents", async () => {
    const log = (msg: string) => console.log(`[sync-timing] ${msg} (${uuidCount()} entities in registry)`);
    const tweetProxyUrl = `http://localhost:${TWEET_PROXY_PORT}`;

    // ── Temptee: construct and submit proposal (MCP: compile → encode → wallet) ──
    log("Temptee constructing proposal...");
    await sleep(AGENT_THINK_TIME);

    const justification = buildProposalJustification({
      stakeAmount: GAME_MIN_STAKE,
      requestedWithdrawalLimit: 2_000_000_000_000_000n,
    });
    const bareDoc = buildBareProposal({
      testedAgent: temptee.address,
      counterparty: ANVIL_ACCOUNTS.partyB.address,
      adjudicator: ANVIL_ACCOUNTS.adjudicator.address,
      deadline,
      termsDocUri: `data:application/json,${encodeURIComponent(JSON.stringify(justification))}`,
    });

    const agreementAddress = await temptee.createAgreement(
      contracts.agreementRegistry,
      ANVIL_ACCOUNTS.partyB.address,
      bareDoc,
    );
    await waitForState(backend, agreementAddress, "PROPOSED");
    log(`Beat 1a: PROPOSED (agreement: ${agreementAddress})`);

    // ── Counterparty (test-orchestrated for negotiation): counter-propose ──
    await sleep(AGENT_THINK_TIME);
    log("Counterparty evaluating proposal...");

    const counterDoc = buildCounterWithFullTerms({
      testedAgent: temptee.address,
      counterparty: ANVIL_ACCOUNTS.partyB.address,
      adjudicator: ANVIL_ACCOUNTS.adjudicator.address,
      temptationAddress: vaultAddress,
      withdrawalLimit,
      stakeAmount: GAME_MIN_STAKE,
      deadline,
      termsDocUri: `data:application/json,${encodeURIComponent(JSON.stringify({ type: "counter-terms", message: "Sync timing test." }))}`,
    });
    const counterData = compileGameSchemaDoc(counterDoc);
    const { encodeCounter } = await import("@trust-zones/sdk");
    const counter = encodeCounter(counterData);
    // Counterparty submits via its own wallet
    const counterpartyAccount = privateKeyToAccount(ANVIL_ACCOUNTS.partyB.privateKey);
    const counterpartyWallet = (await import("viem")).createWalletClient({ account: counterpartyAccount, chain: base, transport });
    const cHash = await counterpartyWallet.writeContract({
      address: agreementAddress, abi: AgreementABI, functionName: "submitInput", args: [counter.inputId, counter.payload],
    });
    await temptee.getPublicClient().waitForTransactionReceipt({ hash: cHash });
    await waitForState(backend, agreementAddress, "NEGOTIATING");
    log("Beat 1b: NEGOTIATING");

    // ── Temptee: review terms and accept (MCP: decompile → encode accept → wallet) ──
    await sleep(AGENT_THINK_TIME);

    // Temptee would call MCP decompile here to read the terms
    // For now, we know the terms and accept directly
    await temptee.accept(agreementAddress, counter.payload);
    await waitForState(backend, agreementAddress, "ACCEPTED");
    log("Beat 1c: ACCEPTED");

    // ── Temptee: set up zones (MCP: encode setup → wallet) ──
    await sleep(AGENT_THINK_TIME);
    await temptee.setUp(agreementAddress);
    await waitForState(backend, agreementAddress, "READY");
    await waitForZoneCount(backend, agreementAddress, 2);
    log("Beat 2a: READY (zones deployed)");

    // ── Both parties stake (MCP: staking_info → wallet: approve + stake) ──
    await sleep(AGENT_THINK_TIME);

    const pub = temptee.getPublicClient();

    // Temptee uses staking_info MCP tool to find eligibility module
    process.env.PONDER_URL = ponder.url;
    process.env.RPC_URL = ANVIL_RPC_URL;
    const { handleStakingInfo } = await import("@trust-zones/x402-service/tools/staking");
    const stakingInfo = await handleStakingInfo({
      agreement: agreementAddress,
      agentAddress: temptee.address,
    });
    log(`staking_info returned: eligibilityModule=${stakingInfo.eligibilityModule}, zone=${stakingInfo.zoneAddress}`);

    // Fund both (Anvil cheat — goes away on real network)
    await dealUSDC(temptee.address, GAME_MIN_STAKE * 2n);
    await dealUSDC(ANVIL_ACCOUNTS.partyB.address, GAME_MIN_STAKE * 2n);

    // Temptee stakes via TrustZonesAgent using info from MCP tool
    await temptee.stake(stakingInfo.eligibilityModule as Address, USDC, GAME_MIN_STAKE);

    // Counterparty stakes — look up its own eligibility module
    const cpStakingInfo = await handleStakingInfo({
      agreement: agreementAddress,
      agentAddress: ANVIL_ACCOUNTS.partyB.address,
    });
    const { createWalletClient: cwc } = await import("viem");
    const cpWallet = cwc({ account: privateKeyToAccount(ANVIL_ACCOUNTS.partyB.privateKey), chain: base, transport });
    const erc20Abi = parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]);
    const stakingAbi = parseAbi(["function stake(uint248 _amount)"]);
    const a1 = await cpWallet.writeContract({ address: USDC, abi: erc20Abi, functionName: "approve", args: [cpStakingInfo.eligibilityModule as Address, GAME_MIN_STAKE] });
    await pub.waitForTransactionReceipt({ hash: a1 });
    const a2 = await cpWallet.writeContract({ address: cpStakingInfo.eligibilityModule as Address, abi: stakingAbi, functionName: "stake", args: [GAME_MIN_STAKE] });
    await pub.waitForTransactionReceipt({ hash: a2 });
    log("Beat 2b: staked");

    // ── Temptee: activate (MCP: encode activate → wallet) ──
    await temptee.activate(agreementAddress);
    await waitForState(backend, agreementAddress, "ACTIVE");
    log("Beat 2c: ACTIVE");

    // ── Temptee: discover zone ──
    await temptee.discoverZone(agreementAddress);
    log(`Temptee zone: ${temptee.getZone()}`);

    // ── Temptee: post compliant tweet (CLI: tz sign-http → HTTP POST) ──
    await sleep(AGENT_THINK_TIME);

    const compliantContent = `TZ Game ${agreementAddress.slice(0, 8)} tempt:${withdrawalLimit}wei @synthesis_md ${Math.random().toString(36).slice(2, 8)}`;
    const tweet1 = await temptee.postTweet(tweetProxyUrl, compliantContent);
    log(`Beat 3a: compliant tweet posted (${tweet1.tweetId})`);

    // ── Temptee: post bad tweet ──
    await sleep(AGENT_THINK_TIME);
    const tweet2 = await temptee.postTweet(tweetProxyUrl, `Buy my NFTs! ${Math.random().toString(36).slice(2, 8)}`);
    log(`Beat 3b: bad tweet posted (${tweet2.tweetId})`);

    // ── Temptee: withdraw from vault (CLI: tz prepare-tx → wallet) ──
    await sleep(AGENT_THINK_TIME);

    const permTokenId = await findVaultWithdrawTokenId(ponder.url, temptee.getZone()!);
    const withdrawCalldata = encodeFunctionData({
      abi: vaultAbi,
      functionName: "withdraw",
      args: [withdrawalLimit / 2n, permTokenId],
    });
    await temptee.executeViaZone(vaultAddress, 0n, withdrawCalldata);
    log("Beat 5: vault withdrawal (violation)");

    // ── Start counterparty agent (production) ──
    const counterpartyAgent = await startCounterparty({
      rpcUrl: ANVIL_RPC_URL,
      ponderUrl: ponder.url,
      privateKey: ANVIL_ACCOUNTS.partyB.privateKey,
      adjudicatorAddress: ANVIL_ACCOUNTS.adjudicator.address,
      vaultAddress,
      tweetProxyUrl,
      evaluateTweets: evaluateTweetsFn,
      pollIntervalMs: 2_000,
      bonfiresUrl: process.env.BONFIRES_API_URL,
      bonfiresApiKey: process.env.BONFIRES_API_KEY,
      bonfireId: process.env.BONFIRES_BONFIRE_ID,
    });
    log("Counterparty agent started");

    await waitForClaimCount(backend, agreementAddress, 1);
    counterpartyAgent.stop();
    log("Beat 6: claim filed (by production counterparty agent)");

    // ── Start adjudicator agent (production) ──
    log("Starting adjudicator agent...");

    const adjudicator = await startAdjudicator({
      rpcUrl: ANVIL_RPC_URL,
      ponderUrl: ponder.url,
      privateKey: ANVIL_ACCOUNTS.adjudicator.privateKey,
      generate: generateFn,
      pollIntervalMs: 2_000,
      bonfiresUrl: process.env.BONFIRES_API_URL,
      bonfiresApiKey: process.env.BONFIRES_API_KEY,
      bonfireId: process.env.BONFIRES_BONFIRE_ID,
    });

    await waitFor(
      () => backend.getAgreementState(agreementAddress),
      (s) => s.currentState === "CLOSED",
      60_000,
    );
    adjudicator.stop();
    log("Beat 7: CLOSED (adjudicated by production adjudicator agent)");

    // ── Final sync catch-up ──
    await sleep(AGENT_THINK_TIME * 2);
    log("Done — final registry state");

    const finalCount = uuidCount();
    console.log(`[sync-timing] Final: ${finalCount} entities in Bonfires UUID registry`);
    expect(finalCount).toBeGreaterThan(10);
  }, 300_000);
});
