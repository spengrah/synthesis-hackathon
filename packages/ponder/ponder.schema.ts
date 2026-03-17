import { onchainTable, index } from "@ponder/core";

// ─── Core lifecycle ──────────────────────────────────────────────

export const agreement = onchainTable("agreement", (t) => ({
  id: t.hex().primaryKey(), // contract address
  state: t.text().notNull(),
  outcome: t.text(),
  termsHash: t.hex(),
  termsUri: t.text(),
  adjudicator: t.hex(),
  deadline: t.bigint(),
  agreementHatId: t.bigint().notNull(),
  partyACompleted: t.boolean().notNull().default(false),
  partyBCompleted: t.boolean().notNull().default(false),
  partyAExited: t.boolean().notNull().default(false),
  partyBExited: t.boolean().notNull().default(false),
  createdAt: t.bigint().notNull(),
  activatedAt: t.bigint(),
  closedAt: t.bigint(),
}));

export const actor = onchainTable("actor", (t) => ({
  id: t.text().primaryKey(), // address lowercase
  address: t.hex().notNull(),
  agentId: t.bigint(),
}));

export const agreementParty = onchainTable("agreement_party", (t) => ({
  id: t.text().primaryKey(), // `${agreement}:${address}`
  agreementId: t.hex().notNull(),
  actorId: t.text().notNull(),
  partyIndex: t.integer().notNull(),
}));

export const proposal = onchainTable("proposal", (t) => ({
  id: t.text().primaryKey(), // `${agreement}:${sequence}`
  agreementId: t.hex().notNull(),
  proposerId: t.text().notNull(),
  sequence: t.integer().notNull(),
  termsHash: t.hex().notNull(),
  timestamp: t.bigint().notNull(),
  termsDocUri: t.text(),
  adjudicator: t.hex(),
  deadline: t.bigint(),
  zoneCount: t.integer(),
}));

export const trustZone = onchainTable("trust_zone", (t) => ({
  id: t.hex().primaryKey(), // TZ account address
  agreementId: t.hex().notNull(),
  actorId: t.text().notNull(),
  hatId: t.bigint().notNull(),
  zoneIndex: t.integer().notNull(),
  active: t.boolean().notNull().default(true),
  createdAt: t.bigint().notNull(),
}));

// ─── Context graph typed entities ────────────────────────────────

export const permission = onchainTable("permission", (t) => ({
  id: t.text().primaryKey(),
  agreementId: t.hex().notNull(),
  proposalId: t.text(),
  trustZoneId: t.hex(),
  resourceTokenId: t.bigint(),
  zoneIndex: t.integer().notNull(),
  resource: t.text(),
  rateLimit: t.text(),
  expiry: t.bigint(),
  purpose: t.text(),
  createdAt: t.bigint().notNull(),
}));

export const responsibility = onchainTable("responsibility", (t) => ({
  id: t.text().primaryKey(),
  agreementId: t.hex().notNull(),
  proposalId: t.text(),
  trustZoneId: t.hex(),
  resourceTokenId: t.bigint(),
  zoneIndex: t.integer().notNull(),
  obligation: t.text(),
  criteria: t.text(),
  deadline: t.bigint(),
  createdAt: t.bigint().notNull(),
}));

export const directive = onchainTable("directive", (t) => ({
  id: t.text().primaryKey(),
  agreementId: t.hex().notNull(),
  proposalId: t.text(),
  trustZoneId: t.hex(),
  resourceTokenId: t.bigint(),
  zoneIndex: t.integer().notNull(),
  rule: t.text(),
  severity: t.text(),
  params: t.text(),
  createdAt: t.bigint().notNull(),
}));

export const constraint = onchainTable("constraint", (t) => ({
  id: t.text().primaryKey(),
  agreementId: t.hex().notNull(),
  proposalId: t.text(),
  trustZoneId: t.hex(),
  zoneIndex: t.integer().notNull(),
  module: t.hex().notNull(),
  initData: t.hex().notNull(),
  createdAt: t.bigint().notNull(),
}));

export const eligibility = onchainTable("eligibility", (t) => ({
  id: t.text().primaryKey(),
  agreementId: t.hex().notNull(),
  proposalId: t.text(),
  trustZoneId: t.hex(),
  zoneIndex: t.integer().notNull(),
  module: t.hex().notNull(),
  initData: t.hex().notNull(),
  createdAt: t.bigint().notNull(),
}));

export const incentive = onchainTable("incentive", (t) => ({
  id: t.text().primaryKey(),
  agreementId: t.hex().notNull(),
  proposalId: t.text(),
  trustZoneId: t.hex(),
  zoneIndex: t.integer().notNull(),
  incentiveType: t.text().notNull(),
  module: t.hex().notNull(),
  initData: t.hex().notNull(),
  createdAt: t.bigint().notNull(),
}));

export const decisionModel = onchainTable("decision_model", (t) => ({
  id: t.text().primaryKey(),
  agreementId: t.hex().notNull(),
  proposalId: t.text(),
  trustZoneId: t.hex(),
  zoneIndex: t.integer().notNull(),
  module: t.hex().notNull(),
  initData: t.hex().notNull(),
  createdAt: t.bigint().notNull(),
}));

export const principalAlignment = onchainTable("principal_alignment", (t) => ({
  id: t.text().primaryKey(),
  agreementId: t.hex().notNull(),
  proposalId: t.text(),
  trustZoneId: t.hex(),
  zoneIndex: t.integer().notNull(),
  module: t.hex().notNull(),
  initData: t.hex().notNull(),
  createdAt: t.bigint().notNull(),
}));

// ─── Token layer ─────────────────────────────────────────────────

export const resourceToken = onchainTable("resource_token", (t) => ({
  id: t.bigint().primaryKey(), // ERC-6909 token ID
  tokenType: t.integer().notNull(),
  creator: t.hex().notNull(),
  metadata: t.hex().notNull(),
  createdAt: t.bigint().notNull(),
}));

export const resourceTokenHolding = onchainTable("resource_token_holding", (t) => ({
  id: t.text().primaryKey(), // `${trustZone}:${tokenId}`
  trustZoneId: t.hex().notNull(),
  resourceTokenId: t.bigint().notNull(),
  balance: t.bigint().notNull(),
}));

// ─── Claims + feedback ──────────────────────────────────────────

export const claim = onchainTable("claim", (t) => ({
  id: t.text().primaryKey(), // `${agreement}:${claimId}`
  agreementId: t.hex().notNull(),
  mechanismIndex: t.bigint().notNull(),
  claimantId: t.text().notNull(),
  evidence: t.hex().notNull(),
  verdict: t.boolean(),
  actionTypes: t.text(), // JSON array of decoded bytes32 strings
  timestamp: t.bigint().notNull(),
  adjudicatedAt: t.bigint(),
}));

export const reputationFeedback = onchainTable("reputation_feedback", (t) => ({
  id: t.text().primaryKey(), // `${agreement}:${agentId}`
  agreementId: t.hex().notNull(),
  actorId: t.text(),
  tag: t.text().notNull(),
  feedbackURI: t.text().notNull(),
  feedbackHash: t.hex().notNull(),
  timestamp: t.bigint().notNull(),
}));
