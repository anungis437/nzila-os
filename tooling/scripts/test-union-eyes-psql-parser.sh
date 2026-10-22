#!/usr/bin/env bash
# Shell boundary regression: realistic stdout/stderr/exit status, no database.
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
parse() {
  PSQL_TEST_STDERR="${1:-}" PSQL_TEST_STATUS="${2:-0}" node --input-type=module -e '
    import fs from "node:fs";
    import { parsePsqlFrames, numericCount } from "./tooling/scripts/lib/union-eyes-staging-proof.mjs";
    try {
      const frames = parsePsqlFrames(fs.readFileSync(0, "utf8"), process.env.PSQL_TEST_STDERR, Number(process.env.PSQL_TEST_STATUS), ["emptyContext"]);
      process.stdout.write(String(numericCount(frames.emptyContext)));
    } catch { process.exitCode = 1; }
  '
}
accepted="$(printf 'BEGIN\nSET\n\nUE_emptyContext=0\nROLLBACK\n' | parse)"
[ "$accepted" = 0 ]
accepted="$(printf 'BEGIN\nUE_emptyContext=12\nROLLBACK\n' | parse)"
[ "$accepted" = 12 ]
for bad in '' 'BEGIN\nROLLBACK' 'UE_emptyContext=' 'UE_emptyContext=ROLLBACK' \
  'UE_emptyContext=0\nUE_emptyContext=0' 'UE_emptyContext=0\n1' \
  'ERROR: relation does not exist\nUE_emptyContext=0' 'UE_emptyContext=-1' \
  'UE_emptyContext=1.5' 'UE_emptyContext=NaN' 'UE_emptyContext=9007199254740992'; do
  if printf '%b\n' "$bad" | parse; then echo 'malformed result accepted' >&2; exit 1; fi
done
if printf 'UE_emptyContext=0\n' | parse 'ERROR: connection lost' 0; then exit 1; fi
if printf 'UE_emptyContext=0\n' | parse '' 3; then exit 1; fi
echo 'psql parser shell regression: 15 cases passed'
