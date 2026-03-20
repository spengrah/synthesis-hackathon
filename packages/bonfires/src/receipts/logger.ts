import type { BonfiresClient } from "../client.js";

export interface TweetReceipt {
  zone: string;
  content: string;
  tweetId: string;
  url: string;
  timestamp: number;
}

export function createReceiptLogger(client: BonfiresClient) {
  return async function logTweetReceipt(receipt: TweetReceipt): Promise<void> {
    try {
      await client.createEpisode({
        name: `receipt:tweet:${receipt.tweetId}`,
        episode_body: JSON.stringify({
          type: "tweet",
          zone: `zone:${receipt.zone.toLowerCase()}`,
          content: receipt.content,
          tweetId: receipt.tweetId,
          url: receipt.url,
          timestamp: receipt.timestamp,
        }),
        source: "json",
        source_description: "tweet_proxy_receipt",
        reference_time: new Date(receipt.timestamp).toISOString(),
      });
    } catch (err) {
      console.error(`[bonfires] Failed to log tweet receipt ${receipt.tweetId}:`, err);
    }
  };
}
