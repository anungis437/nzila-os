# Union Eyes — CI / Governance Evidence

**Captured:** 2026-05-20  
**Sprint:** noImplicitAny hardening (commit `b08e98840`)  
**Source:** Live CI gates — `pnpm typecheck`, `pnpm governance:check-db-imports`, contract tests

---

## 1. TypeScript Strict Mode — `noImplicitAny: true`

```
Command: pnpm typecheck --filter "@nzila/union-eyes"
Result:  Tasks: 3 successful, 3 total | Cached: 2 cached | Time: 1m12.96s

✅ @nzila/policies:build          — cache hit
✅ @nzila/cupe-vocabulary:build   — cache hit
✅ @nzila/union-eyes:typecheck    — 0 errors
```

**`apps/union-eyes/tsconfig.json`:**
```json
{
  "compilerOptions": {
    "noImplicitAny": true,
    "strict": true
  }
}
```

Files fixed this sprint: **46 files**, +580 / −516 lines.

Key fixes:
- `RLSTx = typeof db` (postgres.js adapter — correct for Drizzle/postgres.js)
- `withRLSContext` overloads reordered (tx-arg overloads first — required for TS overload resolution)
- `AnyColumn` → `PgColumn<any>` in all 4 self-referential FK schema lambdas
- `NodePgDatabase<any>` → `RLSTx` across all query files + `billing-cycle-service.ts`
- All `result.rows` accesses removed (postgres.js returns array-direct, not `.rows`)
- `signatures.ts` `relations()` added (required for Drizzle relational query result typing)
- `analytics-actions.ts` insert columns corrected to match `mlPredictions` schema
- `enhanced-rbac-queries.ts` line 696 typo fixed (`prevresult` → `prevResult`)

---

## 2. DB Import Guard — Zero Tolerance

```
Command: pnpm governance:check-db-imports
Result:  ✅ governance:check-db-imports — clean (0 violations)
```

**Guard script:** `scripts/check-ue-db-import-guard.ts`  
**ALLOWLIST:** `[]` (zero tolerance — no exceptions permitted)  
**CI enforcement:** included in `pnpm governance:audit`

All 14 previously raw-db-import violation files migrated to `withRLSContext` / `withSystemRLSContext` in commit `5643972ef`.

---

## 3. RLS Context Enforcement

**Enforcement type:** Fail-closed — throws on missing `organizationId`

```typescript
// apps/union-eyes/lib/db/with-rls-context.ts
if (!orgId) {
  throw new Error(
    "Organization context is required for RLS-protected operations. " +
    "Use withSystemRLSContext for system operations."
  );
}
```

**Explicit bypass wrappers:**
- `withSystemRLSContext` — for system operations (audited)
- `withPlatformAdminRLSContext` — for platform admin operations (audited)

**Cross-org regression tests:** `apps/union-eyes/tests/api/rbac.spec.ts`

---

## 4. Org-Scoped Idempotency

Intake idempotency hash includes `organizationId`:

```typescript
// apps/union-eyes/app/api/cases/intake/route.ts
const idempotencyKey = createHash('sha256')
  .update(`${organizationId}:${memberId}:${caseType}:${dateWindow}`)
  .digest('hex');
```

Prevents cross-org idempotency key collisions.

---

## 5. Prod/Staging Blast-Radius Separation (EXC-001 — Resolved)

```yaml
# .github/workflows/deploy-production.yml
env:
  AZURE_RESOURCE_GROUP: nzila-canada-prod-rg   # hardcoded — no secret substitution

# blast-radius isolation gate
- name: Blast-radius isolation gate
  run: |
    if [ "$AZURE_RESOURCE_GROUP" = "${{ vars.STAGING_RESOURCE_GROUP }}" ]; then
      echo "FATAL: Production and staging resource groups must be separate."
      exit 1
    fi
```

`reports/runtime/platform-runtime-truth-latest.json`:
```json
"productionResourceGroup": "nzila-canada-prod-rg",
"stagingResourceGroup": "nzila-canada-staging-rg",
"sharedBlastRadius": false,
"overallStatus": "HEALTHY"
```

---

## 6. Data Residency

```json
"dataResidency": {
  "status": "HEALTHY",
  "allowedRegions": ["canadacentral", "canadaeast"],
  "detectedRegions": ["canadacentral"],
  "violations": []
}
```

All 14 deployed container apps resolve to `canadacentral.azurecontainerapps.io`.

---

## 7. Hash-Chained Audit Trail

**Test suite:** `apps/union-eyes/lib/__tests__/evidence-export.lifecycle.test.ts`  
**Coverage:** append → seal → verify → tamper-detect  
**Result:** 6/6 tests pass

---

## 8. FSM Lifecycle

**Test suite:** `apps/union-eyes/lib/workflow/__tests__/case-lifecycle.test.ts`  
**Result:** 19/19 tests pass

FSM invariants enforced:
- `closed → triage` restricted to `system_admin` only
- Invalid transitions return 409
- SLA breach surfaces as warnings
- `getAllowedTransitions` validated per role

---

## 9. Correlation ID Parity (TS ↔ Django)

**Test suite:** `apps/union-eyes/backend/observability/tests/test_correlation_parity.py`  
**Result:** 5/5 parity tests pass

Headers propagated: `X-Governance-Correlation`, `X-Governance-Trace`

---

## 10. ClamAV Malware Scanning

**Implementation:** `apps/union-eyes/lib/security/clamav.ts`  
**Tests:** `apps/union-eyes/lib/security/__tests__/clamav.test.ts`  
**Contract test:** `union-eyes-malware-scan-enforcement`

---

## Evidence Gaps — Required Before Broad Production

The following evidence items require **live environment confirmation** before expanding beyond the controlled pilot:

| Item | Command / Action | Where to store |
|---|---|---|
| Prod URL smoke test | `curl https://<pilot-url>/api/health` | `reports/runtime/smoke-test-prod-YYYYMMDD.json` |
| Prod resource group confirmation | `pnpm proof:ingest:azure` | `reports/runtime/azure-runtime-latest.json` |
| Key Vault separation | Azure portal screenshot or CLI output | `reports/runtime/keyvault-separation-YYYYMMDD.txt` |
| Azure Monitor workbook export | Portal → Workbooks → Export | `reports/runtime/monitor-workbook-YYYYMMDD.json` |
| Restore drill evidence | Per `docs/union-eyes/dr/restore-drill-runbook.md` | `reports/runtime/restore-drill-YYYYMMDD.md` |

*These are operational proof items, not code items. The code is ready; the env confirmation is pending.*
