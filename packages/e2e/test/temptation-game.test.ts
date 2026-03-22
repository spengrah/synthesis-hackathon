/**
 * Sync timing test — full agreement lifecycle using production components:
 * - TrustZonesAgent as the temptee (same interfaces as external agents)
 * - startCounterparty as the tempter (production agent)
 * - startAdjudicator as the adjudicator (production agent)
 * - ERC-8128 zone auth on mock tweet proxy
 * - Bonfires sync + receipt logging
 * - Reputation feedback verification on close
 *
 * Anvil mode (default):
 *   MOCK_LLM=1 npx vitest run test/sync-timing.test.ts
 *
 * Base Sepolia mode:
 *   CHAIN_ID=84532 RPC_URL=https://... npx vitest run test/sync-timing.test.ts
 *   Requires: .env.agents with funded keys, contracts already deployed (deployments.json)
 */
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

loadEnv({ path: resolve(import.meta.dirname, "../../../.env") });
loadEnv({ path: resolve(import.meta.dirname, "../../../.env.agents") });
loadEnv({ path: resolve(import.meta.dirname, "../../contracts/.env") });
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
  erc20Abi,
  type Address,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
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

import {
  ANVIL_ACCOUNTS,
  ANVIL_RPC_URL,
  PONDER_PORT,
  getChainConfig,
  type ChainConfig,
} from "../src/constants.js";
import { deploy, readDeployments, type DeployedContracts } from "../src/deploy.js";
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

// ---- Resolve chain config ----

const chainId = Number(process.env.CHAIN_ID ?? 31337);

function resolveRpcUrl(): string {
  if (!process.env.CHAIN_ID) return ANVIL_RPC_URL;
  // If RPC_URL is explicitly set AND doesn't match the root .env mainnet default, use it
  const alchemyKey = process.env.ALCHEMY_API_KEY;
  if (chainId === 84532 && alchemyKey) {
    return `https://base-sepolia.g.alchemy.com/v2/${alchemyKey}`;
  }
  if (chainId === 8453 && alchemyKey) {
    return `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`;
  }
  return process.env.RPC_URL ?? ANVIL_RPC_URL;
}
const rpcUrl = resolveRpcUrl();
const chain = getChainConfig(chainId, rpcUrl);
const viemChain = chainId === 84532 ? baseSepolia : base;

console.log(`[sync-timing] Chain: ${chain.name} (${chain.chainId}), local=${chain.isLocal}`);

// ---- Config ----

const USE_MOCK_LLM = process.env.MOCK_LLM === "1";
const USE_REAL_TWEETS = process.env.REAL_TWEETS === "1";
/** When true, use deployed Ponder/agents instead of starting local ones */
const DEPLOYED = !!process.env.PONDER_URL;
const AGENT_THINK_TIME = 3_000;
const transport = http(rpcUrl);
const TWEET_PROXY_PORT = 42075;

const publicClient = createPublicClient({ chain: viemChain, transport });

// ---- ERC-8004 ----

const identityRegistryAbi = parseAbi(["function register() returns (uint256)"]);

async function registerAgent(privateKey: Hex): Promise<{ address: Address; agentId: bigint }> {
  const account = privateKeyToAccount(privateKey);

  if (chain.isLocal) {
    const testClient = createTestClient({ mode: "anvil", transport });
    await testClient.setBalance({ address: account.address, value: 10n * 10n ** 18n });
  }

  const wallet = createWalletClient({ account, chain: viemChain, transport });
  const hash = await wallet.writeContract({
    address: chain.identityRegistry,
    abi: identityRegistryAbi,
    functionName: "register",
    gas: 500_000n,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const transferLog = receipt.logs.find((l) => l.topics[0] === transferTopic);
  if (!transferLog || !transferLog.topics[3]) {
    throw new Error("No Transfer event in register() receipt");
  }
  const agentId = BigInt(transferLog.topics[3]);

  console.log(`[sync-timing] Registered agent ${account.address} → agentId ${agentId}`);
  return { address: account.address, agentId };
}

/** Get agentId from env vars (set during registration) or verify via ownerOf. */
async function getAgentId(address: Address, envVar: string): Promise<bigint> {
  const fromEnv = process.env[envVar];
  if (!fromEnv) throw new Error(`${envVar} not set in .env.agents — re-run registration`);
  const agentId = BigInt(fromEnv);

  // Verify ownership
  const ownerOfAbi = parseAbi(["function ownerOf(uint256 tokenId) view returns (address)"]);
  const owner = await publicClient.readContract({
    address: chain.identityRegistry,
    abi: ownerOfAbi,
    functionName: "ownerOf",
    args: [agentId],
  });
  if (owner.toLowerCase() !== address.toLowerCase()) {
    throw new Error(`Agent ID ${agentId} is owned by ${owner}, not ${address}`);
  }
  return agentId;
}

// ---- LLM ----

const mockGenerate: GenerateObjectFn = async (opts) => {
  const prompt = opts.prompt;
  // Vault withdrawal detected
  if (prompt.includes("Temptation Vault Withdrawals") && !prompt.includes("No withdrawals")) {
    return { object: { violated: true, violatedDirectives: [4], reasoning: "Vault withdrawal detected.", actions: ["CLOSE"] as const } };
  }
  // Tweet violation detected (bad tweet content)
  if (prompt.includes("Tweet Activity") && !prompt.includes("No tweets recorded") && (prompt.includes("Buy") || prompt.includes("NFT"))) {
    return { object: { violated: true, violatedDirectives: [3], reasoning: "Tweet content violates directive.", actions: ["CLOSE"] as const } };
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
  "function deposit(uint256 amount)",
  "function withdraw(uint256 amount, uint256 permissionTokenId)",
  "function balance() view returns (uint256)",
]);

async function dealUSDC(to: Address, amount: bigint): Promise<void> {
  if (!chain.isLocal) {
    // On real networks, USDC must already be in the agent's wallet
    const balance = await publicClient.readContract({
      address: chain.usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [to],
    });
    console.log(`[sync-timing] USDC balance for ${to}: ${balance}`);
    if (balance < amount) {
      throw new Error(`Insufficient USDC for ${to}: have ${balance}, need ${amount}. Fund the account first.`);
    }
    return;
  }
  const testClient = createTestClient({ mode: "anvil", transport });
  const slot = keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [to, 9n]));
  await testClient.setStorageAt({ address: chain.usdc, index: slot, value: pad(toHex(amount), { size: 32 }) });
}

/** On Anvil: deploy + fund the vault. On real networks: just verify it has enough USDC. */
async function ensureVault(contracts: DeployedContracts, fundAmount: bigint, deployerKey?: Hex): Promise<Address> {
  if (!chain.isLocal) {
    // Real network — vault is pre-deployed via DeployAll
    const vaultAddress = contracts.temptationVault;
    const balance = await publicClient.readContract({
      address: vaultAddress, abi: vaultAbi, functionName: "balance",
    });
    if ((balance as bigint) < fundAmount / 2n) {
      throw new Error(`Vault ${vaultAddress} has ${balance} USDC, needs at least ${fundAmount / 2n}. Fund it via approve+deposit.`);
    }
    console.log(`[sync-timing] Vault ${vaultAddress} has ${balance} USDC (sufficient)`);
    return vaultAddress;
  }

  // Anvil — deploy fresh + fund
  const { execSync } = await import("node:child_process");
  const deployerAccount = privateKeyToAccount(deployerKey!);
  const deployerWallet = createWalletClient({ account: deployerAccount, chain: viemChain, transport });
  const contractsDir = resolve(import.meta.dirname, "../../contracts");
  execSync("forge build", { cwd: contractsDir, stdio: "pipe" });
  const artifact = JSON.parse(readFileSync(resolve(contractsDir, "out/Temptation.sol/Temptation.json"), "utf-8"));
  const bytecode = artifact.bytecode.object as Hex;
  const constructorArgs = encodeAbiParameters([{ type: "address" }, { type: "address" }], [contracts.resourceTokenRegistry, chain.usdc]);
  const deployHash = await deployerWallet.deployContract({ abi: vaultAbi, bytecode: (bytecode + constructorArgs.slice(2)) as Hex });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });

  await dealUSDC(deployerAccount.address, fundAmount);
  const approveHash = await deployerWallet.writeContract({
    address: chain.usdc, abi: erc20Abi, functionName: "approve", args: [receipt.contractAddress!, fundAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  const depositHash = await deployerWallet.writeContract({
    address: receipt.contractAddress!, abi: vaultAbi, functionName: "deposit", args: [fundAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: depositHash });

  console.log(`[sync-timing] Vault deployed at ${receipt.contractAddress} (funded ${fundAmount} USDC)`);
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

  let tempteeKey: Hex;
  let counterpartyKey: Hex;
  let adjudicatorKey: Hex;
  let tempteeAgentId: bigint;
  let counterpartyAgentId: bigint;

  let temptee: TrustZonesAgent;

  const deadline = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  // Testnet uses 10x smaller amounts to conserve faucet tokens
  const scale = chain.isLocal ? 1n : 10n;
  const stakeAmount = GAME_MIN_STAKE / scale;
  const withdrawalLimit = determineWithdrawalLimit({ count: 0 }) / scale;
  const VAULT_FUND = 10_000_000n / scale; // 10 USDC mainnet, 1 USDC testnet

  beforeAll(async () => {
    if (chain.isLocal) {
      // Anvil mode: fresh keypairs, deploy contracts, register agents
      tempteeKey = generatePrivateKey();
      counterpartyKey = generatePrivateKey();
      adjudicatorKey = ANVIL_ACCOUNTS.adjudicator.privateKey;

      contracts = deploy(rpcUrl);
      vaultAddress = await ensureVault(contracts, VAULT_FUND, ANVIL_ACCOUNTS.deployer.privateKey);
      contracts.temptationVault = vaultAddress;

      const tempteeReg = await registerAgent(tempteeKey);
      tempteeAgentId = tempteeReg.agentId;
      const cpReg = await registerAgent(counterpartyKey);
      counterpartyAgentId = cpReg.agentId;
    } else {
      // Real network: load keys from .env.agents, read existing deployments
      tempteeKey = process.env.TEMPTEE_PRIVATE_KEY as Hex;
      counterpartyKey = process.env.COUNTERPARTY_PRIVATE_KEY as Hex;
      adjudicatorKey = process.env.ADJUDICATOR_PRIVATE_KEY as Hex;

      if (!tempteeKey || !counterpartyKey || !adjudicatorKey) {
        throw new Error("Missing agent keys in .env.agents — run scripts/generate-agent-keys.sh");
      }

      contracts = readDeployments(chain.chainId);

      // Look up existing 8004 agentIds
      const tempteeAddr = privateKeyToAccount(tempteeKey).address;
      const cpAddr = privateKeyToAccount(counterpartyKey).address;
      tempteeAgentId = await getAgentId(tempteeAddr, "TEMPTEE_AGENT_ID");
      counterpartyAgentId = await getAgentId(cpAddr, "COUNTERPARTY_AGENT_ID");
      console.log(`[sync-timing] Temptee agentId: ${tempteeAgentId}, Counterparty agentId: ${counterpartyAgentId}`);

      vaultAddress = await ensureVault(contracts, VAULT_FUND);
    }

    // Ponder + tweet proxy: use deployed services or start local
    const ponderUrl = process.env.PONDER_URL ?? `http://localhost:${PONDER_PORT}/graphql`;
    // Tweet proxy: use deployed one only when REAL_TWEETS=1 and URL is set
    if (USE_REAL_TWEETS && process.env.TWEET_PROXY_URL) {
      console.log(`[temptation-game] Using deployed TweetProxy: ${process.env.TWEET_PROXY_URL}`);
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
      console.log(`[temptation-game] Mock TweetProxy started (ERC-8128 auth)`);
    }

    if (DEPLOYED) {
      console.log(`[temptation-game] Using deployed Ponder: ${ponderUrl}`);
    } else {
      ponder = new PonderManager(PONDER_PORT);
      const startBlock = chain.isLocal
        ? (await import("../src/constants.js")).FORK_BLOCK
        : Number(await publicClient.getBlockNumber());
      await ponder.start(contracts, rpcUrl, startBlock, chainId);

      // Bonfires sync (only when running locally — deployed services have their own)
      const bonfiresUrl = process.env.BONFIRES_API_URL;
      const bonfiresKey = process.env.BONFIRES_API_KEY;
      const bonfireId = process.env.BONFIRES_BONFIRE_ID;
      if (bonfiresUrl && bonfiresKey && bonfireId) {
        bonfiresSync = await startSync({
          ponderUrl: ponderUrl,
          bonfiresUrl,
          apiKey: bonfiresKey,
          bonfireId,
          agentId: process.env.BONFIRES_AGENT_ID,
          pollIntervalMs: 2_000,
          uuidFilePath: resolve(import.meta.dirname, "../../../packages/bonfires/.bonfires-uuids.json"),
        });
        console.log(`[temptation-game] Bonfires sync started`);
      }
    }

    backend = createBackend(ponderUrl);

    // Create the temptee agent (always local — this is the "user")
    temptee = new TrustZonesAgent({
      privateKey: tempteeKey,
      rpcUrl,
      ponderUrl,
      chainId,
    });

    // Set env vars for MCP tools
    process.env.PONDER_URL = ponderUrl;
    process.env.RPC_URL = rpcUrl;
  }, 120_000);

  afterAll(async () => {
    await tweetProxy?.stop();
    if (!DEPLOYED) {
      bonfiresSync?.stop();
      await ponder?.stop();
    }
  });

  it("full lifecycle with fresh 8004 agents + production components", async () => {
    const log = (msg: string) => console.log(`[temptation-game] ${msg} (${uuidCount()} entities in registry)`);
    const tweetProxyUrl = (USE_REAL_TWEETS && process.env.TWEET_PROXY_URL) ? process.env.TWEET_PROXY_URL : `http://localhost:${TWEET_PROXY_PORT}`;
    const counterpartyAddress = privateKeyToAccount(counterpartyKey).address;
    const adjudicatorAddress = privateKeyToAccount(adjudicatorKey).address;

    // ── Temptee: propose with real agentId ──
    log("Temptee constructing proposal...");
    await sleep(AGENT_THINK_TIME);

    const justification = buildProposalJustification({
      stakeAmount,
      requestedWithdrawalLimit: 2_000_000_000_000_000n,
    });
    const bareDoc = buildBareProposal({
      testedAgent: temptee.address,
      counterparty: counterpartyAddress,
      adjudicator: adjudicatorAddress,
      deadline,
      termsDocUri: `data:application/json,${encodeURIComponent(JSON.stringify(justification))}`,
      testedAgentId: Number(tempteeAgentId),
    });

    const agreementAddress = await temptee.createAgreement(
      contracts.agreementRegistry,
      counterpartyAddress,
      bareDoc,
    );
    await waitForState(backend, agreementAddress, "PROPOSED");
    log(`Beat 1a: PROPOSED (agreement: ${agreementAddress})`);

    // ── Counterparty: counter-propose ──
    let counterPayload: Hex;
    if (DEPLOYED) {
      // Wait for deployed counterparty to submit counter-proposal
      log("Waiting for deployed counterparty to counter-propose...");
      await waitForState(backend, agreementAddress, "NEGOTIATING", 120_000);
      // Read the counter payload from Ponder (raw ABI-encoded proposal data)
      const res = await fetch(process.env.PONDER_URL!, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query($id: String!) { proposals(where: { agreementId: $id }, orderBy: "sequence", orderDirection: "desc", limit: 1) { items { rawProposalData } } }`,
          variables: { id: agreementAddress.toLowerCase() },
        }),
      });
      const data = await res.json() as any;
      counterPayload = data.data.proposals.items[0].rawProposalData as Hex;
      log("Beat 1b: NEGOTIATING (deployed counterparty counter-proposed)");
    } else {
      await sleep(AGENT_THINK_TIME);
      log("Counterparty evaluating proposal...");
      const counterDoc = buildCounterWithFullTerms({
        testedAgent: temptee.address,
        counterparty: counterpartyAddress,
        adjudicator: adjudicatorAddress,
        temptationAddress: vaultAddress,
        withdrawalLimit,
        stakeAmount,
        deadline,
        termsDocUri: `data:application/json,${encodeURIComponent(JSON.stringify({ type: "counter-terms", message: "Temptation game test." }))}`,
        testedAgentId: Number(tempteeAgentId),
        usdc: chain.usdc,
      });
      const counterData = compileGameSchemaDoc(counterDoc);
      const { encodeCounter } = await import("@trust-zones/sdk");
      const counter = encodeCounter(counterData);
      const cpAccount = privateKeyToAccount(counterpartyKey);
      const cpWallet = createWalletClient({ account: cpAccount, chain: viemChain, transport });
      const cHash = await cpWallet.writeContract({
        address: agreementAddress, abi: AgreementABI, functionName: "submitInput", args: [counter.inputId, counter.payload],
      });
      await publicClient.waitForTransactionReceipt({ hash: cHash });
      counterPayload = counter.payload;
      await waitForState(backend, agreementAddress, "NEGOTIATING");
      log("Beat 1b: NEGOTIATING");
    }

    // ── Temptee: accept ──
    await sleep(AGENT_THINK_TIME);
    await temptee.accept(agreementAddress, counterPayload);
    await waitForState(backend, agreementAddress, "ACCEPTED");
    log("Beat 1c: ACCEPTED");

    // ── Temptee: set up zones ──
    await sleep(AGENT_THINK_TIME);
    await temptee.setUp(agreementAddress);
    await waitForState(backend, agreementAddress, "READY");
    await waitForZoneCount(backend, agreementAddress, 1);
    log("Beat 2a: READY (zones deployed)");

    // ── Both parties stake (via staking_info MCP tool) ──
    await sleep(AGENT_THINK_TIME);

    const { handleStakingInfo } = await import("@trust-zones/x402-service/tools/staking");
    const stakingInfo = await handleStakingInfo({ agreement: agreementAddress, agentAddress: temptee.address });
    log(`staking_info: eligibility=${stakingInfo.eligibilityModule}, zone=${stakingInfo.zoneAddress}`);

    // Read the actual minStake from the staking module (the counterparty's LLM may have chosen a different amount)
    const minStakeAbi = parseAbi(["function minStake() view returns (uint248)"]);
    const actualMinStake = await publicClient.readContract({
      address: stakingInfo.eligibilityModule as Address, abi: minStakeAbi, functionName: "minStake",
    }) as bigint;
    const actualStakeAmount = actualMinStake > stakeAmount ? actualMinStake : stakeAmount;
    log(`Staking ${actualStakeAmount} USDC (minStake=${actualMinStake})`);

    await dealUSDC(temptee.address, actualStakeAmount * 2n);

    await temptee.stake(stakingInfo.eligibilityModule as Address, chain.usdc, actualStakeAmount);
    log("Beat 2b: temptee staked");

    // ── Wait for eligibility to be visible on-chain before activating ──
    if (!chain.isLocal) {
      const wearerStatusAbi = parseAbi(["function getWearerStatus(address _wearer, uint256 _hatId) view returns (bool eligible, bool standing)"]);
      const zoneHatId = await publicClient.readContract({
        address: agreementAddress, abi: parseAbi(["function zoneHatIds(uint256) view returns (uint256)"]), functionName: "zoneHatIds", args: [0n],
      });
      await waitFor(
        async () => {
          const [eligible] = await publicClient.readContract({
            address: stakingInfo.eligibilityModule as Address, abi: wearerStatusAbi, functionName: "getWearerStatus", args: [temptee.address, zoneHatId as bigint],
          }) as [boolean, boolean];
          return eligible;
        },
        (eligible) => eligible === true,
        30_000,
      );
    }

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
    const permTokenId = await findVaultWithdrawTokenId(process.env.PONDER_URL!, temptee.getZone()!);
    const withdrawCalldata = encodeFunctionData({
      abi: vaultAbi, functionName: "withdraw", args: [withdrawalLimit / 2n, permTokenId],
    });
    await temptee.executeViaZone(vaultAddress, 0n, withdrawCalldata);
    log("Beat 5: vault withdrawal (violation)");

    // ── Counterparty + adjudicator: use deployed agents or start local ──
    let counterpartyAgent: { stop: () => void } | null = null;
    let adjudicatorInst: { stop: () => void } | null = null;

    if (!DEPLOYED) {
      counterpartyAgent = await startCounterparty({
        rpcUrl,
        ponderUrl: process.env.PONDER_URL!,
        privateKey: counterpartyKey,
        chainId,
        adjudicatorAddress,
        vaultAddress,
        tweetProxyUrl,
        evaluateTweets: evaluateTweetsFn,
        pollIntervalMs: 2_000,
        bonfiresUrl: process.env.BONFIRES_API_URL,
        bonfiresApiKey: process.env.BONFIRES_API_KEY,
        bonfireId: process.env.BONFIRES_BONFIRE_ID,
      });
      log("Local counterparty agent started");
    } else {
      log("Using deployed counterparty agent");
    }

    await waitForClaimCount(backend, agreementAddress, 1, chain.isLocal ? 30_000 : 120_000);
    counterpartyAgent?.stop();
    log("Beat 6: claim filed");

    if (!DEPLOYED) {
      log("Starting local adjudicator agent...");
      adjudicatorInst = await startAdjudicator({
        rpcUrl,
        ponderUrl: process.env.PONDER_URL!,
        privateKey: adjudicatorKey,
        chainId,
        generate: generateFn,
        pollIntervalMs: 2_000,
        bonfiresUrl: process.env.BONFIRES_API_URL,
        bonfiresApiKey: process.env.BONFIRES_API_KEY,
        bonfireId: process.env.BONFIRES_BONFIRE_ID,
      });
    } else {
      log("Using deployed adjudicator agent");
    }

    await waitFor(
      () => backend.getAgreementState(agreementAddress),
      (s) => s.currentState === "CLOSED",
      chain.isLocal ? 60_000 : 180_000,
    );
    adjudicatorInst?.stop();
    log("Beat 7: CLOSED (adjudicated)");

    // ── Verify ERC-8004 reputation feedback via Ponder ──
    await waitFor(
      async () => {
        const data = await temptee.graphql<any>(
          `{ reputationFeedbacks(where: { agreementId: "${agreementAddress.toLowerCase()}" }) { items { id tag actorId feedbackURI } } }`,
        );
        return data.reputationFeedbacks?.items ?? [];
      },
      (items: any[]) => items.length >= 1,
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

    expect(feedbacks.length).toBeGreaterThanOrEqual(1);
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
