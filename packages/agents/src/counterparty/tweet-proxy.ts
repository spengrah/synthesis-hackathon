import express, { type Express, type Request, type Response } from "express";
import type { Server } from "node:http";
import { TwitterApi } from "twitter-api-v2";
import { verifyRequest, type NonceStore, type VerifyResult } from "@slicekit/erc8128";
import type { PublicClient } from "viem";
import { BonfiresClient, createReceiptLogger } from "@trust-zones/bonfires";

/** In-memory nonce store — sufficient for hackathon. */
class MemoryNonceStore implements NonceStore {
  private consumed = new Map<string, number>();

  async consume(key: string, ttlSeconds: number): Promise<boolean> {
    const now = Date.now();
    // Clean expired entries
    for (const [k, exp] of this.consumed) {
      if (exp < now) this.consumed.delete(k);
    }
    if (this.consumed.has(key)) return false;
    this.consumed.set(key, now + ttlSeconds * 1000);
    return true;
  }
}

export interface TweetProxyConfig {
  /** X OAuth 1.0a Consumer Key */
  consumerKey: string;
  /** X OAuth 1.0a Consumer Secret */
  consumerSecret: string;
  /** X OAuth 1.0a Access Token */
  accessToken: string;
  /** X OAuth 1.0a Access Token Secret */
  accessTokenSecret: string;
  /** X account username (without @), used to construct tweet URLs */
  username: string;
  /** When provided, enables ERC-8128 signature verification */
  publicClient?: PublicClient;
  /** Called after a successful tweet — fire-and-forget for receipt logging */
  onTweet?: (record: TweetRecord) => void;
}

export interface TweetRecord {
  zone: string;
  content: string;
  tweetId: string;
  url: string;
  timestamp: number;
}

/**
 * Tweet proxy — posts to X via twitter-api-v2.
 *
 * Auth modes:
 * - ERC-8128 (when publicClient provided): verifies HTTP message signatures
 * - keyid fallback (when no publicClient): uses simple keyid header (mock/test)
 *
 * The proxy does NOT filter content — enforcement is post-hoc
 * via directives + adjudicator.
 */
export class TweetProxy {
  private app: Express;
  private server: Server | null = null;
  private tweets: TweetRecord[] = [];
  private twitter: TwitterApi;
  private username: string;
  private publicClient: PublicClient | undefined;
  private nonceStore: NonceStore;
  private onTweet: ((record: TweetRecord) => void) | undefined;

  constructor(config: TweetProxyConfig) {
    this.twitter = new TwitterApi({
      appKey: config.consumerKey,
      appSecret: config.consumerSecret,
      accessToken: config.accessToken,
      accessSecret: config.accessTokenSecret,
    });
    this.username = config.username;
    this.publicClient = config.publicClient;
    this.nonceStore = new MemoryNonceStore();
    this.onTweet = config.onTweet;

    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.post("/tweet", (req, res) => this.handleTweet(req, res));
    this.app.get("/tweets", (_req, res) => {
      res.json({ tweets: this.tweets });
    });
    this.app.get("/health", (_req, res) => {
      res.json({ ok: true, tweetCount: this.tweets.length });
    });
  }

  /**
   * Authenticate a request. Returns the zone address or sends an error response.
   */
  private async authenticateRequest(req: Request, res: Response): Promise<string | null> {
    if (this.publicClient) {
      return this.authenticateERC8128(req, res);
    }
    return this.authenticateKeyId(req, res);
  }

  /** Authenticate via simple keyid header (fallback for mock/test). */
  private authenticateKeyId(req: Request, res: Response): string | null {
    const keyId = req.headers["keyid"] as string | undefined;
    if (!keyId) {
      res.status(401).json({ error: "Missing keyid header" });
      return null;
    }
    return keyId;
  }

  /** Authenticate via ERC-8128 signature verification. */
  private async authenticateERC8128(req: Request, res: Response): Promise<string | null> {
    // Convert Express request to Fetch API Request for @slicekit/erc8128
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
      res.status(401).json({
        error: "Unauthorized",
        reason: result.reason,
        detail: result.detail,
      });
      return null;
    }

    return result.address;
  }

  private async handleTweet(req: Request, res: Response): Promise<void> {
    const zone = await this.authenticateRequest(req, res);
    if (!zone) return; // response already sent

    const { content } = req.body;
    if (!content || typeof content !== "string") {
      res.status(400).json({ error: "Missing or invalid content field" });
      return;
    }

    if (content.length > 280) {
      res.status(400).json({ error: "Tweet exceeds 280 characters" });
      return;
    }

    try {
      const { data } = await this.twitter.v2.tweet(content);
      const tweetId = data.id;
      const url = `https://x.com/${this.username}/status/${tweetId}`;

      const record: TweetRecord = {
        zone,
        content,
        tweetId,
        url,
        timestamp: Date.now(),
      };
      this.tweets.push(record);

      console.log(`[tweet-proxy] ${zone} posted tweet ${tweetId}: "${content.slice(0, 80)}..."`);

      // Fire-and-forget receipt logging
      if (this.onTweet) {
        try { this.onTweet(record); } catch { /* don't block response */ }
      }

      res.status(201).json({ tweetId, url });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[tweet-proxy] X API error: ${message}`);
      res.status(502).json({ error: "Failed to post tweet", detail: message });
    }
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
        console.log(`Tweet proxy running on port ${port} (posting as @${this.username}, auth: ${mode})`);
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

/**
 * Create a TweetProxy from environment variables.
 *
 * Expected env vars:
 *   X_CONSUMER_KEY, X_CONSUMER_SECRET,
 *   X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET,
 *   X_USERNAME (defaults to "tempt_game_bot")
 *
 * Optional: pass a publicClient to enable ERC-8128 auth.
 */
export function createTweetProxyFromEnv(publicClient?: PublicClient): TweetProxy {
  const required = (key: string): string => {
    const val = process.env[key];
    if (!val) throw new Error(`Missing required env var: ${key}`);
    return val;
  };

  // Auto-wire Bonfires receipt logging if env vars are present
  let onTweet: ((record: TweetRecord) => void) | undefined;
  const bonfiresUrl = process.env["BONFIRES_API_URL"];
  const bonfiresKey = process.env["BONFIRES_API_KEY"];
  const bonfireId = process.env["BONFIRES_BONFIRE_ID"];
  if (bonfiresUrl && bonfiresKey && bonfireId) {
    const client = new BonfiresClient({ apiUrl: bonfiresUrl, apiKey: bonfiresKey, bonfireId });
    const logReceipt = createReceiptLogger(client);
    onTweet = (record) => { logReceipt(record); };
    console.log("[tweet-proxy] Bonfires receipt logging enabled");
  }

  return new TweetProxy({
    consumerKey: required("X_CONSUMER_KEY"),
    consumerSecret: required("X_CONSUMER_SECRET"),
    accessToken: required("X_ACCESS_TOKEN"),
    accessTokenSecret: required("X_ACCESS_TOKEN_SECRET"),
    username: process.env["X_USERNAME"] ?? "tempt_game_bot",
    publicClient,
    onTweet,
  });
}
