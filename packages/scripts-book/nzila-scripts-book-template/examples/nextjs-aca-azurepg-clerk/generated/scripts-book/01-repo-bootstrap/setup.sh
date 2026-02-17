#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------------------------
# setup.sh — Bootstrap courtlens-platform for local development (Unix)
# -----------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "==> Bootstrapping courtlens-platform ..."

# 1. Install pnpm dependencies
echo "--- Installing pnpm dependencies ---"
cd "$REPO_ROOT"
pnpm install --frozen-lockfile

# 2. Copy environment template if .env.local does not exist
if [ ! -f "$REPO_ROOT/.env.local" ]; then
  echo "--- Copying .env.example → .env.local ---"
  cp "$REPO_ROOT/.env.example" "$REPO_ROOT/.env.local"
else
  echo "--- .env.local already exists, skipping copy ---"
fi

# 3. Database setup placeholder
echo "--- Running database setup ---"
pnpm --filter apps/web run db:push || {
  echo "WARNING: db:push failed — verify DATABASE_URL in .env.local"
}

echo "==> Bootstrap complete. Run 'pnpm --filter apps/web run dev' to start."
