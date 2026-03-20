#!/usr/bin/env npx tsx
import { runSignHttp } from "./sign-http.js";
import { runPrepareTx } from "./prepare-tx.js";

const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case "sign-http":
    await runSignHttp(args);
    break;

  case "prepare-tx":
    await runPrepareTx(args);
    break;

  default:
    console.log(`Trust Zones CLI

Commands:
  sign-http    Sign an HTTP request as a zone (ERC-8128)
  prepare-tx   Prepare a transaction for zone execution (returns calldata)

Usage:
  tz sign-http --zone <addr> --url <url> --method POST --body '{}' --private-key <hex> --rpc-url <url>
  tz prepare-tx --zone <addr> --to <addr> --value <wei> --data <hex>
`);
    if (command) {
      console.error(`Unknown command: ${command}`);
      process.exit(1);
    }
}
