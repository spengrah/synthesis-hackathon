#!/usr/bin/env bash
# Generate 3 agent keypairs and save to .env.agents (gitignored).
# Only addresses are printed to stdout — private keys stay in the file.

set -euo pipefail

OUTFILE="$(git rev-parse --show-toplevel)/.env.agents"

if [ -f "$OUTFILE" ]; then
  echo "ERROR: $OUTFILE already exists. Delete it first if you want to regenerate."
  exit 1
fi

echo "Generating 3 agent keypairs..."

# Generate keypairs via cast, extract address + private key
for ROLE in TEMPTEE COUNTERPARTY ADJUDICATOR; do
  OUTPUT=$(cast wallet new --json)
  ADDRESS=$(echo "$OUTPUT" | jq -r '.[0].address')
  PRIVKEY=$(echo "$OUTPUT" | jq -r '.[0].private_key')

  echo "${ROLE}_ADDRESS=${ADDRESS}" >> "$OUTFILE"
  echo "${ROLE}_PRIVATE_KEY=${PRIVKEY}" >> "$OUTFILE"
  echo "" >> "$OUTFILE"

  echo "  ${ROLE}: ${ADDRESS}"
done

chmod 600 "$OUTFILE"
echo ""
echo "Keys saved to $OUTFILE (gitignored, chmod 600)"
echo "Fund these addresses with testnet ETH before running."
