# 04 — Findings and Dispositions

**Wave:** 0
**Status:** Substantive.

For each Wave 0 finding, the disposition is either **Fixed** (landed in this
wave), **Deferred** (tracked to a later wave with an explicit `targetWave`
in the registry), or **Rejected** (finding invalidated by evidence).

## F-01 — Five cron endpoints returned HTTP 200 with `{ status: 'not_implemented' }`

- **Severity:** P0 — external schedulers were recording success for no-ops.
- **Disposition:** **Fixed** in Wave 0.
- **Change:** each handler now `throw ApiError.notImplemented(...)`, which
  the standard error middleware maps to HTTP 501 via
  `apps/union-eyes/lib/api/standardized-responses.ts:110`.
- **Evidence:**
  - Route sources: `app/api/cron/{monthly-dues,overdue-notifications,process-messages,process-notifications,scheduled-reports}/route.ts`.
  - Existing config test `apps/union-eyes/config/__tests__/public-api-routes.test.ts` continues to enumerate these routes correctly.

## F-02 — Bank of Canada FX provenance conflation

- **Severity:** P0 — financial records were being written with fabricated provenance.
- **Disposition:** **Fixed** in Wave 0.
- **Change:** `getBankOfCanadaNoonRateWithProvenance` returns a typed
  `BocRateResult` with `source` (`'bank_of_canada' | 'bank_of_canada_cached'`),
  `cacheStatus` (`'fresh' | 'stale-fallback'`), `observationDate`, and
  `sourceReference`. `convertUSDToCAD` now propagates that structure and
  labels cached fallbacks as
  `Bank of Canada (cached FXUSDCAD from YYYY-MM-DD)` — no longer as a fresh
  Valet observation.
- **Follow-up:** durable authoritative FX-rate cache is deferred to Wave 7.
  Callers persisting the result MUST record `provenance.source` and
  `provenance.observationDate`.
- **Evidence:**
  - Source: `apps/union-eyes/services/currency-enforcement-service.ts`.
  - Test: `apps/union-eyes/services/__tests__/currency-enforcement-service.test.ts`
    — new assertion `does NOT claim fresh BOC when the value is a cached fallback`.

## F-03 — Pilot-status endpoint returned hardcoded green readiness

- **Severity:** P0 — dashboards were reporting "healthy" regardless of state.
- **Disposition:** **Fixed** (partial) in Wave 0; capability re-classified as `LIMITED`.
- **Change:**
  - `PilotConfiguration` fields are now nullable; `null` means "unmeasured".
  - `HealthCheckItem['status']` gained `'unknown'`.
  - `PilotHealthCheck['status']` gained `'remediation_in_progress'`.
  - Any `unknown` check forces `remediation_in_progress` regardless of other passes.
  - The route now executes real DB queries for `users` and `worksites` counts
    scoped to the requesting org, and returns `null` (→ `unknown`) for
    `vocabularyLoaded`, `orgConfigured`, `slaThresholdsSet`, and
    `auditTrailActive`.
- **Follow-up:** wire real measurements for the remaining four flags in Wave 3.
- **Evidence:**
  - Source: `apps/union-eyes/app/api/admin/pilot-status/route.ts`, `apps/union-eyes/lib/pilot-admin.ts`.
  - Tests: `apps/union-eyes/app/api/__tests__/admin-pilot-status.route.test.ts`,
    `apps/union-eyes/lib/__tests__/pilot-admin.test.ts` (new `unknown`/`remediation_in_progress` assertions).

## F-04 — Demo runtime `cupe4373` can activate in any environment

- **Severity:** P0 — production risk (real customers could receive demo data).
- **Disposition:** **Deferred** to Wave 6 with a `DEMO_ONLY` classification in the registry.
- **Rationale:** capability is now classified truthfully; the actual
  deployment guard requires CI wiring that is out of scope for Wave 0.
- **Evidence:**
  - Source: `apps/union-eyes/lib/feature-flags.ts`, `apps/union-eyes/.env.local`.
  - Registry entry: `UE-DEMO-CUPE4373` — `state: 'DEMO_ONLY'`, `targetWave: 6`.

## F-05 — In-memory auth-middleware audit store presented as authoritative

- **Severity:** P1 (Wave 0 documents, but does not yet fix).
- **Disposition:** **Deferred** to Wave 9.
- **Evidence:** `apps/union-eyes/lib/middleware/auth-middleware.ts:221`
  keeps up to 10 000 recent events in a static array; this is not durable
  and is lost on process restart / horizontal scaling.
