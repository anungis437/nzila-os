#!/bin/sh
# Starts the official ClamAV init (clamd + freshclam) in the background, then
# runs the HTTP adapter in the foreground as the container's main process.
# Preloaded signatures in the base image mean clamd does not need freshclam
# to succeed before it has a database to load.
set -e

echo "[start.sh] launching ClamAV (clamd + freshclam)..."
/init &
INIT_PID=$!

cleanup() {
  echo "[start.sh] signal received, shutting down..."
  kill "$INIT_PID" 2>/dev/null || true
  exit 0
}
trap cleanup TERM INT

echo "[start.sh] launching HTTP adapter on :${PORT:-8080}..."
node /opt/clamav-adapter/server.js &
NODE_PID=$!
wait "$NODE_PID"
