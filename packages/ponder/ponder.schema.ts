import { onchainTable, index, relations } from "@ponder/core";

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
  setUpAt: t.bigint(),
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
  rawProposalData: t.hex(), // ABI-encoded ProposalData bytes from the event
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
  value: t.bigint(),
  period: t.text(),
  expiry: t.bigint(),
  params: t.text(),
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
  moduleKind: t.text(),
  data: t.hex().notNull(),
  createdAt: t.bigint().notNull(),
}));

export const eligibility = onchainTable("eligibility", (t) => ({
  id: t.text().primaryKey(),
  agreementId: t.hex().notNull(),
  proposalId: t.text(),
  trustZoneId: t.hex(),
  zoneIndex: t.integer().notNull(),
  module: t.hex().notNull(),
  moduleKind: t.text(),
  data: t.hex().notNull(),
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
  moduleKind: t.text(),
  data: t.hex().notNull(),
  createdAt: t.bigint().notNull(),
}));

export const decisionModel = onchainTable("decision_model", (t) => ({
  id: t.text().primaryKey(),
  agreementId: t.hex().notNull(),
  proposalId: t.text(),
  trustZoneId: t.hex(),
  zoneIndex: t.integer().notNull(),
  module: t.hex().notNull(),
  moduleKind: t.text(),
  data: t.hex().notNull(),
  createdAt: t.bigint().notNull(),
}));

export const principalAlignment = onchainTable("principal_alignment", (t) => ({
  id: t.text().primaryKey(),
  agreementId: t.hex().notNull(),
  proposalId: t.text(),
  trustZoneId: t.hex(),
  zoneIndex: t.integer().notNull(),
  module: t.hex().notNull(),
  moduleKind: t.text(),
  data: t.hex().notNull(),
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

// ─── Relations ──────────────────────────────────────────────────
// Field names here become the GraphQL nested query fields.

export const agreementRelations = relations(agreement, ({ many }) => ({
  agreementParties: many(agreementParty),
  proposals: many(proposal),
  trustZones: many(trustZone),
  claims: many(claim),
  reputationFeedbacks: many(reputationFeedback),
}));

export const agreementPartyRelations = relations(agreementParty, ({ one }) => ({
  agreement: one(agreement, { fields: [agreementParty.agreementId], references: [agreement.id] }),
  actor: one(actor, { fields: [agreementParty.actorId], references: [actor.id] }),
}));

export const proposalRelations = relations(proposal, ({ one }) => ({
  agreement: one(agreement, { fields: [proposal.agreementId], references: [agreement.id] }),
  proposer: one(actor, { fields: [proposal.proposerId], references: [actor.id] }),
}));

export const trustZoneRelations = relations(trustZone, ({ one, many }) => ({
  agreement: one(agreement, { fields: [trustZone.agreementId], references: [agreement.id] }),
  actor: one(actor, { fields: [trustZone.actorId], references: [actor.id] }),
  permissions: many(permission),
  responsibilities: many(responsibility),
  directives: many(directive),
  constraints: many(constraint),
  resourceTokenHoldings: many(resourceTokenHolding),
}));

export const permissionRelations = relations(permission, ({ one }) => ({
  trustZone: one(trustZone, { fields: [permission.trustZoneId], references: [trustZone.id] }),
  resourceToken: one(resourceToken, { fields: [permission.resourceTokenId], references: [resourceToken.id] }),
}));

export const responsibilityRelations = relations(responsibility, ({ one }) => ({
  trustZone: one(trustZone, { fields: [responsibility.trustZoneId], references: [trustZone.id] }),
  resourceToken: one(resourceToken, { fields: [responsibility.resourceTokenId], references: [resourceToken.id] }),
}));

export const directiveRelations = relations(directive, ({ one }) => ({
  trustZone: one(trustZone, { fields: [directive.trustZoneId], references: [trustZone.id] }),
  resourceToken: one(resourceToken, { fields: [directive.resourceTokenId], references: [resourceToken.id] }),
}));

export const constraintRelations = relations(constraint, ({ one }) => ({
  trustZone: one(trustZone, { fields: [constraint.trustZoneId], references: [trustZone.id] }),
}));

export const resourceTokenHoldingRelations = relations(resourceTokenHolding, ({ one }) => ({
  trustZone: one(trustZone, { fields: [resourceTokenHolding.trustZoneId], references: [trustZone.id] }),
  resourceToken: one(resourceToken, { fields: [resourceTokenHolding.resourceTokenId], references: [resourceToken.id] }),
}));

export const claimRelations = relations(claim, ({ one }) => ({
  agreement: one(agreement, { fields: [claim.agreementId], references: [agreement.id] }),
  claimant: one(actor, { fields: [claim.claimantId], references: [actor.id] }),
}));

export const reputationFeedbackRelations = relations(reputationFeedback, ({ one }) => ({
  agreement: one(agreement, { fields: [reputationFeedback.agreementId], references: [agreement.id] }),
  actor: one(actor, { fields: [reputationFeedback.actorId], references: [actor.id] }),
}));
