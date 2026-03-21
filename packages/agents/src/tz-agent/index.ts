/**
 * TrustZonesAgent — reference implementation for an agent participating
 * in Trust Zones agreements.
 *
 * Uses the same code paths as the public interfaces:
 * - MCP server tools: compile, decompile, encode, graphql
 * - CLI: sign-http (ERC-8128), prepare-tx (zone execution)
 *
 * Currently calls the underlying functions directly. Future version
 * will use LLM-driven tool calls via installed skills + MCP + CLI.
 */
import {
  compile,
  decompile,
  createDefaultRegistry,
  BASE_MAINNET_CONFIG,
  type TZSchemaDocument,
} from "@trust-zones/compiler";
import {
  encodePropose,
  encodeCounter,
  encodeAccept,
  encodeSetUp,
  encodeActivate,
  encodeComplete,
  decodeProposalData,
  buildZoneExecute,
  createPonderBackend,
  AgreementRegistryABI,
  AgreementABI,
  type ReadBackend,
} from "@trust-zones/sdk";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toHex,
  encodeFunctionData,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Transport,
  type Chain,
  type Account,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import { createZoneSignerClient } from "../shared/erc8128.js";

export interface TrustZonesAgentConfig {
  privateKey: Hex;
  rpcUrl: string;
  ponderUrl: string;
  chainId?: number;
}

export class TrustZonesAgent {
  readonly account: ReturnType<typeof privateKeyToAccount>;
  readonly address: Address;
  private wallet: WalletClient<Transport, Chain, Account>;
  private publicClient: PublicClient;
  private ponderUrl: string;
  private backend: ReadBackend;
  private registry = createDefaultRegistry();
  private config = BASE_MAINNET_CONFIG;
  private zoneAddress: Address | null = null;

  constructor(cfg: TrustZonesAgentConfig) {
    this.account = privateKeyToAccount(cfg.privateKey);
    this.address = this.account.address;
    const chain = cfg.chainId === 84532 ? baseSepolia : base;
    const transport = http(cfg.rpcUrl);
    this.publicClient = createPublicClient({ chain, transport }) as unknown as PublicClient;
    this.wallet = createWalletClient({ account: this.account, chain, transport }) as unknown as WalletClient<Transport, Chain, Account>;
    this.ponderUrl = cfg.ponderUrl;
    this.backend = createPonderBackend(cfg.ponderUrl);
  }

  // ─── MCP: compile ────────────────────────────────────────────

  /** Compile a schema document into proposal data. (MCP: compile) */
  compileSchema(doc: TZSchemaDocument): { payload: Hex; inputId: Hex } {
    const proposalData = compile(doc, this.config, this.registry);
    return encodePropose(proposalData);
  }

  /** Compile a counter-proposal. (MCP: compile + encode counter) */
  compileCounter(doc: TZSchemaDocument): { payload: Hex; inputId: Hex } {
    const proposalData = compile(doc, this.config, this.registry);
    return encodeCounter(proposalData);
  }

  // ─── MCP: decompile ──────────────────────────────────────────

  /** Decompile raw proposal data into a readable schema. (MCP: decompile) */
  decompileProposal(rawProposalData: Hex): TZSchemaDocument {
    const proposalData = decodeProposalData(rawProposalData);
    return decompile(proposalData, this.config, this.registry);
  }

  // ─── MCP: graphql ────────────────────────────────────────────

  /** Query Ponder GraphQL. (MCP: graphql) */
  async graphql<T = Record<string, unknown>>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const res = await fetch(this.ponderUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`Ponder query failed: ${res.status}`);
    const json = await res.json() as { data: T; errors?: unknown[] };
    if (json.errors?.length) throw new Error(`Ponder errors: ${JSON.stringify(json.errors)}`);
    return json.data;
  }

  /** Get agreement state. (MCP: graphql) */
  async getAgreementState(agreementAddress: Address) {
    return this.backend.getAgreementState(agreementAddress);
  }

  /** Get zone details. (MCP: graphql) */
  async getZoneDetails(zoneAddress: Address) {
    return this.backend.getZoneDetails(zoneAddress);
  }

  // ─── MCP: encode → wallet: submit ────────────────────────────

  /** Create a new agreement with a proposal. (MCP: encode propose → wallet: submit) */
  async createAgreement(
    registryAddress: Address,
    counterparty: Address,
    schemaDoc: TZSchemaDocument,
  ): Promise<Address> {
    const { payload } = this.compileSchema(schemaDoc);
    const { result } = await this.publicClient.simulateContract({
      account: this.account,
      address: registryAddress,
      abi: AgreementRegistryABI,
      functionName: "createAgreement",
      args: [counterparty, payload],
    });
    const hash = await this.wallet.writeContract({
      address: registryAddress,
      abi: AgreementRegistryABI,
      functionName: "createAgreement",
      args: [counterparty, payload],
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    return result;
  }

  /** Accept the latest proposal. (MCP: encode accept → wallet: submit) */
  async accept(agreementAddress: Address, proposalPayload: Hex): Promise<Hex> {
    const { inputId } = encodeAccept();
    return this.submitInput(agreementAddress, inputId, proposalPayload);
  }

  /** Trigger zone deployment. (MCP: encode setup → wallet: submit) */
  async setUp(agreementAddress: Address): Promise<Hex> {
    const { inputId, payload } = encodeSetUp();
    return this.submitInput(agreementAddress, inputId, payload);
  }

  /** Activate the agreement. (MCP: encode activate → wallet: submit) */
  async activate(agreementAddress: Address): Promise<Hex> {
    const { inputId, payload } = encodeActivate();
    return this.submitInput(agreementAddress, inputId, payload);
  }

  /** Approve and stake into an eligibility module. (wallet: approve + stake) */
  async stake(stakingModule: Address, token: Address, amount: bigint): Promise<void> {
    const erc20Abi = [{ name: "approve", type: "function", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" }] as const;
    const stakingAbi = [{ name: "stake", type: "function", inputs: [{ name: "_amount", type: "uint248" }], outputs: [], stateMutability: "nonpayable" }] as const;

    const h1 = await this.wallet.writeContract({ address: token, abi: erc20Abi, functionName: "approve", args: [stakingModule, amount] });
    await this.publicClient.waitForTransactionReceipt({ hash: h1, confirmations: 2 });
    const h2 = await this.wallet.writeContract({ address: stakingModule, abi: stakingAbi, functionName: "stake", args: [amount] });
    await this.publicClient.waitForTransactionReceipt({ hash: h2, });
  }

  /** Complete with feedback. (MCP: encode complete → wallet: submit) */
  async complete(agreementAddress: Address, feedback: { assessment: string }): Promise<Hex> {
    const feedbackContent = JSON.stringify({
      agreement: agreementAddress,
      outcome: "completed",
      assessment: feedback.assessment,
      timestamp: Date.now(),
    });
    const feedbackUri = `data:application/json,${encodeURIComponent(feedbackContent)}`;
    const feedbackHash = keccak256(toHex(feedbackContent));
    const { inputId, payload } = encodeComplete(feedbackUri, feedbackHash);
    return this.submitInput(agreementAddress, inputId, payload);
  }

  /** Submit a raw input to an agreement. */
  async submitInput(agreementAddress: Address, inputId: Hex, payload: Hex): Promise<Hex> {
    const hash = await this.wallet.writeContract({
      address: agreementAddress,
      abi: AgreementABI,
      functionName: "submitInput",
      args: [inputId, payload],
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  // ─── CLI: sign-http (ERC-8128) ───────────────────────────────

  /** Post a signed HTTP request as the zone. (CLI: tz sign-http) */
  async signedFetch(url: string, init: RequestInit): Promise<Response> {
    if (!this.zoneAddress) throw new Error("Zone not set — call setZone() after activation");

    const signerClient = await createZoneSignerClient(
      this.wallet as any,
      this.zoneAddress,
      base.id,
      { publicClient: this.publicClient as any },
    );

    return signerClient.fetch(url, init);
  }

  /** Post a tweet via the tweet proxy. Uses ERC-8128 if zone is set, keyid fallback otherwise. */
  async postTweet(tweetProxyUrl: string, content: string): Promise<{ tweetId: string; url: string }> {
    let res: Response;

    if (!this.zoneAddress) {
      throw new Error("Zone not set — call setZone() after activation");
    }

    // Try ERC-8128, fall back to keyid on auth failure
    try {
      res = await this.signedFetch(`${tweetProxyUrl}/tweet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.status === 401) throw new Error("ERC-8128 auth rejected");
    } catch {
      res = await fetch(`${tweetProxyUrl}/tweet`, {
        method: "POST",
        headers: { "Content-Type": "application/json", keyid: this.zoneAddress },
        body: JSON.stringify({ content }),
      });
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Tweet failed (${res.status}): ${err}`);
    }

    return res.json() as Promise<{ tweetId: string; url: string }>;
  }

  // ─── CLI: prepare-tx (zone execution) ────────────────────────

  /** Execute a transaction through the zone account. (CLI: tz prepare-tx → wallet: submit) */
  async executeViaZone(to: Address, value: bigint, data: Hex): Promise<Hex> {
    if (!this.zoneAddress) throw new Error("Zone not set — call setZone() after activation");

    const prepared = buildZoneExecute(this.zoneAddress, to, value, data);
    const hash = await this.wallet.writeContract({
      address: prepared.to,
      abi: [{ name: "execute", type: "function", inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }, { name: "data", type: "bytes" }], outputs: [], stateMutability: "payable" }],
      functionName: "execute",
      args: [to, value, data],
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  // ─── Zone management ─────────────────────────────────────────

  /** Set the zone address (read from Ponder after setUp). */
  setZone(zoneAddress: Address): void {
    this.zoneAddress = zoneAddress;
  }

  /** Get this agent's zone address. */
  getZone(): Address | null {
    return this.zoneAddress;
  }

  /** Discover this agent's zone from an active agreement. */
  async discoverZone(agreementAddress: Address): Promise<Address> {
    const state = await this.getAgreementState(agreementAddress);
    // Find the zone operated by this agent
    for (const zoneAddr of state.trustZones) {
      if (zoneAddr === "0x0000000000000000000000000000000000000000") continue;
      const details = await this.getZoneDetails(zoneAddr);
      // Check if this zone's actor matches our address
      // The zone details don't directly expose the actor address, so query Ponder
      const data = await this.graphql<any>(
        `query($id: String!) { trustZone(id: $id) { actor { address } } }`,
        { id: zoneAddr.toLowerCase() },
      );
      if (data.trustZone?.actor?.address?.toLowerCase() === this.address.toLowerCase()) {
        this.zoneAddress = zoneAddr as Address;
        return this.zoneAddress;
      }
    }
    throw new Error(`No zone found for agent ${this.address} in agreement ${agreementAddress}`);
  }

  // ─── Wallet utilities ────────────────────────────────────────

  /** Get the underlying public client for direct reads. */
  getPublicClient(): PublicClient {
    return this.publicClient;
  }

  /** Get the underlying wallet client for direct writes. */
  getWalletClient(): WalletClient<Transport, Chain, Account> {
    return this.wallet;
  }
}
