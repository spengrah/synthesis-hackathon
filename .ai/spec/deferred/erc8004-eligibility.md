# ERC-8004 Integration Spec

## Status: SIMPLIFIED

The original plan for a `ReputationEligibility` Hats module was too complex for hackathon scope (6-9 hours for a secondary feature). This spec captures the simplified approach.

## Primary integration: Reputation feedback (already built)

Trust Zones agreements already write ERC-8004 reputation feedback on closure. This is the primary 8004 integration and requires no additional work:

```
Agreement closes → _writeReputationFeedback() → ReputationRegistry.giveFeedback()
  tag1: "trust-zone-agreement"
  tag2: outcome (COMPLETED, EXITED, EXPIRED, ADJUDICATED)
```

This creates a track record that accumulates over time. Any system can query `ReputationRegistry.getSummary()` to see an agent's history.

**What this demonstrates for the ERC-8004 bounty ($750):**
- Correct use of ERC-8004 as a reputation primitive
- Automatic feedback generation from agreement outcomes
- Queryable reputation history for trust decisions
- The renegotiation beat (beat 9) shows reputation influencing the next agreement

## Deprioritized: ReputationEligibility module

The full Hats eligibility module that gates zone participation on 8004 scores has been deferred. The design is preserved below for post-hackathon implementation.

## Alternative considered: 8004 NFT staking

An interesting alternative to the eligibility module: require agents to **stake their ERC-8004 identity NFT** as collateral. This is qualitatively different from USDC staking:

- **USDC staking:** Financial skin in the game. Losing your stake costs money.
- **Identity staking:** Reputational skin in the game. Losing your identity NFT costs your entire on-chain reputation history, agent ID, and all associated trust signals.

### When this makes sense

Identity staking only makes sense for high-stakes agreements where:
1. The reward is very valuable (large payout, exclusive data access, privileged permissions)
2. The delegated resource is fragile or irreplaceable (private keys, custody access, irreversible actions)
3. The principal needs maximum assurance (e.g., delegating financial custody to an agent)

An agent rational enough to stake their identity is signaling: "I'm so confident I'll comply that I'm willing to bet my entire reputation on it."

### Design sketch

```solidity
// StakeIdentity: agent transfers their ERC-8004 NFT to the staking contract
// If the agent violates terms and is adjudicated against, the NFT is burned or
// transferred to the injured party. If the agreement completes cleanly, the NFT
// is returned.

contract IdentityStakingEligibility is HatsEligibilityModule {
    IERC721 public identityRegistry;

    function stake(uint256 tokenId) external {
        identityRegistry.transferFrom(msg.sender, address(this), tokenId);
        // record staker → tokenId mapping
    }

    function slash(address wearer) external onlyHatAdmin {
        // burn or transfer the staked NFT
    }

    function getWearerStatus(address wearer, uint256) public view returns (bool, bool) {
        // eligible = has staked their identity NFT
        // standing = not slashed
    }
}
```

### Trade-offs

| Pro | Con |
|-----|-----|
| Extremely strong trust signal | Agents will resist staking — very high bar |
| Novel mechanism (differentiator) | ERC-8004 NFT may not be transferable (depends on implementation) |
| Simple contract (transfer + slash) | Burning an identity is irreversible — harsh punishment |
| Compelling narrative | Limited applicability (only high-stakes agreements) |

### Verdict

Not building for hackathon. The narrative is compelling but the implementation adds complexity without being on the critical path. If we have spare time on day 6, it's a high-impact addition. Depends on whether ERC-8004 identity tokens are transferable.

---

## Original ReputationEligibility design (deferred)

Preserved for reference. See git history for the full spec.

**Key design points:**
- `ReputationEligibility` extends `HatsEligibilityModule`, deployed as HatsModuleFactory clone
- Immutable args: `reputationRegistry` address + `agentId`
- Mutable init: `minFeedbackCount`, `minSummaryValue`, `summaryValueDecimals`, `trustedClients[]`
- Chains with StakingEligibility via `HatsEligibilitiesChain` (AND-all logic)
- No changes to Agreement.sol needed (generic module deployment path)
- Cold start: set thresholds to 0 for first agreement, raise for renegotiation
- `trustedClients` populated with known prior agreement addresses
- Standing always true (reputation is qualification, not discipline)
- Estimated 6-9 hours to build
