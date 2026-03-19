import { ponder } from "@/generated";
import { eq, and, isNull } from "@ponder/core";
import {
  agreement,
  actor,
  agreementParty,
  proposal,
  trustZone,
  permission,
  responsibility,
  directive,
  constraint,
  eligibility,
  incentive,
  decisionModel,
  principalAlignment,
  resourceToken,
  resourceTokenHolding,
  claim,
  reputationFeedback,
} from "../ponder.schema";
import {
  decodeBytes32,
  parseProposalData,
  parsePermissionMetadata,
  parseResponsibilityMetadata,
  parseDirectiveMetadata,
  PARAM_TYPE,
  TOKEN_TYPE,
  MODULE_KIND_LABELS,
} from "./utils";
import type { Hex } from "viem";

// ─── ProposalSubmitted ───────────────────────────────────────────

ponder.on("Agreement:ProposalSubmitted", async ({ event, context }) => {
  const { db } = context;
  const agreementId = event.log.address.toLowerCase() as Hex;
  const proposerId = event.args.proposer.toLowerCase();
  const termsHash = event.args.termsHash;
  const proposalDataBytes = event.args.proposalData as Hex;

  // Upsert proposer actor
  await db
    .insert(actor)
    .values({ id: proposerId, address: event.args.proposer })
    .onConflictDoNothing();

  // Count existing proposals for sequence number
  const existingProposals = await db.sql
    .select()
    .from(proposal)
    .where(eq(proposal.agreementId, agreementId));
  const sequence = existingProposals.length;

  const proposalId = `${agreementId}:${sequence}`;

  // Parse proposal data
  try {
    const parsed = parseProposalData(proposalDataBytes);

    // Create proposal
    await db.insert(proposal).values({
      id: proposalId,
      agreementId,
      proposerId,
      sequence,
      termsHash,
      timestamp: event.block.timestamp,
      termsDocUri: parsed.termsDocUri,
      adjudicator: parsed.adjudicator,
      deadline: parsed.deadline,
      zoneCount: parsed.zones.length,
      rawProposalData: proposalDataBytes,
    });

    // Update agreement termsHash
    await db
      .update(agreement, { id: agreementId })
      .set({ termsHash, termsUri: parsed.termsDocUri });

    // Create tentative typed entities from parsed proposal data
    for (let zoneIdx = 0; zoneIdx < parsed.zones.length; zoneIdx++) {
      const zone = parsed.zones[zoneIdx];

      // Mechanisms → tentative typed entities
      for (let mechIdx = 0; mechIdx < zone.mechanisms.length; mechIdx++) {
        const mech = zone.mechanisms[mechIdx];
        const entityId = `${proposalId}:z${zoneIdx}:m${mechIdx}`;

        const moduleKind = MODULE_KIND_LABELS[mech.moduleKind] ?? `Unknown(${mech.moduleKind})`;

        switch (mech.paramType) {
          case PARAM_TYPE.Constraint:
            await db.insert(constraint).values({
              id: entityId,
              agreementId,
              proposalId,
              zoneIndex: zoneIdx,
              module: mech.module,
              moduleKind,
              data: mech.data,
              createdAt: event.block.timestamp,
            });
            break;
          case PARAM_TYPE.Eligibility:
            await db.insert(eligibility).values({
              id: entityId,
              agreementId,
              proposalId,
              zoneIndex: zoneIdx,
              module: mech.module,
              moduleKind,
              data: mech.data,
              createdAt: event.block.timestamp,
            });
            break;
          case PARAM_TYPE.Reward:
            await db.insert(incentive).values({
              id: entityId,
              agreementId,
              proposalId,
              zoneIndex: zoneIdx,
              incentiveType: "Reward",
              module: mech.module,
              moduleKind,
              data: mech.data,
              createdAt: event.block.timestamp,
            });
            break;
          case PARAM_TYPE.Penalty:
            await db.insert(incentive).values({
              id: entityId,
              agreementId,
              proposalId,
              zoneIndex: zoneIdx,
              incentiveType: "Penalty",
              module: mech.module,
              moduleKind,
              data: mech.data,
              createdAt: event.block.timestamp,
            });
            break;
          case PARAM_TYPE.PrincipalAlignment:
            await db.insert(principalAlignment).values({
              id: entityId,
              agreementId,
              proposalId,
              zoneIndex: zoneIdx,
              module: mech.module,
              moduleKind,
              data: mech.data,
              createdAt: event.block.timestamp,
            });
            break;
          case PARAM_TYPE.DecisionModel:
            await db.insert(decisionModel).values({
              id: entityId,
              agreementId,
              proposalId,
              zoneIndex: zoneIdx,
              module: mech.module,
              moduleKind,
              data: mech.data,
              createdAt: event.block.timestamp,
            });
            break;
        }
      }

      // Resources → tentative typed entities
      for (let resIdx = 0; resIdx < zone.resources.length; resIdx++) {
        const res = zone.resources[resIdx];
        const entityId = `${proposalId}:z${zoneIdx}:r${resIdx}`;

        switch (res.tokenType) {
          case TOKEN_TYPE.Permission: {
            const meta = parsePermissionMetadata(res.metadata);
            await db.insert(permission).values({
              id: entityId,
              agreementId,
              proposalId,
              zoneIndex: zoneIdx,
              resource: meta.resource,
              value: meta.value,
              period: meta.period,
              expiry: meta.expiry,
              params: meta.params,
              createdAt: event.block.timestamp,
            });
            break;
          }
          case TOKEN_TYPE.Responsibility: {
            const meta = parseResponsibilityMetadata(res.metadata);
            await db.insert(responsibility).values({
              id: entityId,
              agreementId,
              proposalId,
              zoneIndex: zoneIdx,
              obligation: meta.obligation,
              criteria: meta.criteria,
              deadline: meta.deadline,
              createdAt: event.block.timestamp,
            });
            break;
          }
          case TOKEN_TYPE.Directive: {
            const meta = parseDirectiveMetadata(res.metadata);
            await db.insert(directive).values({
              id: entityId,
              agreementId,
              proposalId,
              zoneIndex: zoneIdx,
              rule: meta.rule,
              severity: meta.severity,
              params: meta.params,
              createdAt: event.block.timestamp,
            });
            break;
          }
        }
      }
    }
  } catch {
    // If ABI decoding fails, still create the proposal with raw data
    await db.insert(proposal).values({
      id: proposalId,
      agreementId,
      proposerId,
      sequence,
      termsHash,
      timestamp: event.block.timestamp,
    });
  }
});

// ─── AgreementStateChanged ───────────────────────────────────────

ponder.on("Agreement:AgreementStateChanged", async ({ event, context }) => {
  const { db } = context;
  const agreementId = event.log.address.toLowerCase() as Hex;
  const toState = decodeBytes32(event.args.toState);

  await db.update(agreement, { id: agreementId }).set({ state: toState });
});

// ─── AgreementSetUp ──────────────────────────────────────────────

ponder.on("Agreement:AgreementSetUp", async ({ event, context }) => {
  const { db } = context;
  const agreementId = event.log.address.toLowerCase() as Hex;

  await db
    .update(agreement, { id: agreementId })
    .set({ setUpAt: event.block.timestamp });
});

// ─── AgreementActivated ──────────────────────────────────────────

ponder.on("Agreement:AgreementActivated", async ({ event, context }) => {
  const { db } = context;
  const agreementId = event.log.address.toLowerCase() as Hex;

  await db
    .update(agreement, { id: agreementId })
    .set({ activatedAt: event.block.timestamp });
});

// ─── ZoneDeployed ────────────────────────────────────────────────

ponder.on("Agreement:ZoneDeployed", async ({ event, context }) => {
  const { db } = context;
  const agreementId = event.log.address.toLowerCase() as Hex;
  const tzAddress = event.args.trustZone.toLowerCase() as Hex;
  const partyAddr = event.args.party;
  const partyId = partyAddr.toLowerCase();
  const agentId = event.args.agentId;

  // Upsert actor with agentId
  if (agentId > 0n) {
    await db
      .insert(actor)
      .values({ id: partyId, address: partyAddr, agentId })
      .onConflictDoUpdate({ agentId });
  } else {
    await db
      .insert(actor)
      .values({ id: partyId, address: partyAddr })
      .onConflictDoNothing();
  }

  // Determine zone index from existing zones
  const existingZones = await db.sql
    .select()
    .from(trustZone)
    .where(eq(trustZone.agreementId, agreementId));
  const zoneIndex = existingZones.length;

  await db.insert(trustZone).values({
    id: tzAddress,
    agreementId,
    actorId: partyId,
    hatId: event.args.zoneHatId,
    zoneIndex,
    active: true,
    createdAt: event.block.timestamp,
  });
});

// ─── MechanismRegistered ─────────────────────────────────────────
// Strategy: promote the matching tentative entity (from ProposalData parsing) to
// deployed by setting trustZoneId. This preserves moduleKind and data.
//
// Matching: for singletons (ERC7579Hook/External), the deployed address matches
// the tentative module address exactly. For HatsModule clones, the deployed
// address differs, so we fall back to positional match — but only if there is
// exactly one unmatched candidate (ambiguity = no promotion).

ponder.on("Agreement:MechanismRegistered", async ({ event, context }) => {
  const { db } = context;
  const agreementId = event.log.address.toLowerCase() as Hex;
  const paramType = event.args.paramType;
  const deployedModule = (event.args.module as string).toLowerCase() as Hex;
  const zoneIndex = Number(event.args.zoneIndex);

  // Find the trust zone for this agreement + zoneIndex
  const zones = await db.sql
    .select()
    .from(trustZone)
    .where(eq(trustZone.agreementId, agreementId));
  const tz = zones.find((z) => z.zoneIndex === zoneIndex);
  const tzId = tz?.id;

  // Helper: find a tentative entity to promote.
  // 1. Try exact module address match (works for singletons)
  // 2. Fall back to sole unmatched candidate (works for clones when unambiguous)
  const promote = async (
    table: typeof constraint | typeof eligibility | typeof decisionModel | typeof principalAlignment,
  ) => {
    const candidates = await db.sql
      .select()
      .from(table)
      .where(and(eq(table.agreementId, agreementId), eq(table.zoneIndex, zoneIndex), isNull(table.trustZoneId)));

    // Try exact address match first (singleton modules keep their address)
    let match = candidates.find((c) => (c.module as string).toLowerCase() === deployedModule);

    // Fall back: if exactly one unmatched candidate, it must be the one (clone)
    if (!match && candidates.length === 1) {
      match = candidates[0];
    }

    if (match) {
      await db.update(table, { id: match.id }).set({ trustZoneId: tzId, module: deployedModule });
    }
  };

  const promoteIncentive = async () => {
    const candidates = await db.sql
      .select()
      .from(incentive)
      .where(and(eq(incentive.agreementId, agreementId), eq(incentive.zoneIndex, zoneIndex), isNull(incentive.trustZoneId)));

    let match = candidates.find((c) => (c.module as string).toLowerCase() === deployedModule);
    if (!match && candidates.length === 1) {
      match = candidates[0];
    }

    if (match) {
      await db.update(incentive, { id: match.id }).set({ trustZoneId: tzId, module: deployedModule });
    }
  };

  switch (paramType) {
    case PARAM_TYPE.Constraint:
      await promote(constraint);
      break;
    case PARAM_TYPE.Eligibility:
      await promote(eligibility);
      break;
    case PARAM_TYPE.Reward:
    case PARAM_TYPE.Penalty:
      await promoteIncentive();
      break;
    case PARAM_TYPE.PrincipalAlignment:
      await promote(principalAlignment);
      break;
    case PARAM_TYPE.DecisionModel:
      await promote(decisionModel);
      break;
  }
});

// ─── ResourceTokenAssigned ───────────────────────────────────────

ponder.on("Agreement:ResourceTokenAssigned", async ({ event, context }) => {
  const { db } = context;
  const agreementId = event.log.address.toLowerCase() as Hex;
  const tzAddress = event.args.trustZone.toLowerCase() as Hex;
  const tokenId = event.args.tokenId;
  const tokenType = event.args.tokenType;

  // Find the zone to get its zoneIndex
  const tz = await db.find(trustZone, { id: tzAddress });
  const zoneIndex = tz?.zoneIndex ?? 0;

  // Create resource token holding
  const holdingId = `${tzAddress}:${tokenId}`;
  await db
    .insert(resourceTokenHolding)
    .values({
      id: holdingId,
      trustZoneId: tzAddress,
      resourceTokenId: tokenId,
      balance: 1n,
    })
    .onConflictDoUpdate({ balance: 1n });

  // Create deployed typed entity — read metadata from resource token if available
  const entityId = `${agreementId}:deployed:t${tokenId}`;
  const rt = await db.find(resourceToken, { id: tokenId });
  const metadata = rt?.metadata as Hex | undefined;

  switch (tokenType) {
    case TOKEN_TYPE.Permission: {
      const meta = metadata ? parsePermissionMetadata(metadata) : null;
      await db.insert(permission).values({
        id: entityId,
        agreementId,
        trustZoneId: tzAddress,
        resourceTokenId: tokenId,
        zoneIndex,
        resource: meta?.resource,
        value: meta?.value,
        period: meta?.period,
        expiry: meta?.expiry,
        params: meta?.params,
        createdAt: event.block.timestamp,
      });
      break;
    }
    case TOKEN_TYPE.Responsibility: {
      const meta = metadata ? parseResponsibilityMetadata(metadata) : null;
      await db.insert(responsibility).values({
        id: entityId,
        agreementId,
        trustZoneId: tzAddress,
        resourceTokenId: tokenId,
        zoneIndex,
        obligation: meta?.obligation,
        criteria: meta?.criteria,
        deadline: meta?.deadline,
        createdAt: event.block.timestamp,
      });
      break;
    }
    case TOKEN_TYPE.Directive: {
      const meta = metadata ? parseDirectiveMetadata(metadata) : null;
      await db.insert(directive).values({
        id: entityId,
        agreementId,
        trustZoneId: tzAddress,
        resourceTokenId: tokenId,
        zoneIndex,
        rule: meta?.rule,
        severity: meta?.severity,
        params: meta?.params,
        createdAt: event.block.timestamp,
      });
      break;
    }
  }
});

// ─── ClaimFiled ──────────────────────────────────────────────────

ponder.on("Agreement:ClaimFiled", async ({ event, context }) => {
  const { db } = context;
  const agreementId = event.log.address.toLowerCase() as Hex;
  const claimantAddr = event.args.claimant;
  const claimantId = claimantAddr.toLowerCase();

  // Upsert claimant actor
  await db
    .insert(actor)
    .values({ id: claimantId, address: claimantAddr })
    .onConflictDoNothing();

  const claimIdStr = `${agreementId}:${event.args.claimId}`;

  await db.insert(claim).values({
    id: claimIdStr,
    agreementId,
    mechanismIndex: event.args.mechanismIndex,
    claimantId,
    evidence: event.args.evidence as Hex,
    timestamp: event.block.timestamp,
  });
});

// ─── AdjudicationDelivered ───────────────────────────────────────

ponder.on("Agreement:AdjudicationDelivered", async ({ event, context }) => {
  const { db } = context;
  const agreementId = event.log.address.toLowerCase() as Hex;
  const claimIdStr = `${agreementId}:${event.args.claimId}`;

  // Decode action type bytes32 values
  const actionTypes = event.args.actionTypes.map((at) => decodeBytes32(at));

  await db.update(claim, { id: claimIdStr }).set({
    verdict: event.args.verdict,
    actionTypes: JSON.stringify(actionTypes),
    adjudicatedAt: event.block.timestamp,
  });
});

// ─── CompletionSignaled ──────────────────────────────────────────

ponder.on("Agreement:CompletionSignaled", async ({ event, context }) => {
  const { db } = context;
  const agreementId = event.log.address.toLowerCase() as Hex;
  const partyAddr = event.args.party.toLowerCase();

  // Find the party's index
  const parties = await db.sql
    .select()
    .from(agreementParty)
    .where(eq(agreementParty.agreementId, agreementId));

  const party = parties.find((p) => p.actorId === partyAddr);

  if (party?.partyIndex === 0) {
    await db
      .update(agreement, { id: agreementId })
      .set({ partyACompleted: true });
  } else if (party?.partyIndex === 1) {
    await db
      .update(agreement, { id: agreementId })
      .set({ partyBCompleted: true });
  }
});

// ─── ExitSignaled ────────────────────────────────────────────────

ponder.on("Agreement:ExitSignaled", async ({ event, context }) => {
  const { db } = context;
  const agreementId = event.log.address.toLowerCase() as Hex;
  const partyAddr = event.args.party.toLowerCase();

  const parties = await db.sql
    .select()
    .from(agreementParty)
    .where(eq(agreementParty.agreementId, agreementId));

  const party = parties.find((p) => p.actorId === partyAddr);

  if (party?.partyIndex === 0) {
    await db
      .update(agreement, { id: agreementId })
      .set({ partyAExited: true });
  } else if (party?.partyIndex === 1) {
    await db
      .update(agreement, { id: agreementId })
      .set({ partyBExited: true });
  }
});

// ─── AgreementClosed ─────────────────────────────────────────────

ponder.on("Agreement:AgreementClosed", async ({ event, context }) => {
  const { db } = context;
  const agreementId = event.log.address.toLowerCase() as Hex;
  const outcomeStr = decodeBytes32(event.args.outcome);

  await db.update(agreement, { id: agreementId }).set({
    outcome: outcomeStr,
    closedAt: event.block.timestamp,
  });

  // Deactivate all trust zones for this agreement
  const zones = await db.sql
    .select()
    .from(trustZone)
    .where(eq(trustZone.agreementId, agreementId));
  for (const zone of zones) {
    await db.update(trustZone, { id: zone.id }).set({ active: false });
  }
});

// ─── ReputationFeedbackWritten ───────────────────────────────────

ponder.on(
  "Agreement:ReputationFeedbackWritten",
  async ({ event, context }) => {
    const { db } = context;
    const agreementId = event.log.address.toLowerCase() as Hex;
    const agentIdVal = event.args.agentId;

    // Try to find the actor by agentId
    const actors = await db.sql
      .select()
      .from(actor)
      .where(eq(actor.agentId, agentIdVal));
    const actorRecord = actors[0];

    const feedbackId = `${agreementId}:${agentIdVal}`;

    await db.insert(reputationFeedback).values({
      id: feedbackId,
      agreementId,
      actorId: actorRecord?.id ?? null,
      tag: event.args.tag2,
      feedbackURI: event.args.feedbackURI,
      feedbackHash: event.args.feedbackHash as Hex,
      timestamp: event.block.timestamp,
    });
  }
);
