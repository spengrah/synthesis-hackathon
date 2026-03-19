import { BonfiresClient } from "../client.js";
import { UuidRegistry } from "../uuid-registry.js";
import { fetchPonderSnapshot, type PonderSnapshot, type PonderTypedEntities } from "./queries.js";
import {
  buildAgreementEntity,
  buildActorEntity,
  buildProposalEntity,
  buildTrustZoneEntity,
  buildClaimEntity,
  buildFeedbackEntity,
  buildTypedEntity,
  type TypedEntityKind,
} from "./entities.js";
import {
  agreementZoneEdge,
  partyOfEdge,
  operatesEdge,
  proposalInEdge,
  proposedByEdge,
  deployedEntityEdge,
  proposedEntityEdge,
  claimInEdge,
  filedByEdge,
  feedbackForEdge,
  feedbackInEdge,
  type EdgeContext,
} from "./edges.js";
import {
  stateTransitionEpisode,
  proposalEpisode,
  claimFiledEpisode,
  adjudicationEpisode,
  agreementClosedEpisode,
} from "./episodes.js";
import { Differ, type SyncChangeset } from "./differ.js";
import type { CreateEdgeRequest } from "../types.js";

// ─── Sync orchestrator ──────────────────────────────────────────

async function syncEntities(
  client: BonfiresClient,
  registry: UuidRegistry,
  snapshot: PonderSnapshot,
) {
  // 1. Actors — collect unique actors from all agreements
  const actors = new Map<string, { id: string; address: string; agentId?: string }>();
  for (const agr of snapshot.agreements) {
    for (const party of agr.agreementParties.items) {
      actors.set(party.actor.id, party.actor);
    }
    for (const prop of agr.proposals.items) {
      actors.set(prop.proposer.id, prop.proposer);
    }
    for (const zone of agr.trustZones.items) {
      actors.set(zone.actor.id, zone.actor);
    }
    for (const claim of agr.claims.items) {
      actors.set(claim.claimant.id, claim.claimant);
    }
    for (const fb of agr.reputationFeedbacks.items) {
      if (fb.actor) actors.set(fb.actor.id, fb.actor);
    }
  }
  for (const actor of actors.values()) {
    await registry.ensureEntity(client, buildActorEntity(actor));
  }

  // 2. Agreements
  for (const agr of snapshot.agreements) {
    await registry.ensureEntity(client, buildAgreementEntity(agr));
  }

  // 3. Proposals
  for (const agr of snapshot.agreements) {
    for (const prop of agr.proposals.items) {
      await registry.ensureEntity(client, buildProposalEntity(prop, agr.id));
    }
  }

  // 4. Trust Zones
  for (const agr of snapshot.agreements) {
    for (const zone of agr.trustZones.items) {
      await registry.ensureEntity(client, buildTrustZoneEntity(zone, agr.id));
    }
  }

  // 5. Typed entities
  for (const agr of snapshot.agreements) {
    const typed = snapshot.typedEntities.get(agr.id);
    if (!typed) continue;

    const kinds: [keyof PonderTypedEntities, TypedEntityKind][] = [
      ["permissions", "Permission"],
      ["responsibilitys", "Responsibility"],
      ["directives", "Directive"],
      ["constraints", "Constraint"],
      ["eligibilitys", "Eligibility"],
      ["incentives", "Incentive"],
      ["decisionModels", "DecisionModel"],
      ["principalAlignments", "PrincipalAlignment"],
    ];

    for (const [key, kind] of kinds) {
      for (const entity of typed[key].items) {
        await registry.ensureEntity(client, buildTypedEntity(kind, entity));
      }
    }
  }

  // 6. Claims
  for (const agr of snapshot.agreements) {
    for (const claim of agr.claims.items) {
      await registry.ensureEntity(client, buildClaimEntity(claim, agr.id));
    }
  }

  // 7. Reputation feedback
  for (const agr of snapshot.agreements) {
    for (const fb of agr.reputationFeedbacks.items) {
      await registry.ensureEntity(client, buildFeedbackEntity(fb, agr.id));
    }
  }
}

async function syncEdges(
  client: BonfiresClient,
  registry: UuidRegistry,
  snapshot: PonderSnapshot,
) {
  const ctx: EdgeContext = { registry, groupId: client.bonfireId };
  const edges: (CreateEdgeRequest | null)[] = [];

  for (const agr of snapshot.agreements) {
    // Agreement ↔ parties
    for (const party of agr.agreementParties.items) {
      edges.push(partyOfEdge(ctx, party.actor.id, agr.id));
    }

    // Agreement ↔ zones
    for (const zone of agr.trustZones.items) {
      edges.push(agreementZoneEdge(ctx, agr.id, zone.id));
      edges.push(operatesEdge(ctx, zone.actorId, zone.id));
    }

    // Agreement ↔ proposals
    for (const prop of agr.proposals.items) {
      edges.push(proposalInEdge(ctx, prop.id, agr.id));
      edges.push(proposedByEdge(ctx, prop.id, prop.proposer.id));
    }

    // Agreement ↔ claims
    for (const claim of agr.claims.items) {
      edges.push(claimInEdge(ctx, claim.id, agr.id));
      edges.push(filedByEdge(ctx, claim.id, claim.claimant.id));
    }

    // Agreement ↔ feedback
    for (const fb of agr.reputationFeedbacks.items) {
      edges.push(feedbackInEdge(ctx, fb.id, agr.id));
      if (fb.actor) {
        edges.push(feedbackForEdge(ctx, fb.id, fb.actor.id));
      }
    }

    // Typed entity edges
    const typed = snapshot.typedEntities.get(agr.id);
    if (!typed) continue;

    const kinds: [keyof PonderTypedEntities, TypedEntityKind][] = [
      ["permissions", "Permission"],
      ["responsibilitys", "Responsibility"],
      ["directives", "Directive"],
      ["constraints", "Constraint"],
      ["eligibilitys", "Eligibility"],
      ["incentives", "Incentive"],
      ["decisionModels", "DecisionModel"],
      ["principalAlignments", "PrincipalAlignment"],
    ];

    for (const [key, kind] of kinds) {
      for (const entity of typed[key].items) {
        if (entity.trustZoneId) {
          edges.push(deployedEntityEdge(ctx, kind, entity.id, entity.trustZoneId));
        }
        if (entity.proposalId) {
          edges.push(proposedEntityEdge(ctx, kind, entity.id, entity.proposalId));
        }
      }
    }
  }

  // Create all edges (skip nulls — missing UUIDs)
  for (const e of edges) {
    if (!e) continue;
    try {
      await client.createEdge(e);
    } catch (err) {
      // Edges may already exist — Bonfires should deduplicate, but log just in case
      console.warn(`[bonfires-sync] edge warning: ${(err as Error).message}`);
    }
  }
}

async function syncEpisodes(
  client: BonfiresClient,
  snapshot: PonderSnapshot,
  changes: SyncChangeset,
) {
  const bonfireId = client.bonfireId;

  // State transitions
  for (const st of changes.stateTransitions) {
    try {
      await client.createEpisode(
        stateTransitionEpisode(bonfireId, st.agreementId, st.fromState, st.toState, st.timestamp),
      );
    } catch (err) {
      console.warn(`[bonfires-sync] episode warning: ${(err as Error).message}`);
    }
  }

  // New proposals
  if (changes.isFullSync) {
    for (const agr of snapshot.agreements) {
      for (const prop of agr.proposals.items) {
        try {
          await client.createEpisode(
            proposalEpisode(bonfireId, prop.id, agr.id, prop.proposer.address, prop.sequence, prop.timestamp),
          );
        } catch (err) {
          console.warn(`[bonfires-sync] episode warning: ${(err as Error).message}`);
        }
      }
    }
  }

  // New claims
  for (const agr of snapshot.agreements) {
    for (const claim of agr.claims.items) {
      if (changes.newClaimIds.has(claim.id)) {
        try {
          await client.createEpisode(
            claimFiledEpisode(bonfireId, claim.id, agr.id, claim.claimant.address, claim.timestamp),
          );
        } catch (err) {
          console.warn(`[bonfires-sync] episode warning: ${(err as Error).message}`);
        }
      }

      // Adjudicated claims
      if (changes.adjudicatedClaimIds.has(claim.id) && claim.adjudicatedAt) {
        try {
          await client.createEpisode(
            adjudicationEpisode(bonfireId, claim.id, agr.id, claim.verdict!, claim.actionTypes, claim.adjudicatedAt),
          );
        } catch (err) {
          console.warn(`[bonfires-sync] episode warning: ${(err as Error).message}`);
        }
      }
    }
  }

  // Closed agreements
  for (const agr of snapshot.agreements) {
    if (changes.closedAgreementIds.has(agr.id) && agr.closedAt && agr.outcome) {
      try {
        await client.createEpisode(
          agreementClosedEpisode(bonfireId, agr.id, agr.outcome, agr.closedAt),
        );
      } catch (err) {
        console.warn(`[bonfires-sync] episode warning: ${(err as Error).message}`);
      }
    }
  }
}

// ─── Main loop ──────────────────────────────────────────────────

export interface SyncConfig {
  ponderUrl: string;
  bonfiresUrl: string;
  apiKey: string;
  bonfireId: string;
  agentId?: string;
  pollIntervalMs?: number;
  uuidFilePath?: string;
}

export async function startSync(config: SyncConfig): Promise<{ stop: () => void }> {
  const client = new BonfiresClient({
    apiUrl: config.bonfiresUrl,
    apiKey: config.apiKey,
    bonfireId: config.bonfireId,
    agentId: config.agentId,
  });
  const registry = new UuidRegistry(config.uuidFilePath ?? ".bonfires-uuids.json");
  await registry.load();

  const differ = new Differ();
  let running = true;
  const pollInterval = config.pollIntervalMs ?? 10_000;

  async function tick() {
    try {
      const snapshot = await fetchPonderSnapshot(config.ponderUrl);
      const changes = differ.diff(snapshot);

      const entityCount = snapshot.agreements.length;
      if (entityCount === 0) {
        return; // Nothing to sync
      }

      console.log(
        `[bonfires-sync] tick: ${entityCount} agreements, ` +
        `${changes.newAgreementIds.size} new, ` +
        `${changes.stateTransitions.length} state changes, ` +
        `${changes.newClaimIds.size} new claims`,
      );

      await syncEntities(client, registry, snapshot);
      await syncEdges(client, registry, snapshot);
      await syncEpisodes(client, snapshot, changes);
      await registry.save();
    } catch (err) {
      console.error("[bonfires-sync] tick error:", err);
    }
  }

  const loop = async () => {
    while (running) {
      await tick();
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  };

  loop();

  return {
    stop: () => {
      running = false;
    },
  };
}

// ─── CLI entry point ────────────────────────────────────────────

const isMain = process.argv[1]?.endsWith("sync/index.ts") || process.argv[1]?.endsWith("sync/index.js");
if (isMain) {
  const config: SyncConfig = {
    ponderUrl: process.env.PONDER_URL ?? "http://localhost:42069/graphql",
    bonfiresUrl: process.env.BONFIRES_API_URL ?? "",
    apiKey: process.env.BONFIRES_API_KEY ?? "",
    bonfireId: process.env.BONFIRES_BONFIRE_ID ?? "",
    agentId: process.env.BONFIRES_AGENT_ID,
    pollIntervalMs: Number(process.env.SYNC_POLL_INTERVAL_MS ?? "10000"),
  };

  if (!config.bonfiresUrl || !config.apiKey || !config.bonfireId) {
    console.error("Missing required env vars: BONFIRES_API_URL, BONFIRES_API_KEY, BONFIRES_BONFIRE_ID");
    process.exit(1);
  }

  console.log(`[bonfires-sync] Starting sync service`);
  console.log(`  Ponder: ${config.ponderUrl}`);
  console.log(`  Bonfires: ${config.bonfiresUrl}`);
  console.log(`  Bonfire ID: ${config.bonfireId}`);
  console.log(`  Poll interval: ${config.pollIntervalMs}ms`);

  const { stop } = await startSync(config);

  process.on("SIGINT", () => {
    console.log("[bonfires-sync] Stopping...");
    stop();
    process.exit(0);
  });
}
