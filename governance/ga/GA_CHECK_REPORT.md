# GA Gate v2 — Check Report

**Overall**: ❌ FAIL
**Commit**: `60f947a`
**Timestamp**: 2026-02-21T20:23:28.821Z
**Duration**: 117ms
**CI**: No

## Summary

| Metric | Value |
|--------|-------|
| Total checks | 16 |
| Passed | 13 |
| Failed | 3 |

## Gate Results

| Status | Gate | Details | Duration |
|--------|------|---------|----------|
| ❌ | Org boundary: No raw DB imports in app code | 70 violation(s) found | 40ms |
| ✅ | Org boundary: Org-scoped registry exists and consistent | Org-scoped registry present with both ORG_SCOPED_TABLES and NON_ORG_SCOPED_TABLES | 0ms |
| ✅ | Hash chain: Module + append-only tables tracked | Hash module exists, 3 append-only tables tracked | 0ms |
| ✅ | Governance profiles: Registry exists + validation | Profile registry with immutable controls + validation | 0ms |
| ❌ | Auth middleware: All apps have Clerk middleware | 1 app(s) missing auth middleware | 1ms |
| ❌ | Audited writes: withAudit used in API guards | 4 app(s) missing audited writes | 0ms |
| ✅ | Audited writes: Audit module blocks on failure | Audit emission is mandatory (blocks on failure) | 0ms |
| ✅ | Evidence: verifySeal exported from seal module | generateSeal + verifySeal both exported | 1ms |
| ✅ | Evidence: governance workflow includes verifySeal step | Governance workflow includes evidence seal verification | 0ms |
| ✅ | CI gates: Required security checks present in workflows | All 5 required CI checks present in workflows | 2ms |
| ✅ | CI gates: Governance workflow exists | nzila-governance.yml + ci.yml both present | 0ms |
| ✅ | ESLint: All apps enforce boundary rules | All 4 apps enforce 3 boundary rules | 1ms |
| ✅ | Contract tests: ≥20 test files exist | 36 contract test files (require ≥20) | 0ms |
| ✅ | CODEOWNERS: Governance files have ownership | All governance paths have code ownership | 1ms |
| ✅ | Red-team: Nightly red-team workflow exists | Red-team nightly workflow with schedule trigger present | 0ms |
| ✅ | Red-team: Outputs included as evidence artifacts | Red-team outputs uploaded as artifacts, test files present | 0ms |

## Violations

### Org boundary: No raw DB imports in app code

- apps\console\app\(dashboard)\console\ai\actions\page.tsx (unscoped db from barrel)
- apps\console\app\(dashboard)\console\ai\knowledge\page.tsx (unscoped db from barrel)
- apps\console\app\(dashboard)\console\ai\models\page.tsx (unscoped db from barrel)
- apps\console\app\(dashboard)\console\ai\overview\page.tsx (unscoped db from barrel)
- apps\console\app\(dashboard)\console\ai\usage\page.tsx (unscoped db from barrel)
- apps\console\app\(dashboard)\console\finance\stripe\page.tsx (unscoped db from barrel)
- apps\console\app\(dashboard)\settings\billing\page.tsx (unscoped db from barrel)
- apps\console\app\(dashboard)\settings\integrations\page.tsx (unscoped db from barrel)
- apps\console\app\api\ai\actions\approve\route.ts (unscoped db from barrel)
- apps\console\app\api\ai\actions\execute\route.ts (unscoped db from barrel)
- apps\console\app\api\ai\actions\finance\stripe-monthly-reports\route.ts (unscoped db from barrel)
- apps\console\app\api\ai\actions\knowledge\ingest\route.ts (unscoped db from barrel)
- apps\console\app\api\ai\actions\propose\route.ts (unscoped db from barrel)
- apps\console\app\api\ai\prompts\route.ts (unscoped db from barrel)
- apps\console\app\api\ai\prompts\versions\route.ts (unscoped db from barrel)
- apps\console\app\api\ai\rag\query\route.ts (unscoped db from barrel)
- apps\console\app\api\analytics\route.ts (unscoped db from barrel)
- apps\console\app\api\approvals\route.ts (unscoped db from barrel)
- apps\console\app\api\audit\verify-chain\route.ts (unscoped db from barrel)
- apps\console\app\api\entities\route.ts (unscoped db from barrel)
- apps\console\app\api\entities\[entityId]\approvals\route.ts (unscoped db from barrel)
- apps\console\app\api\entities\[entityId]\audit\route.ts (unscoped db from barrel)
- apps\console\app\api\entities\[entityId]\compliance\route.ts (unscoped db from barrel)
- apps\console\app\api\entities\[entityId]\documents\route.ts (unscoped db from barrel)
- apps\console\app\api\entities\[entityId]\equity\cap-table\route.ts (unscoped db from barrel)
- apps\console\app\api\entities\[entityId]\equity\certificates\route.ts (unscoped db from barrel)
- apps\console\app\api\entities\[entityId]\equity\ledger\route.ts (unscoped db from barrel)
- apps\console\app\api\entities\[entityId]\equity\share-classes\route.ts (unscoped db from barrel)
- apps\console\app\api\entities\[entityId]\filings\route.ts (unscoped db from barrel)
- apps\console\app\api\entities\[entityId]\governance-actions\route.ts (unscoped db from barrel)
- apps\console\app\api\entities\[entityId]\meetings\route.ts (unscoped db from barrel)
- apps\console\app\api\entities\[entityId]\people\route.ts (unscoped db from barrel)
- apps\console\app\api\entities\[entityId]\resolutions\route.ts (unscoped db from barrel)
- apps\console\app\api\entities\[entityId]\route.ts (unscoped db from barrel)
- apps\console\app\api\entities\[entityId]\shareholders\route.ts (unscoped db from barrel)
- apps\console\app\api\entities\[entityId]\year-end\route.ts (unscoped db from barrel)
- apps\console\app\api\finance\close\route.ts (unscoped db from barrel)
- apps\console\app\api\finance\close\[periodId]\route.ts (unscoped db from barrel)
- apps\console\app\api\finance\governance-links\route.ts (unscoped db from barrel)
- apps\console\app\api\finance\indirect-tax\accounts\route.ts (unscoped db from barrel)
- apps\console\app\api\finance\indirect-tax\periods\route.ts (unscoped db from barrel)
- apps\console\app\api\finance\indirect-tax\periods\[periodId]\route.ts (unscoped db from barrel)
- apps\console\app\api\finance\indirect-tax\summary\route.ts (unscoped db from barrel)
- apps\console\app\api\finance\tax\filings\route.ts (unscoped db from barrel)
- apps\console\app\api\finance\tax\installments\route.ts (unscoped db from barrel)
- apps\console\app\api\finance\tax\notices\route.ts (unscoped db from barrel)
- apps\console\app\api\finance\tax\profiles\route.ts (unscoped db from barrel)
- apps\console\app\api\finance\tax\years\route.ts (unscoped db from barrel)
- apps\console\app\api\finance\tax\years\[taxYearId]\route.ts (unscoped db from barrel)
- apps\console\app\api\finance\year-end-pack\route.ts (unscoped db from barrel)
- apps\console\app\api\ml\models\active\route.ts (unscoped db from barrel)
- apps\console\app\api\ml\models\route.ts (unscoped db from barrel)
- apps\console\app\api\ml\runs\inference\route.ts (unscoped db from barrel)
- apps\console\app\api\ml\runs\training\route.ts (unscoped db from barrel)
- apps\console\app\api\ml\scores\stripe\daily\route.ts (unscoped db from barrel)
- apps\console\app\api\ml\scores\stripe\transactions\route.ts (unscoped db from barrel)
- apps\console\app\api\ml\scores\ue\cases\priority\route.ts (unscoped db from barrel)
- apps\console\app\api\ml\scores\ue\cases\sla-risk\route.ts (unscoped db from barrel)
- apps\console\app\api\qbo\callback\route.ts (unscoped db from barrel)
- apps\console\app\api\qbo\status\route.ts (unscoped db from barrel)
- apps\console\app\api\qbo\sync\route.ts (unscoped db from barrel)
- apps\console\app\api\stripe\refunds\approve\route.ts (unscoped db from barrel)
- apps\console\app\api\stripe\refunds\route.ts (unscoped db from barrel)
- apps\console\app\api\stripe\subscriptions\route.ts (unscoped db from barrel)
- apps\console\app\api\stripe\webhooks\route.ts (unscoped db from barrel)
- apps\console\app\api\webhooks\stripe\route.ts (unscoped db from barrel)
- apps\console\lib\api-guards.ts (unscoped db from barrel)
- apps\console\lib\audit-db.ts (unscoped db from barrel)
- apps\console\lib\governance\state-machine.ts (unscoped db from barrel)
- apps\partners\lib\partner-auth.ts (unscoped db from barrel)

### Auth middleware: All apps have Clerk middleware

- apps/union-eyes: no middleware.ts

### Audited writes: withAudit used in API guards

- apps/web: missing lib/api-guards.ts
- apps/console: api-guards.ts does not use withAudit/createAuditedScopedDb
- apps/partners: missing lib/api-guards.ts
- apps/union-eyes: missing lib/api-guards.ts


## Environment

- **Node**: v24.13.1
- **Platform**: win32
- **CWD**: C:\APPS\nzila-automation

---
*Generated by `pnpm ga-check` — Nzila OS GA Gate v2*
