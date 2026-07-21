/**
 * Union Eyes — Capability Reality Registry
 *
 * Machine-readable source of truth for the runtime state of every
 * Union Eyes capability. Produced under the Union Eyes Reality &
 * World-Class Remediation Programme (Wave 0). Values are audited
 * against real code and deployment behaviour — NOT aspirational.
 *
 * States:
 *
 * | State             | Meaning                                                                                          |
 * |-------------------|--------------------------------------------------------------------------------------------------|
 * | `REAL`            | Fully implemented, deployed, and validated end-to-end against real infrastructure and data.       |
 * | `LIMITED`         | Implemented with clearly documented limits (e.g. cached fallback, partial data source coverage).  |
 * | `DEGRADED`        | Runs, but with a known non-fatal defect (e.g. some checks unmeasured; some data source is stale). |
 * | `DISABLED`        | Code exists but is intentionally turned off in production.                                        |
 * | `DEMO_ONLY`       | Only functions inside a marked demo/pilot profile; blocked outside dev.                           |
 * | `NOT_IMPLEMENTED` | Endpoint/handler exists but returns HTTP 501; behaviour is intentionally absent.                  |
 * | `DEPRECATED`      | Replaced by another capability; kept only for compatibility, scheduled for removal.               |
 * | `REMOVED`         | No longer present in the codebase; entry kept for historical traceability.                       |
 *
 * Anti-theatre invariants (enforced by CI):
 *   1. A `REAL` entry must not depend on a `NOT_IMPLEMENTED` or `DEMO_ONLY` capability.
 *   2. A capability that returns HTTP 200 with `{ status: 'not_implemented' }`
 *      MUST NOT appear as `REAL`. It must be either `NOT_IMPLEMENTED` (and
 *      return HTTP 501) or `LIMITED`/`DEGRADED` with a documented reason.
 *   3. A capability whose provenance depends on a cached fallback MUST NOT be
 *      `REAL`; it must be `LIMITED` at best.
 */

export type CapabilityState =
  | 'REAL'
  | 'LIMITED'
  | 'DEGRADED'
  | 'DISABLED'
  | 'DEMO_ONLY'
  | 'NOT_IMPLEMENTED'
  | 'DEPRECATED'
  | 'REMOVED';

export interface Capability {
  /** Stable identifier (e.g. `UE-CRON-MONTHLY-DUES`). Never renamed once assigned. */
  id: string;
  /** Short human-readable title. */
  title: string;
  /** Current runtime state — see {@link CapabilityState}. */
  state: CapabilityState;
  /** File or route paths that own the implementation (relative to `apps/union-eyes/`). */
  ownedBy: readonly string[];
  /**
   * Truthful evidence justifying the recorded state: file+line references,
   * test IDs, log signatures, or explicit contract statements. If empty,
   * the entry is unverified and MUST be treated as `NOT_IMPLEMENTED` by
   * downstream consumers.
   */
  evidence: readonly string[];
  /** Wave in which the state is expected to change (0 = current Wave 0 baseline). */
  targetWave: number;
  /** Free-form notes (limitations, gotchas, follow-ups). */
  notes?: string;
}

/**
 * Wave 0 baseline. Additions are appended over successive waves; existing
 * entries are ONLY updated when the underlying state genuinely changes.
 */
export const CAPABILITY_REGISTRY: readonly Capability[] = [
  // ------------------------------------------------------------------------
  // Cron endpoints (Wave 0 P0 fix: 200-no-op → HTTP 501)
  // ------------------------------------------------------------------------
  {
    id: 'UE-CRON-MONTHLY-DUES',
    title: 'Monthly dues cron',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/cron/monthly-dues/route.ts'],
    evidence: [
      'app/api/cron/monthly-dues/route.ts — throws ApiError.notImplemented → HTTP 501',
      'lib/api/errors.ts:92 — ApiError.notImplemented factory',
      'lib/api/standardized-responses.ts:110 — NOT_IMPLEMENTED → 501 mapping',
    ],
    targetWave: 5,
    notes: 'Pending real dues-calculation implementation in Wave 5 and Wave 7.',
  },
  {
    id: 'UE-CRON-OVERDUE-NOTIFICATIONS',
    title: 'Overdue-notifications cron',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/cron/overdue-notifications/route.ts'],
    evidence: ['app/api/cron/overdue-notifications/route.ts — throws ApiError.notImplemented → HTTP 501'],
    targetWave: 3,
  },
  {
    id: 'UE-CRON-PROCESS-MESSAGES',
    title: 'Message-processing cron',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/cron/process-messages/route.ts'],
    evidence: ['app/api/cron/process-messages/route.ts — throws ApiError.notImplemented → HTTP 501'],
    targetWave: 4,
  },
  {
    id: 'UE-CRON-PROCESS-NOTIFICATIONS',
    title: 'Notification-processing cron',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/cron/process-notifications/route.ts'],
    evidence: ['app/api/cron/process-notifications/route.ts — throws ApiError.notImplemented → HTTP 501'],
    targetWave: 4,
    notes: 'Depends on Wave 5 (real notification dispatcher).',
  },
  {
    id: 'UE-CRON-SCHEDULED-REPORTS',
    title: 'Scheduled-reports cron',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/cron/scheduled-reports/route.ts'],
    evidence: ['app/api/cron/scheduled-reports/route.ts — throws ApiError.notImplemented → HTTP 501'],
    targetWave: 8,
  },

  // ------------------------------------------------------------------------
  // Admin / observability
  // ------------------------------------------------------------------------
  {
    id: 'UE-ADMIN-PILOT-STATUS',
    title: 'Pilot readiness aggregator (/api/admin/pilot-status)',
    state: 'LIMITED',
    ownedBy: [
      'app/api/admin/pilot-status/route.ts',
      'lib/pilot-admin.ts',
    ],
    evidence: [
      'app/api/admin/pilot-status/route.ts — runs real DB counts for users/worksites; other checks returned as `null` (unknown)',
      'lib/pilot-admin.ts — `unknown` HealthCheckItem status + `remediation_in_progress` overall status introduced Wave 0',
      'app/api/__tests__/admin-pilot-status.route.test.ts — asserts unmeasured flags are `null`, not fabricated `true`',
    ],
    targetWave: 3,
    notes:
      'Vocabulary loaded, org configured, SLA thresholds set, and audit-trail freshness checks are still ' +
      'unmeasured — they return `unknown` and force overall status `remediation_in_progress`.',
  },

  // ------------------------------------------------------------------------
  // Financial / FX
  // ------------------------------------------------------------------------
  {
    id: 'UE-FIN-BOC-EXCHANGE-RATE',
    title: 'Bank of Canada FX rate resolution',
    state: 'LIMITED',
    ownedBy: ['services/currency-enforcement-service.ts'],
    evidence: [
      'services/currency-enforcement-service.ts — getBankOfCanadaNoonRateWithProvenance returns BocRateResult with truthful source/cacheStatus',
      'services/__tests__/currency-enforcement-service.test.ts — asserts cached-fallback path returns source `bank_of_canada_cached`, cacheStatus `stale-fallback`',
    ],
    targetWave: 7,
    notes:
      'Fresh Valet fetches are labelled `bank_of_canada`; cached fallbacks are labelled `bank_of_canada_cached`. ' +
      'Downstream persistence must record `provenance.source` alongside the numeric rate.',
  },

  // ------------------------------------------------------------------------
  // Demo profile
  // ------------------------------------------------------------------------
  {
    id: 'UE-DEMO-CUPE4373',
    title: 'CUPE 4373 demo profile',
    state: 'DEMO_ONLY',
    ownedBy: [
      'lib/feature-flags.ts',
      '.env.local',
    ],
    evidence: [
      'lib/feature-flags.ts — isCupe4373DemoRuntime reads NEXT_PUBLIC_UE_DEMO_PROFILE and UE_FEATURE_PROFILE',
    ],
    targetWave: 6,
    notes:
      'Deployment guard blocking UE_FEATURE_PROFILE=cupe4373 outside development is pending Wave 6. ' +
      'DO NOT promote this capability to REAL without that guard in place.',
  },

  // ------------------------------------------------------------------------
  // Dashboard surfaces returning HTTP 404 (Wave 0 §7 reconciliation)
  // ------------------------------------------------------------------------
  {
    id: 'UE-DASH-REPORTS-INDEX',
    title: 'Reports dashboard index (/dashboard/reports)',
    state: 'NOT_IMPLEMENTED',
    ownedBy: [
      'app/[locale]/dashboard/reports/page.tsx',
      'app/[locale]/dashboard/reports/layout.tsx',
    ],
    evidence: [
      'app/[locale]/dashboard/reports/page.tsx — unconditional notFound() call in ReportsPage; renders HTTP 404',
      'app/[locale]/dashboard/reports/layout.tsx — server-side auth guard preserved so 404 is emitted only after auth passes',
      'docs/union-eyes/reality-remediation/19_ROUTE_RECONCILIATION.md — enumerated nav references still pointing here (5 files, 12 refs)',
    ],
    targetWave: 5,
    notes:
      'The demo variant lives in `apps/union-eyes-demo/` and is no longer reachable from the operational build. ' +
      'Navigation entries in role-experience.ts, portal-home.tsx, federation-dashboard.tsx, and sidebar.tsx still ' +
      'reference /dashboard/reports; they are intentionally left in place so the entry re-appears automatically ' +
      'the moment the target-wave implementation lands. See §7 route reconciliation for the enforced invariant.',
  },
  {
    id: 'UE-DASH-DEBUG',
    title: 'Developer debug page (/dashboard/debug) — dev-only',
    state: 'DISABLED',
    ownedBy: ['app/[locale]/dashboard/debug/page.tsx'],
    evidence: [
      'app/[locale]/dashboard/debug/page.tsx:26 — process.env.NODE_ENV === "production" → notFound() (HTTP 404)',
      'app/[locale]/dashboard/debug/layout.tsx — auth guard requires System Admin (level 200) even in dev',
    ],
    targetWave: 0,
    notes: 'Deliberately never advertised in navigation. HTTP 404 in every deployed environment.',
  },
  {
    id: 'UE-DEV-SENTRY-EXAMPLE',
    title: 'Sentry example page (/sentry-example-page) — dev-only',
    state: 'DISABLED',
    ownedBy: ['app/sentry-example-page/page.tsx'],
    evidence: [
      'app/sentry-example-page/page.tsx:26 — process.env.NODE_ENV === "production" → notFound() (HTTP 404)',
    ],
    targetWave: 0,
    notes: 'Ships in the bundle but is unreachable in staging/pilot/production. Kept only for local Sentry SDK validation.',
  },
] as const;

/**
 * Look up a capability by id. Returns `undefined` if unknown — callers
 * must decide whether to treat the absence as `NOT_IMPLEMENTED` or fail.
 */
export function getCapability(id: string): Capability | undefined {
  return CAPABILITY_REGISTRY.find((c) => c.id === id);
}

/**
 * All capabilities whose state matches the predicate. Used by anti-theatre
 * CI checks to enumerate NOT_IMPLEMENTED and DEMO_ONLY entries.
 */
export function capabilitiesInState(state: CapabilityState): readonly Capability[] {
  return CAPABILITY_REGISTRY.filter((c) => c.state === state);
}

/**
 * Wave 0 §7 — Route reconciliation invariant.
 *
 * Return the set of dashboard route paths (as they appear in navigation
 * items — always beginning with `/dashboard/…`) whose owning capability
 * is `NOT_IMPLEMENTED` AND owns an `app/[locale]/dashboard/**` page.
 * These surfaces are guaranteed to render HTTP 404 in every deployed
 * environment (the page body reduces to `notFound()`).
 *
 * Consumers use this to enforce the §7 invariant: no navigation surface
 * may advertise an unconditional-404 route unless that route is
 * registry-tracked here.
 *
 * `DISABLED` routes are intentionally NOT included: they are only 404
 * in production (gated by `process.env.NODE_ENV === 'production'`) and
 * remain reachable in local dev. Use {@link getConditionalProduction404DashboardRoutes}
 * for that case.
 *
 * The returned strings are `/dashboard/…` prefixed and do NOT include
 * the `[locale]` segment (matches how navigation items are authored).
 */
export function getRegistryTracked404DashboardRoutes(): readonly string[] {
  return collectDashboardRoutesForStates(['NOT_IMPLEMENTED']);
}

/**
 * Return dashboard routes whose owning capability is `DISABLED` (i.e.
 * always 404 in production but reachable in local dev). Kept separate
 * from the NOT_IMPLEMENTED set because the two carry different
 * invariants: NOT_IMPLEMENTED pages MUST have a body of only
 * `notFound()`, while DISABLED pages have a real body guarded by a
 * `process.env.NODE_ENV === 'production'` check.
 */
export function getConditionalProduction404DashboardRoutes(): readonly string[] {
  return collectDashboardRoutesForStates(['DISABLED']);
}

function collectDashboardRoutesForStates(states: readonly CapabilityState[]): readonly string[] {
  const result: string[] = [];
  for (const cap of CAPABILITY_REGISTRY) {
    if (!states.includes(cap.state)) continue;
    for (const owned of cap.ownedBy) {
      const m = owned.match(/^app\/\[locale\]\/(dashboard\/[^/]+(?:\/[^/]+)*)\/(?:page|layout)\.tsx$/);
      if (!m) continue;
      const route = `/${m[1]}`;
      if (!result.includes(route)) result.push(route);
    }
  }
  return result;
}
