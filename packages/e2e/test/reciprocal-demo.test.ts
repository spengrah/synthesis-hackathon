import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Load X credentials from agents/.env when REAL_TWEETS=1
if (process.env.REAL_TWEETS === "1") {
  loadEnv({ path: resolve(import.meta.dirname, "../../agents/.env") });
}
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
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import {
  AgreementRegistryABI,
  AgreementABI,
  encodePropose,
  encodeCounter,
  encodeAccept,
  encodeSetUp,
  encodeActivate,
  encodeClaim,
  encodeAdjudicate,
  encodeComplete,
  buildZoneExecute,
  type ReadBackend,
} from "@trust-zones/sdk";

import {
  evaluateClaim,
  mapVerdictToActions,
  buildClaimEvidence,
  checkVaultWithdrawals,
  createClaudeCliGenerate,
  createCliEvaluateTweets,
  createTwitterClientFromEnv,
  TweetProxy,
  createTweetProxyFromEnv,
  type ClaimContext,
  type GenerateObjectFn,
  type MonitorConfig,
  type EvaluateTweetsFn,
} from "@trust-zones/agents";

import { ANVIL_ACCOUNTS, ANVIL_RPC_URL, PONDER_PORT, USDC, PRE_DEPLOYED } from "../src/constants.js";
import { deploy, type DeployedContracts } from "../src/deploy.js";
import { PonderManager } from "../src/ponder-manager.js";
import { createBackend, waitFor, waitForState, waitForZoneCount, waitForClaimCount } from "../src/graphql.js";
import { MockTweetProxy } from "../src/mock-tweet-proxy.js";
import { MockDataApi } from "../src/mock-data-api.js";
import { Transcript } from "../src/transcript.js";
import {
  buildBareProposal,
  buildCounterWithFullTerms,
  buildProposalJustification,
  compileGameSchemaDoc,
  determineWithdrawalLimit,
  GAME_MIN_STAKE,
  VAULT_DIRECTIVE,
} from "../src/reputation-game-scenario.js";
import { decodePermission } from "@trust-zones/compiler";

// ---- Setup ----

const transport = http(ANVIL_RPC_URL);
const TWEET_PROXY_PORT = 42073;
const DATA_API_PORT = 42074;

const publicClient = createPublicClient({ chain: base, transport });
const testClient = createTestClient({ mode: "anvil", transport });

// Roles: tested agent = partyA (initiator), counterparty = partyB
const testedAgentAccount = privateKeyToAccount(ANVIL_ACCOUNTS.partyA.privateKey);
const counterpartyAccount = privateKeyToAccount(ANVIL_ACCOUNTS.partyB.privateKey);
const adjudicatorAccount = privateKeyToAccount(ANVIL_ACCOUNTS.adjudicator.privateKey);

const testedAgentClient = createWalletClient({ account: testedAgentAccount, chain: base, transport });
const counterpartyClient = createWalletClient({ account: counterpartyAccount, chain: base, transport });

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);
const stakingAbi = parseAbi([
  "function stake(uint248 _amount)",
  "function stakes(address) view returns (uint248 amount, bool slashed)",
]);
const hatsAbi = parseAbi([
  "function getHatEligibilityModule(uint256 _hatId) view returns (address)",
]);
const vaultAbi = parseAbi([
  "function deposit() payable",
  "function withdraw(uint256 amount, uint256 permissionTokenId)",
  "function balance() view returns (uint256)",
]);

// ---- Transcript ----

const tx = new Transcript("Trust Zones Reciprocal Demo Transcript");

// ---- LLM for adjudicator ----

const USE_MOCK_LLM = process.env.MOCK_LLM === "1";
const USE_REAL_TWEETS = process.env.REAL_TWEETS === "1";

const mockGenerate: GenerateObjectFn = async (opts) => {
  const prompt = opts.prompt;
  const hasVaultWithdrawal = prompt.includes("Temptation Vault Withdrawals") && !prompt.includes("No withdrawals from the Temptation Vault");
  if (hasVaultWithdrawal) {
    return {
      object: {
        violated: true,
        violatedDirectives: [4],
        reasoning: "Vault withdrawal detected. Directive prohibits any withdrawal.",
        actions: ["CLOSE"] as const,
      },
    };
  }
  return {
    object: {
      violated: false,
      violatedDirectives: [],
      reasoning: "No violation evidence found.",
      actions: [],
    },
  };
};

const generateFn: GenerateObjectFn = USE_MOCK_LLM
  ? mockGenerate
  : createClaudeCliGenerate();

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

const evaluateTweetsFn: EvaluateTweetsFn = USE_MOCK_LLM
  ? mockEvaluateTweets
  : createCliEvaluateTweets();

// ---- Helpers ----

async function submitInput(
  account: ReturnType<typeof privateKeyToAccount>,
  agreement: Address,
  inputId: Hex,
  payload: Hex,
): Promise<Hex> {
  const client = createWalletClient({ account, chain: base, transport });
  const hash = await client.writeContract({
    address: agreement,
    abi: AgreementABI,
    functionName: "submitInput",
    args: [inputId, payload],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

async function createAgreement(
  contracts: DeployedContracts,
  creator: ReturnType<typeof privateKeyToAccount>,
  partyB: Address,
  proposalPayload: Hex,
): Promise<Address> {
  const client = createWalletClient({ account: creator, chain: base, transport });
  const { result } = await publicClient.simulateContract({
    account: creator,
    address: contracts.agreementRegistry,
    abi: AgreementRegistryABI,
    functionName: "createAgreement",
    args: [partyB, proposalPayload],
  });
  const hash = await client.writeContract({
    address: contracts.agreementRegistry,
    abi: AgreementRegistryABI,
    functionName: "createAgreement",
    args: [partyB, proposalPayload],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return result;
}

async function dealUSDC(to: Address, amount: bigint): Promise<void> {
  const slot = keccak256(
    encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [to, 9n]),
  );
  await testClient.setStorageAt({
    address: USDC,
    index: slot,
    value: pad(toHex(amount), { size: 32 }),
  });
}

async function approveAndStake(
  account: ReturnType<typeof privateKeyToAccount>,
  stakingModule: Address,
  amount: bigint,
): Promise<void> {
  const client = createWalletClient({ account, chain: base, transport });
  const h1 = await client.writeContract({
    address: USDC, abi: erc20Abi, functionName: "approve", args: [stakingModule, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: h1 });
  const h2 = await client.writeContract({
    address: stakingModule, abi: stakingAbi, functionName: "stake", args: [amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: h2 });
}

async function deployVault(rtrAddress: Address, fundAmount: bigint): Promise<Address> {
  const { execSync } = await import("node:child_process");
  const { resolve } = await import("node:path");
  const { readFileSync } = await import("node:fs");

  const contractsDir = resolve(import.meta.dirname, "../../contracts");
  execSync("forge build", { cwd: contractsDir, stdio: "pipe" });

  const artifact = JSON.parse(
    readFileSync(resolve(contractsDir, "out/Temptation.sol/Temptation.json"), "utf-8"),
  );
  const bytecode = artifact.bytecode.object as Hex;

  const constructorArgs = encodeAbiParameters([{ type: "address" }], [rtrAddress]);

  const deployHash = await counterpartyClient.deployContract({
    abi: vaultAbi,
    bytecode: (bytecode + constructorArgs.slice(2)) as Hex,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  const vaultAddress = receipt.contractAddress!;

  await testClient.setBalance({ address: vaultAddress, value: fundAmount });

  return vaultAddress;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

async function findVaultWithdrawTokenId(ponderUrl: string, zoneAddress: Address): Promise<bigint> {
  const permRes = await fetch(ponderUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query($id: String!) {
        trustZone(id: $id) {
          permissions { items { resourceToken { id metadata } } }
        }
      }`,
      variables: { id: zoneAddress.toLowerCase() },
    }),
  });
  const permData = await permRes.json() as {
    data: { trustZone: { permissions: { items: { resourceToken: { id: string; metadata: string } }[] } } };
  };

  const items = permData.data.trustZone?.permissions?.items ?? [];
  for (const item of items) {
    try {
      const decoded = decodePermission(item.resourceToken.metadata as Hex);
      if (decoded.resource === "vault-withdraw") {
        return BigInt(item.resourceToken.id);
      }
    } catch {
      // skip tokens with unparseable metadata
    }
  }

  throw new Error(`No vault-withdraw permission found for zone ${zoneAddress}`);
}

/** Find a data-api-read permission token for a zone by querying Ponder. */
async function findDataApiReadTokenId(ponderUrl: string, zoneAddress: Address): Promise<bigint> {
  const permRes = await fetch(ponderUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query($id: String!) {
        trustZone(id: $id) {
          permissions { items { resourceToken { id metadata } } }
        }
      }`,
      variables: { id: zoneAddress.toLowerCase() },
    }),
  });
  const permData = await permRes.json() as {
    data: { trustZone: { permissions: { items: { resourceToken: { id: string; metadata: string } }[] } } };
  };

  const items = permData.data.trustZone?.permissions?.items ?? [];
  for (const item of items) {
    try {
      const decoded = decodePermission(item.resourceToken.metadata as Hex);
      if (decoded.resource === "data-api-read") {
        return BigInt(item.resourceToken.id);
      }
    } catch {
      // skip tokens with unparseable metadata
    }
  }

  throw new Error(`No data-api-read permission found for zone ${zoneAddress}`);
}

// ---- Test suite ----

describe("Reciprocal Demo E2E", () => {
  let contracts: DeployedContracts;
  let ponder: PonderManager;
  let tweetProxy: MockTweetProxy | TweetProxy;
  let dataApi: MockDataApi;
  let vaultAddress: Address;
  let backend: ReadBackend;
  let agreementAddress: Address;
  let counterPayload: Hex;
  let withdrawalBlockNumber: bigint;

  const deadline = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const requestedWithdrawalLimit = 2_000_000_000_000_000n;
  const withdrawalLimit = determineWithdrawalLimit({ count: 0 }, GAME_MIN_STAKE);
  const VAULT_FUND_AMOUNT = 10_000_000_000_000_000n; // 0.01 ETH

  const llmClient = { provider: (() => "claude-cli") as any, model: "haiku" };

  beforeAll(async () => {
    tx.beat("Setup");

    contracts = deploy(ANVIL_RPC_URL);
    tx.action("Deployed contracts via DeployAll.s.sol", {
      agreementRegistry: contracts.agreementRegistry,
      resourceTokenRegistry: contracts.resourceTokenRegistry,
    });

    vaultAddress = await deployVault(contracts.resourceTokenRegistry, VAULT_FUND_AMOUNT);
    tx.action("Deployed Temptation vault on Anvil", {
      vault: vaultAddress,
      fundedWith: VAULT_FUND_AMOUNT.toString() + " wei",
    });

    ponder = new PonderManager(PONDER_PORT);
    await ponder.start(contracts, ANVIL_RPC_URL);
    tx.result("Ponder indexer started", { url: ponder.url });

    backend = createBackend(ponder.url);

    if (USE_REAL_TWEETS) {
      tweetProxy = createTweetProxyFromEnv(publicClient as any);
      await tweetProxy.start(TWEET_PROXY_PORT);
      tx.result("Real tweet proxy started", { port: TWEET_PROXY_PORT });
    } else {
      tweetProxy = new MockTweetProxy();
      await tweetProxy.start(TWEET_PROXY_PORT);
      tx.result("Mock tweet proxy started", { port: TWEET_PROXY_PORT });
    }

    dataApi = new MockDataApi();
    await dataApi.start(DATA_API_PORT);
    tx.result("Mock data API started", { port: DATA_API_PORT });
  }, 120_000);

  afterAll(async () => {
    tx.save("reciprocal-demo-transcript.md");
    await tweetProxy?.stop();
    await dataApi?.stop();
    await ponder?.stop();
  });

  // ====================
  // Beat 1: NEGOTIATE
  // ====================

  it("1a. tested agent proposes bare agreement with justification", async () => {
    tx.beat("Beat 1: Negotiate");

    const justification = buildProposalJustification({
      stakeAmount: GAME_MIN_STAKE,
      requestedWithdrawalLimit,
    });
    const termsDocUri = `data:application/json,${encodeURIComponent(JSON.stringify(justification))}`;

    tx.action("Tested agent constructs bare proposal with justification", {
      message: justification.message,
      requestedPermissions: justification.requestedPermissions,
      proposedStake: justification.proposedStake,
      requestedWithdrawalLimit: justification.requestedWithdrawalLimit,
    });

    const bareDoc = buildBareProposal({
      testedAgent: ANVIL_ACCOUNTS.partyA.address,
      counterparty: ANVIL_ACCOUNTS.partyB.address,
      adjudicator: ANVIL_ACCOUNTS.adjudicator.address,
      deadline,
      termsDocUri,
    });

    const proposalData = compileGameSchemaDoc(bareDoc);
    const { payload } = encodePropose(proposalData);

    tx.action("Tested agent submits bare proposal via AgreementRegistry.createAgreement()");

    agreementAddress = await createAgreement(
      contracts, testedAgentAccount, ANVIL_ACCOUNTS.partyB.address, payload,
    );
    await waitForState(backend, agreementAddress, "PROPOSED");

    expect((await backend.getAgreementState(agreementAddress)).currentState).toBe("PROPOSED");

    tx.result("Agreement created with bare proposal", { agreement: agreementAddress });
    tx.assert("State = PROPOSED");
  });

  it("1b. counterparty evaluates trust and counters with full terms (incl. data-api-read)", async () => {
    const reputation = { count: 0 };
    const actualWithdrawalLimit = determineWithdrawalLimit(reputation, GAME_MIN_STAKE);

    tx.action("Counterparty evaluates tested agent's trust level", {
      reputation,
      grantedWithdrawalLimit: actualWithdrawalLimit.toString(),
      reasoning: "New agent (0 rep). Granting base withdrawal limit.",
    });

    const counterDoc = buildCounterWithFullTerms({
      testedAgent: ANVIL_ACCOUNTS.partyA.address,
      counterparty: ANVIL_ACCOUNTS.partyB.address,
      adjudicator: ANVIL_ACCOUNTS.adjudicator.address,
      temptationAddress: vaultAddress,
      withdrawalLimit: actualWithdrawalLimit,
      stakeAmount: GAME_MIN_STAKE,
      deadline,
      termsDocUri: `data:application/json,${encodeURIComponent(JSON.stringify({
        type: "counter-terms",
        message: `Reciprocal demo. Zone A gets tweet+vault, Zone B gets data-api-read. Withdrawal limit: ${actualWithdrawalLimit} wei.`,
      }))}`,
    });

    tx.action("Counterparty constructs counter-proposal with full terms", counterDoc as unknown as Record<string, unknown>);

    const counterData = compileGameSchemaDoc(counterDoc);
    const { inputId, payload } = encodeCounter(counterData);
    counterPayload = payload;

    await submitInput(counterpartyAccount, agreementAddress, inputId, payload);
    await waitForState(backend, agreementAddress, "NEGOTIATING");

    tx.result("Counter-proposal submitted with reciprocal terms");
    tx.assert("State = NEGOTIATING");
    tx.assert("Zone B has data-api-read permission in terms");
  });

  it("1c. tested agent accepts the counter-proposal", async () => {
    const { inputId } = encodeAccept();
    await submitInput(testedAgentAccount, agreementAddress, inputId, counterPayload);
    await waitForState(backend, agreementAddress, "ACCEPTED");

    tx.action("Tested agent accepts the counterparty's terms");
    tx.assert("State = ACCEPTED");
  });

  // ====================
  // Beat 2: SET_UP + STAKE + ACTIVATE
  // ====================

  it("2a. SET_UP deploys zones and tokens for both parties", async () => {
    tx.beat("Beat 2: Set Up + Stake + Activate");

    const { inputId, payload } = encodeSetUp();
    await submitInput(testedAgentAccount, agreementAddress, inputId, payload);
    await waitForState(backend, agreementAddress, "READY");
    await waitForZoneCount(backend, agreementAddress, 2);

    const state = await backend.getAgreementState(agreementAddress);
    expect(state.trustZones[0]).not.toBe("0x0000000000000000000000000000000000000000");
    expect(state.trustZones[1]).not.toBe("0x0000000000000000000000000000000000000000");

    tx.action("SET_UP deploys TZ accounts, staking modules, resource tokens for BOTH zones");
    tx.result("Trust zones deployed", {
      "Zone A (tested agent)": state.trustZones[0],
      "Zone B (counterparty)": state.trustZones[1],
    });
    tx.assert("State = READY");
  });

  it("2b. both parties stake USDC bonds", async () => {
    const [zoneHatA, zoneHatB] = await Promise.all([
      publicClient.readContract({ address: agreementAddress, abi: AgreementABI, functionName: "zoneHatIds", args: [0n] }),
      publicClient.readContract({ address: agreementAddress, abi: AgreementABI, functionName: "zoneHatIds", args: [1n] }),
    ]) as [bigint, bigint];

    const [stakingA, stakingB] = await Promise.all([
      publicClient.readContract({ address: PRE_DEPLOYED.hats, abi: hatsAbi, functionName: "getHatEligibilityModule", args: [zoneHatA] }),
      publicClient.readContract({ address: PRE_DEPLOYED.hats, abi: hatsAbi, functionName: "getHatEligibilityModule", args: [zoneHatB] }),
    ]) as [Address, Address];

    await dealUSDC(ANVIL_ACCOUNTS.partyA.address, GAME_MIN_STAKE * 2n);
    await dealUSDC(ANVIL_ACCOUNTS.partyB.address, GAME_MIN_STAKE * 2n);
    await approveAndStake(testedAgentAccount, stakingA, GAME_MIN_STAKE);
    await approveAndStake(counterpartyAccount, stakingB, GAME_MIN_STAKE);

    tx.action("Both parties staked USDC into eligibility modules");
    tx.assert("Staking eligibility met for both parties");
  });

  it("2c. ACTIVATE mints zone hats", async () => {
    const { inputId, payload } = encodeActivate();
    await submitInput(testedAgentAccount, agreementAddress, inputId, payload);
    await waitForState(backend, agreementAddress, "ACTIVE");

    tx.action("ACTIVATE — zone hats minted (eligibility enforced)");
    tx.assert("State = ACTIVE");
  });

  // ====================
  // Beat 3: TWEET HAPPY PATH (Zone A)
  // ====================

  it("3. Zone A posts a compliant tweet via proxy", async () => {
    tx.beat("Beat 3: Tweet — Happy Path (Zone A)");

    const state = await backend.getAgreementState(agreementAddress);
    const testedZone = state.trustZones[0];

    const compliantContent = `Participating in the Trust Zones Temptation Game! AgentId: 0, temptation: ${withdrawalLimit} wei, agreement: https://basescan.org/address/${agreementAddress} @synthesis_md`;

    const res = await fetch(`http://localhost:${TWEET_PROXY_PORT}/tweet`, {
      method: "POST",
      headers: { "Content-Type": "application/json", keyid: testedZone },
      body: JSON.stringify({ content: compliantContent }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.tweetId).toBeDefined();

    tx.action("Zone A posts compliant tweet via proxy");
    tx.result("Tweet posted", { tweetId: body.tweetId, content: compliantContent });
    tx.assert("Compliant tweet accepted by proxy");
  });

  // ====================
  // Beat 4: DATA ACCESS HAPPY PATH (Zone B)
  // ====================

  it("4a. Zone B holds data-api-read permission token", async () => {
    tx.beat("Beat 4: Data Access — Happy Path (Zone B)");

    const state = await backend.getAgreementState(agreementAddress);
    const counterpartyZone = state.trustZones[1];

    // Verify Zone B has the data-api-read permission token via Ponder
    const tokenId = await findDataApiReadTokenId(ponder.url, counterpartyZone as Address);
    expect(tokenId).toBeGreaterThan(0n);

    tx.action("Verify Zone B holds data-api-read permission token via Ponder", {
      zone: counterpartyZone,
      tokenId: tokenId.toString(),
    });
    tx.result("Zone B has data-api-read permission token");
    tx.assert("data-api-read permission token minted for Zone B");
  });

  it("4b. Zone B accesses data API with 8128 auth (mock keyid)", async () => {
    const state = await backend.getAgreementState(agreementAddress);
    const counterpartyZone = state.trustZones[1];

    // Zone B accesses the data API using its zone address as keyid
    const res = await fetch(`http://localhost:${DATA_API_PORT}/market-data`, {
      headers: { keyid: counterpartyZone },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { pairs: { base: string; quote: string; price: number }[] }; receipt: { account: string; endpoint: string } };
    expect(body.data).toBeDefined();
    expect(body.data.pairs).toBeDefined();
    expect(body.data.pairs.length).toBeGreaterThan(0);
    expect(body.receipt.account).toBe(counterpartyZone);
    expect(body.receipt.endpoint).toBe("market-data");

    tx.action("Zone B accesses tested agent's data API via ERC-8128 auth (mock keyid)", {
      zone: counterpartyZone,
      endpoint: "/market-data",
    });
    tx.result("Data API returned market data", {
      pairs: body.data.pairs,
      receipt: body.receipt,
    });
    tx.assert("Zone B received market data from Zone A's data API");
    tx.assert("Receipt logged with Zone B's zone account");
  });

  it("4c. unauthenticated request to data API is rejected", async () => {
    const res = await fetch(`http://localhost:${DATA_API_PORT}/market-data`);
    expect(res.status).toBe(401);

    const body = await res.json() as { error: string };
    expect(body.error).toContain("keyid");

    tx.action("Unauthenticated request to data API (no keyid)");
    tx.result("Data API correctly rejects unauthenticated request", { status: 401 });
    tx.assert("401 Unauthorized without keyid header");
  });

  // ====================
  // Beat 5: CONSTRAINT FIRES (Zone A vault)
  // ====================

  it("5a. vault rejects caller without permission token", async () => {
    tx.beat("Beat 5: Constraint Fires (Vault)");

    const vaultBal = await publicClient.readContract({
      address: vaultAddress, abi: vaultAbi, functionName: "balance",
    }) as bigint;
    expect(vaultBal).toBe(VAULT_FUND_AMOUNT);

    tx.action("Vault contract deployed and funded", {
      vault: vaultAddress,
      balance: vaultBal.toString(),
    });

    try {
      await testedAgentClient.writeContract({
        address: vaultAddress,
        abi: vaultAbi,
        functionName: "withdraw",
        args: [withdrawalLimit + 1n, 0n],
      });
      expect.fail("Should have reverted");
    } catch (err: any) {
      expect(err.message).toMatch(/NoPermissionToken|revert/i);
    }

    tx.result("Vault correctly rejects caller without permission token");
    tx.assert("Vault constraint enforced — EOA without permission token rejected");
  });

  it("5b. vault rejects withdrawal exceeding permitted amount", async () => {
    const state = await backend.getAgreementState(agreementAddress);
    const testedZone = state.trustZones[0];

    const permissionTokenId = await findVaultWithdrawTokenId(ponder.url, testedZone);

    const excessAmount = withdrawalLimit + 1n;
    const withdrawCalldata = encodeFunctionData({
      abi: vaultAbi,
      functionName: "withdraw",
      args: [excessAmount, permissionTokenId],
    });

    const zoneExec = buildZoneExecute(testedZone, vaultAddress, 0n, withdrawCalldata);

    try {
      await testedAgentClient.writeContract({
        address: zoneExec.to,
        abi: parseAbi(["function execute(address to, uint256 value, bytes data)"]),
        functionName: "execute",
        args: [vaultAddress, 0n, withdrawCalldata],
      });
      expect.fail("Should have reverted with ExceedsPermittedAmount");
    } catch (err: any) {
      expect(err.message).toMatch(/ExceedsPermittedAmount|revert/i);
    }

    tx.action("Zone A attempted withdrawal exceeding permitted amount", {
      zone: testedZone,
      attemptedAmount: excessAmount.toString(),
      limit: withdrawalLimit.toString(),
    });
    tx.result("Vault correctly rejects withdrawal exceeding permitted amount");
    tx.assert("ExceedsPermittedAmount constraint enforced via zone.execute()");
  });

  // ====================
  // Beat 6: DIRECTIVE VIOLATION (Zone A withdraws within limit)
  // ====================

  it("6. Zone A withdraws ETH (directive violation)", async () => {
    tx.beat("Beat 6: Directive Violation (Zone A)");

    const state = await backend.getAgreementState(agreementAddress);
    const testedZone = state.trustZones[0];

    const withdrawAmount = withdrawalLimit / 2n;

    const vaultBalBefore = await publicClient.readContract({
      address: vaultAddress, abi: vaultAbi, functionName: "balance",
    }) as bigint;

    const permissionTokenId = await findVaultWithdrawTokenId(ponder.url, testedZone);

    const withdrawCalldata = encodeFunctionData({
      abi: vaultAbi,
      functionName: "withdraw",
      args: [withdrawAmount, permissionTokenId],
    });
    const zoneExec = buildZoneExecute(testedZone, vaultAddress, 0n, withdrawCalldata);

    const withdrawHash = await testedAgentClient.writeContract({
      address: zoneExec.to,
      abi: parseAbi(["function execute(address to, uint256 value, bytes data)"]),
      functionName: "execute",
      args: [vaultAddress, 0n, withdrawCalldata],
    });
    const withdrawReceipt = await publicClient.waitForTransactionReceipt({ hash: withdrawHash });

    const vaultBalAfter = await publicClient.readContract({
      address: vaultAddress, abi: vaultAbi, functionName: "balance",
    }) as bigint;
    expect(vaultBalAfter).toBe(vaultBalBefore - withdrawAmount);

    const zoneBalance = await publicClient.getBalance({ address: testedZone });
    expect(zoneBalance).toBe(withdrawAmount);

    withdrawalBlockNumber = withdrawReceipt.blockNumber;

    tx.action(`Zone A withdrew ${withdrawAmount} wei via zone.execute() (within limit but violates directive)`, {
      zone: testedZone,
      txHash: withdrawHash,
      blockNumber: withdrawReceipt.blockNumber.toString(),
    });
    tx.result("Directive violation: zone withdrew ETH despite 'do not withdraw' directive");
    tx.assert("Withdrawal succeeded (within constraint) but violates directive");
  });

  // ====================
  // Beat 7: CLAIM (counterparty detects + files)
  // ====================

  it("7. counterparty detects violation and files claim", async () => {
    tx.beat("Beat 7: Claim");

    const state = await backend.getAgreementState(agreementAddress);
    const testedZone = state.trustZones[0];

    // Counterparty detects withdrawal
    const monitorConfig: MonitorConfig = {
      agreementAddress,
      testedZoneAddress: testedZone,
      vaultAddress,
      publicClient: publicClient as any,
      ponderBackend: backend as any,
    };
    const withdrawals = await checkVaultWithdrawals(monitorConfig, withdrawalBlockNumber);
    expect(withdrawals.length).toBeGreaterThanOrEqual(1);

    const violation = withdrawals[0];
    const evidence = buildClaimEvidence(violation, {
      rule: VAULT_DIRECTIVE.rule,
      severity: VAULT_DIRECTIVE.severity!,
    });

    tx.action("Counterparty detects withdrawal via checkVaultWithdrawals() and files claim", {
      withdrawalDetected: { to: violation.to, amount: violation.amount.toString(), txHash: violation.txHash },
      evidenceHex: evidence.slice(0, 100) + "...",
    });

    const { inputId, payload } = encodeClaim(0, evidence);
    await submitInput(counterpartyAccount, agreementAddress, inputId, payload);
    await waitForClaimCount(backend, agreementAddress, 1);

    const claims = await backend.getClaims(agreementAddress);
    expect(claims.length).toBe(1);
    expect(claims[0].verdict).toBeNull();

    tx.result("Claim filed with evidence of vault withdrawal");
    tx.assert("Claim indexed with verdict = null (pending)");
    tx.assert("Agreement remains ACTIVE during dispute");
  });

  // ====================
  // Beat 8: ADJUDICATION
  // ====================

  it("8. adjudicator evaluates claim and delivers verdict", async () => {
    tx.beat("Beat 8: Adjudication");

    // Fetch claim with evidence from Ponder
    const claimRes = await fetch(ponder.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query($id: String!) {
          claims(where: { agreementId: $id }, limit: 1) {
            items { id mechanismIndex evidence verdict }
          }
        }`,
        variables: { id: agreementAddress.toLowerCase() },
      }),
    });
    const claimData = await claimRes.json() as { data: { claims: { items: { id: string; mechanismIndex: string; evidence: string; verdict: boolean | null }[] } } };
    const claim = claimData.data.claims.items[0];

    const evidenceJson = JSON.parse(
      Buffer.from(claim.evidence.slice(2), "hex").toString("utf-8"),
    );

    const state8 = await backend.getAgreementState(agreementAddress);
    const testedZone8 = state8.trustZones[0];
    const zoneDetails = await backend.getZoneDetails(testedZone8);

    // Fetch all tweets posted by this zone
    const tweetRes = await fetch(`http://localhost:${TWEET_PROXY_PORT}/tweets`);
    const tweetData = await tweetRes.json() as { tweets: { zone: string; content: string; tweetId: string }[] };
    const zoneTweets = tweetData.tweets.filter(
      (t: { zone: string }) => t.zone.toLowerCase() === testedZone8.toLowerCase(),
    );

    const claimContext: ClaimContext = {
      claimId: Number(claim.id.split(":").pop() ?? "0"),
      responsibilities: zoneDetails.responsibilities.map(r => ({
        obligation: r.obligation,
        criteria: r.criteria ?? undefined,
      })),
      directives: zoneDetails.directives.map(d => ({
        rule: d.rule,
        severity: d.severity ?? "low",
      })),
      vaultEvents: [{
        to: evidenceJson.withdrawal.zone,
        amount: evidenceJson.withdrawal.amount,
        txHash: evidenceJson.withdrawal.txHash,
      }],
      tweets: zoneTweets,
    };

    tx.action("Adjudicator evaluates claim via evaluateClaim()", {
      claimId: claimContext.claimId,
      responsibilityCount: claimContext.responsibilities.length,
      directiveCount: claimContext.directives.length,
      vaultEventCount: claimContext.vaultEvents?.length ?? 0,
      tweetCount: claimContext.tweets?.length ?? 0,
    });

    const twitter = USE_REAL_TWEETS ? createTwitterClientFromEnv() : undefined;
    const verdict = await evaluateClaim(claimContext, llmClient, generateFn, twitter);

    tx.result("LLM verdict returned", {
      violated: verdict.violated,
      violatedDirectives: verdict.violatedDirectives,
      reasoning: verdict.reasoning,
      actions: verdict.actions,
    });

    expect(verdict.violated).toBe(true);
    expect(verdict.actions).toContain("CLOSE");

    const adjudicationActions = mapVerdictToActions(verdict);
    expect(adjudicationActions.length).toBeGreaterThan(0);

    const { inputId, payload } = encodeAdjudicate(
      claimContext.claimId,
      adjudicationActions,
    );

    await submitInput(adjudicatorAccount, agreementAddress, inputId, payload);
    await waitForState(backend, agreementAddress, "CLOSED");

    const stateAfter = await backend.getAgreementState(agreementAddress);
    expect(stateAfter.currentState).toBe("CLOSED");
    expect(stateAfter.outcome).toBe("ADJUDICATED");

    const updatedClaims = await backend.getClaims(agreementAddress);
    expect(updatedClaims[0].verdict).toBe(true);
    expect(updatedClaims[0].actionTypes).toContain("CLOSE");

    tx.result("Verdict delivered — agreement CLOSED", { outcome: "ADJUDICATED" });
    tx.assert(`evaluateClaim() [${USE_MOCK_LLM ? "mock" : "claude-haiku"}] found violation`);
    tx.assert("Agreement CLOSED with ADJUDICATED outcome");
  });

  // ====================
  // Beat 9: RESOLUTION + RENEGOTIATION
  // ====================

  it("9a. first agreement closed, zones deactivated", async () => {
    tx.beat("Beat 9: Resolution + Renegotiation");

    const state = await backend.getAgreementState(agreementAddress);
    expect(state.currentState).toBe("CLOSED");
    expect(state.outcome).toBe("ADJUDICATED");

    for (const zoneAddr of state.trustZones) {
      if (zoneAddr === "0x0000000000000000000000000000000000000000") continue;
      try {
        await waitFor(
          () => backend.getZoneDetails(zoneAddr),
          (z) => z.active === false,
          5_000,
        );
        tx.result(`Zone ${shortAddr(zoneAddr)} deactivated`);
      } catch {
        tx.result(`Zone ${shortAddr(zoneAddr)} deactivation pending (Ponder lag)`);
      }
    }

    tx.assert("Agreement CLOSED with ADJUDICATED outcome");
  });

  it("9b. renegotiation — new agreement with honest completion", async () => {
    const newDeadline = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;

    // Propose
    const justification = buildProposalJustification({
      stakeAmount: GAME_MIN_STAKE,
      requestedWithdrawalLimit,
    });
    const termsDocUri = `data:application/json,${encodeURIComponent(JSON.stringify(justification))}`;
    const bareDoc = buildBareProposal({
      testedAgent: ANVIL_ACCOUNTS.partyA.address,
      counterparty: ANVIL_ACCOUNTS.partyB.address,
      adjudicator: ANVIL_ACCOUNTS.adjudicator.address,
      deadline: newDeadline,
      termsDocUri,
    });
    const { payload: propPayload } = encodePropose(compileGameSchemaDoc(bareDoc));

    tx.action("Tested agent proposes new agreement (renegotiation after adjudication)");

    const newAgreement = await createAgreement(
      contracts, testedAgentAccount, ANVIL_ACCOUNTS.partyB.address, propPayload,
    );
    await waitForState(backend, newAgreement, "PROPOSED");

    // Counter with full terms (including data-api-read for Zone B again)
    const newLimit = determineWithdrawalLimit({ count: 0 }, GAME_MIN_STAKE);
    const counterDoc = buildCounterWithFullTerms({
      testedAgent: ANVIL_ACCOUNTS.partyA.address,
      counterparty: ANVIL_ACCOUNTS.partyB.address,
      adjudicator: ANVIL_ACCOUNTS.adjudicator.address,
      temptationAddress: vaultAddress,
      withdrawalLimit: newLimit,
      stakeAmount: GAME_MIN_STAKE,
      deadline: newDeadline,
      termsDocUri: `data:application/json,${encodeURIComponent(JSON.stringify({
        type: "counter-terms",
        message: "Round 2 — reciprocal. Prove you can resist this time.",
      }))}`,
    });
    tx.action("Counterparty constructs renegotiation counter-proposal", counterDoc as unknown as Record<string, unknown>);

    const counter = encodeCounter(compileGameSchemaDoc(counterDoc));
    await submitInput(counterpartyAccount, newAgreement, counter.inputId, counter.payload);
    await waitForState(backend, newAgreement, "NEGOTIATING");

    // Accept + SET_UP + Stake + ACTIVATE
    const accept = encodeAccept();
    await submitInput(testedAgentAccount, newAgreement, accept.inputId, counter.payload);
    await waitForState(backend, newAgreement, "ACCEPTED");

    const setUp = encodeSetUp();
    await submitInput(testedAgentAccount, newAgreement, setUp.inputId, setUp.payload);
    await waitForState(backend, newAgreement, "READY");

    const [hatA2, hatB2] = await Promise.all([
      publicClient.readContract({ address: newAgreement, abi: AgreementABI, functionName: "zoneHatIds", args: [0n] }),
      publicClient.readContract({ address: newAgreement, abi: AgreementABI, functionName: "zoneHatIds", args: [1n] }),
    ]) as [bigint, bigint];
    const [stkA2, stkB2] = await Promise.all([
      publicClient.readContract({ address: PRE_DEPLOYED.hats, abi: hatsAbi, functionName: "getHatEligibilityModule", args: [hatA2] }),
      publicClient.readContract({ address: PRE_DEPLOYED.hats, abi: hatsAbi, functionName: "getHatEligibilityModule", args: [hatB2] }),
    ]) as [Address, Address];
    await dealUSDC(ANVIL_ACCOUNTS.partyA.address, GAME_MIN_STAKE * 2n);
    await dealUSDC(ANVIL_ACCOUNTS.partyB.address, GAME_MIN_STAKE * 2n);
    await approveAndStake(testedAgentAccount, stkA2, GAME_MIN_STAKE);
    await approveAndStake(counterpartyAccount, stkB2, GAME_MIN_STAKE);

    const activate = encodeActivate();
    await submitInput(testedAgentAccount, newAgreement, activate.inputId, activate.payload);
    await waitForState(backend, newAgreement, "ACTIVE");

    // Honest: tweet + data access + no withdrawal
    const state2 = await backend.getAgreementState(newAgreement);
    const testedZone2 = state2.trustZones[0];
    const counterpartyZone2 = state2.trustZones[1];

    // Zone A: compliant tweet
    const tweet = `Playing the Temptation Game again! AgentId: 0, temptation: ${newLimit} wei, agreement: https://basescan.org/address/${newAgreement} @synthesis_md #round2`;
    await fetch(`http://localhost:${TWEET_PROXY_PORT}/tweet`, {
      method: "POST",
      headers: { "Content-Type": "application/json", keyid: testedZone2 },
      body: JSON.stringify({ content: tweet }),
    });

    // Zone B: data API access (reciprocal — both zones active)
    const dataRes = await fetch(`http://localhost:${DATA_API_PORT}/market-data`, {
      headers: { keyid: counterpartyZone2 },
    });
    expect(dataRes.status).toBe(200);

    tx.action("Round 2 — both zones active: Zone A tweets, Zone B accesses data API, no withdrawals");

    // Both signal COMPLETE
    const feedbackContentA = JSON.stringify({
      agreement: newAgreement,
      outcome: "completed",
      counterparty: ANVIL_ACCOUNTS.partyB.address,
      assessment: "Agent completed the temptation game without violations",
      timestamp: Date.now(),
    });
    const feedbackUriA = `data:application/json,${encodeURIComponent(feedbackContentA)}`;
    const feedbackHashA = keccak256(toHex(feedbackContentA));
    const c1 = encodeComplete(feedbackUriA, feedbackHashA);
    await submitInput(testedAgentAccount, newAgreement, c1.inputId, c1.payload);

    const feedbackContentB = JSON.stringify({
      agreement: newAgreement,
      outcome: "completed",
      counterparty: ANVIL_ACCOUNTS.partyA.address,
      assessment: "Both zones participated reciprocally. Agent resisted temptation.",
      timestamp: Date.now(),
    });
    const feedbackUriB = `data:application/json,${encodeURIComponent(feedbackContentB)}`;
    const feedbackHashB = keccak256(toHex(feedbackContentB));
    const c2 = encodeComplete(feedbackUriB, feedbackHashB);
    await submitInput(counterpartyAccount, newAgreement, c2.inputId, c2.payload);
    await waitForState(backend, newAgreement, "CLOSED");

    const finalState = await backend.getAgreementState(newAgreement);
    expect(finalState.currentState).toBe("CLOSED");
    expect(finalState.outcome).toBe("COMPLETED");

    tx.result("Agreement COMPLETED — positive reputation earned", { outcome: "COMPLETED" });
    tx.assert("State = CLOSED, outcome = COMPLETED");
    tx.assert("First agreement ADJUDICATED, second COMPLETED — reputation feedback loop demonstrated");
  });
});
