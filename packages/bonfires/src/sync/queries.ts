// ─── Ponder GraphQL queries for the sync service ────────────────

async function gql<T>(ponderUrl: string, query: string): Promise<T> {
  const res = await fetch(ponderUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
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

// ─── Query 1: Agreements with nested core data ──────────────────

const AGREEMENTS_QUERY = `{
  agreements {
    items {
      id state outcome termsHash termsUri adjudicator deadline
      agreementHatId createdAt setUpAt activatedAt closedAt
      partyACompleted partyBCompleted partyAExited partyBExited
      agreementParties {
        items { actorId partyIndex actor { id address agentId } }
      }
      proposals {
        items {
          id sequence proposerId termsHash termsDocUri
          adjudicator deadline zoneCount timestamp
          proposer { id address }
        }
      }
      trustZones {
        items {
          id hatId zoneIndex active actorId createdAt
          actor { id address agentId }
        }
      }
      claims {
        items {
          id mechanismIndex evidence verdict actionTypes
          timestamp adjudicatedAt
          claimant { id address }
        }
      }
      reputationFeedbacks {
        items {
          id actorId tag feedbackURI feedbackHash timestamp
          actor { id address }
        }
      }
    }
  }
}`;

// ─── Query 2: Typed entities for a given agreement ──────────────

function typedEntitiesQuery(agreementId: string): string {
  const where = `where: { agreementId: "${agreementId}" }`;
  return `{
    permissions(${where}) {
      items { id agreementId proposalId trustZoneId resourceTokenId zoneIndex resource value period expiry params createdAt }
    }
    responsibilitys(${where}) {
      items { id agreementId proposalId trustZoneId resourceTokenId zoneIndex obligation criteria deadline createdAt }
    }
    directives(${where}) {
      items { id agreementId proposalId trustZoneId resourceTokenId zoneIndex rule severity params createdAt }
    }
    constraints(${where}) {
      items { id agreementId proposalId trustZoneId zoneIndex module moduleKind data createdAt }
    }
    eligibilitys(${where}) {
      items { id agreementId proposalId trustZoneId zoneIndex module moduleKind data createdAt }
    }
    incentives(${where}) {
      items { id agreementId proposalId trustZoneId zoneIndex incentiveType module moduleKind data createdAt }
    }
    decisionModels(${where}) {
      items { id agreementId proposalId trustZoneId zoneIndex module moduleKind data createdAt }
    }
    principalAlignments(${where}) {
      items { id agreementId proposalId trustZoneId zoneIndex module moduleKind data createdAt }
    }
  }`;
}

// ─── Types for Ponder snapshot ──────────────────────────────────

export interface PonderActor {
  id: string;
  address: string;
  agentId?: string;
}

export interface PonderProposal {
  id: string;
  sequence: number;
  proposerId: string;
  termsHash: string;
  termsDocUri?: string;
  adjudicator?: string;
  deadline?: string;
  zoneCount?: number;
  timestamp: string;
  proposer: PonderActor;
}

export interface PonderTrustZone {
  id: string;
  hatId: string;
  zoneIndex: number;
  active: boolean;
  actorId: string;
  createdAt: string;
  actor: PonderActor;
}

export interface PonderClaim {
  id: string;
  mechanismIndex: string;
  evidence: string;
  verdict: boolean | null;
  actionTypes: string | null;
  timestamp: string;
  adjudicatedAt: string | null;
  claimant: PonderActor;
}

export interface PonderFeedback {
  id: string;
  actorId: string | null;
  tag: string;
  feedbackURI: string;
  feedbackHash: string;
  timestamp: string;
  actor: PonderActor | null;
}

export interface PonderAgreement {
  id: string;
  state: string;
  outcome: string | null;
  termsHash: string | null;
  termsUri: string | null;
  adjudicator: string | null;
  deadline: string | null;
  agreementHatId: string;
  createdAt: string;
  setUpAt: string | null;
  activatedAt: string | null;
  closedAt: string | null;
  partyACompleted: boolean;
  partyBCompleted: boolean;
  partyAExited: boolean;
  partyBExited: boolean;
  agreementParties: { items: { actorId: string; partyIndex: number; actor: PonderActor }[] };
  proposals: { items: PonderProposal[] };
  trustZones: { items: PonderTrustZone[] };
  claims: { items: PonderClaim[] };
  reputationFeedbacks: { items: PonderFeedback[] };
}

export interface PonderTypedEntity {
  id: string;
  agreementId: string;
  proposalId: string | null;
  trustZoneId: string | null;
  zoneIndex: number;
  createdAt: string;
  [key: string]: unknown;
}

export interface PonderTypedEntities {
  permissions: { items: PonderTypedEntity[] };
  responsibilitys: { items: PonderTypedEntity[] };
  directives: { items: PonderTypedEntity[] };
  constraints: { items: PonderTypedEntity[] };
  eligibilitys: { items: PonderTypedEntity[] };
  incentives: { items: PonderTypedEntity[] };
  decisionModels: { items: PonderTypedEntity[] };
  principalAlignments: { items: PonderTypedEntity[] };
}

export interface PonderSnapshot {
  agreements: PonderAgreement[];
  /** Typed entities keyed by agreement ID */
  typedEntities: Map<string, PonderTypedEntities>;
}

// ─── Fetch functions ────────────────────────────────────────────

export async function fetchPonderSnapshot(ponderUrl: string): Promise<PonderSnapshot> {
  const { agreements: agData } = await gql<{
    agreements: { items: PonderAgreement[] };
  }>(ponderUrl, AGREEMENTS_QUERY);

  const agreements = agData.items;
  const typedEntities = new Map<string, PonderTypedEntities>();

  for (const agr of agreements) {
    const typed = await gql<PonderTypedEntities>(
      ponderUrl,
      typedEntitiesQuery(agr.id),
    );
    typedEntities.set(agr.id, typed);
  }

  return { agreements, typedEntities };
}
