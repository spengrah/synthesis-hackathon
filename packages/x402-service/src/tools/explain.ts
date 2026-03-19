import type { Address } from "viem";

const PONDER_URL = process.env.PONDER_URL || "http://localhost:42069";

const EXPLAIN_QUERY = `
  query Explain($id: String!) {
    agreement(id: $id) {
      id
      state
      outcome
      deadline
      termsUri
      createdAt
      activatedAt
      closedAt
      agreementParties {
        items {
          actor { id address agentId }
          partyIndex
        }
      }
      trustZones {
        items {
          id
          active
          zoneIndex
          txHash
          actor { address agentId }
          permissions { items { resource value period expiry } }
          responsibilities { items { obligation criteria } }
          directives { items { rule severity } }
        }
      }
      claims {
        items {
          id
          verdict
          actionTypes
          txHash
          timestamp
          adjudicatedAt
        }
      }
      reputationFeedback {
        items {
          actorId
          tag
          txHash
        }
      }
    }
  }
`;

export async function handleExplain(args: {
  agreement: Address;
}): Promise<Record<string, unknown>> {
  const res = await fetch(PONDER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: EXPLAIN_QUERY,
      variables: { id: args.agreement.toLowerCase() },
    }),
  });

  if (!res.ok) {
    throw new Error(`Ponder query failed: ${res.status}`);
  }

  const json = (await res.json()) as { data?: { agreement?: Record<string, unknown> } };
  const agreement = json.data?.agreement;

  if (!agreement) {
    return { error: `Agreement ${args.agreement} not found` };
  }

  return agreement;
}
