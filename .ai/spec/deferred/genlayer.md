# GenLayer Adjudicator Spec

## Hackathon Status: DEFERRED

For the hackathon, we're using a **simple LLM agent** (Option B) instead of GenLayer. The agent polls Ponder for claims, evaluates evidence with a single LLM call, and submits verdicts. This is ~100 lines of TypeScript using Vercel AI SDK + an OpenAI-compatible provider.

GenLayer remains the **production path** — the single-agent adjudicator would be replaced by GenLayer's multi-validator consensus for decentralized subjective evaluation. The Intelligent Contract code below is preserved for post-hackathon implementation.

**See `.ai/spec/reputation-game.md` for the hackathon adjudicator design.**

---

## What GenLayer Is

GenLayer is an AI-native blockchain that extends smart contracts with LLM reasoning and web connectivity. Its contracts ("Intelligent Contracts") are written in Python, run on the GenVM, and can make non-deterministic decisions — calling LLMs and fetching live web data — while preserving blockchain-grade consensus.

**Chain status:** GenLayer runs on ZKsync Elastic Network infrastructure (Ethereum-level security, low fees). Currently **testnet only** — Asimov and Bradbury testnets are both live (Bradbury launched March 2026). Not yet on mainnet. It is NOT on Base. Cross-chain messaging to other EVM chains is planned via LayerZero but not yet available.

**Ghost contracts:** Proxy smart contracts on GenLayer's consensus layer that bridge external accounts to Intelligent Contracts. They handle message management and asset bridging. When an external service calls a GenLayer Intelligent Contract, it goes through a ghost contract on the ZK-stack rollup.

**Bradbury testnet:** Unlocks validator-specific AI — validators select and fine-tune their preferred LLMs. Relevant for adjudication: diverse LLMs reaching consensus on subjective evidence evaluation produces a more robust verdict than a single model.

**Implication:** GenLayer contracts cannot directly call Base contracts today. Cross-chain interaction requires an offchain component. However, GenLayer's Intelligent Contracts can read from any EVM chain via `@gl.evm.contract_interface` (read-only), and can fetch any URL via `gl.nondet.web`.

### Internet Court

GenLayer's flagship showcase application. Positions GenLayer as a "global synthetic jurisdiction" — validators running diverse LLMs act as a decentralized digital court. Key features:
- Most decisions delivered within 30 minutes, transactions finalize in ~100 seconds
- Appeals escalate validator count (Condorcet's Jury Theorem)
- AI consensus interprets ambiguous terms ("legal," "force majeure")

Internet Court is not a separate product we can integrate directly — it's a branding/positioning for GenLayer itself. Our adjudicator contract IS an Internet Court use case. We write our own Intelligent Contract using the same primitives.

**Key properties relevant to adjudication:**

- **Non-deterministic consensus.** Multiple validators independently execute the same logic (LLM calls, web fetches) and reach agreement via Optimistic Democracy. This is exactly what subjective dispute resolution needs — no single LLM decides; a quorum does.
- **Web access.** Contracts can fetch live URLs (`gl.nondet.web.get()`, `gl.nondet.web.render()`). The adjudicator can verify evidence URLs directly.
- **LLM reasoning.** Contracts can prompt LLMs (`gl.nondet.exec_prompt()`) and validate responses across validators. The adjudicator can reason about whether evidence proves a violation.
- **EVM interaction.** Contracts can read from and write to EVM contracts on other chains via `@gl.evm.contract_interface`, enabling the adjudicator to deliver verdicts back to the Agreement contract on Base.

## How Optimistic Democracy Maps to Adjudication

GenLayer's consensus mechanism is a natural fit for dispute adjudication:

| GenLayer concept | Adjudication analog |
|---|---|
| Leader validator proposes outcome | One LLM evaluates evidence and proposes a verdict |
| Consensus validators re-execute and vote | Multiple independent LLMs re-evaluate the same evidence |
| Equivalence Principle validates results | Validators check that the verdict structure is valid and the reasoning is sound |
| Appeal mechanism (doubled validator set) | Contested verdicts get re-evaluated by a larger panel |
| Bond-based appeals | Parties can challenge verdicts by posting bonds |

The key insight: **GenLayer's Optimistic Democracy IS a decentralized jury.** Each validator independently:
1. Reads the evidence (web fetch + structured data)
2. Reads the agreement terms (web fetch or on-chain read)
3. Prompts its LLM to evaluate whether the evidence proves a violation
4. Votes on whether the leader's verdict is acceptable

This gives us multi-validator LLM consensus on subjective disputes without building any consensus infrastructure ourselves.

## Architecture

Since GenLayer is on ZKsync (not Base) and cross-chain writes aren't available yet, we need a bridge component. The preferred approach avoids a full relay service.

### Preferred: Ponder-detected, thin watcher

```
┌─────────────────────────────────────────────────────────┐
│  BASE                                                     │
│                                                           │
│  Agreement Contract                                       │
│  ├── CLAIM filed → emits ClaimFiled event                │
│  ├── ADJUDICATE (auth: adjudicator address only)         │
│  └── adjudicator = watcher EOA address                   │
│                                                           │
│  Ponder Indexer → indexes ClaimFiled events               │
│  Bonfires KG → stores evidence, receipts, terms           │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ (1) Ponder detects ClaimFiled
                       ▼
┌─────────────────────────────────────────────────────────┐
│  WATCHER (lightweight Node.js script)                    │
│                                                           │
│  Polls Ponder for new claims                              │
│  Calls GenLayer adjudicator contract with evidence + terms│
│  Waits for GenLayer finality                              │
│  Reads verdict from GenLayer                              │
│  Submits ADJUDICATE to Agreement on Base                  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ (2) Forward claim
                       ▼
┌─────────────────────────────────────────────────────────┐
│  GENLAYER (ZKsync)                                       │
│                                                           │
│  AdjudicatorContract (Intelligent Contract, Python)      │
│  ├── adjudicate_claim(agreement, claimId, evidence, terms)│
│  │   └── Fetches evidence URL                            │
│  │   └── LLM evaluates violation                         │
│  │   └── Validators reach consensus                      │
│  └── get_verdict(agreement, claimId) → verdict           │
└─────────────────────────────────────────────────────────┘
```

### Why Ponder-based detection (not direct event watching)?

- Ponder already indexes `ClaimFiled` — no duplicate event listeners
- The watcher can enrich the claim with Ponder/Bonfires context before forwarding
- GraphQL polling is simpler than maintaining a websocket connection

### Why a watcher instead of a relay?

The "watcher" is functionally simple — it's a single async function, not a persistent service:
1. Poll Ponder for new claims (or run on a schedule)
2. For each new claim: call GenLayer, wait, read verdict, submit to Base
3. Can be a cron job or a simple `setInterval`

This is much lighter than a full relay service. The watcher holds one EOA key (the adjudicator address). It cannot fabricate verdicts — it only relays what GenLayer consensus produces.

### Alternative explored: Agreement calls GenLayer directly

The user asked whether the Agreement contract could call `receive_claim()` on GenLayer directly. **This is not possible today** because:
- GenLayer is on ZKsync, Base is a separate L2
- No synchronous cross-L2 calls exist
- LayerZero integration is planned but not yet available

When LayerZero is available, this becomes viable: Agreement.sol emits a LayerZero message, GenLayer receives it, evaluates, and sends the verdict back via LayerZero. This would eliminate the watcher entirely. Worth tracking for post-hackathon.

## Adjudication Flow

### Step 1: Claim Filed on Base

An agent calls `submitInput(CLAIM, encodeClaim(mechanismIndex, evidence))` on the Agreement contract. The evidence is structured JSON (ABI-encoded as bytes):

```json
{
  "publicUrl": "https://agent-b-blog.example.com/stolen-data",
  "dataSample": "AAPL: $187.32, MSFT: $412.56, ...",
  "originalReceipt": {
    "id": "receipt:abc123",
    "actor": "0xAgentB",
    "zone": "0xZoneB",
    "resource": "/market-data",
    "timestamp": 1710600000,
    "responseHash": "0x...",
    "signature": "0x..."
  }
}
```

The Agreement contract emits `ClaimFiled(claimId, mechanismIndex, claimant, evidence)`.

### Step 2: Claim Detection (via Ponder)

The watcher polls Ponder for new claims:

```typescript
const { claims } = await ponderGQL(`{
  claims(where: { adjudicatedAt: null }) {
    items { id mechanismIndex claimantId evidence timestamp }
  }
}`)
```

For each unprocessed claim, the watcher:
1. Decodes the evidence from the claim
2. Fetches agreement terms and zone context from Ponder
3. Optionally enriches with Bonfires context (receipts, prior observations)
4. Calls `adjudicate_claim()` on the GenLayer contract

### Step 3: GenLayer Evaluates

The GenLayer Intelligent Contract:

1. **Fetches evidence URL.** Uses `gl.nondet.web.get()` or `gl.nondet.web.render()` to retrieve the content at the public URL cited in the evidence.
2. **Reads agreement terms.** Either passed as input (simplest), fetched from a terms URL, or read from Base via EVM interaction.
3. **Compares data.** Uses LLM to evaluate whether the content at the public URL matches the data sample from the receipt and whether this constitutes a violation of the agreement terms (directives).
4. **Produces a structured verdict.** The LLM returns JSON with: `verdict` (boolean), `reasoning` (string), `recommended_actions` (array of action types).

Each GenLayer validator independently:
- Fetches the same URL
- Prompts its own LLM with the same evaluation prompt
- Validates that the leader's verdict structure is sound and the reasoning is consistent with the evidence

### Step 4: Verdict Delivered to Base

Once GenLayer reaches consensus (finality), the verdict is delivered to the Agreement contract on Base:

```
submitInput(ADJUDICATE, abi.encode(claimId, verdict, actions))
```

Where `actions` is an array of `AdjudicationAction`:
```solidity
struct AdjudicationAction {
    uint256 mechanismIndex;  // which mechanism to act on
    uint256 targetIndex;     // zone-targeted actions
    bytes32 actionType;      // PENALIZE, REWARD, FEEDBACK, DEACTIVATE, CLOSE
    bytes params;            // action-specific parameters
}
```

## Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│ INPUTS TO GENLAYER CONTRACT                                   │
│                                                                │
│ 1. agreement_address (Base address)                           │
│ 2. claim_id (uint256)                                         │
│ 3. mechanism_index (uint256)                                  │
│ 4. evidence_json:                                             │
│    ├── publicUrl: string (where violation data was found)     │
│    ├── dataSample: string (excerpt of violated data)          │
│    └── originalReceipt: object (cryptographic proof of        │
│        original data delivery under the agreement)            │
│ 5. terms: string[] (directive rules from the agreement,       │
│    e.g. "no redistribution")                                  │
│ 6. zone_context: object (which zone is accused, what          │
│    resources it holds)                                         │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ GENLAYER PROCESSING                                           │
│                                                                │
│ 1. Fetch publicUrl content via gl.nondet.web                  │
│ 2. Compare fetched content against dataSample                 │
│ 3. LLM prompt: "Given these terms [terms], this evidence     │
│    [fetched content + receipt], determine whether the         │
│    accused party violated the agreement."                     │
│ 4. Validators independently verify via Optimistic Democracy   │
│ 5. Consensus reached on verdict                               │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ OUTPUTS FROM GENLAYER CONTRACT                                │
│                                                                │
│ 1. verdict: bool (true = violation confirmed)                 │
│ 2. reasoning: string (natural language explanation)           │
│ 3. actions: AdjudicationAction[] — recommended enforcement   │
│    e.g. [{ actionType: CLOSE, mechanismIndex: 0, ... }]      │
│ 4. Stored on GenLayer chain as finalized state                │
│ 5. Relayed to Base Agreement via submitInput(ADJUDICATE)      │
└──────────────────────────────────────────────────────────────┘
```

## Bonfires Integration

The adjudicator can query Bonfires for richer evidence beyond what's in the claim payload:

```
POST /delve
{
  "bonfire_id": BONFIRE_ID,
  "query": "action receipts for zone:0xZoneB involving /market-data between March 17 and March 19"
}
```

This returns:
- All action receipts showing data access (Tier 2)
- Agreement terms and zone configuration (Tier 1)
- Any disclosed evidence from the claimant (Tier 3 disclosed to Tier 2)

For the GenLayer contract to query Bonfires, it would use `gl.nondet.web.request()` to call the Bonfires API:

```python
def fetch_evidence():
    response = gl.nondet.web.request(
        BONFIRES_URL + "/delve",
        method="POST",
        body={
            "bonfire_id": bonfire_id,
            "query": f"evidence for claim against zone:{zone_address}",
            "limit": 50
        }
    )
    return json.loads(response.body.decode("utf-8"))
```

Since Bonfires responses may vary slightly between validator calls (timing, new data arriving), the contract should extract stable fields (receipt IDs, signatures, content hashes) rather than comparing raw responses.

## Code Sketch: GenLayer Adjudicator Contract

```python
# { "Depends": "py-genlayer:..." }

from genlayer import *
import json

class TrustZoneAdjudicator(gl.Contract):
    # Storage
    verdicts: dict       # claim_key -> verdict result
    pending_claims: list # claims awaiting processing

    def __init__(self):
        self.verdicts = {}
        self.pending_claims = []

    @gl.public.write
    def adjudicate_claim(
        self,
        agreement_address: str,
        claim_id: int,
        mechanism_index: int,
        evidence_json: str,
        terms: list,
    ):
        """
        Evaluate a dispute claim using LLM reasoning and web verification.
        Called by the relay/watcher service when a ClaimFiled event is detected.
        """
        evidence = json.loads(evidence_json)
        public_url = evidence["publicUrl"]
        data_sample = evidence["dataSample"]
        original_receipt = evidence["originalReceipt"]

        # --- Non-deterministic block: fetch + evaluate ---
        def evaluate():
            # 1. Fetch the allegedly-violating public content
            web_content = gl.nondet.web.render(public_url, mode="html")

            # 2. Build evaluation prompt
            prompt = f"""You are an impartial adjudicator for a machine agreement.

AGREEMENT TERMS (directives the accused party agreed to follow):
{json.dumps(terms, indent=2)}

EVIDENCE SUBMITTED BY CLAIMANT:
- Public URL where violation was found: {public_url}
- Data sample from the public URL: {data_sample}
- Original receipt proving data was served under the agreement:
  - Resource: {original_receipt.get('resource')}
  - Timestamp: {original_receipt.get('timestamp')}
  - Response hash: {original_receipt.get('responseHash')}

CONTENT FETCHED FROM PUBLIC URL:
{web_content[:5000]}

TASK:
1. Determine if the content at the public URL contains data that matches
   the data sample from the original receipt.
2. If it does, determine if publishing this data violates any of the
   agreement terms (directives).
3. Return your verdict as JSON:

{{
  "verdict": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "explanation of your analysis",
  "violated_terms": ["term1", ...] or [],
  "recommended_action": "CLOSE" or "PENALIZE" or "DISMISS"
}}

Be conservative: only return verdict=true if the evidence clearly
demonstrates a violation. If the data at the URL does not match the
sample, or if the terms do not prohibit the observed behavior, return
verdict=false.
"""
            result = gl.nondet.exec_prompt(prompt, response_format="json")
            return result

        # --- Validator function: structural + semantic check ---
        def validate(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            try:
                data = json.loads(leader_result.calldata)
            except (json.JSONDecodeError, TypeError):
                return False

            # Structural validation
            if not isinstance(data.get("verdict"), bool):
                return False
            if not isinstance(data.get("confidence"), (int, float)):
                return False
            if data["confidence"] < 0 or data["confidence"] > 1:
                return False
            if not isinstance(data.get("reasoning"), str):
                return False
            if data.get("recommended_action") not in (
                "CLOSE", "PENALIZE", "DISMISS"
            ):
                return False

            # Semantic validation: validator re-evaluates independently
            my_result = evaluate()
            try:
                my_data = json.loads(my_result)
            except (json.JSONDecodeError, TypeError):
                return False

            # Verdicts must agree (the core question: violation or not)
            return my_data.get("verdict") == data["verdict"]

        # Execute with multi-validator consensus
        verdict_json = gl.vm.run_nondet_unsafe(evaluate, validate)
        verdict_data = json.loads(verdict_json)

        # Store verdict
        claim_key = f"{agreement_address}:{claim_id}"
        self.verdicts[claim_key] = verdict_data

        # Note: EVM call to Base happens via relay service reading
        # this verdict, or via direct EVM interaction on finality:
        #
        # agreement = AgreementContract(agreement_address)
        # if verdict_data["verdict"]:
        #     agreement.emit().submitInput(ADJUDICATE, encoded_payload)

    @gl.public.view
    def get_verdict(self, agreement_address: str, claim_id: int) -> dict:
        claim_key = f"{agreement_address}:{claim_id}"
        return self.verdicts.get(claim_key, {})
```

## Code Sketch: Claim Watcher (TypeScript)

```typescript
// Polls Ponder for new claims, forwards to GenLayer, relays verdict to Base

import { createPublicClient, createWalletClient } from "viem";
import { createClient as createGenLayerClient } from "genlayer-js";
import { encodeAdjudicate } from "@trust-zones/sdk";

const ADJUDICATE_ACTION_CLOSE = keccak256("CLOSE");

async function processClaim(
  agreementAddress: Address,
  claimId: number,
  evidence: string,
  terms: string[],
  genLayerContractAddress: Address,
) {
  const glClient = createGenLayerClient({ chain: testnet });

  // 1. Submit claim to GenLayer for adjudication
  await glClient.writeContract({
    address: genLayerContractAddress,
    functionName: "adjudicate_claim",
    args: [agreementAddress, claimId, 0, evidence, terms],
  });

  // 2. Wait for GenLayer finality + read verdict
  // (poll get_verdict until non-empty)
  let verdict;
  while (!verdict?.verdict) {
    await sleep(5000);
    verdict = await glClient.readContract({
      address: genLayerContractAddress,
      functionName: "get_verdict",
      args: [agreementAddress, claimId],
    });
  }

  // 3. Encode and submit to Base
  const actions = [];
  if (verdict.recommended_action === "CLOSE") {
    actions.push({
      mechanismIndex: 0n,
      targetIndex: 0n,
      actionType: ADJUDICATE_ACTION_CLOSE,
      params: "0x",
    });
  }

  const { inputId, payload } = encodeAdjudicate(claimId, actions);
  await walletClient.writeContract({
    address: agreementAddress,
    abi: agreementAbi,
    functionName: "submitInput",
    args: [inputId, payload],
  });
}

// Main loop: poll Ponder for unadjudicated claims
async function watchClaims() {
  const processed = new Set<string>();
  setInterval(async () => {
    const { claims } = await ponderGQL(`{
      claims(where: { adjudicatedAt: null }) {
        items { id mechanismIndex claimantId evidence timestamp }
      }
    }`);
    for (const claim of claims.items) {
      if (!processed.has(claim.id)) {
        processed.add(claim.id);
        processClaim(/* ... */).catch(console.error);
      }
    }
  }, 10_000);
}
```

## Open Questions and Risks

### GenLayer maturity

1. **Testnet only.** GenLayer is on Asimov testnet (Bradbury next, mainnet TBD). For the hackathon demo, testnet is sufficient. For production, GenLayer mainnet availability is a dependency.

2. **No Base interop yet.** GenLayer is on ZKsync, not Base. Cross-chain writes require the watcher. LayerZero integration is planned but not available. Track this — when available, it eliminates the watcher entirely.

3. **Finality timing.** Optimistic Democracy includes appeal windows. Happy path should complete in ~100 seconds per GenLayer docs. For demo, ensure no appeals are triggered.

4. **Web fetch reliability.** If the evidence URL goes down between leader and validator execution, validators will disagree. Handle with `gl.UserError` or archive evidence to Bonfires/IPFS first.

### Trust model

5. **Watcher trust.** The watcher holds the adjudicator EOA key. It can only relay GenLayer consensus — cannot fabricate verdicts. Still a centralization point. Post-hackathon: replace with LayerZero messaging.

6. **LLM manipulation.** Adversarial prompt injection in evidence payloads is a real risk. Multi-validator model helps (different LLMs per validator). Harden the prompt.

7. **Evidence liveness.** Evidence URLs must remain accessible during consensus. Mitigation: claimant archives evidence hash to Bonfires before filing claim.

### Integration

8. **Two-chain coordination.** Claim on Base → GenLayer evaluates → verdict back to Base. Adds latency. For hackathon, acceptable.

9. **Gas costs.** GenLayer transactions cost GEN tokens. Who pays — claimant, protocol, or losing party?

10. **GenLayer SDK maturity.** Need to verify `genlayer-js` client library works as expected for testnet interaction from our watcher.

## Implementation Plan

### Phase 1: Local prototype (Day 1)

1. **Set up GenLayer Studio locally.** `npm install -g genlayer && genlayer init && genlayer up`
2. **Write the adjudicator contract** in Python, test in Studio sandbox.
3. **Mock the evidence.** Hard-code an evidence URL and terms. Verify the LLM evaluates correctly and validators reach consensus.
4. **Test EVM interaction.** If Studio supports Hardhat integration, test calling a mock Agreement contract from the GenLayer contract.

### Phase 2: Ponder-based watcher (Day 2)

5. **Build the claim watcher.** TypeScript script that polls Ponder for unadjudicated claims, forwards to GenLayer, reads verdict, submits to Base. Single file, ~100 lines.
6. **End-to-end test.** File a claim on Base fork, watch it flow through GenLayer, verdict submitted back.

### Phase 3: Bonfires integration (Day 3, stretch)

8. **Connect Bonfires queries.** Have the GenLayer contract query Bonfires `/delve` for additional evidence context.
9. **Evidence archival.** Claimant archives evidence content hash to Bonfires before filing claim. Adjudicator verifies the hash.

### Phase 4: Demo integration (Day 4)

10. **Wire into the E2E demo scenario.** Replace the stub adjudicator in `packages/e2e/src/demo-scenario.ts` with the GenLayer-based flow.
11. **Update the `adjudicator` address** in `ProposalData` to point to the relay EOA.
12. **Demo run.** Full 9-beat demo with real GenLayer adjudication at beat 6.

### Cut lines

- **Must have:** GenLayer contract evaluates evidence and reaches consensus. Relay delivers verdict to Base. Demo works end-to-end.
- **Nice to have:** Bonfires integration for richer evidence queries. Direct EVM interaction (no relay). Multiple claim types beyond "no redistribution."
- **Post-hackathon:** Appeal handling UX. Gas sponsorship model. Evidence archival on IPFS. Multi-adjudicator support (different adjudicators for different mechanism types).
