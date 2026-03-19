import { EDGE, type CreateEdgeRequest } from "../types.js";
import type { UuidRegistry } from "../uuid-registry.js";

/**
 * Build an edge request. Returns null if either source or target UUID is unknown.
 */
function edge(
  registry: UuidRegistry,
  sourceName: string,
  targetName: string,
  edgeName: string,
  fact: string,
  groupId: string,
): CreateEdgeRequest | null {
  const sourceUuid = registry.get(sourceName);
  const targetUuid = registry.get(targetName);
  if (!sourceUuid || !targetUuid) return null;

  return {
    source_uuid: sourceUuid,
    target_uuid: targetUuid,
    edge_name: edgeName,
    fact,
    group_id: groupId,
  };
}

export interface EdgeContext {
  registry: UuidRegistry;
  groupId: string;
}

// ─── Agreement edges ────────────────────────────────────────────

export function agreementZoneEdge(
  ctx: EdgeContext,
  agreementId: string,
  zoneId: string,
): CreateEdgeRequest | null {
  return edge(ctx.registry, `agreement:${agreementId}`, `zone:${zoneId}`, EDGE.HAS_ZONE,
    `Agreement ${agreementId} contains zone ${zoneId}`, ctx.groupId);
}

export function partyOfEdge(
  ctx: EdgeContext,
  actorId: string,
  agreementId: string,
): CreateEdgeRequest | null {
  return edge(ctx.registry, `actor:${actorId}`, `agreement:${agreementId}`, EDGE.PARTY_OF,
    `Actor ${actorId} is a party to agreement ${agreementId}`, ctx.groupId);
}

export function operatesEdge(
  ctx: EdgeContext,
  actorId: string,
  zoneId: string,
): CreateEdgeRequest | null {
  return edge(ctx.registry, `actor:${actorId}`, `zone:${zoneId}`, EDGE.OPERATES,
    `Actor ${actorId} operates zone ${zoneId}`, ctx.groupId);
}

// ─── Proposal edges ─────────────────────────────────────────────

export function proposalInEdge(
  ctx: EdgeContext,
  proposalId: string,
  agreementId: string,
): CreateEdgeRequest | null {
  return edge(ctx.registry, `proposal:${proposalId}`, `agreement:${agreementId}`, EDGE.PROPOSAL_IN,
    `Proposal ${proposalId} submitted in agreement ${agreementId}`, ctx.groupId);
}

export function proposedByEdge(
  ctx: EdgeContext,
  proposalId: string,
  actorId: string,
): CreateEdgeRequest | null {
  return edge(ctx.registry, `proposal:${proposalId}`, `actor:${actorId}`, EDGE.PROPOSED_BY,
    `Proposal ${proposalId} submitted by actor ${actorId}`, ctx.groupId);
}

// ─── Typed entity edges (deployed) ──────────────────────────────

const HOLDS_EDGES: Record<string, string> = {
  permission: EDGE.HOLDS_PERMISSION,
  responsibility: EDGE.HOLDS_RESPONSIBILITY,
  directive: EDGE.HOLDS_DIRECTIVE,
};

const HAS_EDGES: Record<string, string> = {
  constraint: EDGE.HAS_CONSTRAINT,
  eligibility: EDGE.HAS_ELIGIBILITY,
  incentive: EDGE.HAS_INCENTIVE,
  decisionModel: EDGE.HAS_DECISION_MODEL,
  principalAlignment: EDGE.HAS_PRINCIPAL_ALIGNMENT,
};

export function deployedEntityEdge(
  ctx: EdgeContext,
  kind: string,
  entityId: string,
  zoneId: string,
): CreateEdgeRequest | null {
  const kindLower = kind.charAt(0).toLowerCase() + kind.slice(1);
  const edgeName = HOLDS_EDGES[kindLower] ?? HAS_EDGES[kindLower];
  if (!edgeName) return null;

  return edge(ctx.registry, `zone:${zoneId}`, `${kindLower}:${entityId}`, edgeName,
    `Zone ${zoneId} holds ${kindLower} ${entityId}`, ctx.groupId);
}

// ─── Typed entity edges (proposed) ──────────────────────────────

export function proposedEntityEdge(
  ctx: EdgeContext,
  kind: string,
  entityId: string,
  proposalId: string,
): CreateEdgeRequest | null {
  const kindLower = kind.charAt(0).toLowerCase() + kind.slice(1);
  return edge(ctx.registry, `${kindLower}:${entityId}`, `proposal:${proposalId}`, EDGE.PROPOSED_IN,
    `${kind} ${entityId} proposed in proposal ${proposalId}`, ctx.groupId);
}

// ─── Claim edges ────────────────────────────────────────────────

export function claimInEdge(
  ctx: EdgeContext,
  claimId: string,
  agreementId: string,
): CreateEdgeRequest | null {
  return edge(ctx.registry, `claim:${claimId}`, `agreement:${agreementId}`, EDGE.CLAIM_IN,
    `Claim ${claimId} filed in agreement ${agreementId}`, ctx.groupId);
}

export function filedByEdge(
  ctx: EdgeContext,
  claimId: string,
  actorId: string,
): CreateEdgeRequest | null {
  return edge(ctx.registry, `claim:${claimId}`, `actor:${actorId}`, EDGE.FILED_BY,
    `Claim ${claimId} filed by actor ${actorId}`, ctx.groupId);
}

// ─── Feedback edges ─────────────────────────────────────────────

export function feedbackForEdge(
  ctx: EdgeContext,
  feedbackId: string,
  actorId: string,
): CreateEdgeRequest | null {
  return edge(ctx.registry, `feedback:${feedbackId}`, `actor:${actorId}`, EDGE.FEEDBACK_FOR,
    `Feedback ${feedbackId} is about actor ${actorId}`, ctx.groupId);
}

export function feedbackInEdge(
  ctx: EdgeContext,
  feedbackId: string,
  agreementId: string,
): CreateEdgeRequest | null {
  return edge(ctx.registry, `feedback:${feedbackId}`, `agreement:${agreementId}`, EDGE.FEEDBACK_IN,
    `Feedback ${feedbackId} is from agreement ${agreementId}`, ctx.groupId);
}
