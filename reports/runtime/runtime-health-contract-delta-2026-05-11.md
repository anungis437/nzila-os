# Runtime Health Contract — Delta-2 Evidence

- Date: 2026-05-11
- Branch: `feat/ue-kt-handover-lifecycle`
- Commit: `4ad83815f` (this delta), follows `70dabdbe2` (Delta-1, PR #502)
- Scope: shared runtime health contract + orchestrator-api hardening

## Executive Verdict

The portfolio now has a **mechanically trustworthy** runtime health contract. The
new helper makes the difference between "service is failing" and "service is
running but a non-critical dependency is missing" explicit and uniform across
apps. The orchestrator-api liveness collapse — root cause of 3 of the
20 failing endpoints in `reports/runtime/live-health-failure-matrix.json` — is
fixed at the source: an unset `GITHUB_TOKEN` no longer trips the ACA
`HEALTHCHECK` and drops ingress.

No truth-overstatement was introduced. Custom-domain failures (Veridian,
Flow staging custom domain) remain explicitly classified and surfaced.

## Files Reviewed / Changed

| Path | Change |
|---|---|
| [packages/os-core/src/health.ts](../../packages/os-core/src/health.ts) | +runtime contract types & helpers (additive) |
| [packages/os-core/src/index.ts](../../packages/os-core/src/index.ts) | re-export new symbols |
| [apps/orchestrator-api/src/routes/health.ts](../../apps/orchestrator-api/src/routes/health.ts) | rewritten to use helper; critical/non-critical split |
| [packages/os-core/src/__tests__/runtime-health.test.ts](../../packages/os-core/src/__tests__/runtime-health.test.ts) | new — 12 unit tests |
| [apps/orchestrator-api/Dockerfile](../../apps/orchestrator-api/Dockerfile) | reviewed only — `HEALTHCHECK` already targets `/health` (no change needed) |
| [apps/orchestrator-api/src/api-guards.ts](../../apps/orchestrator-api/src/api-guards.ts) | reviewed only — `/health` & `/health/deep` already public (no change needed) |

## Health Contract Implemented

Shared types & helpers in `@nzila/os-core/health`:

- `RuntimeHealthStatus = 'healthy' | 'degraded' | 'failing' | 'not_instrumented'`
- `RuntimeHealthCheck { status: HealthCheckState, critical?, ms?, error?, note? }`
- `RuntimeHealthResponse { ok, status, app, environment, timestamp, version, checks, customDomainStatus?, fallbackRuntimeStatus?, reason? }`
- `runtimeStatusFromChecks(checks)` — empty → `not_instrumented`; any **critical** check not `'ok'` → `failing`; any other `'fail'` → `failing`; any `'degraded'`/`'unknown'` → `degraded`; else `healthy`.
- `buildRuntimeHealthResponse(input)` — returns the canonical payload with
  `ok = status !== 'failing'`, supporting an explicit `notInstrumented`
  override and a `customDomainStatus` / `fallbackRuntimeStatus` split for
  apps fronted by a custom domain.

Behavioural contract:

- HTTP 200 when `ok === true` (`healthy` **or** `degraded` **or**
  `not_instrumented`).
- HTTP 503 only when `status === 'failing'`.
- A non-critical dependency outage degrades the response to status
  `'degraded'` with HTTP 200 — preserving liveness probes while remaining
  honest in the JSON payload.

## Orchestrator API Findings & Fix

`/health` previously treated every check as fatal: missing `GITHUB_TOKEN`
returned HTTP 503, the ACA `HEALTHCHECK wget … /health` failed, the revision
went unhealthy, ingress dropped, and **all** orchestrator endpoints
(`/`, `/health`, `/ready`) reported `"This operation was aborted"` to the
synthetic prober. That accounts for the three `staging:orchestrator-api:fallback:*`
rows in [reports/runtime/live-health-failure-matrix.json](live-health-failure-matrix.json).

After this delta:

- `/health` checks: DB (**critical**), github (non-critical — `degraded` +
  note when token absent).
- `/health/deep` checks: DB (**critical**), github (non-critical),
  eventBus (**critical**), evidence (non-critical, exercises the operating
  evidence service).
- 503 is only emitted when a critical dependency is broken, which is
  exactly what the ACA `HEALTHCHECK` should react to.

## Runtime Failure Classification (unchanged from Delta-1 evidence)

The 20 failing endpoints from `live-health-failure-matrix.json` remain
classified as advisory; this delta resolves the orchestrator-api root cause
at code level. Deployment of the new revision will retire the three
`orchestrator-api` aborted rows.

| Cluster | Endpoints | Class | Status after this delta |
|---|---|---|---|
| Veridian (site/care/admin × 2) | 6 | `staged_not_resolvable` (DNS) | unchanged — ACA app not deployed |
| Orchestrator-api fallback (root/health/ready) | 3 | ACA ingress/revision blocker | **fixed at source** — pending redeploy |
| Flow custom domain root | 1 | custom-domain advisory; fallback healthy | unchanged — split via `customDomainStatus`/`fallbackRuntimeStatus` once flow adopts helper |
| Zonga/Agrimo/Cora/Trade `/api/health` 503 | 4 | app readiness defect | unchanged — eligible for helper adoption (next delta) |
| Cfo/Agrimo/Cora/Trade/Mobility/Abr root aborted | 6 | advisory fallback ingress timeouts | unchanged |

## Verification

- `pnpm --filter @nzila/os-core test` — 55 files / 796 tests passing
  (incl. new `runtime-health.test.ts` — 12/12).
- `pnpm --filter @nzila/orchestrator-api typecheck` — clean.
- `get_errors` over the four changed paths — clean.
- Existing api-guards allowlist already covers `/health`, `/health/deep`
  and `/metrics`; Dockerfile `HEALTHCHECK` targets `/health`. No further
  guard or container changes were needed.

## Remaining Risks / Next Recommended Delta

- Helper adoption is currently limited to orchestrator-api. Cross-app
  rollout to `apps/{zonga,agrimo,cora,trade,flow}/app/api/health/route.ts`
  would let those apps express the same critical/non-critical split (and
  let Flow expose the `customDomainStatus` vs `fallbackRuntimeStatus` it
  needs). Deferred per smallest-safe-fix discipline; tracked as the next
  delta.
- Veridian ACA apps remain undeployed — DNS rows will continue to fail
  until the ACA app + custom domain bind succeed.
- The orchestrator-api fix lives at the code layer; the actual recovery
  of the 3 aborted endpoints depends on a CI build + ACA revision
  promotion of `4ad83815f`.

## References

- Live failure matrix: [reports/runtime/live-health-failure-matrix.json](live-health-failure-matrix.json)
- Stabilization snapshot: [reports/runtime/live-health-stabilization-report.md](live-health-stabilization-report.md)
- Sidecar status JSON: [reports/runtime/runtime-health-status-2026-05-11.json](runtime-health-status-2026-05-11.json)
