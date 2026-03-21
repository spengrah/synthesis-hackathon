import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import type { DeployedContracts } from "./deploy.js";
import { ANVIL_RPC_URL } from "./constants.js";

const PONDER_DIR = resolve(import.meta.dirname, "../../ponder");
const READY_TIMEOUT = 30_000;
const POLL_INTERVAL = 500;

export class PonderManager {
  private process: ChildProcess | null = null;
  private port: number;
  /** True when we attached to an already-running Ponder (don't kill on stop) */
  private external = false;

  constructor(port: number) {
    this.port = port;
  }

  get url(): string {
    return `http://localhost:${this.port}/graphql`;
  }

  async start(
    contracts: DeployedContracts,
    rpcUrl: string = ANVIL_RPC_URL,
    startBlock?: number,
    chainId?: number,
  ): Promise<void> {
    // If Ponder is already running on this port, reuse it
    if (await this.isAlreadyRunning()) {
      this.external = true;
      console.log(`Ponder already running at ${this.url} — reusing`);
      return;
    }

    const env = {
      ...process.env,
      PONDER_AGREEMENT_REGISTRY: contracts.agreementRegistry,
      PONDER_RESOURCE_TOKEN_REGISTRY: contracts.resourceTokenRegistry,
      PONDER_TEMPTATION_VAULT: contracts.temptationVault,
      PONDER_RPC_URL: rpcUrl,
      PONDER_START_BLOCK: String(startBlock ?? 0),
      PONDER_CHAIN_ID: String(chainId ?? 8453),
    };

    this.process = spawn("pnpm", ["ponder", "dev", "--port", String(this.port)], {
      cwd: PONDER_DIR,
      env,
      stdio: "pipe",
    });

    this.process.stdout?.on("data", (data: Buffer) => {
      const line = data.toString().trim();
      if (line) console.log(`[ponder] ${line}`);
    });
    this.process.stderr?.on("data", (data: Buffer) => {
      const line = data.toString().trim();
      if (line) console.error(`[ponder] ${line}`);
    });
    this.process.on("error", (err) => {
      console.error("[ponder] process error:", err);
    });

    await this.waitForReady();
    console.log(`Ponder ready at ${this.url}`);
  }

  async stop(): Promise<void> {
    // Don't kill an externally managed Ponder
    if (this.external || !this.process) return;
    this.process.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      if (!this.process) return resolve();
      this.process.on("close", () => resolve());
      setTimeout(() => {
        this.process?.kill("SIGKILL");
        resolve();
      }, 5_000);
    });
    this.process = null;
  }

  private async isAlreadyRunning(): Promise<boolean> {
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "{ __typename }" }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async waitForReady(): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < READY_TIMEOUT) {
      try {
        const res = await fetch(this.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: "{ __typename }" }),
        });
        if (res.ok) return;
      } catch {
        // Not ready yet
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    }
    throw new Error(`Ponder did not become ready within ${READY_TIMEOUT}ms`);
  }
}
