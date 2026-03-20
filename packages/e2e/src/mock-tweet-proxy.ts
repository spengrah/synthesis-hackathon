import express, { type Express, type Request, type Response } from "express";
import type { Server } from "node:http";
import type { PublicClient } from "viem";
import { verifyRequest, type NonceStore, type VerifyResult } from "@slicekit/erc8128";

export interface TweetRecord {
  zone: string;
  content: string;
  tweetId: string;
  url: string;
  timestamp: number;
}

/** In-memory nonce store. */
class MemoryNonceStore implements NonceStore {
  private consumed = new Map<string, number>();
  async consume(key: string, ttlSeconds: number): Promise<boolean> {
    const now = Date.now();
    for (const [k, exp] of this.consumed) {
      if (exp < now) this.consumed.delete(k);
    }
    if (this.consumed.has(key)) return false;
    this.consumed.set(key, now + ttlSeconds * 1000);
    return true;
  }
}

/**
 * Mock tweet proxy — records tweets without posting to X.
 * Supports both ERC-8128 signature verification (when publicClient provided)
 * and simple keyid header fallback.
 */
export class MockTweetProxy {
  private app: Express;
  private server: Server | null = null;
  private tweets: TweetRecord[] = [];
  private nextTweetId = 1;
  private onTweet: ((record: TweetRecord) => void) | undefined;
  private publicClient: PublicClient | undefined;
  private nonceStore: NonceStore;

  constructor(opts?: {
    onTweet?: (record: TweetRecord) => void;
    publicClient?: PublicClient;
  }) {
    this.onTweet = opts?.onTweet;
    this.publicClient = opts?.publicClient;
    this.nonceStore = new MemoryNonceStore();
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.post("/tweet", (req, res) => this.handleTweet(req, res));
    this.app.get("/tweets", (_req, res) => {
      res.json({ tweets: this.tweets });
    });
  }

  private async authenticateRequest(req: Request, res: Response): Promise<string | null> {
    if (this.publicClient) {
      return this.authenticateERC8128(req, res);
    }
    return this.authenticateKeyId(req, res);
  }

  private authenticateKeyId(req: Request, res: Response): string | null {
    const keyId = req.headers["keyid"] as string | undefined;
    if (!keyId) {
      res.status(401).json({ error: "Missing keyid header" });
      return null;
    }
    return keyId;
  }

  private async authenticateERC8128(req: Request, res: Response): Promise<string | null> {
    const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") {
        headers.set(key, value);
      } else if (Array.isArray(value)) {
        for (const v of value) headers.append(key, v);
      }
    }

    const fetchRequest = new globalThis.Request(url, {
      method: req.method,
      headers,
      body: req.method !== "GET" && req.method !== "HEAD"
        ? JSON.stringify(req.body)
        : undefined,
    });

    const result: VerifyResult = await verifyRequest({
      request: fetchRequest,
      verifyMessage: async (args) => {
        return this.publicClient!.verifyMessage({
          address: args.address,
          message: { raw: args.message.raw },
          signature: args.signature,
        });
      },
      nonceStore: this.nonceStore,
      policy: {
        maxValiditySec: 120,
        clockSkewSec: 10,
      },
    });

    if (!result.ok) {
      console.log(`[mock-tweet] ERC-8128 auth failed: ${result.reason} ${result.detail ?? ""}`);
      res.status(401).json({
        error: "Unauthorized",
        reason: result.reason,
        detail: result.detail,
      });
      return null;
    }

    console.log(`[mock-tweet] ERC-8128 auth succeeded for ${result.address}`);
    return result.address;
  }

  private async handleTweet(req: Request, res: Response): Promise<void> {
    const zone = await this.authenticateRequest(req, res);
    if (!zone) return;

    const { content } = req.body;
    if (!content || typeof content !== "string") {
      res.status(400).json({ error: "Missing or invalid content field" });
      return;
    }

    const tweetId = `mock-${this.nextTweetId++}`;
    const url = `https://x.com/TrustZonesBot/status/${tweetId}`;
    const tweet: TweetRecord = {
      zone,
      content,
      tweetId,
      url,
      timestamp: Date.now(),
    };

    this.tweets.push(tweet);
    console.log(`[mock-tweet] ${zone} posted: "${content.slice(0, 80)}..."`);

    if (this.onTweet) {
      try { this.onTweet(tweet); } catch { /* don't block response */ }
    }

    res.status(201).json({ tweetId, url });
  }

  getTweets(): TweetRecord[] {
    return [...this.tweets];
  }

  getTweetsByZone(zone: string): TweetRecord[] {
    return this.tweets.filter((t) => t.zone.toLowerCase() === zone.toLowerCase());
  }

  async start(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        const mode = this.publicClient ? "ERC-8128" : "keyid";
        console.log(`Mock tweet proxy running on port ${port} (auth: ${mode})`);
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
