import { ponder } from "@/generated";
import {
  agreement,
  actor,
  agreementParty,
} from "../ponder.schema";

ponder.on("AgreementRegistry:AgreementCreated", async ({ event, context }) => {
  const { db } = context;
  const { agreement: agreementAddr, agreementHatId, partyA, partyB } =
    event.args;

  const agreementId = agreementAddr.toLowerCase() as `0x${string}`;
  const partyAId = partyA.toLowerCase();
  const partyBId = partyB.toLowerCase();

  // Upsert actors
  await db
    .insert(actor)
    .values({ id: partyAId, address: partyA })
    .onConflictDoNothing();
  await db
    .insert(actor)
    .values({ id: partyBId, address: partyB })
    .onConflictDoNothing();

  // Create agreement
  await db.insert(agreement).values({
    id: agreementId,
    state: "PROPOSED",
    agreementHatId,
    createdAt: event.block.timestamp,
  }).onConflictDoNothing();

  // Create agreement parties
  await db.insert(agreementParty).values({
    id: `${agreementId}:${partyAId}`,
    agreementId,
    actorId: partyAId,
    partyIndex: 0,
  }).onConflictDoNothing();
  await db.insert(agreementParty).values({
    id: `${agreementId}:${partyBId}`,
    agreementId,
    actorId: partyBId,
    partyIndex: 1,
  }).onConflictDoNothing();
});
