// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { TrustZoneBase } from "../../Base.t.sol";
import { TrustZone } from "../../../src/TrustZone.sol";
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";

contract TrustZone_isValidSignature is TrustZoneBase {
  bytes4 internal constant ERC1271_MAGIC = 0x1626ba7e;
  bytes4 internal constant FAILURE_VALUE = 0xffffffff;

  /// @dev Helper: sign a hash with a private key and prepend the validator module address.
  function _sign(uint256 pk, bytes32 hash) internal pure returns (bytes memory) {
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, hash);
    bytes memory rawSig = abi.encodePacked(r, s, v);
    return rawSig;
  }

  function test_ReturnsFailure_GivenNoValidatorInstalled() public {
    // Deploy a fresh uninitialised clone — no validator installed
    bytes32 salt = keccak256("no-validator-sig-test");
    TrustZone uninit = TrustZone(payable(Clones.cloneDeterministic(address(trustZoneImpl), salt)));

    bytes32 hash = keccak256("test message");
    // Signature must be at least 20 bytes (module address prefix) — use hatValidator address + dummy sig
    bytes memory sig = abi.encodePacked(
      address(hatValidator),
      hex"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000ff"
    );
    bytes4 result = uninit.isValidSignature(hash, sig);
    assertEq(result, FAILURE_VALUE);
  }

  function test_ReturnsMagicValue_WhenSignerWearsHat() public {
    // Create a fresh hat with room for a signer with known private key
    (address signer, uint256 signerPk) = makeAddrAndKey("hatWearerSigner");

    vm.startPrank(deployer);
    uint256 sigHatId = hats.createHat(agreementHatId, "Sig Test Hat", 1, deployer, deployer, true, "");
    hats.mintHat(sigHatId, signer);
    vm.stopPrank();

    // Deploy a fresh clone initialized with the new hat
    bytes32 salt = keccak256("sig-magic-test");
    TrustZone sigZone = TrustZone(payable(Clones.cloneDeterministic(address(trustZoneImpl), salt)));
    sigZone.initialize(address(hatValidator), abi.encode(sigHatId), mockExecutor, "", address(0), "");

    bytes32 hash = keccak256("test message");
    bytes memory rawSig = _sign(signerPk, hash);

    // Prepend the validator module address (20 bytes) per OZ convention
    bytes memory sig = abi.encodePacked(address(hatValidator), rawSig);
    bytes4 result = sigZone.isValidSignature(hash, sig);
    assertEq(result, ERC1271_MAGIC);
  }

  function test_ReturnsFailure_WhenSignerDoesNotWearHat() public {
    (, uint256 nonWearerPk) = makeAddrAndKey("nonWearer");

    bytes32 hash = keccak256("test message");
    bytes memory rawSig = _sign(nonWearerPk, hash);

    bytes memory sig = abi.encodePacked(address(hatValidator), rawSig);
    bytes4 result = trustZone.isValidSignature(hash, sig);
    assertEq(result, FAILURE_VALUE);
  }
}
