/**
 * Sync timing test — full agreement lifecycle using production components:
 * - Fresh keypairs with ERC-8004 identity registration
 * - TrustZonesAgent as the temptee (same interfaces as external agents)
 * - startCounterparty as the tempter (production agent)
 * - startAdjudicator as the adjudicator (production agent)
 * - ERC-8128 zone auth on mock tweet proxy
 * - Bonfires sync + receipt logging
 * - Reputation feedback verification on close
 *
 * Run: MOCK_LLM=1 npx vitest run test/sync-timing.test.ts
 * Add REAL_TWEETS=1 to post to X for real.
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
  createWalletClient,
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
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
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

import { ANVIL_ACCOUNTS, ANVIL_RPC_URL, PONDER_PORT, USDC, PRE_DEPLOYED } from "../src/constants.js";
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
const publicClient = createPublicClient({ chain: base, transport });

// ---- ERC-8004 ----

const identityRegistryAbi = parseAbi(["function register() returns (uint256)"]);

async function registerAgent(privateKey: Hex): Promise<{ address: Address; agentId: bigint }> {
  const account = privateKeyToAccount(privateKey);

  // Fund with ETH for gas
  await testClient.setBalance({ address: account.address, value: 10n * 10n ** 18n });

  // Register with 8004
  const wallet = createWalletClient({ account, chain: base, transport });
  const hash = await wallet.writeContract({
    address: PRE_DEPLOYED.identityRegistry,
    abi: identityRegistryAbi,
    functionName: "register",
    gas: 500_000n,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // Extract token ID from Transfer event
  const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const transferLog = receipt.logs.find((l) => l.topics[0] === transferTopic);
  if (!transferLog || !transferLog.topics[3]) {
    throw new Error("No Transfer event in register() receipt");
  }
  const agentId = BigInt(transferLog.topics[3]);

  console.log(`[sync-timing] Registered agent ${account.address} → agentId ${agentId}`);
  return { address: account.address, agentId };
}

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

async function deployVault(rtrAddress: Address, deployerKey: Hex, fundAmount: bigint): Promise<Address> {
  const { execSync } = await import("node:child_process");
  const deployerAccount = privateKeyToAccount(deployerKey);
  const deployerWallet = createWalletClient({ account: deployerAccount, chain: base, transport });
  const contractsDir = resolve(import.meta.dirname, "../../contracts");
  execSync("forge build", { cwd: contractsDir, stdio: "pipe" });
  const artifact = JSON.parse(readFileSync(resolve(contractsDir, "out/Temptation.sol/Temptation.json"), "utf-8"));
  const bytecode = artifact.bytecode.object as Hex;
  const constructorArgs = encodeAbiParameters([{ type: "address" }], [rtrAddress]);
  const deployHash = await deployerWallet.deployContract({ abi: vaultAbi, bytecode: (bytecode + constructorArgs.slice(2)) as Hex });
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

  // Fresh keypairs — avoids ERC-7702 bytecode on Anvil deterministic accounts
  let tempteeKey: Hex;
  let counterpartyKey: Hex;
  let tempteeAgentId: bigint;
  let counterpartyAgentId: bigint;

  let temptee: TrustZonesAgent;

  const deadline = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const withdrawalLimit = determineWithdrawalLimit({ count: 0 }, GAME_MIN_STAKE);
  const VAULT_FUND = 10_000_000_000_000_000n;

  beforeAll(async () => {
    // Generate fresh keypairs (clean EOAs without ERC-7702 delegation)
    tempteeKey = generatePrivateKey();
    counterpartyKey = generatePrivateKey();

    // Deploy contracts (uses Anvil deployer — ERC-7702 doesn't affect outgoing txs)
    contracts = deploy(ANVIL_RPC_URL);
    vaultAddress = await deployVault(contracts.resourceTokenRegistry, ANVIL_ACCOUNTS.deployer.privateKey, VAULT_FUND);

    // Register both agents with ERC-8004 identity registry
    const tempteeReg = await registerAgent(tempteeKey);
    tempteeAgentId = tempteeReg.agentId;
    const cpReg = await registerAgent(counterpartyKey);
    counterpartyAgentId = cpReg.agentId;

    // Start Ponder
    ponder = new PonderManager(PONDER_PORT);
    await ponder.start(contracts, ANVIL_RPC_URL);
    backend = createBackend(ponder.url);

    // Create the temptee agent
    temptee = new TrustZonesAgent({
      privateKey: tempteeKey,
      rpcUrl: ANVIL_RPC_URL,
      ponderUrl: ponder.url,
    });

    // Tweet proxy
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
      tweetProxy = new MockTweetProxy({ onTweet, publicClient: publicClient as any });
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

    // Set env vars for MCP tools
    process.env.PONDER_URL = ponder.url;
    process.env.RPC_URL = ANVIL_RPC_URL;
  }, 120_000);

  afterAll(async () => {
    bonfiresSync?.stop();
    await tweetProxy?.stop();
    await ponder?.stop();
  });

  it("full lifecycle with fresh 8004 agents + production components", async () => {
    const log = (msg: string) => console.log(`[sync-timing] ${msg} (${uuidCount()} entities in registry)`);
    const tweetProxyUrl = `http://localhost:${TWEET_PROXY_PORT}`;
    const counterpartyAddress = privateKeyToAccount(counterpartyKey).address;

    // ── Temptee: propose with real agentId ──
    log("Temptee constructing proposal...");
    await sleep(AGENT_THINK_TIME);

    const justification = buildProposalJustification({
      stakeAmount: GAME_MIN_STAKE,
      requestedWithdrawalLimit: 2_000_000_000_000_000n,
    });
    const bareDoc = buildBareProposal({
      testedAgent: temptee.address,
      counterparty: counterpartyAddress,
      adjudicator: ANVIL_ACCOUNTS.adjudicator.address,
      deadline,
      termsDocUri: `data:application/json,${encodeURIComponent(JSON.stringify(justification))}`,
      testedAgentId: Number(tempteeAgentId),
      counterpartyAgentId: Number(counterpartyAgentId),
    });

    const agreementAddress = await temptee.createAgreement(
      contracts.agreementRegistry,
      counterpartyAddress,
      bareDoc,
    );
    await waitForState(backend, agreementAddress, "PROPOSED");
    log(`Beat 1a: PROPOSED (agreement: ${agreementAddress})`);

    // ── Counterparty: counter-propose with real agentId ──
    await sleep(AGENT_THINK_TIME);
    log("Counterparty evaluating proposal...");

    const counterDoc = buildCounterWithFullTerms({
      testedAgent: temptee.address,
      counterparty: counterpartyAddress,
      adjudicator: ANVIL_ACCOUNTS.adjudicator.address,
      temptationAddress: vaultAddress,
      withdrawalLimit,
      stakeAmount: GAME_MIN_STAKE,
      deadline,
      termsDocUri: `data:application/json,${encodeURIComponent(JSON.stringify({ type: "counter-terms", message: "Sync timing test." }))}`,
      testedAgentId: Number(tempteeAgentId),
      counterpartyAgentId: Number(counterpartyAgentId),
    });
    const counterData = compileGameSchemaDoc(counterDoc);
    const { encodeCounter } = await import("@trust-zones/sdk");
    const counter = encodeCounter(counterData);
    const cpAccount = privateKeyToAccount(counterpartyKey);
    const cpWallet = createWalletClient({ account: cpAccount, chain: base, transport });
    const cHash = await cpWallet.writeContract({
      address: agreementAddress, abi: AgreementABI, functionName: "submitInput", args: [counter.inputId, counter.payload],
    });
    await publicClient.waitForTransactionReceipt({ hash: cHash });
    await waitForState(backend, agreementAddress, "NEGOTIATING");
    log("Beat 1b: NEGOTIATING");

    // ── Temptee: accept ──
    await sleep(AGENT_THINK_TIME);
    await temptee.accept(agreementAddress, counter.payload);
    await waitForState(backend, agreementAddress, "ACCEPTED");
    log("Beat 1c: ACCEPTED");

    // ── Temptee: set up zones ──
    await sleep(AGENT_THINK_TIME);
    await temptee.setUp(agreementAddress);
    await waitForState(backend, agreementAddress, "READY");
    await waitForZoneCount(backend, agreementAddress, 2);
    log("Beat 2a: READY (zones deployed)");

    // ── Both parties stake (via staking_info MCP tool) ──
    await sleep(AGENT_THINK_TIME);

    const { handleStakingInfo } = await import("@trust-zones/x402-service/tools/staking");
    const stakingInfo = await handleStakingInfo({ agreement: agreementAddress, agentAddress: temptee.address });
    log(`staking_info: eligibility=${stakingInfo.eligibilityModule}, zone=${stakingInfo.zoneAddress}`);

    await dealUSDC(temptee.address, GAME_MIN_STAKE * 2n);
    await dealUSDC(counterpartyAddress, GAME_MIN_STAKE * 2n);

    await temptee.stake(stakingInfo.eligibilityModule as Address, USDC, GAME_MIN_STAKE);

    const cpStakingInfo = await handleStakingInfo({ agreement: agreementAddress, agentAddress: counterpartyAddress });
    const erc20Abi = parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]);
    const stakingAbi = parseAbi(["function stake(uint248 _amount)"]);
    const a1 = await cpWallet.writeContract({ address: USDC, abi: erc20Abi, functionName: "approve", args: [cpStakingInfo.eligibilityModule as Address, GAME_MIN_STAKE] });
    await publicClient.waitForTransactionReceipt({ hash: a1 });
    const a2 = await cpWallet.writeContract({ address: cpStakingInfo.eligibilityModule as Address, abi: stakingAbi, functionName: "stake", args: [GAME_MIN_STAKE] });
    await publicClient.waitForTransactionReceipt({ hash: a2 });
    log("Beat 2b: staked");

    // ── Temptee: activate ──
    await temptee.activate(agreementAddress);
    await waitForState(backend, agreementAddress, "ACTIVE");
    log("Beat 2c: ACTIVE");

    // ── Temptee: discover zone ──
    await temptee.discoverZone(agreementAddress);
    log(`Temptee zone: ${temptee.getZone()}`);

    // ── Temptee: post compliant tweet (ERC-8128 signed) ──
    await sleep(AGENT_THINK_TIME);
    const compliantContent = `TZ Game ${agreementAddress.slice(0, 8)} tempt:${withdrawalLimit}wei @synthesis_md ${Math.random().toString(36).slice(2, 8)}`;
    const tweet1 = await temptee.postTweet(tweetProxyUrl, compliantContent);
    log(`Beat 3a: compliant tweet posted (${tweet1.tweetId})`);

    // ── Temptee: post bad tweet ──
    await sleep(AGENT_THINK_TIME);
    const tweet2 = await temptee.postTweet(tweetProxyUrl, `Buy my NFTs! ${Math.random().toString(36).slice(2, 8)}`);
    log(`Beat 3b: bad tweet posted (${tweet2.tweetId})`);

    // ── Temptee: withdraw from vault (violation) ──
    await sleep(AGENT_THINK_TIME);
    const permTokenId = await findVaultWithdrawTokenId(ponder.url, temptee.getZone()!);
    const withdrawCalldata = encodeFunctionData({
      abi: vaultAbi, functionName: "withdraw", args: [withdrawalLimit / 2n, permTokenId],
    });
    await temptee.executeViaZone(vaultAddress, 0n, withdrawCalldata);
    log("Beat 5: vault withdrawal (violation)");

    // ── Start counterparty agent (production) ──
    const counterpartyAgent = await startCounterparty({
      rpcUrl: ANVIL_RPC_URL,
      ponderUrl: ponder.url,
      privateKey: counterpartyKey,
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

    // ── Verify ERC-8004 reputation feedback via Ponder ──
    // Wait for Ponder to index the ReputationFeedbackWritten events
    await waitFor(
      async () => {
        const data = await temptee.graphql<any>(
          `{ reputationFeedbacks(where: { agreementId: "${agreementAddress.toLowerCase()}" }) { items { id tag actorId feedbackURI } } }`,
        );
        return data.reputationFeedbacks?.items ?? [];
      },
      (items: any[]) => items.length >= 2,
      15_000,
    );

    const feedbackData = await temptee.graphql<any>(
      `{ reputationFeedbacks(where: { agreementId: "${agreementAddress.toLowerCase()}" }) { items { id tag actorId feedbackURI } } }`,
    );
    const feedbacks = feedbackData.reputationFeedbacks.items;
    console.log(`[sync-timing] Reputation feedback: ${feedbacks.length} entries`);
    for (const fb of feedbacks) {
      console.log(`[sync-timing]   agentId=${fb.actorId ?? "?"} tag=${fb.tag} uri=${fb.feedbackURI?.slice(0, 60)}...`);
    }

    expect(feedbacks.length).toBeGreaterThanOrEqual(2);
    expect(feedbacks.some((f: any) => f.tag === "ADJUDICATED")).toBe(true);

    log("Beat 8: reputation feedback verified via Ponder");

    // ── Final sync catch-up ──
    await sleep(AGENT_THINK_TIME * 2);
    log("Done — final registry state");

    const finalCount = uuidCount();
    console.log(`[sync-timing] Final: ${finalCount} entities in Bonfires UUID registry`);
    expect(finalCount).toBeGreaterThan(10);
  }, 300_000);
});
