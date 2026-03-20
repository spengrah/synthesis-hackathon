import type { CreateEpisodeRequest } from "../types.js";

function toIso(timestamp: string | number): string {
  const ts = typeof timestamp === "string" ? Number(timestamp) : timestamp;
  return new Date(ts * 1000).toISOString();
}

function episodeBase(
  bonfireId: string,
  name: string,
  body: Record<string, unknown>,
  timestamp: string | number,
): CreateEpisodeRequest {
  return {
    bonfire_id: bonfireId,
    name,
    episode_body: JSON.stringify(body),
    source: "json",
    source_description: "ponder_indexer",
    reference_time: toIso(timestamp),
  };
}

// ─── State transitions ─────────────────────────────────────────

export function stateTransitionEpisode(
  bonfireId: string,
  agreementId: string,
  fromState: string,
  toState: string,
  timestamp: string,
): CreateEpisodeRequest {
  return episodeBase(
    bonfireId,
    `state-change:${agreementId}:${toState}`,
    {
      type: "state_transition",
      agreement: `agreement:${agreementId}`,
      fromState,
      toState,
      timestamp,
    },
    timestamp,
  );
}

// ─── Proposal submitted ─────────────────────────────────────────

export function proposalEpisode(
  bonfireId: string,
  proposalId: string,
  agreementId: string,
  proposerAddress: string,
  sequence: number,
  timestamp: string,
): CreateEpisodeRequest {
  return episodeBase(
    bonfireId,
    `proposal:${proposalId}`,
    {
      type: "proposal_submitted",
      proposal: `proposal:${proposalId}`,
      agreement: `agreement:${agreementId}`,
      proposer: `actor:${proposerAddress.toLowerCase()}`,
      sequence,
      timestamp,
    },
    timestamp,
  );
}

// ─── Claim filed ────────────────────────────────────────────────

export function claimFiledEpisode(
  bonfireId: string,
  claimId: string,
  agreementId: string,
  claimantAddress: string,
  timestamp: string,
): CreateEpisodeRequest {
  return episodeBase(
    bonfireId,
    `claim-filed:${claimId}`,
    {
      type: "claim_filed",
      claim: `claim:${claimId}`,
      agreement: `agreement:${agreementId}`,
      claimant: `actor:${claimantAddress.toLowerCase()}`,
      timestamp,
    },
    timestamp,
  );
}

// ─── Adjudication delivered ─────────────────────────────────────

export function adjudicationEpisode(
  bonfireId: string,
  claimId: string,
  agreementId: string,
  verdict: boolean,
  actionTypes: string | null,
  timestamp: string,
): CreateEpisodeRequest {
  return episodeBase(
    bonfireId,
    `adjudication:${claimId}`,
    {
      type: "adjudication_delivered",
      claim: `claim:${claimId}`,
      agreement: `agreement:${agreementId}`,
      verdict,
      actionTypes: actionTypes ? JSON.parse(actionTypes) : [],
      timestamp,
    },
    timestamp,
  );
}

// ─── Agreement closed ───────────────────────────────────────────

export function agreementClosedEpisode(
  bonfireId: string,
  agreementId: string,
  outcome: string,
  timestamp: string,
): CreateEpisodeRequest {
  return episodeBase(
    bonfireId,
    `agreement-closed:${agreementId}`,
    {
      type: "agreement_closed",
      agreement: `agreement:${agreementId}`,
      outcome,
      timestamp,
    },
    timestamp,
  );
}
