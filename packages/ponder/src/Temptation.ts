import { ponder } from "@/generated";
import { vaultDeposit, vaultWithdrawal } from "../ponder.schema";
import type { Hex } from "viem";

ponder.on("Temptation:Deposited", async ({ event, context }) => {
  const { db } = context;
  const id = `${event.log.transactionHash}:${event.log.logIndex}`;

  await db.insert(vaultDeposit).values({
    id,
    vault: event.log.address.toLowerCase() as Hex,
    depositor: event.args.from,
    amount: event.args.amount,
    timestamp: event.block.timestamp,
    txHash: event.log.transactionHash,
  }).onConflictDoNothing();
});

ponder.on("Temptation:Withdrawn", async ({ event, context }) => {
  const { db } = context;
  const id = `${event.log.transactionHash}:${event.log.logIndex}`;

  await db.insert(vaultWithdrawal).values({
    id,
    vault: event.log.address.toLowerCase() as Hex,
    recipient: event.args.to,
    amount: event.args.amount,
    permissionTokenId: event.args.permissionTokenId,
    timestamp: event.block.timestamp,
    txHash: event.log.transactionHash,
  }).onConflictDoNothing();
});
