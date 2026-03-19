import {
  compile,
  decompile,
  createDefaultRegistry,
  BASE_MAINNET_CONFIG,
  type TZSchemaDocument,
} from "@trust-zones/compiler";
import { encodePropose, decodeProposalData } from "@trust-zones/sdk";
import { keccak256, type Hex } from "viem";

const registry = createDefaultRegistry();
const config = BASE_MAINNET_CONFIG;

export function handleCompile(args: { tzSchemaDoc: TZSchemaDocument }): {
  proposalData: Hex;
  termsHash: Hex;
} {
  const proposalData = compile(args.tzSchemaDoc, config, registry);
  const encoded = encodePropose(proposalData);
  const termsHash = keccak256(encoded.payload);

  return {
    proposalData: encoded.payload,
    termsHash,
  };
}

export function handleDecompile(args: { proposalData: Hex }): {
  tzSchemaDoc: TZSchemaDocument;
} {
  const proposalData = decodeProposalData(args.proposalData);
  const tzSchemaDoc = decompile(proposalData, config, registry);
  return { tzSchemaDoc };
}
