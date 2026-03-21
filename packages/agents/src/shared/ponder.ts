import type { Address } from "viem";
import { createPonderBackend, type ReadBackend } from "@trust-zones/sdk";

// ---- GraphQL helper ----

async function gql<T>(
  ponderUrl: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(ponderUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Ponder query failed: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { data: T; errors?: unknown[] };
  if (json.errors?.length) {
    throw new Error(`Ponder query errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

// ---- Custom queries ----

const GET_UNADJUDICATED_CLAIMS = `
query GetUnadjudicatedClaims {
  claims {
    items {
      id
      mechanismIndex
      evidence
      verdict
      actionTypes
      adjudicatedAt
      claimant { address }
      agreement {
        id
        adjudicator
        state
        proposals { items { adjudicator sequence } }
      }
      timestamp
    }
  }
}`;

const GET_ACTIVE_AGREEMENTS_FOR_PARTY = `
query GetActiveAgreements {
  agreements(where: { state: "ACTIVE" }) {
    items {
      id
      state
      adjudicator
      deadline
      termsHash
      termsUri
      agreementParties {
        items {
          actor { address agentId }
          partyIndex
        }
      }
      trustZones {
        items {
          id
          hatId
          zoneIndex
          active
          actor { address }
        }
      }
    }
  }
}`;

const GET_PROPOSED_AGREEMENTS_FOR_PARTY = `
query GetProposedAgreements {
  agreements(where: { state_in: ["PROPOSED", "NEGOTIATING"] }) {
    items {
      id
      state
      adjudicator
      deadline
      termsHash
      termsUri
      agreementParties {
        items {
          actor { address agentId }
          partyIndex
        }
      }
      proposals {
        items {
          sequence
          rawProposalData
          termsHash
          proposer { address }
          timestamp
        }
      }
    }
  }
}`;

export interface UnadjudicatedClaim {
  id: string;
  mechanismIndex: number;
  evidence: string;
  actionTypes: string[] | null;
  adjudicatedAt: string | null;
  claimantAddress: Address;
  agreementAddress: Address;
  adjudicatorAddress: Address;
  agreementState: string;
  timestamp: string;
}

export interface ActiveAgreement {
  id: Address;
  state: string;
  adjudicator: Address;
  deadline: string;
  parties: { address: Address; agentId: string; partyIndex: number }[];
  zones: { id: Address; hatId: string; zoneIndex: number; active: boolean; actorAddress: Address }[];
}

export interface ProposedAgreement {
  id: Address;
  state: string;
  adjudicator: Address;
  deadline: string;
  parties: { address: Address; agentId: string; partyIndex: number }[];
  proposals: {
    sequence: number;
    rawProposalData: string;
    termsHash: string;
    proposerAddress: Address;
    timestamp: string;
  }[];
}

export interface AgentPonderClient extends ReadBackend {
  getUnadjudicatedClaims: (adjudicatorAddress?: Address) => Promise<UnadjudicatedClaim[]>;
  getActiveAgreementsForParty: (partyAddress: Address) => Promise<ActiveAgreement[]>;
  getProposedAgreementsForParty: (partyAddress: Address) => Promise<ProposedAgreement[]>;
}

export function createAgentPonderClient(ponderUrl: string): AgentPonderClient {
  const backend = createPonderBackend(ponderUrl);

  async function getUnadjudicatedClaims(
    adjudicatorAddress?: Address,
  ): Promise<UnadjudicatedClaim[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await gql<any>(ponderUrl, GET_UNADJUDICATED_CLAIMS);
    const items = data.claims?.items ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((c: any) => {
        // Only unadjudicated claims (verdict is null)
        if (c.verdict !== null) return false;
        // Only claims from ACTIVE agreements (skip stale claims from closed/expired agreements)
        if (c.agreement?.state !== "ACTIVE") return false;
        if (!adjudicatorAddress) return true;
        // Check agreement.adjudicator first, fall back to latest proposal's adjudicator
        const agAdj = c.agreement?.adjudicator;
        const proposals = c.agreement?.proposals?.items ?? [];
        const latestProposal = proposals.sort((a: any, b: any) => b.sequence - a.sequence)[0];
        const propAdj = latestProposal?.adjudicator;
        const effectiveAdj = agAdj ?? propAdj;
        return effectiveAdj?.toLowerCase() === adjudicatorAddress.toLowerCase();
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((c: any) => ({
        id: c.id,
        mechanismIndex: c.mechanismIndex,
        evidence: c.evidence,
        actionTypes: c.actionTypes,
        adjudicatedAt: c.adjudicatedAt,
        claimantAddress: c.claimant?.address as Address,
        agreementAddress: c.agreement?.id as Address,
        adjudicatorAddress: (c.agreement?.adjudicator ??
          c.agreement?.proposals?.items?.sort((a: any, b: any) => b.sequence - a.sequence)[0]?.adjudicator) as Address,
        agreementState: c.agreement?.state,
        timestamp: c.timestamp,
      }));
  }

  async function getActiveAgreementsForParty(
    partyAddress: Address,
  ): Promise<ActiveAgreement[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await gql<any>(ponderUrl, GET_ACTIVE_AGREEMENTS_FOR_PARTY, {
      party: partyAddress.toLowerCase(),
    });
    const items = data.agreements?.items ?? [];
    return items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((a: any) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        a.agreementParties?.items?.some((p: any) =>
          p.actor?.address?.toLowerCase() === partyAddress.toLowerCase(),
        ),
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((a: any) => ({
        id: a.id as Address,
        state: a.state,
        adjudicator: a.adjudicator as Address,
        deadline: a.deadline,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parties: (a.agreementParties?.items ?? []).map((p: any) => ({
          address: p.actor.address as Address,
          agentId: p.actor.agentId,
          partyIndex: p.partyIndex,
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        zones: (a.trustZones?.items ?? []).map((z: any) => ({
          id: z.id as Address,
          hatId: z.hatId,
          zoneIndex: z.zoneIndex,
          active: z.active,
          actorAddress: z.actor?.address as Address,
        })),
      }));
  }

  async function getProposedAgreementsForParty(
    partyAddress: Address,
  ): Promise<ProposedAgreement[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await gql<any>(ponderUrl, GET_PROPOSED_AGREEMENTS_FOR_PARTY);
    const items = data.agreements?.items ?? [];
    return items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((a: any) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        a.agreementParties?.items?.some((p: any) =>
          p.actor?.address?.toLowerCase() === partyAddress.toLowerCase(),
        ),
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((a: any) => ({
        id: a.id as Address,
        state: a.state,
        adjudicator: a.adjudicator as Address,
        deadline: a.deadline,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parties: (a.agreementParties?.items ?? []).map((p: any) => ({
          address: p.actor.address as Address,
          agentId: p.actor.agentId,
          partyIndex: p.partyIndex,
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        proposals: (a.proposals?.items ?? []).map((p: any) => ({
          sequence: p.sequence,
          rawProposalData: p.rawProposalData,
          termsHash: p.termsHash,
          proposerAddress: p.proposer?.address as Address,
          timestamp: p.timestamp,
        })),
      }));
  }

  return {
    ...backend,
    getUnadjudicatedClaims,
    getActiveAgreementsForParty,
    getProposedAgreementsForParty,
  };
}
