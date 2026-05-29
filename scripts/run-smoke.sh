#!/usr/bin/env bash
# Boots the target implementation's built artifact, waits for the port,
# runs the smoke harness, then tears the server down. Usable from any
# example project's `pnpm smoke` script:
#
#   "smoke": "pnpm build && bash ../scripts/run-smoke.sh"
#
# Env overrides:
#   PORT       — default 3000
#   START_CMD  — default "node dist/main.js"
#   BASE_URL   — default "http://localhost:$PORT" (passed to the harness)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-3000}"
START_CMD="${START_CMD:-node dist/main.js}"
BASE_URL="${BASE_URL:-http://localhost:${PORT}}"

echo "▶ Booting server: ${START_CMD} (PORT=${PORT})"

# Boot in the background; suppress stdout, keep stderr for crashes.
${START_CMD} >/dev/null 2>server.log &
SERVER_PID=$!

cleanup() {
  echo ""
  echo "▶ Stopping server (pid ${SERVER_PID})"
  kill "${SERVER_PID}" 2>/dev/null || true
  wait "${SERVER_PID}" 2>/dev/null || true
  rm -f server.log
}
trap cleanup EXIT INT TERM

# Wait up to 30s for the port to accept connections.
echo "▶ Waiting for ${BASE_URL} ..."
for _ in $(seq 1 150); do
  if curl -sf -o /dev/null "${BASE_URL}" 2>/dev/null || \
     curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}" 2>/dev/null | grep -qE '^[0-9]+$'; then
    break
  fi
  sleep 0.2
done

# Final sanity poll — if it's still not responding, fail with the server log.
if ! curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}" 2>/dev/null | grep -qE '^[0-9]+$'; then
  echo "✗ server did not respond at ${BASE_URL}"
  echo "--- server.log (last 50 lines) ---"
  tail -n 50 server.log || true
  exit 1
fi

echo "▶ Running smoke harness ..."
# Node 22.6+ strips TS types natively; no runner needed.
BASE_URL="${BASE_URL}" node "${SCRIPT_DIR}/smoke.ts"
