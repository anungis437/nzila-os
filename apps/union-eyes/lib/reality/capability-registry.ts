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
  // Demo profile (physically separated as of Wave 0 §3 remediation)
  // ------------------------------------------------------------------------
  {
    id: 'UE-DEMO-SEPARATE-PACKAGE',
    title: 'Demo runtime is a separate npm package',
    state: 'REAL',
    ownedBy: [
      'apps/union-eyes-demo/',
      'apps/union-eyes/lib/config/env-validation.ts',
      'apps/union-eyes/lib/runtime/environment.ts',
    ],
    evidence: [
      'apps/union-eyes/lib/config/env-validation.ts — UE_DEMO_PROFILE, NEXT_PUBLIC_UE_DEMO_PROFILE, UE_DEMO_ORG_ID, NEXT_PUBLIC_UE_DEMO_ORG_SLUG all typed z.never().optional(); operational package refuses to boot when any is set',
      'apps/union-eyes/lib/runtime/environment.ts — UeEnvironment omits "demo"; UeDeploymentType omits "cupe4373-demo"; UeFeatureProfile omits "cupe4373"',
      'apps/union-eyes/app/api/health/route.ts — checkBackend() honours only generic demo/deployment tokens; no customer-branded feature-profile match',
    ],
    targetWave: 0,
    notes:
      'The operational package (@nzila/union-eyes) contains no customer-specific demo code. Demo fixtures, personas, ' +
      'navigation, and reference templates live exclusively in @nzila/union-eyes-demo. Boundary enforcement is the ' +
      'zod env schema (fail-closed at process start).',
  },

  // ------------------------------------------------------------------------
  // Build-time isolation (Wave 0 §8 — physically separated as of §3 remediation)
  // ------------------------------------------------------------------------
  {
    id: 'UE-BUILD-OPERATIONAL-ISOLATION',
    title: 'Operational build carries no customer-specific demo content',
    state: 'REAL',
    ownedBy: [
      'apps/union-eyes/lib/dashboard/role-experience.ts',
      'apps/union-eyes/lib/config/env-validation.ts',
      'apps/union-eyes/lib/runtime/environment.ts',
      'apps/union-eyes/components/sidebar.tsx',
      'apps/union-eyes/app/[locale]/dashboard/layout.tsx',
      'tooling/reality/operational-build-scan.ts',
    ],
    evidence: [
      'apps/union-eyes/lib/dashboard/role-experience.ts — CUPE4373_DEMO_* constants, readRuntimeMarker, isCupe4373DemoRuntime, and demo-branch helpers removed. Navigation returns only the operational default.',
      'apps/union-eyes/components/sidebar.tsx / app/[locale]/dashboard/layout.tsx — no isCupeDemo prop, no demo badge, no demo navigation branches.',
      'apps/union-eyes/components/auth/cupe4373-persona-picker.tsx and components/home/portal-home.tsx — DELETED.',
      'apps/union-eyes/lib/config/env-validation.ts — UE_DEMO_* env vars typed z.never().optional(); boot fails if any is set.',
      'apps/union-eyes/lib/runtime/environment.ts — UeEnvironment, UeDeploymentType, UeFeatureProfile enums omit demo/cupe4373 members.',
      'reports/wave-0-artifact-proof.operational.json / wave-0-artifact-proof.md — physical proof of the two-package split.',
      'apps/union-eyes/next.config.ts — outputFileTracingExcludes hard-blocks @vercel/nft from walking into the sibling union-eyes-demo package via pnpm workspace symlinks (Wave 0 Task F).',
      'reports/operational-build-demo-scan.json / .md — Wave 0 Task F verification: production build (`pnpm --filter @nzila/union-eyes build` after removing demo env pollution from .env.local) scanned with `pnpm reality:build-scan:with-bundle` produces 0 bundle hits (down from 6 pre-fix).',
    ],
    targetWave: 0,
    notes:
      'CORRECTED 2026-07-21 (see docs/union-eyes/reality-remediation/23_WAVE_0_CORRECTION.md). ' +
      'The prior allowlist model has been retired. Operational package now physically excludes customer-specific ' +
      'demo modules and rejects UE_DEMO_* env vars at boot via the zod schema. Any regression is caught at the ' +
      'boundary (env validation) or at compile time (removed types), not by a runtime scanner allowlist. ' +
      'Task F (bundle proof) additionally verified via next.config outputFileTracingExcludes plus a clean ' +
      '`pnpm reality:build-scan:with-bundle` after a full production build.',
  },

  // ------------------------------------------------------------------------
  // Dashboard surfaces returning HTTP 404 (Wave 0 §7 reconciliation)
  // ------------------------------------------------------------------------
  {
    id: 'UE-DASH-REPORTS-INDEX',
    title: 'Reports dashboard index (/dashboard/reports) — REMOVED',
    state: 'REMOVED',
    ownedBy: [],
    evidence: [
      'app/[locale]/dashboard/reports/page.tsx — DELETED (Wave 0 Task G)',
      'app/[locale]/dashboard/reports/layout.tsx — DELETED (Wave 0 Task G)',
      'lib/dashboard/role-experience.ts — three "Institutional Intelligence Reports" nav entries REMOVED (staff/executive/governance) plus three /dashboard/reports allowed-prefix entries REMOVED',
      'components/sidebar.tsx — /dashboard/reports iconsByHref entry REMOVED',
      'components/dashboards/federation-dashboard.tsx — Reports quick-action tile REMOVED',
      'apps/union-eyes/lib/reality/__tests__/route-reconciliation.test.ts — new Task G invariant asserts no advertised nav href resolves to a pure notFound() page',
    ],
    targetWave: 5,
    notes:
      'CORRECTED 2026-07-21 (Wave 0 Task G, see docs/union-eyes/reality-remediation/23_WAVE_0_CORRECTION.md §4). ' +
      'The prior policy left the nav entries in place so the surface would "re-appear the moment the target-wave ' +
      'implementation lands". That policy created a permanent dead-link in every staff/executive/governance ' +
      'dashboard. Task G reverses it: no dead nav, no dead page. When the reports surface returns in a later wave ' +
      'it MUST be re-added by adding both the page file and the nav entries in the same commit, gated by a Task G ' +
      'invariant that forbids advertising a route whose page body reduces to notFound().',
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
