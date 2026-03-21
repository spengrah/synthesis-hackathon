# Adjudication & Feedback — Current Status

**Date:** 2026-03-20 (day 5)

## What's working

**Full production pipeline (before feedback change):**
- Fresh keypairs generated, registered with ERC-8004 identity registry (`register()`)
- `TrustZonesAgent` as temptee — creates agreement with real agentIds
- `startCounterparty` autonomously detects vault + tweet violations, files claims
- `startAdjudicator` autonomously finds claims, decodes hex evidence, queries Bonfires for cross-tier context, evaluates via LLM (mock or claude-cli), submits verdict onchain
- Agreement closes → `_writeReputationFeedback()` writes 2 entries to ERC-8004 ReputationRegistry (one per party, tag="ADJUDICATED")
- Ponder indexes `ReputationFeedbackWritten` events
- Test verifies ≥2 feedback entries with tag="ADJUDICATED"
- All passing as of commit `dc6289d`

## What we changed

**Structured FEEDBACK action (commit `178414b`):**
- `mapVerdictToActions` now adds a FEEDBACK adjudication action alongside CLOSE
- Feedback content:
  ```json
  {
    "outcome": "FAILED",
    "agreement": "0x...",
    "claimId": 0,
    "violatedDirectives": ["259", "515"],    // resource token IDs
    "unfulfilledResponsibilities": []         // resource token IDs
  }
  ```
- Token IDs match the identifiers used in Bonfires knowledge graph (`directive:0x...:deployed:t259`)
- Encoded as `abi.encode(string feedbackURI, bytes32 feedbackHash)` in the FEEDBACK action params

**Event emission fix (commit `ecf61ad`):**
- Added `emit ReputationFeedbackWritten(agentId, "ADJUDICATED", feedbackURI, feedbackHash)` in the FEEDBACK action handler in Agreement.sol
- Previously: FEEDBACK action wrote to 8004 registry silently — Ponder/dashboard/Bonfires never saw it
- Now: event emitted so all downstream systems can index the rich feedback content

## Current blocker: Ponder crash

After the Agreement.sol change (adding the event emission), Ponder crashes during the adjudication phase:
```
Adjudicator tick error: TypeError: fetch failed
[bonfires-sync] tick error: TypeError: fetch failed
```

The `fetch failed` means Ponder's GraphQL endpoint is unreachable — the Ponder process died. This happens consistently right when the adjudicator submits its verdict (which includes the new FEEDBACK action).

**Likely causes:**
1. The new event emission changes the Agreement bytecode. The deploy script recompiles with `FOUNDRY_PROFILE=deploy` (via-ir), and the new artifacts are used. But Ponder might be crashing on the new event because:
   - The `ReputationFeedbackWritten` event is now emitted twice in the same transaction (once from FEEDBACK action, once from `_close()`) — Ponder's handler might not handle duplicate events gracefully
   - PGlite (Ponder's embedded database) might be crashing on the duplicate insert (same event, same tx, different log index)
   - The FEEDBACK action's feedbackURI is a long data URI that might exceed a field size limit

2. Unrelated: Ponder might be running out of memory or hitting a PGlite WASM issue on the Anvil fork (we've seen PGlite crashes before on Node 24, though Node 22 has been stable)

**To investigate:**
- Check Ponder's stderr for the actual crash reason (WASM abort, SQL error, etc.)
- Check if the `ReputationFeedbackWritten` event handler in `packages/ponder/src/Agreement.ts` handles duplicate events per transaction
- Try running with the event emission but without the FEEDBACK action to isolate whether it's the duplicate event or the long data URI
- Check PGlite stability on this specific event pattern

## Architecture notes

**Feedback flow (as designed):**
```
Adjudicator verdict
  → mapVerdictToActions: [FEEDBACK(feedbackURI), CLOSE]
  → encodeAdjudicate → submitInput
  → Agreement processes actions in loop:
      1. FEEDBACK: giveFeedback() + emit ReputationFeedbackWritten (rich content)
      2. CLOSE: sets shouldClose=true
  → After loop: _close() → _writeReputationFeedback() → emit ReputationFeedbackWritten (generic)
  → Total: 3 ReputationFeedbackWritten events per adjudication (1 rich + 2 generic)
```

**Ponder handler:** `packages/ponder/src/Agreement.ts` — `Agreement:ReputationFeedbackWritten` handler inserts into `reputation_feedback` table. The ID format is `${agreement}:${agentId}` which would collide if the same agentId gets multiple feedback entries in the same transaction. This is likely the bug — the handler uses `insert` not `upsert`, and the duplicate ID causes a primary key violation that crashes PGlite.

**Fix:** Change the feedback ID format to include the log index or a counter, e.g., `${agreement}:${agentId}:${logIndex}`.
