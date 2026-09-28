#!/usr/bin/env bash
# E6-C: prove an affected typecheck closure or run the full universe.
# A zero-task affected result is not a pass. Unknown modes fail the job.
set -euo pipefail

BASE="${TYPECHECK_BASE:-}"
HEAD="${TYPECHECK_HEAD:-}"
ROOT="$(git rev-parse --show-toplevel)"
CHECKOUT="$(git rev-parse HEAD)"
PLAN_FILE="${TYPECHECK_PLAN_FILE:-${RUNNER_TEMP:-/tmp}/affected-typecheck-plan.json}"

set +e
node "$ROOT/tooling/ci/affected-typecheck-plan.mjs" \
  --root "$ROOT" \
  --base "$BASE" \
  --head "$HEAD" \
  --checkout "$CHECKOUT" \
  --verify-turbo \
  --out "$PLAN_FILE"
STATUS=$?
set -e

if [[ ! -f "$PLAN_FILE" ]]; then
  echo "::error::Affected typecheck planner produced no plan"
  exit 1
fi

cat "$PLAN_FILE"

read_field() {
  node -e 'const fs=require("node:fs"); const plan=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); const value=plan[process.argv[2]]; process.stdout.write(value==null?"":String(value))' "$PLAN_FILE" "$1"
}

MODE="$(read_field MODE)"
TASK_COUNT="$(read_field TASK_COUNT)"
REASON="$(read_field FALLBACK_REASON)"
DIFF_BASE="$(read_field DIFF_BASE)"
echo "affected-typecheck MODE=${MODE} TASK_COUNT=${TASK_COUNT} FALLBACK_REASON=${REASON:-none}"

if [[ "$STATUS" -ne 0 || "$MODE" == "ERROR" ]]; then
  echo "::error::Affected typecheck plan failed closed (mode=${MODE} reason=${REASON})"
  exit 1
fi

case "$MODE" in
  FULL)
    # Same portfolio command as an unresolved or global typecheck.
    pnpm typecheck
    ;;
  AFFECTED)
    if [[ "$TASK_COUNT" == "0" ]]; then
      echo "affected-typecheck zero-task refused; running full typecheck"
      pnpm typecheck
      exit $?
    fi
    mapfile -t PKGS < <(node -e 'const fs=require("node:fs"); const plan=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(!Array.isArray(plan.AFFECTED_PACKAGES)||plan.AFFECTED_PACKAGES.length===0) process.exit(3); for (const pkg of plan.AFFECTED_PACKAGES) console.log(pkg)' "$PLAN_FILE")
    args=()
    for pkg in "${PKGS[@]}"; do
      [[ -n "$pkg" ]] || continue
      args+=("--filter=${pkg}")
    done
    if [[ "${#args[@]}" -eq 0 ]]; then
      echo "affected-typecheck empty filter refused; running full typecheck"
      pnpm typecheck
      exit $?
    fi
    TURBO_SCM_BASE="${DIFF_BASE:-$BASE}" TURBO_SCM_HEAD="$HEAD" \
      pnpm exec turbo run typecheck "${args[@]}"
    ;;
  NOT_APPLICABLE)
    echo "Lint & Typecheck: every changed path is proven irrelevant to typecheck"
    ;;
  *)
    echo "::error::Refusing unknown affected-typecheck mode: ${MODE}"
    exit 1
    ;;
esac
