#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------------------------
# migrate.sh — Run pending database migrations (Unix)
# -----------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Ensure DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set. Export it or add it to .env.local."
  exit 1
fi

echo "==> Running database migrations ..."

cd "$REPO_ROOT"
pnpm --filter apps/web run db:migrate

echo "==> Migrations applied successfully."
