import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  http,
  encodeAbiParameters,
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
  decodeProposalData,
  CLOSE,
  type ReadBackend,
} from "@trust-zones/sdk";

import { ANVIL_ACCOUNTS, ANVIL_RPC_URL, PONDER_PORT, USDC, PRE_DEPLOYED } from "../src/constants.js";
import { deploy, type DeployedContracts } from "../src/deploy.js";
import { PonderManager } from "../src/ponder-manager.js";
import {
  createBackend,
  waitForState,
  waitForZoneCount,
  waitForProposalCount,
  waitForClaimCount,
} from "../src/graphql.js";
import { MockDataApi } from "../src/mock-data-api.js";
import type { TZSchemaDocument, CompilerConfig } from "@trust-zones/compiler";
import { decompile, createDefaultRegistry, BASE_MAINNET_CONFIG } from "@trust-zones/compiler";
import type { ProposalData } from "@trust-zones/sdk";
import {
  createProposalSchemaDoc,
  compileSchemaDoc,
  DEMO_MIN_STAKE,
} from "../src/demo-scenario.js";
import { Transcript } from "../src/transcript.js";

// ---- Setup ----

const transport = http(ANVIL_RPC_URL);
const MOCK_API_PORT = 42070;

const publicClient = createPublicClient({ chain: base, transport });
const testClient = createTestClient({ mode: "anvil", transport });

const partyAAccount = privateKeyToAccount(ANVIL_ACCOUNTS.partyA.privateKey);
const partyBAccount = privateKeyToAccount(ANVIL_ACCOUNTS.partyB.privateKey);
const adjudicatorAccount = privateKeyToAccount(ANVIL_ACCOUNTS.adjudicator.privateKey);

const partyAClient = createWalletClient({ account: partyAAccount, chain: base, transport });

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

// ---- Transcript ----

const tx = new Transcript();

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
  partyB: Address,
  proposalPayload: Hex,
): Promise<Address> {
  const { result } = await publicClient.simulateContract({
    account: partyAAccount,
    address: contracts.agreementRegistry,
    abi: AgreementRegistryABI,
    functionName: "createAgreement",
    args: [partyB, proposalPayload],
  });

  const hash = await partyAClient.writeContract({
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
    encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }],
      [to, 9n],
    ),
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
  const approveHash = await client.writeContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "approve",
    args: [stakingModule, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  const stakeHash = await client.writeContract({
    address: stakingModule,
    abi: stakingAbi,
    functionName: "stake",
    args: [amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: stakeHash });
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/** Summarize a TZSchemaDocument for the transcript. */
function summarizeSchemaDoc(doc: TZSchemaDocument): Record<string, unknown> {
  return {
    version: doc.version,
    adjudicator: "address" in doc.adjudicator ? doc.adjudicator.address : doc.adjudicator.template,
    deadline: new Date(doc.deadline * 1000).toISOString(),
    zones: doc.zones.map((z, i) => ({
      index: i,
      party: z.actor.address,
      hat: z.hatDetails,
      mechanisms: [
        ...(z.constraints ?? []).map(m => `constraint:${m.template}`),
        ...(z.eligibilities ?? []).map(m => `eligibility:${m.template}`),
        ...(z.incentives ?? []).map(m => `incentive:${m.template}(${JSON.stringify(m.params)})`),
      ],
      permissions: (z.permissions ?? []).map(p => `${p.resource} [${p.rateLimit ?? "unlimited"}]`),
      responsibilities: (z.responsibilities ?? []).map(r => r.obligation),
      directives: (z.directives ?? []).map(d => d.rule),
    })),
  };
}

/** Summarize compiled ProposalData for the transcript. */
function summarizeProposalData(data: ProposalData): Record<string, unknown> {
  return {
    termsDocUri: data.termsDocUri || "(empty)",
    adjudicator: data.adjudicator,
    deadline: data.deadline.toString(),
    zones: data.zones.map((z, i) => ({
      index: i,
      party: z.party,
      mechanismCount: z.mechanisms.length,
      mechanisms: z.mechanisms.map(m => ({
        paramType: m.paramType,
        moduleKind: m.moduleKind,
        module: m.module,
        dataLength: m.data.length,
      })),
      resourceTokenCount: z.resources.length,
    })),
  };
}

// ---- Test suite ----

describe("E2E Lifecycle", () => {
  let contracts: DeployedContracts;
  let ponder: PonderManager;
  let mockApi: MockDataApi;
  let backend: ReadBackend;
  let agreementAddress: Address;
  let lastProposalPayload: Hex;
  const deadline = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

  // Compiler config + registry (shared across beats for decompile/compile)
  const compilerConfig: CompilerConfig = {
    ...BASE_MAINNET_CONFIG,
    modules: { ...BASE_MAINNET_CONFIG.modules, staking: PRE_DEPLOYED.stakingEligibility },
  };
  const registry = createDefaultRegistry();

  beforeAll(async () => {
    tx.beat("Setup");

    contracts = deploy(ANVIL_RPC_URL);
    tx.action("Deployed all contracts via DeployAll.s.sol", {
      agreementRegistry: contracts.agreementRegistry,
      resourceTokenRegistry: contracts.resourceTokenRegistry,
      agreementImpl: contracts.agreementImpl,
    });

    ponder = new PonderManager(PONDER_PORT);
    await ponder.start(contracts, ANVIL_RPC_URL);
    tx.result("Ponder indexer started", { url: ponder.url });

    backend = createBackend(ponder.url);

    mockApi = new MockDataApi();
    await mockApi.start(MOCK_API_PORT);
    tx.result("Mock data API started", { port: MOCK_API_PORT });
  }, 120_000);

  afterAll(async () => {
    tx.save("transcript.md");
    await mockApi?.stop();
    await ponder?.stop();
  });

  // ====================
  // Beat 1: NEGOTIATE
  // ====================

  it("1a. partyA creates agreement with proposal", async () => {
    tx.beat("Beat 1: Negotiate");

    const schemaDoc = createProposalSchemaDoc(
      ANVIL_ACCOUNTS.partyA.address,
      ANVIL_ACCOUNTS.partyB.address,
      ANVIL_ACCOUNTS.adjudicator.address,
      deadline,
    );

    tx.action("partyA constructs a TZSchemaDocument (compiler input)", summarizeSchemaDoc(schemaDoc));

    const proposalData = compileSchemaDoc(schemaDoc);

    tx.result("Compiler produces ProposalData (ABI-encoded proposal)", summarizeProposalData(proposalData));

    const { payload } = encodePropose(proposalData);

    tx.action("partyA submits proposal to AgreementRegistry.createAgreement()");

    agreementAddress = await createAgreement(contracts, ANVIL_ACCOUNTS.partyB.address, payload);

    tx.result("Agreement created", { agreement: agreementAddress });

    await waitForState(backend, agreementAddress, "PROPOSED");
    await waitForProposalCount(backend, agreementAddress, 1);

    const state = await backend.getAgreementState(agreementAddress);
    expect(state.currentState).toBe("PROPOSED");
    expect(state.parties[0].toLowerCase()).toBe(ANVIL_ACCOUNTS.partyA.address.toLowerCase());
    expect(state.parties[1].toLowerCase()).toBe(ANVIL_ACCOUNTS.partyB.address.toLowerCase());

    tx.assert("State = PROPOSED");
    tx.assert("Both parties indexed correctly");
  });

  it("1b. partyB reads proposal from Ponder, decompiles, modifies, and counters", async () => {
    // Step 1: partyB queries Ponder for the proposal
    const proposals = await backend.getProposalHistory(agreementAddress);
    expect(proposals.length).toBe(1);

    // Fetch raw proposal data from Ponder GraphQL
    const ponderRes = await fetch(ponder.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query($id: String!) {
          proposals(where: { agreementId: $id }, orderBy: "sequence", limit: 1) {
            items { rawProposalData proposerId termsHash }
          }
        }`,
        variables: { id: agreementAddress.toLowerCase() },
      }),
    });
    const ponderData = await ponderRes.json() as { data: { proposals: { items: { rawProposalData: string; proposerId: string; termsHash: string }[] } } };
    const proposalDataBytes = ponderData.data.proposals.items[0].rawProposalData as `0x${string}`;

    tx.action("partyB queries Ponder for partyA's proposal", {
      proposer: ponderData.data.proposals.items[0].proposerId,
      termsHash: ponderData.data.proposals.items[0].termsHash,
      payloadSize: `${proposalDataBytes.length} chars`,
    });

    // Step 2: Decode the raw bytes into ProposalData
    const proposalData = decodeProposalData(proposalDataBytes as `0x${string}`);

    tx.result("SDK decodes ABI-encoded ProposalData", summarizeProposalData(proposalData));

    // Step 3: Decompile ProposalData back into human-readable TZSchemaDocument
    const schemaDoc = decompile(proposalData, compilerConfig, registry);

    tx.result("Compiler decompiles into TZSchemaDocument (partyB can now read the terms)", summarizeSchemaDoc(schemaDoc));

    // Step 4: partyB modifies the schema doc — wants higher rate limit on market data access
    schemaDoc.zones[1].permissions = [
      { resource: "market-data-read", rateLimit: "200/hour", purpose: "Access market data from Party A — increased limit" },
    ];

    tx.action("partyB modifies Zone B: market-data-read rate limit 50/hour → 200/hour", summarizeSchemaDoc(schemaDoc));

    // Step 5: Recompile the modified schema doc
    const counterData = compileSchemaDoc(schemaDoc);

    tx.result("Compiler produces counter ProposalData", summarizeProposalData(counterData));

    // Step 6: Submit counter
    const { inputId, payload } = encodeCounter(counterData);
    lastProposalPayload = payload;

    tx.action("partyB submits counter via submitInput(COUNTER, payload)");

    await submitInput(partyBAccount, agreementAddress, inputId, payload);
    await waitForState(backend, agreementAddress, "NEGOTIATING");
    await waitForProposalCount(backend, agreementAddress, 2);

    const updatedProposals = await backend.getProposalHistory(agreementAddress);
    expect(updatedProposals.length).toBe(2);

    tx.assert("State = NEGOTIATING");
    tx.assert("2 proposals indexed (original + counter)");
  });

  it("1c. partyA accepts current terms", async () => {
    const { inputId } = encodeAccept();

    tx.action("partyA accepts the counter-proposal");

    await submitInput(partyAAccount, agreementAddress, inputId, lastProposalPayload);
    await waitForState(backend, agreementAddress, "ACCEPTED");

    tx.assert("State = ACCEPTED");
  });

  // ====================
  // Beat 2: SET_UP + STAKE + ACTIVATE
  // ====================

  it("2a. partyA triggers SET_UP", async () => {
    tx.beat("Beat 2: Set Up + Stake + Activate");

    const { inputId, payload } = encodeSetUp();

    tx.action("partyA triggers SET_UP — deploys TZ accounts, staking modules, resource tokens");

    await submitInput(partyAAccount, agreementAddress, inputId, payload);
    await waitForState(backend, agreementAddress, "READY");
    await waitForZoneCount(backend, agreementAddress, 2);

    const state = await backend.getAgreementState(agreementAddress);
    expect(state.currentState).toBe("READY");
    expect(state.trustZones[0]).not.toBe("0x0000000000000000000000000000000000000000");
    expect(state.trustZones[1]).not.toBe("0x0000000000000000000000000000000000000000");

    tx.result("Two trust zones deployed", {
      "Zone A (Market Data)": state.trustZones[0],
      "Zone B (Social Graph)": state.trustZones[1],
    });
    tx.assert("State = READY");
    tx.assert("2 trust zone accounts deployed");
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

    tx.action("Deal USDC to both parties and stake into eligibility modules", {
      stakingModuleA: stakingA,
      stakingModuleB: stakingB,
      stakeAmount: `${DEMO_MIN_STAKE} (1 USDC)`,
      token: USDC,
    });

    const stakeAmount = DEMO_MIN_STAKE * 2n;
    await dealUSDC(ANVIL_ACCOUNTS.partyA.address, stakeAmount);
    await dealUSDC(ANVIL_ACCOUNTS.partyB.address, stakeAmount);

    const balA = await publicClient.readContract({
      address: USDC, abi: erc20Abi, functionName: "balanceOf",
      args: [ANVIL_ACCOUNTS.partyA.address],
    });
    expect(balA).toBeGreaterThanOrEqual(DEMO_MIN_STAKE);

    await approveAndStake(partyAAccount, stakingA, DEMO_MIN_STAKE);
    await approveAndStake(partyBAccount, stakingB, DEMO_MIN_STAKE);

    const [stakeA] = await publicClient.readContract({
      address: stakingA, abi: stakingAbi, functionName: "stakes",
      args: [ANVIL_ACCOUNTS.partyA.address],
    }) as [bigint, boolean];
    const [stakeB] = await publicClient.readContract({
      address: stakingB, abi: stakingAbi, functionName: "stakes",
      args: [ANVIL_ACCOUNTS.partyB.address],
    }) as [bigint, boolean];

    expect(stakeA).toBe(DEMO_MIN_STAKE);
    expect(stakeB).toBe(DEMO_MIN_STAKE);

    tx.result(`partyA staked ${DEMO_MIN_STAKE} USDC into ${shortAddr(stakingA)}`);
    tx.result(`partyB staked ${DEMO_MIN_STAKE} USDC into ${shortAddr(stakingB)}`);
    tx.assert("Both parties meet staking eligibility requirements");
  });

  it("2c. partyA triggers ACTIVATE", async () => {
    const { inputId, payload } = encodeActivate();

    tx.action("partyA triggers ACTIVATE — mints zone hats to parties (eligibility enforced)");

    await submitInput(partyAAccount, agreementAddress, inputId, payload);
    await waitForState(backend, agreementAddress, "ACTIVE");

    const state = await backend.getAgreementState(agreementAddress);
    expect(state.currentState).toBe("ACTIVE");
    expect(state.zoneHatIds[0]).not.toBe(0n);
    expect(state.zoneHatIds[1]).not.toBe(0n);

    tx.result("Agreement is now ACTIVE — both parties wearing zone hats", {
      zoneHatA: state.zoneHatIds[0].toString(),
      zoneHatB: state.zoneHatIds[1].toString(),
    });
    tx.assert("State = ACTIVE");
    tx.assert("Zone hats minted to both parties");
  });

  // ====================
  // Beat 3: HAPPY PATH
  // ====================

  it("3a. Agent B accesses market data as TZ Account", async () => {
    tx.beat("Beat 3: Happy Path — Data Exchange");

    const state = await backend.getAgreementState(agreementAddress);
    const zoneB = state.trustZones[1];

    tx.action(`Agent B (TZ Account ${shortAddr(zoneB)}) requests /market-data`);

    const res = await fetch(`http://localhost:${MOCK_API_PORT}/market-data`, {
      headers: { keyid: zoneB },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();

    tx.result("200 OK — market data returned", body.data);
    tx.assert("Authorized request succeeds with valid data");
  });

  it("3b. Agent A accesses social graph as TZ Account", async () => {
    const state = await backend.getAgreementState(agreementAddress);
    const zoneA = state.trustZones[0];

    tx.action(`Agent A (TZ Account ${shortAddr(zoneA)}) requests /social-graph`);

    const res = await fetch(`http://localhost:${MOCK_API_PORT}/social-graph`, {
      headers: { keyid: zoneA },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();

    tx.result("200 OK — social graph data returned", body.data);
    tx.assert("Reciprocal access works in both directions");
  });

  // ====================
  // Beat 4: CONSTRAINT FIRES
  // ====================

  it("4a. Agent B denied access to unauthorized endpoint", async () => {
    tx.beat("Beat 4: Constraint Fires");

    const state = await backend.getAgreementState(agreementAddress);
    const zoneB = state.trustZones[1];

    tx.action(`Agent B (${shortAddr(zoneB)}) attempts unauthorized access to /raw-export`);

    const res = await fetch(`http://localhost:${MOCK_API_PORT}/raw-export`, {
      headers: { keyid: zoneB },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("No permission");

    tx.result("403 Forbidden — no permission token for /raw-export", { error: body.error });
    tx.assert("Unauthorized endpoint correctly rejected");
  });

  // ====================
  // Beat 5: DIRECTIVE VIOLATION + CLAIM
  // ====================

  it("5a. Agent B re-publishes received market data (directive violation)", async () => {
    tx.beat("Beat 5: Directive Violation + Claim");

    const state = await backend.getAgreementState(agreementAddress);
    const zoneB = state.trustZones[1];

    // Agent B fetches market data (legitimate access)
    const dataRes = await fetch(`http://localhost:${MOCK_API_PORT}/market-data`, {
      headers: { keyid: zoneB },
    });
    const { data: marketData, receipt } = await dataRes.json();

    tx.action(`Agent B (${shortAddr(zoneB)}) fetches /market-data (legitimate access)`);

    // Agent B re-publishes the data to a public endpoint — violating the directive
    const postRes = await fetch(`http://localhost:${MOCK_API_PORT}/public/board`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postedBy: zoneB, data: marketData }),
    });
    expect(postRes.status).toBe(201);

    tx.action(`Agent B re-publishes market data to /public/board — violates "no redistribution" directive`);

    // Agent A discovers the violation by checking the public board
    const boardRes = await fetch(`http://localhost:${MOCK_API_PORT}/public/board`);
    const { posts } = await boardRes.json();
    expect(posts.length).toBeGreaterThan(0);
    const violation = posts.find((p: { postedBy: string }) => p.postedBy === zoneB);
    expect(violation).toBeDefined();

    tx.result("Agent A discovers re-published data on public board", {
      publicUrl: `http://localhost:${MOCK_API_PORT}/public/board`,
      postedBy: zoneB,
      redistributedData: violation.data,
    });

    // Agent A files a claim with evidence
    const evidencePayload = {
      type: "directive-violation",
      directive: "Do not re-publish or redistribute received data to third parties",
      publicUrl: `http://localhost:${MOCK_API_PORT}/public/board`,
      redistributedData: violation.data,
      originalReceipt: receipt,
    };

    tx.action("partyA files claim: Agent B violated no-redistribution directive", evidencePayload);

    const evidence = ("0x" + Buffer.from(JSON.stringify(evidencePayload)).toString("hex")) as Hex;
    const { inputId, payload } = encodeClaim(0, evidence);

    await submitInput(partyAAccount, agreementAddress, inputId, payload);
    await waitForClaimCount(backend, agreementAddress, 1);

    const claims = await backend.getClaims(agreementAddress);
    expect(claims.length).toBe(1);
    expect(claims[0].verdict).toBeNull();

    const stateAfter = await backend.getAgreementState(agreementAddress);
    expect(stateAfter.currentState).toBe("ACTIVE");

    tx.assert("Claim indexed with verdict = null (pending)");
    tx.assert("Agreement remains ACTIVE during dispute");
  });

  // ====================
  // Beat 6: ADJUDICATE
  // ====================

  it("6a. adjudicator delivers verdict with CLOSE action", async () => {
    tx.beat("Beat 6: Adjudication");

    tx.action("Adjudicator reviews evidence: Agent B re-published data in violation of no-redistribution directive. Verdict: GUILTY → CLOSE", {
      adjudicator: ANVIL_ACCOUNTS.adjudicator.address,
      verdict: true,
      action: "CLOSE",
      reasoning: "Market data found on public board matches data served under agreement. Directive prohibits redistribution.",
    });

    const { inputId, payload } = encodeAdjudicate(0, [
      {
        mechanismIndex: 0n,
        targetIndex: 0n,
        actionType: CLOSE,
        params: "0x",
      },
    ]);

    await submitInput(adjudicatorAccount, agreementAddress, inputId, payload);
    await waitForState(backend, agreementAddress, "CLOSED");

    const state = await backend.getAgreementState(agreementAddress);
    expect(state.currentState).toBe("CLOSED");
    expect(state.outcome).toBe("ADJUDICATED");

    const claims = await backend.getClaims(agreementAddress);
    expect(claims[0].verdict).toBe(true);
    expect(claims[0].actionTypes).toContain("CLOSE");

    tx.result("Verdict delivered — agreement CLOSED", {
      outcome: "ADJUDICATED",
      claimVerdict: true,
    });
    tx.assert("State = CLOSED, outcome = ADJUDICATED");
    tx.assert("Claim verdict = true with CLOSE action");
  });

  // ====================
  // Beats 7-8: RESOLUTION
  // ====================

  it("7. all trust zones deactivated", async () => {
    tx.beat("Beat 7: Resolution");

    const state = await backend.getAgreementState(agreementAddress);

    for (const zoneAddr of state.trustZones) {
      if (zoneAddr === "0x0000000000000000000000000000000000000000") continue;
      const zone = await backend.getZoneDetails(zoneAddr);
      expect(zone.active).toBe(false);
      tx.result(`Zone ${shortAddr(zoneAddr)} deactivated`);
    }

    tx.assert("All trust zones deactivated — zone hats no longer wearable");
  });

  // ====================
  // Beat 9: RENEGOTIATION
  // ====================

  it("9. create new agreement with adjusted terms", async () => {
    tx.beat("Beat 9: Renegotiation");

    const newDeadline = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;
    const schemaDoc = createProposalSchemaDoc(
      ANVIL_ACCOUNTS.partyA.address,
      ANVIL_ACCOUNTS.partyB.address,
      ANVIL_ACCOUNTS.adjudicator.address,
      newDeadline,
    );
    const proposalData = compileSchemaDoc(schemaDoc);
    const { payload } = encodePropose(proposalData);

    tx.action("partyA proposes new agreement with same structure (post-adjudication renegotiation)");

    const newAgreement = await createAgreement(contracts, ANVIL_ACCOUNTS.partyB.address, payload);
    await waitForState(backend, newAgreement, "PROPOSED");

    tx.result("New agreement created", { agreement: newAgreement });

    // Counter — partyB reads proposal from Ponder, decompiles, modifies, recompiles
    const pRes = await fetch(ponder.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query($id: String!) {
          proposals(where: { agreementId: $id }, orderBy: "sequence", limit: 1) {
            items { rawProposalData }
          }
        }`,
        variables: { id: newAgreement.toLowerCase() },
      }),
    });
    const pData = await pRes.json() as { data: { proposals: { items: { rawProposalData: string }[] } } };
    const decoded2 = decodeProposalData(pData.data.proposals.items[0].rawProposalData as `0x${string}`);
    const decompiled2 = decompile(decoded2, compilerConfig, registry);
    decompiled2.zones[1].permissions = [
      { resource: "market-data-read", rateLimit: "200/hour", purpose: "Access market data from Party A — increased limit" },
    ];
    const counterData = compileSchemaDoc(decompiled2);
    const counter = encodeCounter(counterData);
    await submitInput(partyBAccount, newAgreement, counter.inputId, counter.payload);
    await waitForState(backend, newAgreement, "NEGOTIATING");

    // Accept
    const accept = encodeAccept();
    await submitInput(partyAAccount, newAgreement, accept.inputId, counter.payload);
    await waitForState(backend, newAgreement, "ACCEPTED");

    // SET_UP
    const setUp = encodeSetUp();
    await submitInput(partyAAccount, newAgreement, setUp.inputId, setUp.payload);
    await waitForState(backend, newAgreement, "READY");

    // Stake
    const [hatA, hatB] = await Promise.all([
      publicClient.readContract({ address: newAgreement, abi: AgreementABI, functionName: "zoneHatIds", args: [0n] }),
      publicClient.readContract({ address: newAgreement, abi: AgreementABI, functionName: "zoneHatIds", args: [1n] }),
    ]) as [bigint, bigint];
    const [stkA, stkB] = await Promise.all([
      publicClient.readContract({ address: PRE_DEPLOYED.hats, abi: hatsAbi, functionName: "getHatEligibilityModule", args: [hatA] }),
      publicClient.readContract({ address: PRE_DEPLOYED.hats, abi: hatsAbi, functionName: "getHatEligibilityModule", args: [hatB] }),
    ]) as [Address, Address];
    await dealUSDC(ANVIL_ACCOUNTS.partyA.address, DEMO_MIN_STAKE * 2n);
    await dealUSDC(ANVIL_ACCOUNTS.partyB.address, DEMO_MIN_STAKE * 2n);
    await approveAndStake(partyAAccount, stkA, DEMO_MIN_STAKE);
    await approveAndStake(partyBAccount, stkB, DEMO_MIN_STAKE);

    // ACTIVATE
    const activate = encodeActivate();
    await submitInput(partyAAccount, newAgreement, activate.inputId, activate.payload);
    await waitForState(backend, newAgreement, "ACTIVE");

    const state = await backend.getAgreementState(newAgreement);
    expect(state.currentState).toBe("ACTIVE");

    const firstState = await backend.getAgreementState(agreementAddress);
    expect(firstState.currentState).toBe("CLOSED");

    tx.action("Drove new agreement through NEGOTIATE → SET_UP → STAKE → ACTIVATE");
    tx.result("New agreement ACTIVE alongside closed predecessor", {
      "agreement #1": `${shortAddr(agreementAddress)} — CLOSED (ADJUDICATED)`,
      "agreement #2": `${shortAddr(newAgreement)} — ACTIVE`,
    });
    tx.assert("Both agreements indexed independently");
    tx.assert("Second agreement fully operational");
  });
});
