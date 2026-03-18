// Library exports — no side effects on import

export { evaluateClaim } from "./adjudicator/evaluate.js";
export { startAdjudicator } from "./adjudicator/index.js";
export { mapVerdictToActions } from "./adjudicator/actions.js";
export type { ClaimContext, Verdict, GenerateObjectFn } from "./adjudicator/evaluate.js";
export type { AdjudicatorConfig } from "./adjudicator/index.js";

export { startCounterparty } from "./counterparty/index.js";
export { buildCounterProposal, determineWithdrawalLimit } from "./counterparty/negotiate.js";
export { buildClaimEvidence } from "./counterparty/monitor.js";
export type { CounterpartyConfig } from "./counterparty/index.js";
export type { VaultWithdrawal, TweetViolation } from "./counterparty/monitor.js";

export { createChainClients } from "./shared/chain.js";
export type { ChainClients } from "./shared/chain.js";
export { createLLMClient } from "./shared/llm.js";
export type { LLMConfig, LLMClient } from "./shared/llm.js";
export { pollUntil } from "./shared/polling.js";
export { createAgentPonderClient } from "./shared/ponder.js";
export type { AgentPonderClient } from "./shared/ponder.js";
export { createClaudeCliGenerate } from "./shared/claude-cli.js";
