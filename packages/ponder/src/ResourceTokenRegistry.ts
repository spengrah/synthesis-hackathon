import { ponder } from "@/generated";
import { eq } from "@ponder/core";
import {
  resourceToken,
  resourceTokenHolding,
  permission,
  responsibility,
  directive,
} from "../ponder.schema";
import {
  parsePermissionMetadata,
  parseResponsibilityMetadata,
  parseDirectiveMetadata,
  TOKEN_TYPE,
} from "./utils";
import type { Hex } from "viem";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// ─── TokenCreated ────────────────────────────────────────────────

ponder.on(
  "ResourceTokenRegistry:TokenCreated",
  async ({ event, context }) => {
    const { db } = context;
    const tokenId = event.args.tokenId;
    const tokenType = event.args.tokenType;
    const metadata = event.args.metadata as Hex;
    const creator = event.args.creator as Hex;

    await db.insert(resourceToken).values({
      id: tokenId,
      tokenType,
      creator,
      metadata,
      createdAt: event.block.timestamp,
    });

    // If a deployed typed entity already exists for this tokenId,
    // decode metadata and update its parsed fields
    switch (tokenType) {
      case TOKEN_TYPE.Permission: {
        const meta = parsePermissionMetadata(metadata);
        // Find permission entities linked to this token
        const perms = await db.sql.select().from(permission)
          .where(eq(permission.resourceTokenId, tokenId));
        for (const perm of perms) {
          await db.update(permission, { id: perm.id }).set({
            resource: meta.resource,
            value: meta.value,
            period: meta.period,
            expiry: meta.expiry,
            params: meta.params,
          });
        }
        break;
      }
      case TOKEN_TYPE.Responsibility: {
        const meta = parseResponsibilityMetadata(metadata);
        const resps = await db.sql.select().from(responsibility)
          .where(eq(responsibility.resourceTokenId, tokenId));
        for (const resp of resps) {
          await db.update(responsibility, { id: resp.id }).set({
            obligation: meta.obligation,
            criteria: meta.criteria,
            deadline: meta.deadline,
          });
        }
        break;
      }
      case TOKEN_TYPE.Directive: {
        const meta = parseDirectiveMetadata(metadata);
        const dirs = await db.sql.select().from(directive)
          .where(eq(directive.resourceTokenId, tokenId));
        for (const dir of dirs) {
          await db.update(directive, { id: dir.id }).set({
            rule: meta.rule,
            severity: meta.severity,
            params: meta.params,
          });
        }
        break;
      }
    }
  }
);

// ─── Transfer (ERC-6909) ─────────────────────────────────────────

ponder.on("ResourceTokenRegistry:Transfer", async ({ event, context }) => {
  const { db } = context;
  const sender = event.args.sender.toLowerCase() as Hex;
  const receiver = event.args.receiver.toLowerCase() as Hex;
  const tokenId = event.args.id;
  const amount = event.args.amount;

  // Mint (sender = zero address) — create or update holding
  if (sender === ZERO_ADDRESS) {
    const holdingId = `${receiver}:${tokenId}`;
    await db
      .insert(resourceTokenHolding)
      .values({
        id: holdingId,
        trustZoneId: receiver,
        resourceTokenId: tokenId,
        balance: amount,
      })
      .onConflictDoUpdate({ balance: amount });
    return;
  }

  // Burn (receiver = zero address) — set balance to 0
  if (receiver === ZERO_ADDRESS) {
    const holdingId = `${sender}:${tokenId}`;
    await db
      .update(resourceTokenHolding, { id: holdingId })
      .set({ balance: 0n });
    return;
  }

  // Regular transfer — update both sides
  const senderHoldingId = `${sender}:${tokenId}`;
  const receiverHoldingId = `${receiver}:${tokenId}`;

  // Decrement sender
  const senderHoldings = await db.sql.select().from(resourceTokenHolding)
    .where(eq(resourceTokenHolding.id, senderHoldingId));
  if (senderHoldings.length > 0) {
    const newBalance = senderHoldings[0].balance - amount;
    await db
      .update(resourceTokenHolding, { id: senderHoldingId })
      .set({ balance: newBalance < 0n ? 0n : newBalance });
  }

  // Increment receiver
  await db
    .insert(resourceTokenHolding)
    .values({
      id: receiverHoldingId,
      trustZoneId: receiver,
      resourceTokenId: tokenId,
      balance: amount,
    })
    .onConflictDoUpdate({ balance: amount });
});
