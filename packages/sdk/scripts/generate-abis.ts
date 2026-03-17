import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTRACTS_OUT = join(__dirname, "../../contracts/out");
const ABIS_DIR = join(__dirname, "../src/abis");

const contracts = [
  { name: "Agreement", path: "Agreement.sol/Agreement.json" },
  {
    name: "AgreementRegistry",
    path: "AgreementRegistry.sol/AgreementRegistry.json",
  },
  { name: "TrustZone", path: "TrustZone.sol/TrustZone.json" },
  { name: "HatValidator", path: "HatValidator.sol/HatValidator.json" },
  {
    name: "ResourceTokenRegistry",
    path: "ResourceTokenRegistry.sol/ResourceTokenRegistry.json",
  },
];

mkdirSync(ABIS_DIR, { recursive: true });

for (const contract of contracts) {
  const artifactPath = join(CONTRACTS_OUT, contract.path);
  const artifact = JSON.parse(readFileSync(artifactPath, "utf-8"));
  const abi = artifact.abi;

  const output = `export const ${contract.name}ABI = ${JSON.stringify(abi, null, 2)} as const;\n`;
  const outPath = join(ABIS_DIR, `${contract.name}.ts`);
  writeFileSync(outPath, output);
  console.log(`Generated ${outPath}`);
}
