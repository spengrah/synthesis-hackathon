import { encodeAbiParameters, decodeAbiParameters, type Hex } from "viem";

/**
 * Pack otherImmutableArgs + initData into the TZMechanism.data field
 * for HatsModule mechanisms.
 *
 * Convention: data = abi.encode(bytes otherImmutableArgs, bytes initData)
 * Agreement.sol splits them when calling HatsModuleFactory.
 */
export function packHatsModuleData(otherImmutableArgs: Hex, initData: Hex): Hex {
  return encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes" }],
    [otherImmutableArgs, initData],
  );
}

/**
 * Unpack TZMechanism.data for HatsModule mechanisms.
 * Returns the otherImmutableArgs and initData components.
 */
export function unpackHatsModuleData(data: Hex): {
  immutableArgs: Hex;
  initData: Hex;
} {
  const [immutableArgs, initData] = decodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes" }],
    data,
  );
  return {
    immutableArgs: immutableArgs as Hex,
    initData: initData as Hex,
  };
}
