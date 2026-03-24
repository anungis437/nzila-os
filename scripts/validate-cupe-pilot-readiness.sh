#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# CUPE Pilot Readiness Validation
# ──────────────────────────────────────────────────────────────────────────────
#
# Runs all CUPE-specific tests plus contract tests and produces a validation
# report. Exit 0 = pilot-ready, exit 1 = fix issues before go-live.
#
# Usage:
#   ./scripts/validate-cupe-pilot-readiness.sh
#
# Requirements:
#   - Node.js 20+, pnpm 10+
#   - Run from repo root
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
WARNINGS=0

pass()    { PASS=$((PASS + 1));     echo -e "  ${GREEN}✓${NC} $1"; }
fail()    { FAIL=$((FAIL + 1));     echo -e "  ${RED}✗${NC} $1"; }
warn()    { WARNINGS=$((WARNINGS + 1)); echo -e "  ${YELLOW}⚠${NC} $1"; }

echo ""
echo "═══════════════════════════════════════════════════"
echo "  CUPE Pilot Readiness Validation"
echo "═══════════════════════════════════════════════════"
echo ""

# ── 1. CUPE vocabulary tests ─────────────────────────────────────────────────
echo "── Phase 1: Vocabulary & Taxonomy ──"

if npx vitest run --project cupe-vocabulary --reporter=dot 2>&1 | tail -1 | grep -q "passed"; then
  pass "CUPE vocabulary tests pass"
else
  fail "CUPE vocabulary tests failed"
fi

# ── 2. Contract tests ────────────────────────────────────────────────────────
echo ""
echo "── Phase 2: Contract Tests ──"

if npx vitest run --project contract-tests --reporter=dot 2>&1 | tail -1 | grep -q "passed"; then
  pass "Contract tests pass (vertical governance, auth guards)"
else
  fail "Contract tests failed"
fi

# ── 3. Documentation ─────────────────────────────────────────────────────────
echo ""
echo "── Phase 3: Documentation ──"

DOCS=(
  "docs/CUPE_RBAC_MATRIX.md"
  "docs/CUPE_MALWARE_CONTROL_BOUNDARY.md"
  "docs/CUPE_PILOTING_QUICK_START.md"
  "docs/CUPE_PILOT_ADMIN_RUNBOOK.md"
  "docs/CUPE_PILOT_USER_GUIDE.md"
  "docs/CUPE_PILOT_SUPPORT_SOP.md"
  "docs/CUPE_PILOT_ROLLBACK_RUNBOOK.md"
  "docs/CUPE_READINESS_CHECKLIST.md"
  "docs/CUPE_PILOT_GO_NO_GO_REVIEW.md"
)

for doc in "${DOCS[@]}"; do
  if [ -f "$doc" ]; then
    pass "$doc exists"
  else
    fail "$doc missing"
  fi
done

# ── 4. Source modules ─────────────────────────────────────────────────────────
echo ""
echo "── Phase 4: Source Modules ──"

MODULES=(
  "apps/union-eyes/lib/audited-case-mutations.ts"
  "apps/union-eyes/lib/evidence-export.ts"
  "apps/union-eyes/lib/action-enforcer.ts"
  "apps/union-eyes/lib/blob-manager.ts"
  "apps/union-eyes/lib/dashboard-metrics.ts"
  "apps/union-eyes/app/api/cases/[caseId]/audit/route.ts"
  "apps/union-eyes/app/api/cases/[caseId]/export/route.ts"
)

for mod in "${MODULES[@]}"; do
  if [ -f "$mod" ]; then
    pass "$mod exists"
  else
    fail "$mod missing"
  fi
done

# ── 5. Auth guards ───────────────────────────────────────────────────────────
echo ""
echo "── Phase 5: Auth Guards ──"

ROUTES=(
  "apps/union-eyes/app/api/vocabulary/route.ts"
  "apps/union-eyes/app/api/vocabulary/case-types/route.ts"
  "apps/union-eyes/app/api/vocabulary/priorities/route.ts"
  "apps/union-eyes/app/api/vocabulary/roles/route.ts"
  "apps/union-eyes/app/api/vocabulary/severities/route.ts"
  "apps/union-eyes/app/api/vocabulary/statuses/route.ts"
  "apps/union-eyes/app/api/admin/seed-cupe-pilot/route.ts"
)

for route in "${ROUTES[@]}"; do
  if grep -q "withApiAuth\|withRoleAuth\|withAdminAuth" "$route" 2>/dev/null; then
    pass "$route has auth guard"
  else
    fail "$route missing auth guard"
  fi
done

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo -e "  Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}, ${YELLOW}${WARNINGS} warnings${NC}"
echo "═══════════════════════════════════════════════════"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}PILOT NOT READY — fix failures above before go-live.${NC}"
  exit 1
else
  echo -e "${GREEN}PILOT READY — all validation checks passed.${NC}"
  exit 0
fi
