# 04 — Findings and Dispositions

**Wave:** 0 (containment) → this document is now the **live 25-finding
adversarial register** required by §4 of the Reality & World-Class
Remediation Programme.
**Status:** Substantive — expanded from 5 Wave-0 finds to the full 25.

Each finding records: file, code path, callers where practical,
environment impact, current state, severity, disposition, required
proof, and closure evidence. A finding is **not closed** merely because
one call-site or route line changed — closure requires the required
proof.

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
- **Disposition:** **Contained** in Wave 0; full removal deferred to Wave 6.
- **Wave 0 containment:**
  - `tooling/reality/demo-deployment-guard.ts` — fail-closed CLI + `assertDemoDeploymentGuard()` runtime function that refuses any target environment other than `development|local|test` if the demo profile is active.
  - `tooling/reality/anti-theatre-scan.ts` rule R-4 blocks the profile from
    appearing in a non-dev env or deployment file.
  - Rule R-3 flags every production import from `demo/**` or `fixtures/**`
    (currently 46 findings, all inside `apps/union-eyes/app/[locale]/dashboard/**/page.tsx`).
- **Rationale for deferral of removal:** the demo profile is the only
  currently working end-to-end path; ripping it out before real member,
  case, and governance flows exist would strand pilot users. It is now
  correctly labelled and cannot ship, which is the honest interim state.
- **Required proof for closure:** `pnpm reality:demo-guard` refuses
  `UE_FEATURE_PROFILE=cupe4373` in staging/pilot/production; CI blocks
  merge on scanner errors; every dashboard page has a production
  implementation and the demo pages live under a segregated segment.
- **Evidence:**
  - Source: `apps/union-eyes/lib/feature-flags.ts`, `apps/union-eyes/.env.local`.
  - Tooling: `tooling/reality/demo-deployment-guard.ts` + tests.
  - Registry entry: `UE-DEMO-CUPE4373` — `state: 'DEMO_ONLY'`, `targetWave: 6`.

## F-05 — In-memory auth-middleware audit store presented as authoritative

- **Severity:** P1 (Wave 0 documents, but does not yet fix).
- **Disposition:** **Deferred** to Wave 9.
- **Evidence:** `apps/union-eyes/lib/middleware/auth-middleware.ts:221`
  keeps up to 10 000 recent events in a static array; this is not durable
  and is lost on process restart / horizontal scaling.

---

## F-06 — Deadline reminder scheduling is a stub

- **Severity:** P1 — statutory deadlines never generate the promised
  reminder notifications; missed dates can defeat grievances.
- **File / code:** `apps/union-eyes/lib/deadline-tracking-system.ts:538` —
  method rescheduling deletes prior reminders but does not enqueue new
  ones. Callers include the deadline mutation actions used by
  `apps/union-eyes/app/api/deadlines/**`.
- **Environment impact:** Any environment relying on staff reminders
  silently loses them. In staging today, no reminders are actually sent
  because the queue infrastructure is not provisioned.
- **Current state:** `NOT_IMPLEMENTED` (the code path is present but
  produces no observable effect).
- **Disposition:** **Deferred** to Wave 1 (pilot-critical).
- **Required proof for closure:** unit test asserting reminders are
  enqueued at the correct offsets; integration test asserting the worker
  processes them; artefact showing an actual email/SMS was sent (or a
  documented mock in test mode).
- **Closure evidence:** none yet.

## F-07 — Communication recipient lookup returns empty in almost every path

- **Severity:** P1 — communications appear to send but reach no one.
- **File / code:** `apps/union-eyes/lib/notifications/**` and the
  recipient-resolution helper used by `app/api/communications/**`.
- **Environment impact:** In staging, notifications land in the DLQ or
  succeed with 0 recipients.
- **Current state:** `LIMITED` — email path resolves for admin invites
  only; case/deadline/grievance notifications do not.
- **Disposition:** **Deferred** to Wave 1 (§10 first). Also drives F-06.
- **Required proof for closure:** deterministic test suite covering:
  case-assignment → notify case owner + committee; deadline reminder →
  notify assigned staff; grievance update → notify member; and evidence
  from Azure Container Apps logs that the mails were dispatched via
  Resend.
- **Closure evidence:** none yet.

## F-08 — Email delivery: implemented but not wired

- **Severity:** P1.
- **File / code:** `apps/union-eyes/lib/email-service.ts` (Resend-backed
  `sendResendEmail` + `sendEmail` wrappers).  Callers: `lib/auth-emails.ts`,
  `lib/claim-notifications.ts`, `lib/workers/email-worker.ts`,
  `lib/email/report-email-templates.ts`, `lib/email/training-notifications.ts`.
- **Environment impact:** Staging has `RESEND_API_KEY` unconfigured →
  every `sendEmail` returns `{ ok: false, reason: 'not_configured' }`
  (fail-closed).
- **Current state:** `REAL` code path, `DEGRADED` in staging.
- **Disposition:** **Wire secret + tracking** in Wave 1.
- **Required proof:** `RESEND_API_KEY` present in Azure KV;
  `nzila-os-union-eyes` `az containerapp show` reveals the secret ref;
  synthetic send in staging captured in Resend dashboard.

## F-09 — SMS delivery: absent

- **Severity:** P2 (pilot escalation, not launch-critical).
- **File / code:** No `twilio` or `sendSms` implementation exists.
- **Current state:** `NOT_IMPLEMENTED`. No SMS is dispatched anywhere.
- **Disposition:** **Deferred** to Wave 3+ when member-consent flow is
  designed.  Meanwhile, SMS-dependent UI copy must be softened or hidden.

## F-10 — Payment processing: partial

- **Severity:** P1 for pilot billing.
- **File / code:** `lib/stripe.ts` + `@nzila/payments-stripe`, webhook
  handler `apps/union-eyes/app/api/payments/webhooks/route.ts`,
  autopay utilities in `lib/__tests__/autopay-utils.test.ts` mocks.
- **Environment impact:** Staging has `STRIPE_SECRET_KEY` unset →
  `stripe` client is `null` and all Stripe calls short-circuit.
- **Current state:** `DEGRADED`.
- **Disposition:** **Deferred** to Wave 2 pending pilot billing sign-off.
- **Required proof:** Stripe test-mode key wired; end-to-end synthetic
  invoice payment captured in Stripe dashboard.

## F-11 — Error monitoring: partial

- **Severity:** P1.
- **File / code:** `lib/api/standardized-responses.ts` lazy-loads
  `@sentry/nextjs`; `lib/logger.ts` routes through Sentry when
  configured.
- **Environment impact:** Staging `SENTRY_DSN` is unset → traces and
  captures no-op.
- **Current state:** `DEGRADED`.
- **Disposition:** **Deferred** to Wave 2. Nzila Sentry org/project must
  be provisioned first.
- **Required proof:** Sentry DSN wired via Azure KV secret;
  `mcp_sentry_mcp_find_organizations` shows the project; a synthetic 500
  in staging appears as an event.

## F-12 — Notification recipient lookup empty

_See F-07 — same finding under a different mandate label._

## F-13 — Remittance approver identity is fabricated

- **Severity:** P0 — legally-binding financial records are attributing
  approvals to a hard-coded string.
- **File / code:** `apps/union-eyes/services/**/remittance-*.ts`.
- **Current state:** `DEGRADED` — approver comes from
  `process.env.UE_REMITTANCE_DEFAULT_APPROVER` fallback, not from an
  authenticated session.
- **Disposition:** **Deferred** to Wave 1 (pilot-critical).
- **Required proof:** approver derived from `auth().userId`; DB column
  `remittance_batches.approved_by_user_id` populated; audit log entry
  linked to the same user.

## F-14 — Empty digest and empty members-report responses served as 200

- **Severity:** P1.
- **File / code:** several report routes under
  `apps/union-eyes/app/api/reports/**` return `[]` or `{data:[]}` with
  HTTP 200 — flagged by scanner R-8 (5 findings in current run).
- **Current state:** `LIMITED` / `NOT_IMPLEMENTED` depending on route.
- **Disposition:** **Deferred** to Wave 2 (analytics/reporting truth).
- **Required proof:** each route either returns real aggregated data
  from the DB, or responds with HTTP 501 via `ApiError.notImplemented()`
  matching the finding-specific reason.

## F-15 — Committee snapshot is hard-coded

- **Severity:** P1.
- **File / code:** `apps/union-eyes/lib/governance/committee-snapshot.ts`
  (name approximate — see registry entry).
- **Current state:** `NOT_IMPLEMENTED`.
- **Disposition:** **Deferred** to Wave 2.
- **Required proof:** snapshot query against `governance_committees`
  table; timestamped API response referenced from
  `/api/governance/committee-snapshot` in staging.

## F-16 — LRB / CBA integration absent

- **Severity:** P2 — Labour Relations Board and Collective Bargaining
  Agreement integrations are entirely stubbed.
- **File / code:** no adapter exists.
- **Current state:** `NOT_IMPLEMENTED`.
- **Disposition:** **Deferred** to Wave 4 (integrations wave).
- **Required proof:** adapter class + contract test using a recorded
  LRB fixture; capability entry moved from `NOT_IMPLEMENTED` to `REAL`.

## F-17 — APNs JWT provisioning: implementation present, credentials not deployed

- **Severity:** P2 (iOS push not required for launch).
- **File / code:** `apps/union-eyes/lib/mobile/providers/apns-provider.ts`.
- **Current state:** Code is real; runtime state is `DEGRADED` when
  `APNS_KEY_ID`/`APNS_TEAM_ID`/`APNS_PRIVATE_KEY` env vars are absent
  (they currently are in staging).
- **Disposition:** **Deferred** to Wave 5.
- **Required proof:** APNs auth key secured in KV; synthetic push
  delivered to a test device.

## F-18 — Biometric assertion path is a placeholder

- **Severity:** P2.
- **File / code:** `apps/union-eyes/app/api/auth/biometric/**` returns
  success without verifying an assertion.
- **Current state:** `DEMO_ONLY` (must never be enabled outside demo).
- **Disposition:** **Deferred** to Wave 5.
- **Required proof:** WebAuthn library integrated; assertion verified
  against stored public key; failing assertion produces HTTP 401.

## F-19 — SharePoint document adapter presents as production

- **Severity:** P1.
- **File / code:** `apps/union-eyes/lib/integrations/adapters/documents/sharepoint-adapter.ts`.
- **Current state:** Adapter exists but is fed by fakes in tests; no
  Graph-API client is wired in staging.
- **Disposition:** **Deferred** to Wave 4.
- **Required proof:** MSAL client-credential auth against a pilot
  SharePoint site; contract test with a recorded response.

## F-20 — Bank of Canada cached fallback

_See F-02 — the fabricated-provenance side is fixed. Deferred to Wave 7:
add a durable authoritative FX-rate cache + staleness alerts._

## F-21 — Hard-coded billing / pricing

- **Severity:** P1.
- **File / code:** `apps/union-eyes/lib/billing/**` — several fee
  amounts hard-coded rather than read from configuration.
- **Current state:** `DEGRADED`.
- **Disposition:** **Deferred** to Wave 2.
- **Required proof:** fee table stored in DB; admin UI to edit;
  audit-logged updates.

## F-22 — Sample analytics served as real

- **Severity:** P1.
- **File / code:** `apps/union-eyes/lib/analytics/**` and
  `app/api/analytics/**`.
- **Current state:** `LIMITED` — endpoints return synthesized numbers
  in the demo profile; empty arrays elsewhere.
- **Disposition:** **Deferred** to Wave 2.
- **Required proof:** dashboards driven from `analytics_events` table;
  demo profile clearly labelled `sample: true` in the response body.

## F-23 — In-memory finance rollups

- **Severity:** P1.
- **File / code:** `apps/union-eyes/lib/finance/*rollup*.ts` and callers.
- **Current state:** `DEGRADED` — rollups computed at request time from
  memory-cached rows; not durable, not consistent across replicas.
- **Disposition:** **Deferred** to Wave 2.
- **Required proof:** rollups persisted to `finance_rollups` table with
  timestamps; recomputable via cron; endpoint returns the persisted row.

## F-24 — Unsupported export formats claim to succeed

- **Severity:** P2.
- **File / code:** `apps/union-eyes/lib/data-export-import.ts:182` —
  Excel export requested but xlsx serialization is not implemented;
  currently rejects with a logger.warn. Other formats have similar gaps.
- **Current state:** `DEGRADED` (rejects, but with an ambiguous error).
- **Disposition:** **Deferred** to Wave 3.
- **Required proof:** each export format either produces a real file
  (contract test verifies content) or responds with HTTP 501.

## F-25 — Unsupported pension / statutory processors

- **Severity:** P1.
- **File / code:**
  `apps/union-eyes/lib/pension-processor/processors/cpp-qpp-processor.ts:338`,
  `apps/union-eyes/lib/pension-processor/processors/otpp-processor.ts:337` —
  both currently return literal `'NOT_IMPLEMENTED'` sentinel values from
  their calc methods.
- **Environment impact:** Any downstream persistence writes the
  sentinel string as if it were a computed benefit.
- **Current state:** `NOT_IMPLEMENTED`.
- **Disposition:** **Deferred** to Wave 4.
- **Required proof:** either replace call-sites with `throw
  ApiError.notImplemented(...)` at the API boundary, OR implement the
  calc against the plan documents and pass a fixture-driven contract
  test.

## Cross-cutting: misleading OpenAPI surface

- **Severity:** P1.
- **File / code:** `apps/union-eyes/lib/api/framework.ts` +
  per-route `openapi:` blocks under `app/api/**`.
- **Current state:** Every route with a `withApi({ openapi: {...} })`
  declaration is published as if fully implemented, even when the
  handler is a stub or 501. This mis-represents the API contract to
  external consumers and generators.
- **Disposition:** **Wave 0 tooling** — the anti-theatre scanner and
  the capability registry now capture the truthful state; the OpenAPI
  emitter must be updated in Wave 1 to mark `NOT_IMPLEMENTED` capabilities
  with `x-nzila-state: NOT_IMPLEMENTED` and to omit `2xx` responses for
  routes that respond only with 501.
- **Required proof:** OpenAPI JSON regenerated; each 501 route lacks a
  `2xx` response schema; each `NOT_IMPLEMENTED` route carries the
  `x-nzila-state` extension.

---

## Traceability

- Wave-0 tooling that catches or contains findings above: `tooling/reality/anti-theatre-scan.ts`, `tooling/reality/demo-deployment-guard.ts`, `tooling/reality/capability-inventory.ts`.
- Programme state matrix and open list: `docs/union-eyes/reality-remediation/00_PROGRAM_CHARTER.md`.
- Baseline anti-theatre numbers: `docs/union-eyes/reality-remediation/16_ANTI_THEATRE_BASELINE.md`.
- Git baseline: `docs/union-eyes/reality-remediation/15_REMEDIATION_BASELINE.md`.

