import { BonfiresClient } from "../client.js";
import { UuidRegistry } from "../uuid-registry.js";
import { fetchPonderSnapshot, type PonderSnapshot, type PonderAgreement, type PonderTypedEntities } from "./queries.js";
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
import type { CreateEdgeRequest, CreateEpisodeRequest } from "../types.js";

// ─── Typed entity kinds ─────────────────────────────────────────

const TYPED_KINDS: [keyof PonderTypedEntities, TypedEntityKind][] = [
  ["permissions", "Permission"],
  ["responsibilitys", "Responsibility"],
  ["directives", "Directive"],
  ["constraints", "Constraint"],
  ["eligibilitys", "Eligibility"],
  ["incentives", "Incentive"],
  ["decisionModels", "DecisionModel"],
  ["principalAlignments", "PrincipalAlignment"],
];

// ─── Sync orchestrator ──────────────────────────────────────────

async function syncEntities(
  client: BonfiresClient,
  registry: UuidRegistry,
  agreements: PonderAgreement[],
  typedEntities: Map<string, PonderTypedEntities>,
) {
  // 1. Actors — collect unique actors from changed agreements
  const actors = new Map<string, { id: string; address: string; agentId?: string }>();
  for (const agr of agreements) {
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
  await Promise.all(
    [...actors.values()].map((a) => registry.ensureEntity(client, buildActorEntity(a))),
  );

  // 2. Agreements
  await Promise.all(
    agreements.map((agr) => registry.ensureEntity(client, buildAgreementEntity(agr))),
  );

  // 3. Proposals
  await Promise.all(
    agreements.flatMap((agr) =>
      agr.proposals.items.map((prop) => registry.ensureEntity(client, buildProposalEntity(prop, agr.id))),
    ),
  );

  // 4. Trust Zones
  await Promise.all(
    agreements.flatMap((agr) =>
      agr.trustZones.items.map((zone) => registry.ensureEntity(client, buildTrustZoneEntity(zone, agr.id))),
    ),
  );

  // 5. Typed entities
  await Promise.all(
    agreements.flatMap((agr) => {
      const typed = typedEntities.get(agr.id);
      if (!typed) return [];
      return TYPED_KINDS.flatMap(([key, kind]) =>
        typed[key].items.map((entity) => registry.ensureEntity(client, buildTypedEntity(kind, entity))),
      );
    }),
  );

  // 6. Claims
  await Promise.all(
    agreements.flatMap((agr) =>
      agr.claims.items.map((claim) => registry.ensureEntity(client, buildClaimEntity(claim, agr.id))),
    ),
  );

  // 7. Reputation feedback
  await Promise.all(
    agreements.flatMap((agr) =>
      agr.reputationFeedbacks.items.map((fb) => registry.ensureEntity(client, buildFeedbackEntity(fb, agr.id))),
    ),
  );
}

async function syncEdges(
  client: BonfiresClient,
  registry: UuidRegistry,
  agreements: PonderAgreement[],
  typedEntities: Map<string, PonderTypedEntities>,
) {
  const ctx: EdgeContext = { registry, groupId: client.bonfireId };
  const edges: (CreateEdgeRequest | null)[] = [];

  for (const agr of agreements) {
    for (const party of agr.agreementParties.items) {
      edges.push(partyOfEdge(ctx, party.actor.id, agr.id));
    }
    for (const zone of agr.trustZones.items) {
      edges.push(agreementZoneEdge(ctx, agr.id, zone.id));
      edges.push(operatesEdge(ctx, zone.actorId, zone.id));
    }
    for (const prop of agr.proposals.items) {
      edges.push(proposalInEdge(ctx, prop.id, agr.id));
      edges.push(proposedByEdge(ctx, prop.id, prop.proposer.id));
    }
    for (const claim of agr.claims.items) {
      edges.push(claimInEdge(ctx, claim.id, agr.id));
      edges.push(filedByEdge(ctx, claim.id, claim.claimant.id));
    }
    for (const fb of agr.reputationFeedbacks.items) {
      edges.push(feedbackInEdge(ctx, fb.id, agr.id));
      if (fb.actor) {
        edges.push(feedbackForEdge(ctx, fb.id, fb.actor.id));
      }
    }

    const typed = typedEntities.get(agr.id);
    if (!typed) continue;

    for (const [key, kind] of TYPED_KINDS) {
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

  await Promise.all(
    edges
      .filter((e): e is CreateEdgeRequest => e !== null)
      .map((e) =>
        registry.ensureEdge(client, e).catch((err) => {
          console.warn(`[bonfires-sync] edge warning: ${(err as Error).message}`);
        }),
      ),
  );
}

async function syncEpisodes(
  client: BonfiresClient,
  snapshot: PonderSnapshot,
  changes: SyncChangeset,
) {
  const bonfireId = client.bonfireId;
  const episodes: CreateEpisodeRequest[] = [];

  // State transitions
  for (const st of changes.stateTransitions) {
    episodes.push(stateTransitionEpisode(bonfireId, st.agreementId, st.fromState, st.toState, st.timestamp));
  }

  // New proposals (on full sync)
  if (changes.isFullSync) {
    for (const agr of snapshot.agreements) {
      for (const prop of agr.proposals.items) {
        episodes.push(proposalEpisode(bonfireId, prop.id, agr.id, prop.proposer.address, prop.sequence, prop.timestamp));
      }
    }
  }

  // New claims + adjudications
  for (const agr of snapshot.agreements) {
    for (const claim of agr.claims.items) {
      if (changes.newClaimIds.has(claim.id)) {
        episodes.push(claimFiledEpisode(bonfireId, claim.id, agr.id, claim.claimant.address, claim.timestamp));
      }
      if (changes.adjudicatedClaimIds.has(claim.id) && claim.adjudicatedAt) {
        episodes.push(adjudicationEpisode(bonfireId, claim.id, agr.id, claim.verdict!, claim.actionTypes, claim.adjudicatedAt));
      }
    }
  }

  // Closed agreements
  for (const agr of snapshot.agreements) {
    if (changes.closedAgreementIds.has(agr.id) && agr.closedAt && agr.outcome) {
      episodes.push(agreementClosedEpisode(bonfireId, agr.id, agr.outcome, agr.closedAt));
    }
  }

  await Promise.all(
    episodes.map((ep) =>
      client.createEpisode(ep).catch((err) => {
        console.warn(`[bonfires-sync] episode warning: ${(err as Error).message}`);
      }),
    ),
  );
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

      if (snapshot.agreements.length === 0) {
        return;
      }

      // Filter to only agreements that changed
      const changed = snapshot.agreements.filter((a) => changes.changedAgreementIds.has(a.id));

      if (changed.length === 0 && changes.stateTransitions.length === 0) {
        return; // Nothing changed
      }

      console.log(
        `[bonfires-sync] tick: ${snapshot.agreements.length} agreements, ` +
        `${changed.length} changed, ` +
        `${changes.stateTransitions.length} state changes, ` +
        `${changes.newClaimIds.size} new claims`,
      );

      // Only sync entities/edges for changed agreements
      if (changed.length > 0) {
        await syncEntities(client, registry, changed, snapshot.typedEntities);
        await syncEdges(client, registry, changed, snapshot.typedEntities);
      }

      // Episodes are already filtered by the changeset
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
