# Agreement Contract + Registry Spec

## Agreement Registry

### Role
Factory + Hats tree manager. Deploys agreement contracts and manages the Trust Zones hat tree.

### Functions

```solidity
function createAgreement(address[] calldata parties) external returns (address agreement);
```

On `createAgreement`:
1. Deploy Agreement contract via CREATE2 (deterministic address)
2. Create agreement-level hat (child of the Trust Zones top hat)
3. Transfer admin of the agreement hat to the new agreement contract
4. Store: agreement address → hat ID mapping
5. Emit: `AgreementCreated(address agreement, address creator, uint256 agreementHatId)`

### State
- Wears the "Trust Zones" top hat
- `mapping(address => uint256) public agreementHatIds`
- `address public hats` — Hats Protocol contract address
- `uint256 public topHatId` — the Trust Zones top hat`

---

## Agreement Contract

### Role
State machine + zone manager. Generic — deploys from pre-compiled ProposalData bytes.

### Shodai-compatible interface

```solidity
function submitInput(bytes32 inputId, bytes calldata payload) external;
function currentState() external view returns (bytes32);
function docUri() external view returns (string memory);  // termsUri
function docHash() external view returns (bytes32);       // termsHash
```

### Events (Shodai-compatible + custom)

See `ponder.md` for full event list.

### Shared structs

```solidity
struct MechanismInstall {
    uint8 moduleType;        // 1=validator, 2=executor, 4=hook
    address module;          // contract address
    bytes initData;          // module-specific init params
    bytes4[] selectors;      // HookMultiPlexer routing (empty = global)
    address[] targets;       // HookMultiPlexer routing (empty = all)
}

struct ZoneConfig {
    address party;
    uint32 hatMaxSupply;
    string hatDetails;
    address hatEligibility;
    bytes hatEligibilityInitData;
    address hatToggle;            // address(0) = agreement contract as toggle
    bytes hatToggleInitData;
    MechanismInstall[] mechanisms;
}

struct ProposalData {
    bytes32 termsDocHash;
    string termsDocUri;
    ZoneConfig[] zones;
    address adjudicator;
    uint256 deadline;
}
```

### State machine

```
PROPOSED ──counter──→ PROPOSED ──accept──→ ACCEPTED ──activate──→ ACTIVE
    │                                          │                     │
    └──reject──→ REJECTED              [async conditions]     ┌──────┼──────┐
                                              │           [dispute] [term] [complete]
                                    acceptAndActivate()       ▼      ▼      ▼
                                    (atomic shortcut)     DISPUTED TERMINATED COMPLETED
                                                              │
                                                         [resolve]
                                                              ▼
                                                          RESOLVED
```

### PROPOSED (initial + reentrant)
- Creating the contract IS proposing
- Auth: sender-based (`msg.sender` must be a party)
- `submitInput(COUNTER, abi.encode(ProposalData))` — overwrites terms, flips turn
- `submitInput(ACCEPT, "")` — locks terms, moves to ACCEPTED
- `submitInput(REJECT, "")` — terminal
- Each proposal stores `(termsHash, termsUri)` onchain + emits `ProposalSubmitted`

### ACCEPTED
- Terms locked. No more negotiation.
- TZ Accounts deployed, zone hats created. But hats may not be wearable yet (eligibility conditions).
- `tryActivate()` — checks hat eligibility for all zones → ACTIVE if all pass
- `acceptAndActivate()` — accept + activate atomically (demo convenience)

### Activation logic (ACCEPTED → ACTIVE)
1. Create zone hats (children of agreement hat) via Hats Protocol
2. Mint zone hats to parties
3. Deploy TZ Account clones via `Clones.cloneDeterministic`
4. Install HatValidator + agreement executor + HookMultiPlexer on each TZ Account
5. Install each mechanism from `ProposalData.zones[i].mechanisms[]`
6. Mint/transfer resource tokens to TZ accounts (from ProposalData)
7. Emit `AgreementActivated`, `ZoneDeployed`, `ResourceTokenAssigned`

### ACTIVE
- Auth: hat-based (zone hat required for inputs)
- Continuous constraint enforcement via hooks
- `submitInput(DISPUTE, abi.encode(tokenRefs, claim, evidenceHash))` → DISPUTED
- `submitInput(TERMINATE, "")` → TERMINATED (requires both parties or deadline)
- `submitInput(COMPLETE, "")` → COMPLETED

### DISPUTED
- Routes to IAdjudicator with claim + evidence
- `submitInput(RESOLVE, abi.encode(verdict, severity))` — called by adjudicator → RESOLVED

### Terminal states (COMPLETED, TERMINATED, RESOLVED)
- Agreement contract (as toggle module) deactivates zone hats
- Bond/escrow settlement based on outcome
- 8004 reputation feedback submitted if applicable
- Trust beliefs updated (Tier 3)

### Onchain storage (minimal)
- `bytes32 public currentState`
- `bytes32 public termsHash` (set on accept)
- `string public termsUri` (set on accept)
- `address public proposer` (whose turn to respond)
- `address[] public parties`
- `address[] public tzAccounts` (set on activation)
- `uint256[] public zoneHatIds` (set on activation)
- `address public adjudicator`
- `uint256 public deadline`
- ProposalData: submitted as calldata, hash verified, not stored in full

### Incentive mechanisms (in agreement contract, not separate contracts)
- **Bond**: parties deposit ETH/USDC. Tracked per-party. Returned or slashed on resolution.
- **Escrow**: depositor's funds held. Released to counterparty or returned based on outcome.
- **8004 Identity stake**: 8004 NFT transferred to agreement contract. Returned on completion. On adverse resolution: returned + reputation feedback via `ERC8004ReputationRegistry.giveFeedback()`.

### Shodai compatibility notes
- `submitInput(bytes32, bytes)` is the universal write interface
- `currentState()` returns the DFSM state as bytes32
- `InputAccepted` and `AgreementStateChanged` events match Shodai's event signatures
- State names are `keccak256(utf8("PROPOSED"))`, etc. — same encoding as Shodai
