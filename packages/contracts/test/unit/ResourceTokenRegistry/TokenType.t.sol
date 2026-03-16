// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28;

import { ResourceTokenRegistryBase } from "../../Base.t.sol";
import { Defaults } from "../../helpers/Defaults.sol";
import { TestHelpers } from "../../helpers/TestHelpers.sol";

contract TokenType_Test is ResourceTokenRegistryBase {
  function test_TokenType_ReturnsLowest8Bits() public view {
    assertEq(registry.tokenType(Defaults.PERMISSION_TOKEN_ID), 0x01);
    assertEq(registry.tokenType(Defaults.RESPONSIBILITY_TOKEN_ID), 0x02);
    assertEq(registry.tokenType(Defaults.DIRECTIVE_TOKEN_ID), 0x03);
  }

  function testFuzz_TokenType(uint256 id) public view {
    assertEq(registry.tokenType(id), uint8(id & 0xFF));
  }

  function test_IsPermission_TrueWhenPrefix01() public view {
    assertTrue(registry.isPermission(Defaults.PERMISSION_TOKEN_ID));
  }

  function test_IsPermission_FalseOtherwise() public view {
    assertFalse(registry.isPermission(Defaults.RESPONSIBILITY_TOKEN_ID));
    assertFalse(registry.isPermission(Defaults.DIRECTIVE_TOKEN_ID));
    assertFalse(registry.isPermission(Defaults.INVALID_TOKEN_ID));
  }

  function test_IsResponsibility_TrueWhenPrefix02() public view {
    assertTrue(registry.isResponsibility(Defaults.RESPONSIBILITY_TOKEN_ID));
  }

  function test_IsResponsibility_FalseOtherwise() public view {
    assertFalse(registry.isResponsibility(Defaults.PERMISSION_TOKEN_ID));
    assertFalse(registry.isResponsibility(Defaults.DIRECTIVE_TOKEN_ID));
    assertFalse(registry.isResponsibility(Defaults.INVALID_TOKEN_ID));
  }

  function test_IsDirective_TrueWhenPrefix03() public view {
    assertTrue(registry.isDirective(Defaults.DIRECTIVE_TOKEN_ID));
  }

  function test_IsDirective_FalseOtherwise() public view {
    assertFalse(registry.isDirective(Defaults.PERMISSION_TOKEN_ID));
    assertFalse(registry.isDirective(Defaults.RESPONSIBILITY_TOKEN_ID));
    assertFalse(registry.isDirective(Defaults.INVALID_TOKEN_ID));
  }

  function testFuzz_IsPermission(uint248 base) public view {
    uint256 permId = TestHelpers.makeTokenId(base, 0x01);
    uint256 otherId = TestHelpers.makeTokenId(base, 0x02);
    assertTrue(registry.isPermission(permId));
    assertFalse(registry.isPermission(otherId));
  }

  function testFuzz_IsResponsibility(uint248 base) public view {
    uint256 respId = TestHelpers.makeTokenId(base, 0x02);
    uint256 otherId = TestHelpers.makeTokenId(base, 0x01);
    assertTrue(registry.isResponsibility(respId));
    assertFalse(registry.isResponsibility(otherId));
  }

  function testFuzz_IsDirective(uint248 base) public view {
    uint256 dirId = TestHelpers.makeTokenId(base, 0x03);
    uint256 otherId = TestHelpers.makeTokenId(base, 0x01);
    assertTrue(registry.isDirective(dirId));
    assertFalse(registry.isDirective(otherId));
  }
}
