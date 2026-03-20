import express, { type Express, type Request, type Response } from "express";
import type { Server } from "node:http";

export interface TweetRecord {
  zone: string;
  content: string;
  tweetId: string;
  url: string;
  timestamp: number;
}

/**
 * Mock tweet proxy — records tweets without posting to X.
 * Checks keyid header for zone identity, checks Ponder for tweet-post permission.
 * Real 8128 auth + X integration replaces this later.
 */
export class MockTweetProxy {
  private app: Express;
  private server: Server | null = null;
  private tweets: TweetRecord[] = [];
  private nextTweetId = 1;
  private onTweet: ((record: TweetRecord) => void) | undefined;

  constructor(opts?: { onTweet?: (record: TweetRecord) => void }) {
    this.onTweet = opts?.onTweet;
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

  private handleTweet(req: Request, res: Response): void {
    const keyId = req.headers["keyid"] as string | undefined;
    if (!keyId) {
      res.status(401).json({ error: "Missing keyid header" });
      return;
    }

    const { content } = req.body;
    if (!content || typeof content !== "string") {
      res.status(400).json({ error: "Missing or invalid content field" });
      return;
    }

    // Mock: accept any zone with a keyid header.
    // Real version queries Ponder for tweet-post permission.
    const tweetId = `mock-${this.nextTweetId++}`;
    const url = `https://x.com/TrustZonesBot/status/${tweetId}`;
    const tweet: TweetRecord = {
      zone: keyId,
      content,
      tweetId,
      url,
      timestamp: Date.now(),
    };

    this.tweets.push(tweet);
    console.log(`[mock-tweet] ${keyId} posted: "${content.slice(0, 80)}..."`);

    // Fire-and-forget receipt callback
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
        console.log(`Mock tweet proxy running on port ${port}`);
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
