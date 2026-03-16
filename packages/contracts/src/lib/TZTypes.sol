// SPDX-License-Identifier: MIT
pragma solidity >=0.8.28;

/// @title TZTypes
/// @notice Trust Zone protocol-level types. Defines the full parameter surface of a trust zone.
library TZTypes {
  /// @notice The parameter dimensions of a trust zone boundary and domain.
  /// @dev Not all types are implemented as onchain mechanisms. Some are expressed as resource tokens,
  ///      some are expressed through eligibility requirements, and some are post-hackathon.
  enum TZParamType {
    Constraint, // hard, self-enforcing rules (→ ERC-7579 hooks)
    Directive, // soft rules, enforced by threat of penalties (→ resource token 0x03)
    Eligibility, // requirements to enter the zone (→ Hats eligibility modules)
    Reward, // positive incentives for good behavior (→ claimable mechanism)
    Penalty, // negative incentives for bad behavior (→ claimable mechanism)
    PrincipalAlignment, // incentive alignment with principal (→ Eligibility requirement)
    DecisionModel, // internal composition: 1-of-n, m-of-n (→ Eligibility requirement)
    Responsibility, // problems/tasks the agent is responsible for (→ resource token 0x02)
    Permission // access to resources (→ resource token 0x01)
  }

  /// @notice A mechanism attached to a trust zone. Used for negotiation terms,
  ///         activation config, and runtime claim/adjudication routing.
  /// @dev Only Constraint, Eligibility, Reward, and Penalty appear as deployed mechanisms.
  ///      Directive, Responsibility, and Permission are represented as resource tokens.
  ///      PrincipalAlignment and DecisionModel are expressed through Eligibility mechanisms.
  /// forge-lint: disable-next-item(pascal-case-struct)
  struct TZMechanism {
    TZParamType paramType;
    address module;
    bytes initData;
  }

  /// @notice A resource token to mint to a trust zone's TZ account on activation.
  /// @dev Token metadata is immutable — set on first mint, never changed.
  /// forge-lint: disable-next-item(pascal-case-struct)
  struct TZResourceTokenConfig {
    uint256 tokenId; // full ID with type prefix (0x01 permission, 0x02 responsibility, 0x03 directive)
    bytes metadata; // creation data, ABI-encoded, set on first mint
  }

  /// @notice Configuration for a single trust zone within an agreement.
  /// forge-lint: disable-next-item(pascal-case-struct)
  struct TZConfig {
    address party;
    uint256 agentId; // ERC-8004 agent identity (0 = no 8004, e.g. human party)
    uint32 hatMaxSupply;
    string hatDetails;
    TZMechanism[] mechanisms;
    TZResourceTokenConfig[] resources;
  }
}
