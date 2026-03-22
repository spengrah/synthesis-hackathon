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
  /** Ponder GraphQL endpoint for zone → agentId resolution */
  ponderUrl?: string;
  /** Public base URL for constructing feed links (e.g. https://tweet-proxy.up.railway.app) */
  publicUrl?: string;
}

export interface TweetRecord {
  zone: string;
  content: string;
  tweetId: string;
  url: string;
  timestamp: number;
  postedToX: boolean;
}

/**
 * Tweet proxy — posts to X via twitter-api-v2, fails open to local feed.
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
  private ponderUrl: string | undefined;
  private publicUrl: string;
  private nextLocalId = 1;
  private agentIdCache = new Map<string, string | null>();

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
    this.ponderUrl = config.ponderUrl;
    this.publicUrl = config.publicUrl ?? "http://localhost:42075";

    this.app = express();
    this.app.use((_req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, keyid, signature, signature-input");
      if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
      next();
    });
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
    this.app.get("/feed", (_req, res) => {
      res.type("html").send(FEED_HTML);
    });
    this.app.get("/feed/tweets", (_req, res) => this.handleFeedTweets(res));
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

    let tweetId: string;
    let url: string;
    let postedToX = false;

    try {
      const { data } = await this.twitter.v2.tweet(content);
      tweetId = data.id;
      url = `https://x.com/${this.username}/status/${tweetId}`;
      postedToX = true;
      console.log(`[tweet-proxy] ${zone} posted tweet ${tweetId}: "${content.slice(0, 80)}..."`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[tweet-proxy] X API failed, recording locally: ${message}`);
      tweetId = `local-${this.nextLocalId++}`;
      url = `${this.publicUrl}/feed#${tweetId}`;
    }

    const record: TweetRecord = {
      zone,
      content,
      tweetId,
      url,
      timestamp: Date.now(),
      postedToX,
    };
    this.tweets.push(record);

    // Fire-and-forget receipt logging
    if (this.onTweet) {
      try { this.onTweet(record); } catch { /* don't block response */ }
    }

    res.status(201).json({ tweetId, url });
  }

  /** Resolve zone address → agentId via Ponder. Caches results. */
  private async resolveAgentId(zone: string): Promise<string | null> {
    const key = zone.toLowerCase();
    if (this.agentIdCache.has(key)) return this.agentIdCache.get(key)!;

    if (!this.ponderUrl) {
      this.agentIdCache.set(key, null);
      return null;
    }

    try {
      const res = await fetch(this.ponderUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query($id:String!){trustZone(id:$id){actor{agentId}}}`,
          variables: { id: key },
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = (await res.json()) as { data?: { trustZone?: { actor?: { agentId?: string } } } };
      const agentId = json.data?.trustZone?.actor?.agentId ?? null;
      this.agentIdCache.set(key, agentId);
      return agentId;
    } catch (err) {
      console.warn(`[tweet-proxy] Failed to resolve agentId for ${key}:`, err);
      this.agentIdCache.set(key, null);
      return null;
    }
  }

  /** Serve enriched tweets for the feed viewer. */
  private async handleFeedTweets(res: Response): Promise<void> {
    const enriched = await Promise.all(
      this.tweets.map(async (t) => ({
        zone: t.zone,
        agentId: await this.resolveAgentId(t.zone),
        content: t.content,
        tweetId: t.tweetId,
        url: t.url,
        timestamp: t.timestamp,
        postedToX: t.postedToX,
      })),
    );
    res.json({ tweets: enriched });
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
    ponderUrl: process.env["PONDER_URL"],
    publicUrl: process.env["PUBLIC_URL"],
  });
}

// ---- Feed viewer HTML ----

const FEED_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Trust Zones Feed</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f5f8fa; color: #14171a; }
  .header { background: #15202b; color: #fff; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 10; }
  .header h1 { font-size: 20px; font-weight: 700; }
  .header button { background: #1d9bf0; color: #fff; border: none; border-radius: 20px; padding: 8px 20px; font-size: 14px; font-weight: 700; cursor: pointer; }
  .header button:hover { background: #1a8cd8; }
  .feed { max-width: 600px; margin: 0 auto; padding: 16px; }
  .tweet { background: #fff; border: 1px solid #e1e8ed; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
  .tweet-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .avatar { width: 40px; height: 40px; border-radius: 50%; background: #1d9bf0; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 16px; flex-shrink: 0; }
  .tweet-meta { display: flex; flex-direction: column; }
  .tweet-name { font-weight: 700; font-size: 15px; }
  .tweet-handle { color: #536471; font-size: 13px; }
  .tweet-content { font-size: 15px; line-height: 1.4; margin-bottom: 8px; white-space: pre-wrap; word-wrap: break-word; }
  .tweet-footer { display: flex; align-items: center; gap: 12px; color: #536471; font-size: 13px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
  .badge-x { background: #e8f5fd; color: #1d9bf0; }
  .badge-local { background: #fef3e2; color: #e67e22; }
  .empty { text-align: center; padding: 48px 16px; color: #536471; font-size: 15px; }
  .loading { text-align: center; padding: 48px 16px; color: #536471; }
</style>
</head>
<body>
<div class="header">
  <h1>Trust Zones Feed</h1>
  <button onclick="loadTweets()">Refresh</button>
</div>
<div class="feed" id="feed">
  <div class="loading">Loading tweets...</div>
</div>
<script>
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h';
  return Math.floor(h / 24) + 'd';
}

function truncAddr(a) {
  if (!a || a.length < 10) return a || '?';
  return a.slice(0, 6) + '...' + a.slice(-4);
}

function renderTweet(t) {
  const name = t.agentId ? 'Agent #' + t.agentId : truncAddr(t.zone);
  const initial = t.agentId ? t.agentId.toString().charAt(0) : 'A';
  const badge = t.postedToX
    ? '<span class="badge badge-x">posted to X</span>'
    : '<span class="badge badge-local">local only</span>';
  return '<div class="tweet" id="' + t.tweetId + '">' +
    '<div class="tweet-header">' +
      '<div class="avatar">' + initial + '</div>' +
      '<div class="tweet-meta">' +
        '<span class="tweet-name">' + escHtml(name) + '</span>' +
        '<span class="tweet-handle">' + truncAddr(t.zone) + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="tweet-content">' + escHtml(t.content) + '</div>' +
    '<div class="tweet-footer">' +
      '<span>' + timeAgo(t.timestamp) + '</span>' +
      badge +
    '</div>' +
  '</div>';
}

function escHtml(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function loadTweets() {
  var feed = document.getElementById('feed');
  feed.innerHTML = '<div class="loading">Loading...</div>';
  fetch('/feed/tweets')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var tweets = data.tweets || [];
      if (tweets.length === 0) {
        feed.innerHTML = '<div class="empty">No tweets yet. Agents haven\\'t posted anything.</div>';
        return;
      }
      // Show newest first
      tweets.sort(function(a, b) { return b.timestamp - a.timestamp; });
      feed.innerHTML = tweets.map(renderTweet).join('');
    })
    .catch(function(err) {
      feed.innerHTML = '<div class="empty">Failed to load tweets: ' + err.message + '</div>';
    });
}

loadTweets();
</script>
</body>
</html>`;
