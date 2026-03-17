import type { Address, Hex } from "viem";
import type {
  AgreementState,
  ClaimSummary,
  ParsedDirective,
  ParsedPermission,
  ProposalSummary,
  ReadBackend,
  ZoneDetails,
} from "../types.js";

// ---- GraphQL query strings ----

const GET_AGREEMENT_STATE = `
query GetAgreementState($id: String!) {
  agreement(id: $id) {
    state
    outcome
    termsHash
    termsUri
    adjudicator
    deadline
    agreementHatId
    activatedAt
    closedAt
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
      }
    }
    claims {
      items {
        id
        mechanismIndex
        claimant { address }
        verdict
        actionTypes
        timestamp
        adjudicatedAt
      }
    }
  }
}`;

const GET_ZONE_DETAILS = `
query GetZoneDetails($id: String!) {
  trustZone(id: $id) {
    id
    hatId
    zoneIndex
    active
    actor { address }
    permissions { items { resourceToken { id } resource rateLimit expiry purpose } }
    responsibilities { items { resourceToken { id } obligation criteria deadline } }
    directives { items { resourceToken { id } rule severity params } }
    constraints { items { module } }
  }
}`;

const GET_ZONE_PERMISSIONS = `
query GetZonePermissions($id: String!) {
  trustZone(id: $id) {
    permissions { items { resourceToken { id } resource rateLimit expiry purpose } }
  }
}`;

const GET_ZONE_DIRECTIVES = `
query GetZoneDirectives($id: String!) {
  trustZone(id: $id) {
    directives { items { resourceToken { id } rule severity params } }
  }
}`;

const GET_PROPOSAL_HISTORY = `
query GetProposalHistory($id: String!) {
  agreement(id: $id) {
    proposals {
      items {
        sequence
        proposer { address }
        termsHash
        termsDocUri
        adjudicator
        deadline
        zoneCount
        timestamp
      }
    }
  }
}`;

const GET_CLAIMS = `
query GetClaims($id: String!) {
  agreement(id: $id) {
    claims {
      items {
        id
        mechanismIndex
        claimant { address }
        verdict
        actionTypes
        timestamp
        adjudicatedAt
      }
    }
  }
}`;

// ---- GraphQL client helper ----

async function gql<T>(
  ponderUrl: string,
  query: string,
  variables: Record<string, unknown>,
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

// ---- Ponder backend ----

export function createPonderBackend(ponderUrl: string): ReadBackend {
  async function getAgreementState(
    agreement: Address,
  ): Promise<AgreementState> {
    const id = agreement.toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await gql<any>(ponderUrl, GET_AGREEMENT_STATE, { id });
    const a = data.agreement;

    // Sort parties by index
    const sortedParties = [...a.agreementParties.items].sort(
      (x: { partyIndex: number }, y: { partyIndex: number }) =>
        x.partyIndex - y.partyIndex,
    );

    // Sort zones by index
    const sortedZones = [...a.trustZones.items].sort(
      (x: { zoneIndex: number }, y: { zoneIndex: number }) =>
        x.zoneIndex - y.zoneIndex,
    );

    return {
      currentState: a.state,
      outcome: a.outcome ?? null,
      parties: [
        sortedParties[0]?.actor.address,
        sortedParties[1]?.actor.address,
      ] as [Address, Address],
      agentIds: [
        BigInt(sortedParties[0]?.actor.agentId ?? 0),
        BigInt(sortedParties[1]?.actor.agentId ?? 0),
      ] as [bigint, bigint],
      termsHash: a.termsHash as Hex,
      termsUri: a.termsUri,
      adjudicator: a.adjudicator as Address,
      deadline: BigInt(a.deadline ?? 0),
      trustZones: [
        sortedZones[0]?.id ?? "0x0000000000000000000000000000000000000000",
        sortedZones[1]?.id ?? "0x0000000000000000000000000000000000000000",
      ] as [Address, Address],
      zoneHatIds: [
        BigInt(sortedZones[0]?.hatId ?? 0),
        BigInt(sortedZones[1]?.hatId ?? 0),
      ] as [bigint, bigint],
      claimCount: BigInt(a.claims?.items?.length ?? 0),
    };
  }

  async function getZoneDetails(
    zoneAccount: Address,
  ): Promise<ZoneDetails> {
    const id = zoneAccount.toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await gql<any>(ponderUrl, GET_ZONE_DETAILS, { id });
    const z = data.trustZone;

    return {
      address: zoneAccount,
      party: z.actor.address as Address,
      hatId: BigInt(z.hatId),
      zoneIndex: z.zoneIndex,
      active: z.active,
      permissions: parsePermissions(z.permissions?.items ?? []),
      responsibilities: (z.responsibilities?.items ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r: any) => ({
          tokenId: BigInt(r.resourceToken?.id ?? 0),
          obligation: r.obligation,
          criteria: r.criteria ?? null,
          deadline: r.deadline ? BigInt(r.deadline) : null,
        }),
      ),
      directives: parseDirectives(z.directives?.items ?? []),
      constraints: (z.constraints?.items ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any) => ({ module: c.module as Address }),
      ),
    };
  }

  async function getZonePermissions(
    zoneAccount: Address,
  ): Promise<ParsedPermission[]> {
    const id = zoneAccount.toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await gql<any>(ponderUrl, GET_ZONE_PERMISSIONS, { id });
    return parsePermissions(data.trustZone.permissions?.items ?? []);
  }

  async function getZoneDirectives(
    zoneAccount: Address,
  ): Promise<ParsedDirective[]> {
    const id = zoneAccount.toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await gql<any>(ponderUrl, GET_ZONE_DIRECTIVES, { id });
    return parseDirectives(data.trustZone.directives?.items ?? []);
  }

  async function getProposalHistory(
    agreement: Address,
  ): Promise<ProposalSummary[]> {
    const id = agreement.toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await gql<any>(ponderUrl, GET_PROPOSAL_HISTORY, { id });
    return (data.agreement.proposals?.items ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => ({
        sequence: p.sequence,
        proposer: p.proposer.address as Address,
        termsHash: p.termsHash as Hex,
        termsDocUri: p.termsDocUri,
        adjudicator: p.adjudicator as Address,
        deadline: BigInt(p.deadline ?? 0),
        zoneCount: p.zoneCount,
        timestamp: BigInt(p.timestamp ?? 0),
      }),
    );
  }

  async function getClaims(agreement: Address): Promise<ClaimSummary[]> {
    const id = agreement.toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await gql<any>(ponderUrl, GET_CLAIMS, { id });
    return parseClaims(data.agreement.claims?.items ?? []);
  }

  async function isHatWearer(
    _wearer: Address,
    _hatId: bigint,
  ): Promise<boolean> {
    // Always fall back to RPC for simple checks
    throw new Error(
      "isHatWearer requires RPC — use the RPC backend for this call",
    );
  }

  async function getResourceTokenBalance(
    _holder: Address,
    _tokenId: bigint,
  ): Promise<bigint> {
    // Always fall back to RPC for simple checks
    throw new Error(
      "getResourceTokenBalance requires RPC — use the RPC backend for this call",
    );
  }

  return {
    getAgreementState,
    getZoneDetails,
    getZonePermissions,
    getZoneDirectives,
    getProposalHistory,
    getClaims,
    isHatWearer,
    getResourceTokenBalance,
  };
}

// ---- Parse helpers ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePermissions(items: any[]): ParsedPermission[] {
  return items.map((p) => ({
    tokenId: BigInt(p.resourceToken?.id ?? 0),
    resource: p.resource,
    rateLimit: p.rateLimit ?? null,
    expiry: p.expiry ? BigInt(p.expiry) : null,
    purpose: p.purpose ?? null,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseDirectives(items: any[]): ParsedDirective[] {
  return items.map((d) => ({
    tokenId: BigInt(d.resourceToken?.id ?? 0),
    rule: d.rule,
    severity: d.severity ?? null,
    params: d.params ?? null,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseClaims(items: any[]): ClaimSummary[] {
  return items.map((c) => {
    // Claim id format: "agreement:claimId"
    const claimIdStr = String(c.id).split(":").pop() ?? "0";
    return {
      claimId: BigInt(claimIdStr),
      mechanismIndex: BigInt(c.mechanismIndex),
      claimant: c.claimant.address as Address,
      verdict: c.verdict ?? null,
      actionTypes: c.actionTypes ?? null,
      timestamp: BigInt(c.timestamp ?? 0),
      adjudicatedAt: c.adjudicatedAt ? BigInt(c.adjudicatedAt) : null,
    };
  });
}
