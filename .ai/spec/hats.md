# Hats Protocol Integration Spec

## Hat tree structure

```
Trust Zones Top Hat (worn by Agreement Registry)
├── Agreement #1 Hat (created on agreement deployment)
│   ├── Zone A Hat (created on activation, worn by Party A)
│   └── Zone B Hat (created on activation, worn by Party B)
├── Agreement #2 Hat
│   └── Zone Hat (single-zone agreement)
└── ...
```

## Integration points

- **Agreement Registry** wears the top hat → can create agreement hats (children)
- **Agreement Contract** admins the agreement hat → creates zone hats (children), mints to agents on activation
- **Zone hat wearing** = TZ membership. Checked by HatValidator on TZ Account.
- **Hat revocation** = agent removal from zone. Cascades to loss of all zone access.

## Modules used

### Eligibility modules (chained)

Two chained eligibility modules on each zone hat:

1. **Staking eligibility** (existing Hats module) — checks agent has deposited ≥ required bond amount
2. **8004ReputationEligibility** (new module) — checks agent's ERC-8004 reputation score ≥ threshold

Both thresholds are negotiable terms in the agreement. The inverse relationship between reputation and bond is a negotiation outcome, not hardcoded logic.

### Toggle module

**AgreementToggle** — the agreement contract itself acts as the toggle module for its zone hats:
- `getHatStatus(hatId)` returns `true` if the agreement is in ACTIVE state and deadline has not passed
- When agreement reaches a terminal state (COMPLETED, TERMINATED, RESOLVED), returns `false` → zones deactivate

## 8004ReputationEligibility module (new, to build)

```solidity
contract ERC8004ReputationEligibility is IHatsEligibility {
    address public reputationRegistry;  // ERC-8004 ReputationRegistry address
    uint256 public erc8004TokenId;      // which 8004 identity to check
    int256 public minScore;             // minimum reputation threshold

    function getWearerStatus(address wearer, uint256 hatId)
        external view returns (bool eligible, bool standing) {
        // Query ERC-8004 ReputationRegistry for aggregate score
        // Return eligible = score >= minScore, standing = true
    }
}
```

Configured per zone hat via init data. The threshold is a negotiated term.

## Hats Protocol addresses

Hats is already deployed on Base. Use existing deployment — do not redeploy.
