# UnionEyes — Staging Environment Audit

> **Status**: AMBER (operationally instrumented; full procurement pass pending)
> **Last reviewed**: as of this PR
> **Owner**: union domain
> **Authority**: This file documents what is real in staging vs what is mocked/degraded. Trust this file over marketing language.

## 1. Active integrations

| Integration | Status | Notes |
|---|---|---|
| Postgres (Drizzle) | ✅ Active | `DATABASE_URL` required at boot; fail-closed when absent. |
| Application auth (`@nzila/platform-auth`) — PG sessions (primary), Entra SSO (secondary) | ✅ Active | `AUTH_SECRET` required at boot; fail-closed when absent. |
| Upstash Redis (rate limiting) | ✅ Active when configured | `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. Rate limiter fails-closed if Redis unreachable in production. |
| OpenTelemetry (`@nzila/os-core/telemetry`) | ✅ Active | Initialised first in `instrumentation.ts`. |
| Sentry | ✅ Active | `sentry.server.config.ts` + `sentry.edge.config.ts` loaded conditionally. |
| Azure Monitor | ⚠️ Partial | OTel hooks present; workbook compatibility documented in `ops/azure/`. |
| Governance runtime (`@nzila/governance-middleware`) | ✅ Active | Bound at boot via `lib/governance/runtime.ts`. |
| Evidence pipeline (`evidence:collect` → `seal` → `verify`) | ✅ Active | `pnpm evidence:all`. |
| Staging seed | ✅ Active | `pnpm -C apps/union-eyes staging:seed` (deterministic, idempotent). |
| Pilot demo runtime | ⚠️ Mode-aware | Validated at boot; emits truthful startup banner. |

## 2. Degraded / mocked integrations

| Item | Reality | Mitigation |
|---|---|---|
| `/api/metrics` (root) | Historical CRUD route over `analytics_metrics` table — NOT a Prometheus-style operational endpoint. | Use `/api/metrics/operational` for ops dashboards (claims/workflow KPIs). |
| Production `DJANGO_API_URL` | Optional; UE health endpoint treats it as `degraded` when unreachable, `ok` when not configured. | `HEALTH_REQUIRE_QUEUE=true` to make it required. |
| `BUILD_TIMESTAMP` | Falls back to runtime ISO timestamp when unset. | Set at build time in CI. |

## 3. Boot-time runtime assertions (`instrumentation.ts`)

Validated at every Node.js startup:

1. OTel initialisation (non-fatal warn if it fails)
2. os-core env validation (`@nzila/os-core/config`)
3. Legacy env validation (`lib/config/env-validation`)
4. **Critical env vars (fail-closed)**: `DATABASE_URL`, `AUTH_SECRET`
5. Tier 2 fail-closed runtime gate (`lib/runtime/fail-closed`) under `RUNTIME_FAIL_CLOSED=true`
6. Pilot demo runtime mode classification
7. DB startup checks (`lib/db-validator`) unless `SKIP_DB_STARTUP_CHECK=true`
8. Redis connectivity (logged as CRITICAL in production when missing)

## 4. Operational endpoints

| Endpoint | Source | Purpose |
|---|---|---|
| `GET /api/health` | `app/api/health/route.ts` | Liveness + dependency checks (DB, optional queue). 503 when degraded. |
| `GET /api/health/liveness` | `app/api/health/liveness/route.ts` | Pure liveness ping (no deps). |
| `GET /api/metrics/operational` | `app/api/metrics/operational/route.ts` | Claims/workflow/queue/SLA KPIs from real DB. |
| `GET /api/governance/telemetry` | `app/api/governance/telemetry/route.ts` | Policy denied, audit volume, workflow transition errors, evidence exports. |
| `GET /api/evidence/export` | `app/api/evidence/export/route.ts` | Procurement-safe evidence pack summary. |

## 5. Expected runtime limitations

- The staging org is `STAGING_SEED_ORG_ID` (default `org_demo_unioneyes_staging`). Seed scenarios are inserted **only** into that org and are tagged `staging-deterministic`.
- The `/api/governance/telemetry` `policy_denied_count` is the sum of in-process counter + DB `policy_evaluations` rows with `action_taken='denied' OR passed=false`. Process restarts reset the in-process portion.
- Evidence export endpoint returns a **summary**, not a sealed bundle. The sealed bundle is produced by `pnpm evidence:all` and stored under `apps/union-eyes/reports/evidence/`.

## 6. Recovery instructions

| Failure | Recovery |
|---|---|
| `FATAL: missing critical env vars: DATABASE_URL, AUTH_SECRET` | Set in deployment config; restart. |
| Redis ping fails | Rate-limited endpoints will reject in production; restore Redis or temporarily lift `RATE_LIMIT_*`. |
| DB startup check fails | Run `pnpm -C apps/union-eyes db:validate`; check `DATABASE_URL` and migrations. |
| Governance runtime not bound | Restart with `NODE_ENV=staging`; ensure `@nzila/governance-middleware` resolves. |
| Demo data stale | `pnpm -C apps/union-eyes staging:seed` re-applies deterministic scenarios idempotently. |

## 7. Known gaps (documented, not hidden)

- Full E2E coverage of `arbitration → settled` lifecycle exists in `e2e/stakeholder-demo-journeys.spec.ts` but the assertions only cover happy-path. Negative-path arbitration tests deferred.
- Cross-org leakage tests live in `security/redteam/adversarial.test.ts` and pass; **but** a fuzzing test for unscoped queries across the 300+ tables is not yet automated.
- Performance/load profile under concurrent demo usage is not yet benchmarked. See `OPS_VALIDATION_CHECKLIST.md` § "before-demo".
