#!/usr/bin/env node
import { runSignHttp } from "./sign-http.js";
import { runPrepareTx } from "./prepare-tx.js";
import { runPrepareHttpRequest, runFinalizeHttpRequest } from "./prepare-http-request.js";

const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case "sign-http":
    await runSignHttp(args);
    break;

  case "prepare-http-request":
    await runPrepareHttpRequest(args);
    break;

  case "finalize-http-request":
    await runFinalizeHttpRequest(args);
    break;

  case "prepare-tx":
    await runPrepareTx(args);
    break;

  default:
    console.log(`Trust Zones CLI

Commands:
  sign-http              Sign an HTTP request as a zone (ERC-8128, requires --private-key)
  prepare-http-request   Prepare an HTTP request for signing (outputs message to sign)
  finalize-http-request  Finalize a signed HTTP request (outputs headers)
  prepare-tx             Prepare a transaction for zone execution (returns calldata)

Usage:
  tz sign-http --zone <addr> --url <url> --method POST --body '{}' --private-key <hex> --rpc-url <url>
  tz prepare-http-request --zone <addr> --url <url> --method POST --body '{}' --rpc-url <url>
  tz finalize-http-request --signature <hex> --zone <addr> --rpc-url <url> --url <url> --method POST [--body '{}']
  tz prepare-tx --zone <addr> --to <addr> --value <wei> --data <hex>
`);
    if (command) {
      console.error(`Unknown command: ${command}`);
      process.exit(1);
    }
}
