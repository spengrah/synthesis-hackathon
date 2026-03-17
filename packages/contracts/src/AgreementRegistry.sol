// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.28;

import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import { IHats } from "hats-protocol/Interfaces/IHats.sol";

import { IAgreementRegistry } from "./interfaces/IAgreementRegistry.sol";
import { ResourceTokenRegistry } from "./ResourceTokenRegistry.sol";
import { Agreement } from "./Agreement.sol";

/// @title AgreementRegistry
/// @notice Factory + Hats tree manager for Trust Zone agreements.
/// @dev Deploys Agreement clones, creates agreement-level hats, and registers
///      new agreements as authorized minters on the ResourceTokenRegistry.
contract AgreementRegistry is IAgreementRegistry {
  IHats public immutable HATS;
  ResourceTokenRegistry public immutable RESOURCE_TOKEN_REGISTRY;
  address public immutable AGREEMENT_IMPLEMENTATION;
  uint256 public immutable topHatId;

  mapping(address => uint256) public agreementHatIds;

  constructor(address _hats, address _resourceTokenRegistry, address _agreementImplementation) {
    HATS = IHats(_hats);
    RESOURCE_TOKEN_REGISTRY = ResourceTokenRegistry(_resourceTokenRegistry);
    AGREEMENT_IMPLEMENTATION = _agreementImplementation;
    topHatId = HATS.mintTopHat(address(this), "Trust Zones", "");
  }

  /// @inheritdoc IAgreementRegistry
  function createAgreement(address partyB, bytes calldata proposalData) external returns (address agreement) {
    if (msg.sender == address(0)) revert InvalidParty(msg.sender);
    if (partyB == address(0)) revert InvalidParty(partyB);
    if (msg.sender == partyB) revert PartiesIdentical();

    // Create agreement-level hat (child of top hat)
    uint256 agreementHatId = HATS.createHat(topHatId, "Agreement", 1, address(this), address(this), true, "");

    // Compute salt and deploy clone
    bytes32 salt = keccak256(abi.encode(agreementHatId, block.chainid));
    agreement = Clones.cloneDeterministic(AGREEMENT_IMPLEMENTATION, salt);

    // Mint agreement hat to the clone
    HATS.mintHat(agreementHatId, agreement);

    // Register as minter on ResourceTokenRegistry
    RESOURCE_TOKEN_REGISTRY.registerMinter(agreement);

    // Initialize the agreement
    Agreement(agreement).initialize([msg.sender, partyB], agreementHatId, proposalData);

    // Store mapping
    agreementHatIds[agreement] = agreementHatId;

    emit AgreementCreated(agreement, msg.sender, agreementHatId, msg.sender, partyB);
  }

  /// @inheritdoc IAgreementRegistry
  function hats() external view returns (address) {
    return address(HATS);
  }

  /// @inheritdoc IAgreementRegistry
  function resourceTokenRegistry() external view returns (address) {
    return address(RESOURCE_TOKEN_REGISTRY);
  }

  /// @inheritdoc IAgreementRegistry
  function agreementImplementation() external view returns (address) {
    return AGREEMENT_IMPLEMENTATION;
  }
}
