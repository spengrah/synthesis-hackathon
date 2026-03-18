import { createOpenAI } from "@ai-sdk/openai";

export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function createLLMClient(config: LLMConfig) {
  const provider = createOpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
  });
  return { provider, model: config.model };
}

export type LLMClient = ReturnType<typeof createLLMClient>;
