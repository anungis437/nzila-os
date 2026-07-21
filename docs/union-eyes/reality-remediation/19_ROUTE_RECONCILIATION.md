# 19 — Route Reconciliation (Wave 0 §7)

**Owner:** Reality & World-Class Remediation Programme
**Status:** Wave 0 §7 — COMPLETE
**Date recorded:** 2026-07-22 (Wave 0 continuation)

## What §7 delivers

Wave 0 §7 reconciles operational dashboard routes that render HTTP 404
against the machine-readable capability registry at
[`apps/union-eyes/lib/reality/capability-registry.ts`](../../../apps/union-eyes/lib/reality/capability-registry.ts).

The reconciliation is enforced by three CI-checked invariants in
[`apps/union-eyes/lib/reality/__tests__/route-reconciliation.test.ts`](../../../apps/union-eyes/lib/reality/__tests__/route-reconciliation.test.ts):

1. **Every nav→404 dead link is registry-tracked.** If a navigation
   surface advertises an `href` that lands on a page whose body reduces
   to an unconditional `notFound()` call, that route MUST be present in
   `getRegistryTracked404DashboardRoutes()` (i.e. its owning capability
   is `NOT_IMPLEMENTED`). Fails otherwise.
2. **Every registry-tracked 404 route has a real 404 body.** Every
   `/dashboard/...` route returned by
   `getRegistryTracked404DashboardRoutes()` must correspond to a page
   file whose body actually reduces to only `notFound()` — the registry
   cannot claim a route 404s if the page renders anything else.
3. **DISABLED (conditional-404) routes are never advertised in
   navigation.** Pages guarded by
   `if (process.env.NODE_ENV === 'production') notFound()` are only
   reachable in local dev; they must not appear in any nav surface.

## Scope of `nav source files`

Only these files are inspected by the reconciliation test — extend the
list when a new nav-authoring surface is introduced:

| File | Role |
|------|------|
| `apps/union-eyes/lib/dashboard/role-experience.ts` | Role-based dashboard navigation (member/staff/executive/governance/admin). |
| `apps/union-eyes/components/dashboards/federation-dashboard.tsx` | Federation-scoped dashboard action tiles. |
| `apps/union-eyes/components/home/portal-home.tsx` | Portal home tile grid. |
| `apps/union-eyes/components/sidebar.tsx` | Persistent sidebar icon map. |

## Current registry-tracked 404 dashboard routes

| Route | Capability | State | Target wave | Nav references |
|-------|-----------|-------|-------------|----------------|
| `/dashboard/reports` | `UE-DASH-REPORTS-INDEX` | `NOT_IMPLEMENTED` | 5 | 12 (see below) |

### /dashboard/reports references still present (intentionally)

The nav entries are deliberately kept so that the reports surface
re-appears automatically the moment its target-wave implementation
lands and its capability state flips to `REAL` / `LIMITED`. Every
entry below is covered by the §7 CI invariant, so the truth (link
lands on 404, capability is `NOT_IMPLEMENTED`) is enforced, not
hidden.

| File | Line | Kind |
|------|-----:|------|
| `apps/union-eyes/lib/dashboard/role-experience.ts` | 77 | CUPE4373 demo nav entry (`oversight` group) |
| `apps/union-eyes/lib/dashboard/role-experience.ts` | 121 | Allowed-path fallback list |
| `apps/union-eyes/lib/dashboard/role-experience.ts` | 192 | Staff experience nav |
| `apps/union-eyes/lib/dashboard/role-experience.ts` | 207 | Executive experience nav |
| `apps/union-eyes/lib/dashboard/role-experience.ts` | 222 | Governance experience nav |
| `apps/union-eyes/lib/dashboard/role-experience.ts` | 262 | Staff `ALLOWED_PREFIXES_BY_EXPERIENCE` |
| `apps/union-eyes/lib/dashboard/role-experience.ts` | 277 | Executive `ALLOWED_PREFIXES_BY_EXPERIENCE` |
| `apps/union-eyes/lib/dashboard/role-experience.ts` | 290 | Governance `ALLOWED_PREFIXES_BY_EXPERIENCE` |
| `apps/union-eyes/components/home/portal-home.tsx` | 86 | Portal home tile |
| `apps/union-eyes/components/home/portal-home.tsx` | 145 | Portal home tile |
| `apps/union-eyes/components/dashboards/federation-dashboard.tsx` | 121 | Federation action tile |
| `apps/union-eyes/components/sidebar.tsx` | 77 | Sidebar icon map |

## DISABLED (conditional-404) routes

These pages return HTTP 404 in every deployed environment
(`NODE_ENV === 'production'`) but remain reachable in local dev. They
are enforced not-advertised by the §7 invariant.

| Route | Capability | State | Purpose |
|-------|-----------|-------|---------|
| `/dashboard/debug` | `UE-DASH-DEBUG` | `DISABLED` | Local diagnostic view of the current authenticated user. |
| `/sentry-example-page` | `UE-DEV-SENTRY-EXAMPLE` | `DISABLED` | Sentry SDK connectivity smoke test. |

## Change protocol

To add a new dashboard surface that intentionally returns 404 until a
future wave:

1. Add a `NOT_IMPLEMENTED` (unconditional 404) or `DISABLED`
   (conditional 404) entry to
   `apps/union-eyes/lib/reality/capability-registry.ts` with truthful
   `ownedBy` + `evidence` + `targetWave`.
2. Confirm the page body reduces to `notFound();` (for
   `NOT_IMPLEMENTED`) or wraps `notFound()` inside a
   `process.env.NODE_ENV === 'production'` guard (for `DISABLED`).
3. Run
   `pnpm --filter @nzila/union-eyes exec vitest run lib/reality/__tests__/route-reconciliation.test.ts`.
4. If new nav references are needed for the `NOT_IMPLEMENTED` case,
   add them to any of the `NAV_SOURCE_FILES` listed above and the
   invariant will accept them; adding them elsewhere will silently
   escape the check — extend `NAV_SOURCE_FILES` if you introduce a new
   nav-authoring surface.

## Non-goals for §7

- Refactoring the navigation architecture to make it registry-driven at
  runtime (out of scope until Wave 5 when the reports surface lands).
- Removing the 12 `/dashboard/reports` nav references (kept
  intentionally — see rationale above).
- OpenAPI reconciliation for `/dashboard/reports` (that surface is a
  React page, not an API route; the corresponding API surfaces
  `/api/reports/execute`, `/api/reports/datasources`, and
  `/api/reports/scheduled` are real and enumerated separately).

## Test evidence

```
pnpm --filter @nzila/union-eyes exec vitest run lib/reality/__tests__/route-reconciliation.test.ts

 Test Files  1 passed (1)
      Tests  4 passed (4)
```
