import express, { type Express, type Request, type Response } from "express";
import type { Server } from "node:http";

// Permitted endpoints and their required permission resource names
const PERMITTED_ENDPOINTS: Record<string, string> = {
  "/market-data": "market-data-read",
  "/social-graph": "social-graph-read",
};

export class MockDataApi {
  private app: Express;
  private server: Server | null = null;
  private rateLimitCounts = new Map<string, number>();
  /** Data posted to the public board — evidence of redistribution. */
  private publicBoard: { postedBy: string; data: unknown; timestamp: number }[] = [];

  constructor() {
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.get("/market-data", (req, res) => this.handleRequest(req, res, "market-data"));
    this.app.get("/social-graph", (req, res) => this.handleRequest(req, res, "social-graph"));
    this.app.get("/raw-export", (req, res) => this.handleRequest(req, res, "raw-export"));

    // Public board — anyone can post, anyone can read. No auth required.
    this.app.post("/public/board", (req, res) => this.handlePublicPost(req, res));
    this.app.get("/public/board", (_req, res) => {
      res.json({ posts: this.publicBoard });
    });
  }

  private async handleRequest(req: Request, res: Response, endpoint: string): Promise<void> {
    const keyId = req.headers["keyid"] as string | undefined;
    if (!keyId) {
      res.status(401).json({ error: "Missing keyid header" });
      return;
    }

    // Check if endpoint is permitted
    const permResource = PERMITTED_ENDPOINTS[`/${endpoint}`];
    if (!permResource) {
      res.status(403).json({ error: `No permission for /${endpoint}` });
      return;
    }

    // Rate limit check (in-memory)
    const key = `${keyId}:${endpoint}`;
    const count = (this.rateLimitCounts.get(key) ?? 0) + 1;
    this.rateLimitCounts.set(key, count);

    console.log(`[mock-api] ${keyId} requesting /${endpoint} (count: ${count})`);

    // Return mock data
    const data = this.getMockData(endpoint);
    res.json({ data, receipt: { account: keyId, endpoint, timestamp: Date.now() } });
  }

  private handlePublicPost(req: Request, res: Response): void {
    const { postedBy, data } = req.body;
    const post = { postedBy, data, timestamp: Date.now() };
    this.publicBoard.push(post);
    console.log(`[mock-api] PUBLIC POST by ${postedBy}: ${JSON.stringify(data).slice(0, 100)}`);
    res.status(201).json(post);
  }

  private getMockData(endpoint: string): unknown {
    switch (endpoint) {
      case "market-data":
        return { pairs: [{ base: "ETH", quote: "USD", price: 3500 }] };
      case "social-graph":
        return { nodes: [{ id: "agent-a", connections: 42 }] };
      default:
        return {};
    }
  }

  async start(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        console.log(`Mock data API running on port ${port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    return new Promise((resolve) => {
      this.server!.close(() => resolve());
    });
  }
}
