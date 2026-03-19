import { TwitterApi } from "twitter-api-v2";

export interface TwitterClient {
  /** Fetch a tweet's text content by ID. Returns null if not found or deleted. */
  getTweet(tweetId: string): Promise<{ id: string; text: string } | null>;
}

export function createTwitterClient(config: {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}): TwitterClient {
  const api = new TwitterApi({
    appKey: config.consumerKey,
    appSecret: config.consumerSecret,
    accessToken: config.accessToken,
    accessSecret: config.accessTokenSecret,
  });

  return {
    async getTweet(tweetId: string) {
      try {
        const { data } = await api.v2.singleTweet(tweetId);
        return { id: data.id, text: data.text };
      } catch {
        return null;
      }
    },
  };
}

export function createTwitterClientFromEnv(): TwitterClient {
  const required = (key: string): string => {
    const val = process.env[key];
    if (!val) throw new Error(`Missing required env var: ${key}`);
    return val;
  };

  return createTwitterClient({
    consumerKey: required("X_CONSUMER_KEY"),
    consumerSecret: required("X_CONSUMER_SECRET"),
    accessToken: required("X_ACCESS_TOKEN"),
    accessTokenSecret: required("X_ACCESS_TOKEN_SECRET"),
  });
}
