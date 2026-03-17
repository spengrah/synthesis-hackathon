#!/usr/bin/env bash
set -euo pipefail

CONTRACTS_DIR="packages/contracts"
# shellcheck source=/dev/null
[ -f "$CONTRACTS_DIR/.env" ] && source "$CONTRACTS_DIR/.env"

FORK_BLOCK="${FORK_BLOCK:-43454644}"
FORK_PORT="${FORK_PORT:-8545}"
ANVIL_PID="$CONTRACTS_DIR/.anvil.pid"
FOUNDRY_TOML="$CONTRACTS_DIR/foundry.toml"

is_running() {
  [ -f "$ANVIL_PID" ] && kill -0 "$(cat "$ANVIL_PID")" 2>/dev/null
}

start() {
  if is_running; then
    echo "Anvil already running (pid $(cat "$ANVIL_PID"))"
    return 0
  fi

  echo "Starting Anvil fork (this may take a moment on first run)..."
  anvil \
    --fork-url "https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}" \
    --fork-block-number "$FORK_BLOCK" \
    --fork-retry-backoff 3000 \
    --port "$FORK_PORT" \
    --silent &
  echo $! > "$ANVIL_PID"

  for i in $(seq 1 10); do
    sleep 2
    if ! kill -0 "$(cat "$ANVIL_PID")" 2>/dev/null; then
      echo "Anvil exited — likely RPC rate-limited. Wait a minute and retry."
      rm -f "$ANVIL_PID"
      exit 1
    fi
    if curl -sf "http://localhost:$FORK_PORT" -X POST \
      -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' >/dev/null 2>&1; then
      echo "Anvil fork running on :$FORK_PORT (pid $(cat "$ANVIL_PID"))"
      break
    fi
    if [ "$i" = 10 ]; then
      echo "Anvil did not become ready in time"
      kill "$(cat "$ANVIL_PID")" 2>/dev/null || true
      rm -f "$ANVIL_PID"
      exit 1
    fi
  done

  sed -i '' "s|^base = .* # managed by.*|base = \"http://localhost:$FORK_PORT\" # managed by anvil-fork.sh|" "$FOUNDRY_TOML"
  echo "foundry.toml base RPC → localhost:$FORK_PORT"
}

stop() {
  if [ -f "$ANVIL_PID" ]; then
    kill "$(cat "$ANVIL_PID")" 2>/dev/null || true
    rm -f "$ANVIL_PID"
    echo "Anvil stopped"
  else
    echo "No Anvil pid file found"
  fi
  sed -i '' "s|^base = .* # managed by.*|base = \"https://base-mainnet.g.alchemy.com/v2/\${ALCHEMY_API_KEY}\" # managed by anvil-fork.sh|" "$FOUNDRY_TOML"
  echo "foundry.toml base RPC → Alchemy"
}

status() {
  if is_running; then
    echo "Anvil running (pid $(cat "$ANVIL_PID"), port $FORK_PORT)"
  else
    echo "Anvil not running"
  fi
}

ensure() {
  # Start fork if not already running; used as a pre-step for test scripts
  if ! is_running; then
    start
  fi
}

case "${1:-help}" in
  start)  start ;;
  stop)   stop ;;
  status) status ;;
  ensure) ensure ;;
  *)
    echo "Usage: $0 {start|stop|status|ensure}"
    exit 1
    ;;
esac
