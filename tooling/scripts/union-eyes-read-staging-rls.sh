#!/usr/bin/env bash
# Database-only evidence. No candidate revision is asserted by this runner.
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/union-eyes-read-staging-rls.mjs" "$@"
