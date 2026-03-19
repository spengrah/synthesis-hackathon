import { ENTITY_LABELS, type CreateEntityRequest } from "../types.js";
import type {
  PonderAgreement,
  PonderActor,
  PonderProposal,
  PonderTrustZone,
  PonderClaim,
  PonderFeedback,
  PonderTypedEntity,
} from "./queries.js";

// ─── Helpers ────────────────────────────────────────────────────

/** Convert bigint strings to plain strings, drop nulls */
function clean(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    out[k] = typeof v === "bigint" ? v.toString() : v;
  }
  return out;
}

// ─── Core entities ──────────────────────────────────────────────

export function buildAgreementEntity(agr: PonderAgreement): CreateEntityRequest {
  const parties = agr.agreementParties.items
    .sort((a, b) => a.partyIndex - b.partyIndex)
    .map((p) => p.actor.address);

  return {
    name: `agreement:${agr.id}`,
    labels: [...ENTITY_LABELS.Agreement],
    summary: `Agreement ${agr.id} between ${parties[0] ?? "?"} and ${parties[1] ?? "?"}. State: ${agr.state}.${agr.termsUri ? ` Terms: ${agr.termsUri}.` : ""}`,
    attributes: clean({
      state: agr.state,
      outcome: agr.outcome,
      termsHash: agr.termsHash,
      termsUri: agr.termsUri,
      adjudicator: agr.adjudicator,
      deadline: agr.deadline,
      agreementHatId: agr.agreementHatId,
      createdAt: agr.createdAt,
      setUpAt: agr.setUpAt,
      activatedAt: agr.activatedAt,
      closedAt: agr.closedAt,
    }),
  };
}

export function buildActorEntity(actor: PonderActor): CreateEntityRequest {
  return {
    name: `actor:${actor.id}`,
    labels: [...ENTITY_LABELS.Actor],
    summary: `Actor ${actor.address}.${actor.agentId ? ` Agent ID: ${actor.agentId}.` : ""}`,
    attributes: clean({
      address: actor.address,
      agentId: actor.agentId,
    }),
  };
}

export function buildProposalEntity(
  prop: PonderProposal,
  agreementId: string,
): CreateEntityRequest {
  return {
    name: `proposal:${prop.id}`,
    labels: [...ENTITY_LABELS.Proposal],
    summary: `Proposal #${prop.sequence} in agreement ${agreementId}. Proposed by ${prop.proposer.address}.${prop.termsDocUri ? ` Terms: ${prop.termsDocUri}.` : ""}`,
    attributes: clean({
      termsHash: prop.termsHash,
      termsDocUri: prop.termsDocUri,
      adjudicator: prop.adjudicator,
      deadline: prop.deadline,
      zoneCount: prop.zoneCount,
      sequence: prop.sequence,
      timestamp: prop.timestamp,
    }),
  };
}

export function buildTrustZoneEntity(
  zone: PonderTrustZone,
  agreementId: string,
): CreateEntityRequest {
  return {
    name: `zone:${zone.id}`,
    labels: [...ENTITY_LABELS.TrustZone],
    summary: `Trust Zone ${zone.id} in agreement ${agreementId}. Operated by ${zone.actor.address}. Active: ${zone.active}.`,
    attributes: clean({
      hatId: zone.hatId,
      zoneIndex: zone.zoneIndex,
      active: zone.active,
      createdAt: zone.createdAt,
    }),
  };
}

export function buildClaimEntity(
  claim: PonderClaim,
  agreementId: string,
): CreateEntityRequest {
  return {
    name: `claim:${claim.id}`,
    labels: [...ENTITY_LABELS.Claim],
    summary: `Claim ${claim.id} in agreement ${agreementId}. Filed by ${claim.claimant.address}. Verdict: ${claim.verdict ?? "pending"}.`,
    attributes: clean({
      mechanismIndex: claim.mechanismIndex,
      evidence: claim.evidence,
      verdict: claim.verdict,
      actionTypes: claim.actionTypes,
      timestamp: claim.timestamp,
      adjudicatedAt: claim.adjudicatedAt,
    }),
  };
}

export function buildFeedbackEntity(
  fb: PonderFeedback,
  agreementId: string,
): CreateEntityRequest {
  return {
    name: `feedback:${fb.id}`,
    labels: [...ENTITY_LABELS.ReputationFeedback],
    summary: `Reputation feedback for agent ${fb.actor?.address ?? fb.actorId ?? "unknown"} in agreement ${agreementId}. Tag: ${fb.tag}.`,
    attributes: clean({
      tag: fb.tag,
      feedbackURI: fb.feedbackURI,
      feedbackHash: fb.feedbackHash,
      timestamp: fb.timestamp,
    }),
  };
}

// ─── Typed entities (resources + mechanisms) ────────────────────

type TypedEntityKind =
  | "Permission"
  | "Responsibility"
  | "Directive"
  | "Constraint"
  | "Eligibility"
  | "Incentive"
  | "DecisionModel"
  | "PrincipalAlignment";

const TYPED_LABELS: Record<TypedEntityKind, string[]> = {
  Permission: ENTITY_LABELS.Permission as unknown as string[],
  Responsibility: ENTITY_LABELS.Responsibility as unknown as string[],
  Directive: ENTITY_LABELS.Directive as unknown as string[],
  Constraint: ENTITY_LABELS.Constraint as unknown as string[],
  Eligibility: ENTITY_LABELS.Eligibility as unknown as string[],
  Incentive: ENTITY_LABELS.Incentive as unknown as string[],
  DecisionModel: ENTITY_LABELS.DecisionModel as unknown as string[],
  PrincipalAlignment: ENTITY_LABELS.PrincipalAlignment as unknown as string[],
};

/** Field names to include as attributes per entity kind (intrinsic data only) */
const TYPED_FIELDS: Record<TypedEntityKind, string[]> = {
  Permission: ["resource", "value", "period", "expiry", "params", "resourceTokenId"],
  Responsibility: ["obligation", "criteria", "deadline", "resourceTokenId"],
  Directive: ["rule", "severity", "params", "resourceTokenId"],
  Constraint: ["module", "moduleKind", "data"],
  Eligibility: ["module", "moduleKind", "data"],
  Incentive: ["incentiveType", "module", "moduleKind", "data"],
  DecisionModel: ["module", "moduleKind", "data"],
  PrincipalAlignment: ["module", "moduleKind", "data"],
};

const TYPED_SUMMARY: Record<TypedEntityKind, (e: PonderTypedEntity) => string> = {
  Permission: (e) => `Permission for ${e.resource ?? "unknown resource"}. Status: ${e.trustZoneId ? "deployed" : "proposed"}.`,
  Responsibility: (e) => `Responsibility: ${e.obligation ?? "unknown"}. Status: ${e.trustZoneId ? "deployed" : "proposed"}.`,
  Directive: (e) => `Directive: ${e.rule ?? "unknown"}. Severity: ${e.severity ?? "?"}. Status: ${e.trustZoneId ? "deployed" : "proposed"}.`,
  Constraint: (e) => `Constraint mechanism. Module: ${e.module}. Kind: ${e.moduleKind ?? "?"}. Status: ${e.trustZoneId ? "deployed" : "proposed"}.`,
  Eligibility: (e) => `Eligibility mechanism. Module: ${e.module}. Kind: ${e.moduleKind ?? "?"}. Status: ${e.trustZoneId ? "deployed" : "proposed"}.`,
  Incentive: (e) => `${e.incentiveType ?? "Incentive"} mechanism. Module: ${e.module}. Kind: ${e.moduleKind ?? "?"}. Status: ${e.trustZoneId ? "deployed" : "proposed"}.`,
  DecisionModel: (e) => `Decision model mechanism. Module: ${e.module}. Kind: ${e.moduleKind ?? "?"}. Status: ${e.trustZoneId ? "deployed" : "proposed"}.`,
  PrincipalAlignment: (e) => `Principal alignment mechanism. Module: ${e.module}. Kind: ${e.moduleKind ?? "?"}. Status: ${e.trustZoneId ? "deployed" : "proposed"}.`,
};

export function buildTypedEntity(
  kind: TypedEntityKind,
  entity: PonderTypedEntity,
): CreateEntityRequest {
  const prefix = kind.toLowerCase().replace(/([A-Z])/g, (_, c) => `-${c.toLowerCase()}`);
  // Use a simpler prefix: permission, responsibility, directive, constraint, etc.
  const namePrefix = kind.charAt(0).toLowerCase() + kind.slice(1);

  const attrs: Record<string, unknown> = {
    status: entity.trustZoneId ? "deployed" : "proposed",
  };
  for (const field of TYPED_FIELDS[kind]) {
    if (entity[field] != null) {
      attrs[field] = entity[field];
    }
  }

  return {
    name: `${namePrefix}:${entity.id}`,
    labels: [...TYPED_LABELS[kind]],
    summary: TYPED_SUMMARY[kind](entity),
    attributes: clean(attrs),
  };
}

export type { TypedEntityKind };
