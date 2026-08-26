# 01 — Baseline and Scope

**Wave:** 0
**Status:** Substantive.

## Scope

This programme covers the `apps/union-eyes` Next.js application and its
directly-owned service/lib modules (`services/**`, `lib/**`, `db/**`,
`app/api/**`). It explicitly excludes shared platform packages
(`packages/**`), which are governed by their own release process.

## Baseline commit

- Branch: `fix/union-eyes-reality-remediation`
- Baseline commit before Wave 0 P0 edits: `c77f0cf091ddd7b54085d90a3583c1b46b7de003`

## In-scope defects confirmed against code

1. **Five cron endpoints** returned HTTP 200 with `{ status: 'not_implemented' }`:
   - `app/api/cron/monthly-dues/route.ts`
   - `app/api/cron/overdue-notifications/route.ts`
   - `app/api/cron/process-messages/route.ts`
   - `app/api/cron/process-notifications/route.ts`
   - `app/api/cron/scheduled-reports/route.ts`

2. **Bank of Canada FX provenance conflation** in
   `services/currency-enforcement-service.ts`: cached fallback rates were
   returned under `source: 'Bank of Canada (FXUSDCAD)'`, indistinguishable
   from a fresh Valet API observation.

3. **Pilot-status endpoint hardcoded readiness** in
   `app/api/admin/pilot-status/route.ts`: `vocabularyLoaded`,
   `orgConfigured`, `slaThresholdsSet`, and `auditTrailActive` were passed
   as literal `true` values regardless of runtime state, producing a
   fabricated "healthy" verdict.

4. **CUPE 4373 demo runtime** could be activated in any environment via
   `NEXT_PUBLIC_UE_DEMO_PROFILE=cupe4373` or `UE_FEATURE_PROFILE=cupe4373`
   with no deployment-time guard preventing staging/production activation.

## Out of scope (this programme)

- Refactoring the shared `@nzila/platform-auth` package (tracked separately).
- Removing the Django backend sidecar (`packages/union-eyes-backend/**`) —
  independent modernization effort.
- Redis / cache layer overhaul.
