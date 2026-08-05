#!/usr/bin/env bash
# Rebuild and restart the standalone server, guaranteeing the port is free.
#
# Exists because a stale server silently keeps port 3000 and the new one exits
# with EADDRINUSE into a log nobody is reading — so the browser shows the
# previous build and you debug code that is not running. That cost two rounds
# on 2026-08-05.
#
# Usage: ./scripts/restart.sh [port]
set -euo pipefail

PORT="${1:-3000}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="${HERE}/.next/server.log"

cd "$HERE"

# Kill whatever holds the port, then WAIT for it to actually let go. `kill`
# returns immediately; the socket lingers.
if lsof -ti:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Freeing port ${PORT}…"
  lsof -ti:"$PORT" -sTCP:LISTEN | xargs kill 2>/dev/null || true
  for _ in $(seq 1 20); do
    lsof -ti:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 || break
    sleep 0.5
  done
fi

if lsof -ti:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port ${PORT} is still held. Not starting a second server." >&2
  exit 1
fi

echo "Building…"
npm run build >/dev/null

echo "Starting…"
npm start > "$LOG" 2>&1 &

# Wait for it to answer, rather than sleeping a guessed number of seconds.
for _ in $(seq 1 40); do
  if curl -sf -o /dev/null "http://127.0.0.1:${PORT}/api/health"; then
    echo "Ready on http://localhost:${PORT}"
    exit 0
  fi
  sleep 0.5
done

echo "Server did not answer in 20s. Log:" >&2
tail -20 "$LOG" >&2
exit 1
