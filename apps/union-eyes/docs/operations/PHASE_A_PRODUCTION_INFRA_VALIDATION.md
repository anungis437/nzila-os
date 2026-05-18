# UnionEyes — Phase A: Production Infrastructure Validation

> **Phase A objective:** Remove all Clerk references from UE runtime/docs/registry, document the real auth stack, and produce an honest production readiness baseline.

---

## Phase A Checklist

### 1. Auth Reality

| Item | Status | Evidence | Owner | Notes |
|---|---|---|---|---|
| All active Clerk runtime references removed | ✅ validated | `docs/AUTH_REALITY_AUDIT.md` | Platform | Health route, env-validator, types.ts |
| Current auth stack documented | ✅ validated | `docs/AUTH_REALITY_AUDIT.md` | Platform | PG sessions primary; Entra SSO secondary |
| Historical Clerk docs archived (not deleted) | ✅ validated | `backend/docs/archive/` | Platform | CLERK_SETUP_COMPLETE.md, DJANGO_SETTINGS_GUIDE_CLERK_ERA.md |
| Regression test added | ✅ validated | `tooling/contract-tests/ue-auth-reality.test.ts` | Platform | Prevents Clerk from re-entering active UE runtime |

### 2. Runtime Env Vars

| Item | Status | Evidence | Owner | Notes |
|---|---|---|---|---|
| `AUTH_SECRET` — required, documented correctly | ✅ validated | `lib/env-validator.ts` | Platform | "Application auth/session secret (NextAuth)" |
| Stale Clerk URL vars removed | ✅ validated | `lib/env-validator.ts` | Platform | `NEXT_PUBLIC_CLERK_SIGN_IN_URL` + `NEXT_PUBLIC_CLERK_SIGN_UP_URL` removed |
| No Clerk key env vars in required set | ✅ validated | `lib/env-validator.ts` | Platform | |

### 3. Health Dependency Checks

| Item | Status | Evidence | Owner | Notes |
|---|---|---|---|---|
| Auth health check uses correct env var | ✅ validated | `app/api/health/route.ts` — `checkAuth()` | Platform | Probes `AUTH_SECRET`, not `CLERK_SECRET_KEY` |
| Health route platform contract intact | ✅ validated | `app/api/health/route.ts` | Platform | `buildRuntimeHealthResponse`, `getBuildMetadata`, `normalizeHealthChecks`, `healthStatusFromChecks`, `ok ? 200 : 503` all present |
| No Clerk-specific dependency check | ✅ validated | `app/api/health/route.ts` | Platform | |

### 4. Secrets / Key Vault

| Item | Status | Evidence | Owner | Notes |
|---|---|---|---|---|
| `AUTH_SECRET` in Key Vault (planned) | planned | `docs/PRODUCTION_TOPOLOGY.md` | DevOps | Not yet deployed |
| No Clerk secrets in Key Vault plan | ✅ validated | `docs/PRODUCTION_TOPOLOGY.md` | Platform | Removed from env vars table |

### 5. Database

| Item | Status | Evidence | Owner | Notes |
|---|---|---|---|---|
| Auth users table (`auth_users`) defined | ✅ validated | `@nzila/db/schema` — `authUsers` | Platform | PG-backed sessions |
| Organization membership table exists | ✅ validated | `db/schema-organizations.ts` | Platform | |
| Migrations run successfully (staging) | amber | `db/migrations/MANIFEST.md` | Platform | Not confirmed against prod |

### 6. Redis / Rate Limiting

| Item | Status | Evidence | Owner | Notes |
|---|---|---|---|---|
| `UPSTASH_REDIS_REST_URL` optional, not Clerk-dependent | ✅ validated | `lib/env-validator.ts` | Platform | Optional — degrades gracefully |
| Health check handles missing Redis gracefully | ✅ validated | `app/api/health/route.ts` — `checkRedis()` | Platform | Returns `ok` with note if not configured |

### 7. Evidence / Blob Storage

| Item | Status | Evidence | Owner | Notes |
|---|---|---|---|---|
| Evidence pipeline runtime check | amber | `app/api/evidence/export` | Platform | Not wired into health check (non-critical) |
| Storage env vars documented | planned | `docs/PRODUCTION_TOPOLOGY.md` | DevOps | `STORAGE_ACCOUNT_NAME`, `STORAGE_ACCOUNT_KEY` |

### 8. Observability

| Item | Status | Evidence | Owner | Notes |
|---|---|---|---|---|
| Sentry DSN optional, documented | ✅ validated | `lib/env-validator.ts` | Platform | |
| Azure Monitor / OTEL wired (staging) | ✅ validated | `docs/UE_STAGING_AUDIT.md` | Platform | |
| Governance telemetry endpoint live | ✅ validated | `app/api/governance/telemetry` | Platform | |

### 9. DNS / SSL / Domain

| Item | Status | Evidence | Owner | Notes |
|---|---|---|---|---|
| Production domain defined | planned | `docs/PRODUCTION_TOPOLOGY.md` | DevOps | `app.unioneyes.ca` |
| SSL / TLS managed by Azure Container Apps | planned | `docs/PRODUCTION_TOPOLOGY.md` | DevOps | |
| Domain not yet registered/configured | deferred | — | Founder | Depends on production deployment decision |

### 10. Backup / Restore

| Item | Status | Evidence | Owner | Notes |
|---|---|---|---|---|
| PITR retention defined | planned | `docs/PRODUCTION_CUTOVER_CHECKLIST.md` | DevOps | 7-day PITR |
| Restore procedure documented | planned | `docs/PRODUCTION_TOPOLOGY.md` | DevOps | Azure PostgreSQL native PITR |

### 11. Rollback

| Item | Status | Evidence | Owner | Notes |
|---|---|---|---|---|
| Rollback procedure documented | planned | `docs/PRODUCTION_TOPOLOGY.md` | DevOps | Azure Container Apps revision reactivation |
| Rollback tested | deferred | — | DevOps | Requires production deployment |

### 12. Incident Ownership

| Item | Status | Evidence | Owner | Notes |
|---|---|---|---|---|
| Incident owner defined | planned | `docs/PRODUCTION_TOPOLOGY.md` | Founder | |
| Runbook exists | ✅ validated | `docs/DEMO_RUNBOOK.md` | Platform | |
| OPS checklist exists | ✅ validated | `docs/OPS_VALIDATION_CHECKLIST.md` | Platform | |

### 13. Cutover Gate

| Item | Status | Evidence | Owner | Notes |
|---|---|---|---|---|
| All Phase A active Clerk refs removed | ✅ validated | This document + `AUTH_REALITY_AUDIT.md` | Platform | |
| All UE tests pass | ✅ validated | CI — 7075 unit tests + 8960 contract tests | Platform | |
| Production topology is honest | ✅ validated | `docs/PRODUCTION_TOPOLOGY.md` | Platform | Marked planned, not validated |
| Do NOT mark production ready | ✅ confirmed | `docs/FINAL_READINESS_STATUS.md` | Platform | CONTROLLED PILOT READY |

---

## Phase A Summary

**Label: PHASE A COMPLETE — AUTH REALITY TRUTHFUL**

What was done:
- Removed all active Clerk references from UE runtime code, docs, and machine-readable registry
- Documented the real auth stack: PG-backed password sessions (primary) + Entra SSO (secondary)
- Fixed health check to probe `AUTH_SECRET` instead of Clerk keys
- Corrected env-validator to remove stale Clerk URL vars
- Updated all production topology docs to reflect real auth architecture
- Added regression test (`tooling/contract-tests/ue-auth-reality.test.ts`) to prevent Clerk from re-entering

What remains before production (Phase B+):
- Actual deployment to Azure Container Apps
- Domain registration and DNS configuration
- Key Vault provisioning and secret injection
- Blob storage provisioning
- Production smoke tests
- Rollback procedure validation
