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

/**
 * Whether a non-`REAL` capability is required before Union Eyes can be
 * considered SaaS-operational. Omitted means `blocking` (the historical
 * default — every non-REAL capability was assumed to need a fix before
 * GA). Set to `non_blocking` only per an explicit, documented
 * product-boundary decision — never inferred from state alone.
 */
export type CapabilityReadinessImpact = 'blocking' | 'non_blocking';

/**
 * Why a `non_blocking` capability is not required. Not a defect
 * classification — `state` already records what's wrong with the
 * implementation; this records why fixing it is optional.
 */
export type CapabilityDisposition =
  // A real, intentional feature Union Eyes could offer, but is not
  // required because a specialist external system (e.g. a dedicated
  // dues/membership platform) may already be authoritative for this
  // domain. Union Eyes does not need to become that system of record.
  | 'OPTIONAL_NATIVE_CAPABILITY'
  // Code that exists but is not wired to any live, user-reachable
  // surface today — orphaned, not a defect a real user can hit.
  | 'LATENT_INTERNAL_CAPABILITY';

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
  /** See {@link CapabilityReadinessImpact}. Omitted = blocking. */
  readinessImpact?: CapabilityReadinessImpact;
  /** Required when `readinessImpact` is `non_blocking`. See {@link CapabilityDisposition}. */
  disposition?: CapabilityDisposition;
}


/**
 * Wave 0 baseline. Additions are appended over successive waves; existing
 * entries are ONLY updated when the underlying state genuinely changes.
 */
export const CAPABILITY_REGISTRY: readonly Capability[] = [
  // ------------------------------------------------------------------------
  // Generated scaffold actions (UE-FINAL-CONVERGENCE-2026-10: 200 "accepted" → HTTP 501)
  //
  // These handlers read the request body and returned { status: 'accepted' } (and an empty list as a "status")
  // without performing or recording any work. They are now honest 501s. Implementing each is tracked in
  // docs/union-eyes/convergence/register/ue-convergence-register.json (UE-CONV-STUB-*). Anti-theatre rule R-9
  // fails the build if the scaffold shape reappears.
  // ------------------------------------------------------------------------
  {
    id: 'UE-ACTION-MEMBERS-MERGE-BULK-EXPORT',
    title: 'Member merge, bulk and export actions',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/members/merge/route.ts', 'app/api/members/bulk/route.ts', 'app/api/members/export/route.ts', 'app/api/admin/members/export/route.ts'],
    evidence: [
      'each route.ts throws ApiError.notImplemented → HTTP 501 on both POST and the status GET',
      'tooling/reality/anti-theatre-scan.ts — rule R-9 rejects the previous 200 { status: "accepted" } scaffold',
    ],
    targetWave: 5,
    notes: 'Member export and merge are consequential (member PII, record integrity) and need kernel authorization, classification and audit before implementation.',
  },
  {
    id: 'UE-ACTION-CLAIMS-BULK',
    title: 'Bulk claim actions',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/claims/bulk/route.ts'],
    evidence: ['app/api/claims/bulk/route.ts — throws ApiError.notImplemented → HTTP 501', 'rule R-9 in tooling/reality/anti-theatre-scan.ts'],
    targetWave: 5,
  },
  {
    id: 'UE-ACTION-CLC-REMITTANCE-SUBMIT-EXPORT',
    title: 'CLC remittance submission and export',
    state: 'NOT_IMPLEMENTED',
    ownedBy: [
      'app/api/admin/clc/remittances/[id]/submit/route.ts',
      'app/api/admin/clc/remittances/[id]/export/route.ts',
      'app/api/admin/clc/remittances/export/route.ts',
    ],
    evidence: [
      'each route.ts throws ApiError.notImplemented → HTTP 501',
      'previously POST .../submit returned 200 { status: "accepted" } and submitted nothing to the CLC',
    ],
    targetWave: 5,
    notes: 'Financial submission: requires a governed remittance approval record (see the finance source findings) and an external acknowledgement before it may report success.',
  },
  {
    id: 'UE-ACTION-CARBON-ACCOUNTING',
    title: 'Carbon accounting: dashboard, infrastructure monitoring and claim validation',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/carbon/dashboard/route.ts', 'app/api/carbon/infrastructure/route.ts', 'app/api/carbon/validate/route.ts'],
    evidence: [
      'each route.ts throws ApiError.notImplemented → HTTP 501',
      'previously returned literal emissions totals, renewable percentages and a certification-eligibility verdict with success true and status 200 (DEF-0B4-CARBON-FABRICATED-MEASUREMENTS-RETURNED-200)',
    ],
    targetWave: 7,
    notes: 'No emissions data is collected. A measurement pipeline and a governed methodology must exist before any figure or certification outcome is returned.',
  },
  {
    id: 'UE-ACTION-TAX-DOCUMENTS',
    title: 'Tax slips, T106, RL-1 and COPE receipt generation',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/tax/slips/route.ts', 'app/api/tax/t106/route.ts', 'app/api/tax/rl-1/generate/route.ts', 'app/api/tax/cope/receipts/route.ts'],
    evidence: [
      'each route.ts throws ApiError.notImplemented → HTTP 501 on GET and POST',
      'previously a generic CRUD collection over per_capita_remittances readable by any member (DEF-0B12-CRUD-TAX-PATHS-SERVE-THE-PER-CAPITA-REMITTANCE-LEDGER-TO-ANY-MEMBER)',
    ],
    targetWave: 5,
    notes: 'Tax documents need a governed financial mandate, validated amounts and an audit record before generation. The per-capita remittance ledger is served by the finance routes under financial authority.',
  },
  {
    id: 'UE-ACTION-TAX-CRA-EXPORT',
    title: 'CRA tax export',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/tax/cra/export/route.ts'],
    evidence: ['app/api/tax/cra/export/route.ts — throws ApiError.notImplemented → HTTP 501', 'rule R-9 in tooling/reality/anti-theatre-scan.ts'],
    targetWave: 5,
  },
  {
    id: 'UE-ACTION-COMMUNICATIONS-EXPORTS',
    title: 'Campaign, distribution-list and survey exports',
    state: 'NOT_IMPLEMENTED',
    ownedBy: [
      'app/api/communications/campaigns/[id]/analytics/export/route.ts',
      'app/api/communications/distribution-lists/[id]/export/route.ts',
      'app/api/communications/surveys/[surveyId]/export/route.ts',
    ],
    evidence: ['each route.ts throws ApiError.notImplemented → HTTP 501', 'rule R-9 in tooling/reality/anti-theatre-scan.ts'],
    targetWave: 5,
  },
  {
    id: 'UE-ACTION-ALERT-TEST-EXECUTION',
    title: 'Alert test execution',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/admin/alerts/executions/test/route.ts'],
    evidence: ['app/api/admin/alerts/executions/test/route.ts — throws ApiError.notImplemented → HTTP 501', 'rule R-9 in tooling/reality/anti-theatre-scan.ts'],
    targetWave: 5,
  },
  {
    id: 'UE-ACTION-ORG-HIERARCHY-SEED',
    title: 'Organization hierarchy seeding',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/admin/seed-test-data/route.ts'],
    evidence: [
      'app/api/admin/seed-test-data/route.ts — throws ApiError.notImplemented → HTTP 501 on GET and POST',
      'the former seeders were empty stubs that created nothing while the route reported success; the SQL replay seeds targeted the superseded replay schema and were retired (UE-CONV-H-005)',
    ],
    targetWave: 5,
    notes: 'A canonical, schema-checked seed does not exist; the development seed button in the union dashboard reports the 501.',
  },

  // ------------------------------------------------------------------------
  // Cron endpoints (Wave 0 P0 fix: 200-no-op → HTTP 501)
  // ------------------------------------------------------------------------
  {
    id: 'UE-CRON-MONTHLY-DUES',
    title: 'Monthly dues cron (main app)',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/cron/monthly-dues/route.ts'],
    evidence: [
      'app/api/cron/monthly-dues/route.ts — throws ApiError.notImplemented → HTTP 501',
      'lib/api/errors.ts:92 — ApiError.notImplemented factory',
      'lib/api/standardized-responses.ts:110 — NOT_IMPLEMENTED → 501 mapping',
    ],
    targetWave: 5,
    notes:
      'Pending real dues-calculation implementation in Wave 5 and Wave 7. NOTE (Phase 3A capability audit, ' +
      '2026-08-31): a SEPARATE, more mature implementation already exists and is scheduled in the ' +
      'financial-service microservice — see UE-FIN-DUES-CALCULATION-WORKFLOW below. That implementation is ' +
      'real and running but has its own defect (hardcoded single test tenant). This entry describes only the ' +
      'main-app stub route, which genuinely returns 501 and is not itself wired to the financial-service job. ' +
      'Intended cadence, removed from lib/operations/scheduled-jobs.json (a schedule for a 501 route only records a failed run every period): "0 6 1 * *" UTC, 300 s timeout.',
  },
  {
    id: 'UE-CRON-OVERDUE-NOTIFICATIONS',
    title: 'Overdue-notifications cron (main app)',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/cron/overdue-notifications/route.ts'],
    evidence: ['app/api/cron/overdue-notifications/route.ts — throws ApiError.notImplemented → HTTP 501'],
    targetWave: 3,
    notes:
      'NOTE (Phase 3A capability audit, 2026-08-31): real dues-reminder-sending code already exists at ' +
      'lib/jobs/dues-reminder-scheduler.ts (DuesReminderScheduler.runReminderJob — 7-day/1-day/overdue ' +
      'notices via lib/services/notification-service.ts) but no cron, queue, or route invokes it anywhere ' +
      'in the codebase. See UE-FIN-DUES-REMINDER-SCHEDULER below. ' +
      'Intended cadence, removed from lib/operations/scheduled-jobs.json (a schedule for a 501 route only records a failed run every period): "0 8 * * *" UTC, 100 s timeout.',
  },
  {
    id: 'UE-CRON-PROCESS-MESSAGES',
    title: 'Message-processing cron',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/cron/process-messages/route.ts'],
    evidence: ['app/api/cron/process-messages/route.ts — throws ApiError.notImplemented → HTTP 501'],
    targetWave: 4,
    notes: 'Intended cadence, removed from lib/operations/scheduled-jobs.json (a schedule for a 501 route only records a failed run every period): "*/5 * * * *" UTC, 100 s timeout.',
  },
  {
    id: 'UE-CRON-PROCESS-NOTIFICATIONS',
    title: 'Notification-processing cron',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/cron/process-notifications/route.ts'],
    evidence: ['app/api/cron/process-notifications/route.ts — throws ApiError.notImplemented → HTTP 501'],
    targetWave: 4,
    notes:
      'Depends on Wave 5 (real notification dispatcher). Intended cadence, removed from lib/operations/scheduled-jobs.json (a schedule for a 501 route only records a failed run every period): "*/5 * * * *" UTC, 100 s timeout.',
  },
  {
    id: 'UE-CRON-SCHEDULED-REPORTS',
    title: 'Scheduled-reports cron',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/cron/scheduled-reports/route.ts'],
    evidence: ['app/api/cron/scheduled-reports/route.ts — throws ApiError.notImplemented → HTTP 501'],
    targetWave: 8,
    notes: 'Intended cadence, removed from lib/operations/scheduled-jobs.json (a schedule for a 501 route only records a failed run every period): "0 * * * *" UTC, 300 s timeout.',
  },
  {
    id: 'UE-CRON-DAILY-METRICS',
    title: 'Daily analytics metrics cron',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/cron/analytics/daily-metrics/route.ts'],
    evidence: ['app/api/cron/analytics/daily-metrics/route.ts — throws ApiError.notImplemented → HTTP 501 (the earlier version returned a literal healthy status and did no work)'],
    targetWave: 8,
    notes: 'Intended cadence, removed from lib/operations/scheduled-jobs.json (a schedule for a 501 route only records a failed run every period): "30 2 * * *" UTC, 300 s timeout. No analytics collector has been designed or persisted.',
  },
  {
    id: 'UE-CRON-BILLING-LIFECYCLE',
    title: 'Billing lifecycle cron (period, invoices, finalization, overdue state)',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/cron/billing-lifecycle/route.ts'],
    evidence: ['app/api/cron/billing-lifecycle/route.ts — throws ApiError.notImplemented → HTTP 501: the lifecycle writes across organizations and the cron caller has no authorized SYSTEM cross-organization write authority (the final closure sprint authorizes cross-organization SELECT only)'],
    targetWave: 7,
    notes: 'Intended cadence, removed from lib/operations/scheduled-jobs.json (a schedule for a 501 route only records a failed run every period): "0 3 * * *" UTC, 300 s timeout. It returns when that write authority is designed, granted and proven.',
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
  // Operational probes of /api/admin/pilot-status (lib/pilot-admin-operational.ts). Each probe reports a `capabilityId`, and the id is an entry here. A probe that is not built
  // answers `unknown`, which the rollup treats as not healthy; the entry says so, so an operator can tell "not observed" from "healthy".
  // ------------------------------------------------------------------------
  {
    id: 'UE-DB-POSTGRES-PING',
    title: 'PostgreSQL round-trip probe',
    state: 'LIMITED',
    ownedBy: ['lib/pilot-admin-operational.ts', 'app/api/admin/pilot-status/route.ts'],
    evidence: ['lib/pilot-admin-operational.ts — probePostgresPing runs SELECT 1 through withSystemContext and reports pass or fail', 'lib/__tests__/pilot-admin-operational.test.ts'],
    targetWave: 3,
    notes: 'Unit-tested against a stub runner; not proven against a deployed database.',
  },
  {
    id: 'UE-REALITY-DEMO-GUARD',
    title: 'Demo profile enforcement probe',
    state: 'LIMITED',
    ownedBy: ['lib/pilot-admin-operational.ts', 'app/api/admin/pilot-status/route.ts'],
    evidence: ['lib/pilot-admin-operational.ts — probeDemoProfileEnforcement fails when a demo profile is active outside a development target', 'lib/__tests__/pilot-admin-operational.test.ts'],
    targetWave: 3,
    notes: 'Reads the environment only; it mirrors the boot-time guard and is not proven in a deployed environment.',
  },
  {
    id: 'UE-SECRET-DATABASE-URL',
    title: 'DATABASE_URL presence probe',
    state: 'LIMITED',
    ownedBy: ['lib/pilot-admin-operational.ts', 'app/api/admin/pilot-status/route.ts'],
    evidence: ['lib/pilot-admin-operational.ts — probeSecretPresence reports whether the variable is set and how long it is, never its value'],
    targetWave: 3,
    notes: 'Presence only: a set variable can still be wrong.',
  },
  {
    id: 'UE-SECRET-AUTH',
    title: 'AUTH_SECRET presence probe',
    state: 'LIMITED',
    ownedBy: ['lib/pilot-admin-operational.ts', 'app/api/admin/pilot-status/route.ts'],
    evidence: ['lib/pilot-admin-operational.ts — probeSecretPresence reports whether the variable is set and how long it is, never its value'],
    targetWave: 3,
    notes: 'Presence only: a set variable can still be wrong.',
  },
  {
    id: 'UE-SECRET-ENTRA-TENANT',
    title: 'AZURE_AD_TENANT_ID presence probe',
    state: 'LIMITED',
    ownedBy: ['lib/pilot-admin-operational.ts', 'app/api/admin/pilot-status/route.ts'],
    evidence: ['lib/pilot-admin-operational.ts — probeSecretPresence reports whether the variable is set and how long it is, never its value'],
    targetWave: 3,
    notes: 'Presence only: a set variable can still be wrong.',
  },
  {
    id: 'UE-DB-MIGRATIONS-APPLIED',
    title: 'Applied-migrations probe',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['lib/pilot-admin-operational.ts'],
    evidence: ['lib/pilot-admin-operational.ts — unmeasuredProbes() answers `unknown`; nothing compares the applied migrations with the expected ones'],
    targetWave: 3,
    notes: 'Healthy would be: no unapplied migrations.',
  },
  {
    id: 'UE-TENANT-ISOLATION',
    title: 'Runtime tenant-isolation probe',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['lib/pilot-admin-operational.ts'],
    evidence: ['lib/pilot-admin-operational.ts — unmeasuredProbes() answers `unknown`; no probe exercises the runtime role against a second organization'],
    targetWave: 3,
    notes: 'Tenant isolation itself is proven by the native real-role tests and the tenant-context census, not by this probe. Healthy would be: every pilot-critical query scoped to organizationId.',
  },
  {
    id: 'UE-REDIS-PING',
    title: 'Redis reachability probe',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['lib/pilot-admin-operational.ts'],
    evidence: ['lib/pilot-admin-operational.ts — unmeasuredProbes() answers `unknown`; nothing pings Redis'],
    targetWave: 3,
    notes: 'Healthy would be: PING → PONG.',
  },
  {
    id: 'UE-DJANGO-SIDECAR-HEALTH',
    title: 'Django sidecar health probe',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['lib/pilot-admin-operational.ts'],
    evidence: ['lib/pilot-admin-operational.ts — unmeasuredProbes() answers `unknown`; nothing calls the sidecar health route'],
    targetWave: 3,
    notes: 'Healthy would be: GET /api/auth_core/health/ returns 200.',
  },
  {
    id: 'UE-QUEUE-DEPTH',
    title: 'Job queue depth probe',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['lib/pilot-admin-operational.ts'],
    evidence: ['lib/pilot-admin-operational.ts — unmeasuredProbes() answers `unknown`; nothing reads the queue'],
    targetWave: 3,
    notes: 'Healthy would be: depth below 100 items with at least one worker running.',
  },
  {
    id: 'UE-WORKER-HEARTBEAT',
    title: 'Worker heartbeat probe',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['lib/pilot-admin-operational.ts'],
    evidence: ['lib/pilot-admin-operational.ts — unmeasuredProbes() answers `unknown`; nothing reads a worker heartbeat'],
    targetWave: 3,
    notes: 'Healthy would be: at least one worker updated its heartbeat in the last 60 s.',
  },
  {
    id: 'UE-CRON-FRESHNESS',
    title: 'Cron freshness probe',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['lib/pilot-admin-operational.ts'],
    evidence: ['lib/pilot-admin-operational.ts — unmeasuredProbes() answers `unknown`; nothing compares each scheduled job\'s last run with its interval'],
    targetWave: 3,
    notes: 'Healthy would be: each configured cron ran within twice its interval.',
  },
  {
    id: 'UE-EMAIL-PROBE',
    title: 'E-mail deliverability probe',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['lib/pilot-admin-operational.ts'],
    evidence: ['lib/pilot-admin-operational.ts — unmeasuredProbes() answers `unknown`; nothing sends a test message'],
    targetWave: 3,
    notes: 'Healthy would be: a test message to the postmaster address is delivered through the mail provider.',
  },
  {
    id: 'UE-SMS-PROBE',
    title: 'SMS deliverability probe',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['lib/pilot-admin-operational.ts'],
    evidence: ['lib/pilot-admin-operational.ts — unmeasuredProbes() answers `unknown`; nothing reaches the SMS provider'],
    targetWave: 3,
    notes: 'Healthy would be: the SMS provider is reachable and quota is available.',
  },
  {
    id: 'UE-CLAMAV-PROBE',
    title: 'Malware scanner reachability probe',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['lib/pilot-admin-operational.ts'],
    evidence: ['lib/pilot-admin-operational.ts — unmeasuredProbes() answers `unknown`; nothing scans an empty payload'],
    targetWave: 3,
    notes: 'Healthy would be: the scanner endpoint returns 200 for an empty payload.',
  },
  {
    id: 'UE-STORAGE-PROBE',
    title: 'Blob storage reachability probe',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['lib/pilot-admin-operational.ts'],
    evidence: ['lib/pilot-admin-operational.ts — unmeasuredProbes() answers `unknown`; nothing reads a canary blob'],
    targetWave: 3,
    notes: 'Healthy would be: a HEAD request on a canary blob returns 200.',
  },
  {
    id: 'UE-PAYMENT-PROBE',
    title: 'Payment provider reachability probe',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['lib/pilot-admin-operational.ts'],
    evidence: ['lib/pilot-admin-operational.ts — unmeasuredProbes() answers `unknown`; nothing calls the payment provider'],
    targetWave: 3,
    notes: 'Healthy would be: a balance read on the payment provider returns 200.',
  },
  {
    id: 'UE-SENTRY-PROBE',
    title: 'Error monitoring reachability probe',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['lib/pilot-admin-operational.ts'],
    evidence: ['lib/pilot-admin-operational.ts — unmeasuredProbes() answers `unknown`; nothing sends a synthetic event'],
    targetWave: 3,
    notes: 'Healthy would be: the DSN is valid and a synthetic message is acknowledged.',
  },
  {
    id: 'UE-SYNTHETIC-MONITORING',
    title: 'Synthetic monitoring probe',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['lib/pilot-admin-operational.ts'],
    evidence: ['lib/pilot-admin-operational.ts — unmeasuredProbes() answers `unknown`; no external probe is recorded'],
    targetWave: 3,
    notes: 'Healthy would be: at least one external probe every 5 minutes returning 200.',
  },
  {
    id: 'UE-AUDIT-SEAL',
    title: 'Audit log tamper-seal probe',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['lib/pilot-admin-operational.ts'],
    evidence: ['lib/pilot-admin-operational.ts — unmeasuredProbes() answers `unknown`; nothing verifies a daily seal row or the hash chain'],
    targetWave: 3,
    notes: 'Healthy would be: a daily audit-seal row within the last 25 hours and a valid hash chain.',
  },
  {
    id: 'UE-BACKUP-FRESHNESS',
    title: 'Backup freshness probe',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['lib/pilot-admin-operational.ts'],
    evidence: ['lib/pilot-admin-operational.ts — unmeasuredProbes() answers `unknown`; nothing reads the newest backup'],
    targetWave: 3,
    notes: 'Healthy would be: the newest full backup is under 26 hours old.',
  },
  {
    id: 'UE-RESTORE-PROOF',
    title: 'Restore drill probe',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['lib/pilot-admin-operational.ts'],
    evidence: ['lib/pilot-admin-operational.ts — unmeasuredProbes() answers `unknown`; no restore drill is recorded'],
    targetWave: 3,
    notes: 'Healthy would be: the last successful restore drill is under 30 days old.',
  },
  {
    id: 'UE-REGISTRY-CONSISTENCY',
    title: 'Capability registry consistency probe',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['lib/pilot-admin-operational.ts'],
    evidence: ['lib/pilot-admin-operational.ts — unmeasuredProbes() answers `unknown`; the consistency is held by tests at build time, not probed at run time'],
    targetWave: 3,
    notes: 'Healthy would be: no route is discovered without a registry entry.',
  },
  {
    id: 'UE-DEPLOYMENT-REVISION',
    title: 'Deployed revision alignment probe',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['lib/pilot-admin-operational.ts'],
    evidence: ['lib/pilot-admin-operational.ts — unmeasuredProbes() answers `unknown`; nothing compares the active revision with the CI-recorded image digest'],
    targetWave: 3,
    notes: 'Healthy would be: the active revision matches the CI-recorded image digest.',
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
      'reports/phase0/task-j/smoke.json — Wave 0 Task J live proof: image nzilacanadaacr.azurecr.io/nzila-os-union-eyes@sha256:73b4b7bd61909a7f8e484b5244840a2ea05a62838e9494b41a859df46e8aa811 (tags task-j-b328b38c4, staging-latest) built via ACR run cx6x with DOCKER_BUILDKIT=1, deployed to Container App nzila-os-union-eyes-staging revision --0000090 (Active, Healthy, Running). Live /api/version reports gitSha=b328b38c4b1e…, releaseId=wave0-task-j, demoProfile=null, featureProfile=internal.',
      'reports/phase0/task-j/README.md — full Task J trail (§11 build, §12 proof, §13 staging baseline, §14 deploy).',
    ],
    targetWave: 0,
    notes:
      'CORRECTED 2026-07-21 (see docs/union-eyes/reality-remediation/23_WAVE_0_CORRECTION.md). ' +
      'The prior allowlist model has been retired. Operational package now physically excludes customer-specific ' +
      'demo modules and rejects UE_DEMO_* env vars at boot via the zod schema. Any regression is caught at the ' +
      'boundary (env validation) or at compile time (removed types), not by a runtime scanner allowlist. ' +
      'Task F (bundle proof) additionally verified via next.config outputFileTracingExcludes plus a clean ' +
      '`pnpm reality:build-scan:with-bundle` after a full production build. ' +
      'Task J (2026-07-21) closes the loop end-to-end: the operational image was rebuilt cleanly in ACR (run ' +
      'cx6x, digest sha256:73b4b7bd6190…) and deployed to nzila-os-union-eyes-staging revision --0000090. ' +
      'The live /api/version endpoint reports gitSha=b328b38c4b1e…, featureProfile=internal, demoProfile=null — ' +
      'proving the runtime environment on staging carries no customer-fixture footprint.',
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
      'components/dashboards/federation-dashboard.tsx — Reports quick-action tile REMOVED (the component itself was later deleted as unmounted UI)',
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
    title: 'Sentry example page (/sentry-example-page) — REMOVED',
    state: 'REMOVED',
    ownedBy: [],
    evidence: [
      'app/sentry-example-page/page.tsx — DELETED: a development-only page that answered 404 in every deployed environment and existed only to throw a test error.',
    ],
    targetWave: 0,
    notes: 'Sentry SDK wiring is validated by the SDK configuration, not by a page that ships in the bundle.',
  },

  // ------------------------------------------------------------------------
  // Wave 1 Phase A — Deadline Engine (durable reminder outbox)
  //
  // CORRECTION 2026-07-21 (after over-claim in commit 32de2ef67):
  //   The five broad capabilities below (CORE, REMINDERS, DELIVERY,
  //   OVERDUE, RECOVERY) were briefly marked PROVEN_IN_STAGING. That
  //   state string is not even a member of CapabilityState — the edit
  //   was type-broken — and, more importantly, the underlying evidence
  //   only covered the worker/provider slice.
  //
  //   The broad capabilities are restored to LIMITED. Four NARROW
  //   proven-slice capabilities have been added below to record exactly
  //   what the live-staging run of 2026-07-21 actually established:
  //     - UE-DEADLINE-WORKER-CLAIM
  //     - UE-DEADLINE-EXECUTION-PERSISTENCE
  //     - UE-DEADLINE-PROVIDER-ACCEPTANCE
  //     - UE-DEADLINE-DIRECT-DEAD-LETTER
  //
  //   NOT proven and therefore still LIMITED at broad level:
  //     - real deadline creation via app service (bypassed — rows inserted directly)
  //     - reminder calculation (scheduler service never invoked)
  //     - rescheduling / cancellation / stale-suppression
  //     - overdue detector transitioning an ACTIVE deadline to OVERDUE
  //     - recipient resolution (email fields set by hand)
  //     - retry / backoff / lease-recovery / restart recovery
  //     - concurrent-claim safety (single worker in test)
  //     - bounce-webhook reconciliation
  //     - timezone / DST battery
  //     - tenant isolation via application identities (test used privileged DB role)
  //     - real scheduled invocation (manual curl, not scheduler)
  // ------------------------------------------------------------------------
  {
    id: 'UE-DEADLINE-CORE',
    title: 'Deadline engine — core outbox schema',
    state: 'LIMITED',
    ownedBy: [
      'migrations/0045_union_eyes_deadline_engine.sql',
      'apps/union-eyes/db/schema/deadline-engine-schema.ts',
    ],
    evidence: [
      'migrations/0045_union_eyes_deadline_engine.sql — deadline_reminders, deadline_reminder_executions (append-only), deadline_audit_events (append-only), lease/fence indexes, tenant-isolation RLS',
      'apps/union-eyes/db/schema/deadline-engine-schema.ts — Drizzle mirror + typed enums',
      'reports/phase0/wave-1-phase-a/migration-0045-apply.log — migration 0045 applied to staging (nzila-staging-db) 2026-07-21T18:40Z; 3 tables + 3 immutability triggers verified',
    ],
    targetWave: 1,
    notes:
      'LIMITED: schema + immutability triggers are live on staging, but migration 0045 was applied MANUALLY with psql and is not yet recorded in the governed migration ledger. Application-level FK-integrity for source_deadline_id (polymorphic) is enforced only by convention — no service-level guard tested. Not yet proven end-to-end via the deadline-creation service path.',
  },
  {
    id: 'UE-DEADLINE-REMINDERS',
    title: 'Deadline engine — reminder scheduler',
    state: 'LIMITED',
    ownedBy: [
      'apps/union-eyes/lib/deadline-engine/reminder-scheduler.ts',
      'apps/union-eyes/lib/deadline-engine/recipient-resolver.ts',
    ],
    evidence: [
      'apps/union-eyes/lib/deadline-engine/reminder-scheduler.ts — atomic cancel-then-insert transaction; pending-uniqueness partial index prevents duplicates on reschedule',
      'apps/union-eyes/lib/deadline-engine/recipient-resolver.ts — snapshot resolution against grievances (grievor + assigned officer); tenant check via grievance.organizationId',
    ],
    targetWave: 1,
    notes:
      'LIMITED: scheduler code + partial index are in place, but the 2026-07-21 staging run did NOT invoke the scheduler service — it inserted deadline_reminders rows directly. Reminder calculation, rescheduling, cancellation, stale-suppression, timezone handling, and DST behaviour remain UNPROVEN in staging.',
  },
  {
    id: 'UE-DEADLINE-DELIVERY',
    title: 'Deadline engine — worker + at-least-once delivery',
    state: 'LIMITED',
    ownedBy: [
      'apps/union-eyes/lib/deadline-engine/reminder-worker.ts',
      'apps/union-eyes/lib/deadline-engine/email-adapter.ts',
      'apps/union-eyes/app/api/cron/deadline-reminders/route.ts',
    ],
    evidence: [
      'apps/union-eyes/lib/deadline-engine/reminder-worker.ts — FOR UPDATE SKIP LOCKED claim, lease/fence, retry with attempt increment, dead-letter after max_attempts, structured WorkerRunResult (never a boolean)',
      'apps/union-eyes/lib/deadline-engine/email-adapter.ts — Resend wrapper distinguishing transient (408/409/425/429/5xx, ECONNRESET, ETIMEDOUT) vs permanent failures',
      'apps/union-eyes/app/api/cron/deadline-reminders/route.ts — cron-authenticated endpoint invoking runDeadlineReminderWorker()',
    ],
    targetWave: 1,
    notes:
      'LIMITED: the worker end (claim → provider acceptance → execution write → audit) is proven by the narrow slice capabilities below. But retry classification, backoff, concurrent-claim safety (2+ workers), lease-recovery, and restart-recovery are all UNPROVEN in staging.',
  },
  {
    id: 'UE-DEADLINE-OVERDUE',
    title: 'Deadline engine — overdue detector',
    state: 'LIMITED',
    ownedBy: ['apps/union-eyes/app/api/cron/deadline-overdue/route.ts'],
    evidence: [
      'apps/union-eyes/app/api/cron/deadline-overdue/route.ts — scans grievance_deadlines for past-due rows without an in-flight overdue reminder; enqueues offset=0 reminders with reminder_kind=overdue; emits overdue.detected audit event',
    ],
    targetWave: 1,
    notes:
      'LIMITED: overdue processor code exists, but the 2026-07-21 staging run did NOT exercise it. The "overdue" scenario manually inserted a reminder row with reminder_kind=overdue rather than transitioning a real ACTIVE deadline to OVERDUE via the processor. Overdue detection, escalation, and pre-deadline reminder cancellation remain UNPROVEN.',
  },
  {
    id: 'UE-DEADLINE-RECOVERY',
    title: 'Deadline engine — lease recovery + append-only audit',
    state: 'LIMITED',
    ownedBy: [
      'apps/union-eyes/lib/deadline-engine/reminder-worker.ts',
      'apps/union-eyes/lib/deadline-engine/audit.ts',
      'migrations/0045_union_eyes_deadline_engine.sql',
    ],
    evidence: [
      'reminder-worker.ts — recovery pass: claimed rows whose lease_expires_at has passed transition back to pending with attempt_count preserved; emits reminder.lease_recovered',
      'migrations/0045 — trg_deadline_reminder_executions_immutable and trg_deadline_audit_events_immutable triggers reject UPDATE/DELETE; append-only enforced at DB layer',
      'audit.ts — AuditMetadataSchema rejects PII/secret keys (message_body, recipient_email, api_key, authorization)',
      'reports/phase0/wave-1-phase-a/migration-0045-apply.log — CREATE TRIGGER trg_deadline_reminder_executions_immutable + trg_deadline_audit_events_immutable executed on staging',
    ],
    targetWave: 1,
    notes:
      'LIMITED: immutability triggers are installed on staging. Lease recovery, restart recovery, retry+backoff on transient failures, and true concurrent-claim safety (2+ workers racing for the same row) are all UNPROVEN. The 2026-07-21 D3 dead-letter used max_attempts=1 and proves only immediate permanent-failure transition, not exhaustion after backoff.',
  },

  // -- Narrow proven-slice capabilities (added by 2026-07-21 correction) ----
  {
    id: 'UE-DEADLINE-WORKER-CLAIM',
    title: 'Deadline engine — worker claim under FOR UPDATE SKIP LOCKED',
    state: 'LIMITED',
    ownedBy: ['apps/union-eyes/lib/deadline-engine/reminder-worker.ts'],
    evidence: [
      'reminder-worker.ts — SELECT ... FOR UPDATE SKIP LOCKED claim loop with lease token + fence write',
      'reports/phase0/wave-1-phase-a/cron-run-1.json — single worker (deadline-worker-bba17019) atomically claimed 2 due rows and released 0 on lease expiry',
      'reports/phase0/wave-1-phase-a/d1-scenario.json — reminder.claimed audit event with actor_id=deadline-worker-bba17019, attempt_number=1',
    ],
    targetWave: 1,
    notes:
      'LIMITED: proven for a single worker claiming multiple due rows in one tick. Two concurrent workers racing the same row (real safety test) is NOT proven.',
  },
  {
    id: 'UE-DEADLINE-EXECUTION-PERSISTENCE',
    title: 'Deadline engine — append-only execution rows',
    state: 'LIMITED',
    ownedBy: [
      'apps/union-eyes/lib/deadline-engine/reminder-worker.ts',
      'migrations/0045_union_eyes_deadline_engine.sql',
    ],
    evidence: [
      'reports/phase0/wave-1-phase-a/d1-scenario.json — deadline_reminder_executions row: attempt_number=1, outcome=sent, provider=resend, duration_ms=187',
      'reports/phase0/wave-1-phase-a/d3-failure.json — permanent-failure execution row written before dead_lettered transition',
      'migrations/0045 — trg_deadline_reminder_executions_immutable installed and verified on staging DB',
    ],
    targetWave: 1,
    notes:
      'LIMITED: proven that the worker writes append-only executions on both success and permanent-failure paths. Immutability trigger REJECTION of UPDATE/DELETE was not exercised in the run — only its installation was verified.',
  },
  {
    id: 'UE-DEADLINE-PROVIDER-ACCEPTANCE',
    title: 'Deadline engine — provider acceptance via Resend',
    state: 'LIMITED',
    ownedBy: ['apps/union-eyes/lib/deadline-engine/email-adapter.ts'],
    evidence: [
      'reports/phase0/wave-1-phase-a/cron-run-1.json — 2 requests to Resend accepted synchronously; 2 provider_message_ids returned',
      'reports/phase0/wave-1-phase-a/d1-scenario.json — provider_message_id 86985eaf-0e9b-416c-8e0b-2619ab703239 captured',
      'reports/phase0/wave-1-phase-a/d2-bounce-scenario.json — provider_message_id b9f30817-e031-4cd4-811a-72d00a6321c4 captured (bounce sandbox — accepted synchronously; actual bounce webhook NOT verified)',
    ],
    targetWave: 1,
    notes:
      'LIMITED: proves the app can call Resend from the deployed staging image and persist the returned provider_message_id. Does NOT prove terminal delivery, bounce reconciliation, or webhook authenticity — those require a controlled inbox + verified webhook fixtures.',
  },
  {
    id: 'UE-DEADLINE-DIRECT-DEAD-LETTER',
    title: 'Deadline engine — immediate dead-letter on synchronous permanent failure',
    state: 'LIMITED',
    ownedBy: ['apps/union-eyes/lib/deadline-engine/reminder-worker.ts'],
    evidence: [
      'reports/phase0/wave-1-phase-a/d3-failure.json — reminder 4f000d24 with malformed recipient: attempt_count reached max_attempts=1, status transitioned to dead_letter, last_error_code=resend_no_message_id, reminder.dead_lettered audit event with reason=permanent_failure',
    ],
    targetWave: 1,
    notes:
      'LIMITED: proves the direct permanent-failure branch when max_attempts=1. Retry classification, exponential backoff, exhaustion-after-retries, manual replay, and lease-based recovery are all UNPROVEN in staging.',
  },

  // ------------------------------------------------------------------------
  // Member Dues Portal — truth reconciliation
  //
  // CORRECTION: the member-facing dues portal previously (a) queried
  // platform-level billing tables (platformCostLedgerEntries /
  // platformPayments — Nzila's own SaaS billing ledger, unrelated to union
  // member dues) instead of the native per-member dues ledger, (b) ignored
  // the authenticated userId and scoped some reads by organization only,
  // leaking cross-member payment/deduction data, (c) fabricated a fake
  // "healthy" balance ($0, active, next-due-in-30-days) on any load error
  // instead of surfacing failure, and (d) never persisted submitted
  // deduction-issue reports despite returning a fabricated success ack.
  // Native dues calculation, scheduling, and automated reminders remain
  // explicitly out of scope (non-blocking, optional) — the requirement
  // enforced here is that whatever balance/history/issue data IS shown to
  // a member is real, correctly scoped, and honestly absent when it can't
  // be loaded.
  //
  // OWNER DECISION (closed): dues and per-capita remittances are handled in
  // an external system. Union Eyes reflects the data it holds, read-only, and
  // at best: it does not collect, calculate, remit, reconcile, submit or
  // export dues, and it does not build a dues or remittance ledger of its own.
  // A dues or remittance screen is therefore either a reflection of rows that
  // exist (with an honest empty or failed state) or it is absent.
  // ------------------------------------------------------------------------
  {
    id: 'UE-DUES-PORTAL-BALANCE',
    title: "Member dues portal — balance summary (member's own view)",
    state: 'REAL',
    ownedBy: [
      'app/api/dues/balance/route.ts',
      'components/dues/dues-payment-portal.tsx',
      'db/schema/dues-finance-schema.ts',
    ],
    evidence: [
      'app/api/dues/balance/route.ts — computes balance from member_dues_ledger (charges − payments − credits − adjustments − write_offs) scoped by authenticated userId + organizationId, filtered to status=posted only',
      'app/api/dues/balance/route.ts — availability requires postedCount > 0 from the SAME status=posted aggregate query; a member whose only ledger activity is pending, reversed, or voided (zero posted rows) returns { available: false } exactly like a member with zero rows at all — "NO DATA != ZERO BALANCE" is never satisfied by non-authoritative activity',
      'app/api/__tests__/dues-balance.route.test.ts — 8 tests prove: missing auth context → available:false; zero ledger rows → available:false; pending-only rows → available:false; reversed-only rows → available:false; voided-only rows → available:false; posted rows summing to zero → genuine available:true/paid_up/$0; posted positive net → owing; posted payments exceeding posted charges → credit',
      'components/dues/dues-payment-portal.tsx — removed the catch-block that fabricated a $0/"active" balance on fetch failure; renders a distinct "no dues data on file" state (balance.available === false) versus a genuine fetch-error state (loadError)',
      'Balance sign convention is not invented in the read endpoint — it matches the two production writers of member_dues_ledger: app/api/portal/dues/pay/route.ts and app/api/dues/arrears/[id]/payment/route.ts, both of which store payment/credit/adjustment/write_off as positive magnitudes that reduce balance, and both of which scope balance calculation to status=posted (which already excludes pending/reversed/voided rows — no separate reversal-handling branch is required)',
      '`asOf` is documented and tested as calculation/query time, not a source-synchronization timestamp; the UI label reads "Balance calculated {date}" (not "Last synchronized") across all 6 locales to avoid implying a sync event that never occurred',
    ],
    targetWave: 0,
    notes:
      'Replaces the prior implementation, which read organization-level platform billing ledger data (platformCostLedgerEntries) and hardcoded membershipStatus/lastPaymentDate/nextDueDate. Dues scheduling ("next deduction expected") is intentionally not shown — no real per-member dues-rate/schedule table exists; this is a non-blocking, optional capability, not a truth defect. The response contract is a discriminated union (`available: true | false`) so a future `source: "integration"` provenance (an external, authoritative dues/membership system) can be added without re-introducing ambiguity between "no data" and "zero balance" — no such integration is implemented or fabricated today. If an integration source later provides a genuine synchronization timestamp, it must be exposed as a distinct field (e.g. `sourceUpdatedAt`) rather than overloading `asOf`.',
  },
  {
    id: 'UE-DUES-PORTAL-PAYMENT-HISTORY',
    title: 'Member dues portal — payment history',
    state: 'REAL',
    ownedBy: ['app/api/dues/payment-history/route.ts', 'app/api/dues/receipt/[id]/route.ts'],
    evidence: [
      'app/api/dues/payment-history/route.ts — queries member_dues_ledger filtered by transactionType=payment, userId, and organizationId (previously queried platformPayments with no userId scoping — a cross-member data leak)',
      'app/api/dues/receipt/[id]/route.ts — receipt lookup now scoped by id + organizationId + userId against member_dues_ledger (previously platformPayments, org-scoped only)',
    ],
    targetWave: 0,
    notes:
      'Receipt route returns the ledger entry as JSON, not a rendered PDF — a known, accepted, lower-priority gap distinct from the truth-fabrication issue this entry addresses.',
  },
  {
    id: 'UE-DUES-PORTAL-ISSUE-REPORTING',
    title: 'Member dues portal — deduction issue reporting',
    state: 'REAL',
    ownedBy: ['app/api/dues/issues/route.ts'],
    evidence: [
      'app/api/dues/issues/route.ts — persists to member_dues_issues via db.insert(); previously returned a fabricated success acknowledgement (crypto.randomUUID() id) with no database write at all',
    ],
    targetWave: 0,
  },
  {
    id: 'UE-DUES-PORTAL-DEDUCTIONS',
    title: 'Member dues portal — payroll deduction history',
    state: 'REAL',
    ownedBy: ['app/api/dues/deductions/route.ts'],
    evidence: [
      'app/api/dues/deductions/route.ts — userId now sourced from the authenticated withApi context; previously read from a client-supplied ?userId= query parameter, allowing any authenticated member to view another member\'s deduction records (IDOR)',
    ],
    targetWave: 0,
  },
  {
    id: 'UE-DUES-DIRECT-PAYMENT',
    title: 'Member dues portal — direct Stripe payment / autopay / saved payment methods',
    state: 'DISABLED',
    ownedBy: [
      'app/api/dues/create-payment-intent/route.ts',
      'app/api/dues/payment-methods/route.ts',
    ],
    evidence: [
      'components/dues/dues-payment-portal.tsx — reflects the member ledger only: it renders no payment form and no payment-method manager (both components were removed with the unmounted UI)',
      'app/api/dues/autopay/route.ts — confirmed does not exist (404)',
      'app/api/dues/payment-methods/[id]/route.ts (DELETE) and .../set-default/route.ts (POST) — confirmed do not exist (404)',
      'Settlement now exists and is proven (lib/dues/dues-settlement.ts, verified Stripe webhook, idempotent, audited) but member dues collection is NOT initial launch scope: the initiation routes answer 501 unless UE_MEMBER_DUES_PAYMENTS=1 (lib/dues/member-dues-flag.ts)',
    ],
    targetWave: 0,
    notes:
      'DISABLED, DORMANT. Owner decision (closed): dues are handled in an external system and Union Eyes reflects data at best, so member dues collection is not to be enabled and no member payment UI is to be built. The server-owned initiation (create-payment-intent, portal/dues/pay) and the verified-webhook settlement into member_dues_ledger remain implemented and off by default (UE_MEMBER_DUES_PAYMENTS unset).',
  },

  // ------------------------------------------------------------------------
  // Deadline continuity remediation (UE_DEADLINE_CONTINUITY) —
  // fix/deadline-continuity. Closes the representative-transition gap the
  // Wave 1 Phase A inventory explicitly flagged: reminder recipients are
  // snapshotted at schedule time and never re-resolved, so a grievance
  // reassignment left the outgoing representative as the reminder
  // recipient and the successor received nothing.
  // ------------------------------------------------------------------------
  {
    id: 'UE-DEADLINE-ASSIGNMENT-CONTINUITY',
    title: 'Deadline engine — recipient continuity across representative reassignment',
    state: 'LIMITED',
    ownedBy: [
      'apps/union-eyes/lib/deadline-engine/assignment-sync.ts',
      'apps/union-eyes/lib/deadline-engine/reminder-worker.ts',
      'apps/union-eyes/app/api/grievances/[id]/assign/route.ts',
    ],
    evidence: [
      'app/api/grievances/[id]/assign/route.ts — PATCH updates grievances.unionRepId and inserts a durable deadline_reassignment_convergence task in the SAME transaction (via the tx handle from withRLSContext), then attempts convergence immediately; previously the route never touched the deadline engine at all',
      'lib/deadline-engine/assignment-sync.ts — requestAssignmentConvergence()/processAssignmentConvergence()/sweepPendingAssignmentConvergence() close the partial-handoff risk at module level: an assignment change inserts deadline_reassignment_convergence in the caller transaction. The task stays "pending" (never a terminal failure) across attempts; refreshDeadlineRemindersForGrievance() reschedules every non-completed grievance_deadlines row and is idempotent (cancel-then-insert). Root migrations/0049 is not the tenant-isolation authority: its PUBLIC policy matches every row when app.current_org_id is empty. Scoped 0019 is the fail-closed source closure and is not staging proof',
      'lib/deadline-engine/reminder-worker.ts — runDeadlineReminderWorker() sweeps pending convergence tasks on every periodic run (sweepPendingAssignmentConvergence), so a handoff that failed to fully converge in-request (deadline N of M failed to reschedule) is retried automatically without requiring a human to re-hit the assign endpoint',
      'lib/deadline-engine/reminder-worker.ts — a dispatch-time revalidation query runs immediately before every delivery attempt: a reminder whose source deadline is now completed, or whose assigned_officer recipient no longer matches grievances.unionRepId, is fail-closed suppressed (status=cancelled, execution outcome=skipped_cancelled, audit event reminder.superseded_at_dispatch) instead of being sent — closing the race where a rep change or completion happens between claim and dispatch, up to leaseMs=60s later',
      'lib/deadline-engine/reminder-worker.ts — the reminder deep link is now built from the deadline\'s actual grievance_id (resolved via the same revalidation query), not the deadline row\'s own id; the prior default builder used source_deadline_id as if it were the grievance id',
      'migrations/0048_union_eyes_deadline_continuity_audit_events.sql — extends the deadline_audit_events.event_type CHECK constraint with reminder.recipients_refreshed and reminder.superseded_at_dispatch',
      'apps/union-eyes/db/migrations-cache/0019_deadline_reassignment_convergence.sql — canonical create-or-close for deadline_reassignment_convergence: drops the 0049 PUBLIC fallback, installs 0010 direct-org policies with FORCE RLS, grants SELECT/INSERT to union_eyes_runtime and SELECT/UPDATE to union_eyes_system, and rejects a later replay of the 0049 policy. Source-tested on PGlite. Not applied to staging by this change, and not a runtime isolation pass',
      'lib/deadline-engine/__tests__/assignment-sync.test.ts, reminder-worker.test.ts, grievance-continuity.integration.test.ts, app/api/__tests__/grievances-assign.route.test.ts — full test coverage for the reassignment-refresh path, the durable convergence task lifecycle (request/process/sweep, idempotent retry, never-strands-the-handoff), the dispatch-time suppression matrix (deadline completed / stale officer / missing source) and the deep-link fix',
    ],
    targetWave: 1,
    notes:
      'LIMITED, not REAL: the fix closes the recipient-continuity gap at the module level with unit + mock-level integration test coverage, matching the same evidentiary standard as the sibling UE-DEADLINE-* entries above. It has NOT been proven against a live staging database (no equivalent of the 2026-07-21 D1-D3 staging runs exists yet for the reassignment scenario, nor for the convergence-task retry path under real concurrent load) — true concurrent-worker races, real RLS tenant isolation at the SQL layer, and an actual successor inbox receiving the email are unproven. Claim deadlines (claim_deadlines table) are explicitly OUT OF SCOPE for this fix — see UE-CLAIM-DEADLINES-SURFACE below.',
  },
  {
    id: 'UE-CLAIM-DEADLINES-SURFACE',
    title: 'Claim deadlines (claim_deadlines table) — listed on Priorities, with no recipients, reminders, completion or extension',
    state: 'NOT_IMPLEMENTED',
    ownedBy: [
      'apps/union-eyes/db/schema/deadlines-schema.ts',
      'apps/union-eyes/db/schema/domains/claims/deadlines.ts',
    ],
    evidence: [
      'db/schema/domains/claims/deadlines.ts — defines a fully-formed claim_deadlines table (deadlineRules, deadlineExtensions sidecar tables, its own organizationId FK) distinct from grievance_deadlines',
      'lib/deadline-engine/recipient-resolver.ts — resolveGrievanceDeadlineRecipients() explicitly throws "not yet supported (Phase A grievance-only)" when sourceTable === "claim_deadlines"',
      'app/api/deadlines/route.ts, overdue/route.ts and upcoming/route.ts are the generic CRUD collection and list routes of claim_deadlines (steward write floor, no case relationship) and dashboard/route.ts summarises them; app/api/deadlines/[id]/complete and /extend were the generic item handler under those names (a DELETE deleted the deadline) and now answer 501 (app/api/__tests__/retired-routes.route.test.ts)',
      'components/priorities/priorities-console.tsx, served by app/[locale]/dashboard/priorities and listed as "Priorities" in components/workspace/workspace-config.ts, lists the overdue and upcoming claim deadlines; nothing in the application creates, completes, extends or sends a reminder for a claim deadline',
    ],
    targetWave: 99,
    notes:
      'Classification: the table is reachable through the Priorities console and the deadline dashboard (read) and through the generic create route, so it is a SEPARATE_SUPPORTED_SURFACE_REQUIRES_REMEDIATION and is no longer latent or unexposed. It has no recipient resolution, no reminder scheduling, no continuity-on-reassignment and no completion or extension, so it stays NOT_IMPLEMENTED for those; the two item routes that suggested otherwise are retired. It is kept OUT of the grievance-continuity fix in this PR, and it must be given that operational treatment, or its listing removed from Priorities, before overall SaaS readiness can pass.',
  },
  {
    id: 'UE-CLAIM-ANONYMOUS-FILING',
    title: 'Claims — opt-in anonymous filing, member identity withheld from readers who are not representing the member',
    state: 'LIMITED',
    ownedBy: [
      'apps/union-eyes/lib/cases/claim-identity.ts',
      'apps/union-eyes/components/claims/new-claim-form.tsx',
      'apps/union-eyes/backend/grievances/migrations/0010_claims_is_anonymous_default_false.py',
    ],
    evidence: [
      'components/claims/new-claim-form.tsx — an unticked-by-default "File anonymously" checkbox; the intake POST carries isAnonymous=false unless the member ticks it (components/claims/new-claim-form.test.tsx)',
      'lib/cases/claim-identity.ts — claimIdentitySelect() gates memberId, memberName, memberEmail and memberPhone in SQL: shown when is_anonymous IS FALSE, to the filer, or to a principal with a live, non-recused creator/owner/assignee/represented_member relationship to the case; NULL for everyone else (collaborators, mandates, delegations, emergency grants, other organizations). Unknown flag values count as anonymous',
      'Applied to every claim read that returns the member: lib/cases/claim-detail-query.ts (GET /api/claims/{id}), app/api/cases/route.ts (GET list), app/api/cases/[caseId]/route.ts, app/api/workbench/assigned/route.ts; lib/services/case-timeline-service.ts no longer puts the name of an anonymous filer into staff dashboard signals; lib/data-export-import.ts already omitted memberId for anonymous rows',
      'lib/cases/claim-identity.pglite.test.ts — real SQL on PGlite: filer, assignee, creator and owner see the member; collaborator, recused, revoked, expired, other-organization and unrelated readers get NULL identity with isAnonymous=true',
      'Defaults are opt-in everywhere: Django model + grievances 0010 (physical DEFAULT false, guarded, reversible), Drizzle schema, lib/validation.ts, @nzila/cupe-vocabulary intake schema, POST /api/claims and POST /api/cases',
    ],
    targetWave: 1,
    notes:
      'LIMITED, not REAL: source- and PGlite-proven only; 0010 has not been applied to staging, and no deployed browser session has filed an anonymous claim. Existing rows are not rewritten: rows stored with is_anonymous=true while no screen offered the choice (the old physical default) are now treated as anonymous, which hides identity from collaborators and oversight readers but never exposes it. Resetting those historical rows is an owner decision with its own change record. Not covered: identity inside free-text fields (description, witness details, attachments) is not redacted, and the member is told only that the representatives directly handling the case see their name.',
  },

  // ------------------------------------------------------------------------
  // Phase 3A capability registry reality audit (2026-08-31) — findings
  // discovered while classifying the 5 NOT_IMPLEMENTED cron entries above.
  // Not implemented/repaired here — flagged with evidence for a dedicated,
  // reviewed follow-up given the financial/notification blast radius.
  //
  // PRODUCT-BOUNDARY CORRECTION (2026-08-31, post-audit): Union Eyes does
  // not need to become a replacement dues-management system. Native
  // multi-tenant dues calculation and automated dues reminders (the two
  // entries immediately below) are OPTIONAL, NON-BLOCKING capabilities —
  // see `readinessImpact`/`disposition` on each. The member-facing dues
  // portal remains REQUIRED to be truthful regardless: it must never
  // display fabricated balances/dates, and must honestly distinguish "no
  // dues data on file" from "$0 owed" when a specialist external
  // dues/membership system is authoritative instead of Union Eyes' native
  // ledger. That truth-contract work is tracked separately (PR #721,
  // UE-DUES-PORTAL-* capability entries) and does not depend on either
  // capability below becoming REAL.
  // ------------------------------------------------------------------------
  {
    id: 'UE-FIN-DUES-CALCULATION-WORKFLOW',
    title: 'Monthly dues calculation (financial-service microservice)',
    state: 'LIMITED',
    ownedBy: ['services/financial-service/src/jobs/dues-calculation-workflow.ts'],
    evidence: [
      'services/financial-service/src/jobs/dues-calculation-workflow.ts:243-246 — monthlyDuesCalculationJob is a real node-cron schedule (0 2 1 * *, America/Toronto), genuinely registered and started.',
      'services/financial-service/src/index.ts — imports and calls startDuesCalculationWorkflow() at service startup.',
      'services/financial-service/src/jobs/dues-calculation-workflow.ts:249 — `const tenantId = \'11111111-1111-1111-1111-111111111111\'; // Test tenant` is HARDCODED inside the scheduled job callback; the code comment above it says "In production, iterate through all tenants" but does not do so.',
      'services/financial-service/src/jobs/dues-calculation-workflow.ts:135-137 — explicit code comment: COPE/PAC/surcharge add-ons are not implemented, only the flat base dues rate is applied.',
      'services/financial-service/src/tests/unit/dues-calculation-workflow.test.ts — unit-tests processMonthlyDuesCalculation() and job cancellation integration for a single supplied tenantId; does not test the scheduled job\'s multi-tenant behavior because there is none to test.',
    ],
    targetWave: 7,
    readinessImpact: 'non_blocking',
    disposition: 'OPTIONAL_NATIVE_CAPABILITY',
    notes:
      'LIMITED, not REAL: the job is genuinely scheduled and does create real dues_transactions rows for the ' +
      'one hardcoded test tenant, but every real customer organization silently receives ZERO monthly dues ' +
      'transactions from this scheduled run — the "iterate through all tenants" step described in the code\'s ' +
      'own comment was never implemented. This is materially different from UE-CRON-MONTHLY-DUES (the main-app ' +
      'stub, which is honestly 501) because this one runs, appears successful in logs, and produces no ' +
      'observable failure for real tenants — it just never processes them. ' +
      'PRODUCT-BOUNDARY DECISION (2026-08-31): native multi-tenant dues calculation is an OPTIONAL, ' +
      'NON-BLOCKING capability, not a requirement for Union Eyes to be SaaS-operational. Union Eyes does not ' +
      'need to become a replacement dues-management system — a specialist external dues/membership system may ' +
      'already be authoritative for a given tenant. This finding therefore must NOT be represented as an ' +
      '"implement to make SaaS operational" blocker. The recommended follow-up is: only productize this ' +
      '(fix the hardcoded tenant, add COPE/PAC/surcharge support) if/when native dues administration becomes ' +
      'an intentional Union Eyes module — it is not required for GA. It remains LIMITED (not REAL) so its ' +
      'current implementation is never mistaken for operational.',
  },
  {
    id: 'UE-FIN-DUES-REMINDER-SCHEDULER',
    title: 'Dues payment reminders (7-day / 1-day / overdue)',
    state: 'LIMITED',
    ownedBy: ['lib/jobs/dues-reminder-scheduler.ts'],
    evidence: [
      'lib/jobs/dues-reminder-scheduler.ts — DuesReminderScheduler.runReminderJob() queries duesTransactions for 7-day, 1-day, and overdue reminder windows and sends real notifications via lib/services/notification-service.ts.',
      'Repo-wide search found zero call sites for DuesReminderScheduler.runReminderJob or DuesReminderScheduler anywhere outside its own file — no cron route, queue consumer, or scheduled task invokes it.',
      'app/api/cron/overdue-notifications/route.ts — the main-app cron that would be the natural trigger for this class is registered NOT_IMPLEMENTED (see UE-CRON-OVERDUE-NOTIFICATIONS) and does not delegate to it.',
    ],
    targetWave: 3,
    readinessImpact: 'non_blocking',
    disposition: 'OPTIONAL_NATIVE_CAPABILITY',
    notes:
      'LIMITED: the reminder logic and notification dispatch are real, tested-in-isolation code, but nothing ' +
      'ever schedules or triggers a run, so no member has ever received a 7-day, 1-day, or overdue dues ' +
      'reminder in a deployed environment. ' +
      'PRODUCT-BOUNDARY DECISION (2026-08-31): automated native dues reminders are an OPTIONAL, NON-BLOCKING ' +
      'capability — not required for Union Eyes to be SaaS-operational, for the same reason as ' +
      'UE-FIN-DUES-CALCULATION-WORKFLOW above (a specialist external dues/membership system may already send ' +
      'these reminders). The recommended follow-up is: only productize this (wire ' +
      'app/api/cron/overdue-notifications/route.ts to call DuesReminderScheduler.runReminderJob() behind the ' +
      'existing cron-secret auth) if/when native dues administration becomes an intentional Union Eyes module ' +
      '— it is not required for GA. It remains LIMITED (not REAL) so its current implementation is never ' +
      'mistaken for operational.',
  },
  {
    id: 'UE-ANALYTICS-SCHEDULED-REPORTS-UI',
    title: 'Scheduled reports admin UI',
    state: 'NOT_IMPLEMENTED',
    ownedBy: [
      'app/[locale]/dashboard/admin/scheduled-reports/page.tsx',
    ],
    evidence: [
      'app/[locale]/dashboard/admin/scheduled-reports/page.tsx — shows an explicit not-available notice (CapabilityUnavailable) and makes no request; the scheduled-report form was deleted.',
      'scheduled_reports has no storage authority (NONE) and no delivery job exists (UE-CRON-SCHEDULED-REPORTS above remains NOT_IMPLEMENTED).',
      'The orphaned components/analytics/scheduled-reports-manager.tsx (it fetched GET /api/v2/analytics/scheduled-reports, which the /api/v2 deprecation catch-all intercepts) was deleted with its hard-coded sample data.',
      'app/[locale]/dashboard/__tests__/unavailable-capability-pages.test.tsx',
    ],
    targetWave: 8,
    readinessImpact: 'non_blocking',
    disposition: 'LATENT_INTERNAL_CAPABILITY',
    notes:
      'The admin page does not pretend a schedule can be saved: no record store and no delivery exist. A scheduled-reports screen must not come back ' +
      'without a record store, a delivery job and an endpoint that is not under the retired /api/v2 tree.',
  },

  // ------------------------------------------------------------------------
  // Governance Officer 2.1 (UE-GOVERNANCE-OFFICER-CANONICAL-2.1) — containment
  // ------------------------------------------------------------------------
  {
    id: 'UE-PRIVACY-INCIDENT-WORKFLOW',
    title: 'Privacy incident (breach) management',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/privacy/breach/route.ts'],
    evidence: [
      'app/api/privacy/breach/route.ts — throws ApiError.notImplemented → HTTP 501 (previously generic CRUD over dataClassificationPolicy)',
      'app/api/privacy/__tests__/data-classification-policy-writerole.test.ts — asserts the route no longer imports the CRUD factory or the policy table',
    ],
    targetWave: 9,
    notes:
      'Platform classification doctrine now lives at app/api/compliance/data-classification-policy/route.ts. A real incident ' +
      'workflow needs dedicated storage, jurisdiction determination, human legal review and a separate dispatch step.',
  },
  {
    id: 'UE-PRIVACY-DSAR-WORKFLOW',
    title: 'Information-rights (DSAR) request handling',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/privacy/dsar/route.ts'],
    evidence: ['app/api/privacy/dsar/route.ts — throws ApiError.notImplemented → HTTP 501'],
    targetWave: 9,
  },
  {
    id: 'UE-PRIVACY-PROVINCIAL-CASES',
    title: 'Provincial / jurisdictional privacy cases',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/privacy/provincial/route.ts'],
    evidence: ['app/api/privacy/provincial/route.ts — throws ApiError.notImplemented → HTTP 501'],
    targetWave: 9,
  },
  {
    id: 'UE-PRIVACY-BREACH-ASSESSMENT',
    title: 'Breach notification determination (PIPEDA / provincial)',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/emergency/pipeda/route.ts'],
    evidence: [
      'app/api/emergency/pipeda/route.ts — returns LEGAL_REVIEW_REQUIRED / legalDetermination NOT_MADE; no threshold, deadline or channel is computed',
      'app/api/__tests__/emergency-pipeda-legal-review.route.test.ts',
    ],
    targetWave: 9,
    notes:
      'The route only acknowledges reported facts. It makes no legal determination, persists nothing and dispatches no notification.',
  },
  {
    id: 'UE-EMERGENCY-DECLARATION',
    title: 'Emergency declaration, break-glass activation, recovery and preparedness reporting',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/emergency/activate/route.ts', 'app/api/emergency/recovery/route.ts', 'app/api/emergency/dashboard/route.ts'],
    evidence: [
      'app/api/emergency/{activate,recovery,dashboard}/route.ts — return HTTP 501 through lib/emergency/not-implemented.ts',
      'app/api/__tests__/emergency-not-implemented.route.test.ts',
    ],
    targetWave: 9,
    notes:
      'The routes previously returned 200 with an invented declaration, an "activated" break-glass state, audit and notification ' +
      'claims and fabricated preparedness and compliance figures, with nothing persisted. Emergency access in the authority kernel ' +
      'requires explicit, time-bound, justified and audited grants; no emergency route may exist before that lifecycle does.',
  },
  {
    id: 'UE-GOV-INDEPENDENT-REVIEW',
    title: 'Independent governance review workflow (intake → finding → verified remediation)',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['lib/governance-officer/review-engine.ts'],
    evidence: [
      'lib/governance-officer/__tests__/review-engine.test.ts — pure domain core only (TEST_PROVEN); no persistence, HTTP surface or UI',
    ],
    targetWave: 9,
    notes:
      'Domain decision core exists; the capability is not operational until persisted state, server routes, audit trail and ' +
      'native acceptance exist (UE-GOVERNANCE-OFFICER-CANONICAL-2.1 §XV).',
  },
  {
    id: 'UE-GOV-ELECTION-VOTING-RESULTS',
    title: 'Council election vote casting, tabulation and published results',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/elections/[id]/vote/route.ts', 'components/elections/election-record-detail.tsx'],
    evidence: [
      'app/api/elections/[id]/vote/route.ts — throws ApiError.notImplemented → HTTP 501',
      'No results route exists for council elections: council_elections is system-only and holds recorded outcomes, not ballots.',
      'components/elections/__tests__/election-screens.test.tsx — the detail screen offers no ballot, no "already voted" state and no results tab, and says so with CapabilityUnavailable.',
    ],
    targetWave: 9,
    notes:
      'A qualified election engine has to exist first: electorate, one-member-one-vote, ballot secrecy and independent tabulation ' +
      '(UE-GOVERNANCE-OFFICER-CANONICAL-2.1 G11/G12). The detail screen shows the winners, votes and participation a staff member recorded, labelled as entered by staff.',
  },
  {
    id: 'UE-GOV-COUNCIL-ELECTION-RECORDS',
    title: 'Council election records (list, view, create)',
    state: 'LIMITED',
    ownedBy: ['app/api/elections/route.ts', 'app/api/elections/[id]/route.ts', 'components/elections/election-records-list.tsx', 'components/elections/election-record-form.tsx'],
    evidence: [
      'app/api/__tests__/elections-client-contract.route.test.ts — runs the real routes inside the real withApi and feeds their output to the client the screens use.',
      'app/api/__tests__/elections-certification.route.test.ts',
    ],
    targetWave: 9,
    notes:
      'A global platform record readable by platform staff only; not runtime-proven against PostgreSQL. A signed-in member who is not platform staff sees an explicit 403 state, not an empty list.',
  },

  // ------------------------------------------------------------------------
  // Organization, members and health & safety screens whose backing capability does not exist (UE-CONV-H-018).
  // The screens say so (CapabilityUnavailable) or no longer offer the action; none of them calls a route that cannot serve it.
  // ------------------------------------------------------------------------
  {
    id: 'UE-ORG-SHARING-SETTINGS',
    title: 'Organization data-sharing settings and access log',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/organizations/[id]/sharing-settings/route.ts', 'app/api/organizations/[id]/access-logs/route.ts', 'app/[locale]/dashboard/settings/sharing/page.tsx'],
    evidence: [
      'app/api/organizations/[id]/sharing-settings/route.ts and access-logs/route.ts answer HTTP 501 by design; lib/__tests__/organization-facade-fail-closed.test.ts forbids a write method.',
      'app/[locale]/dashboard/__tests__/members-new-and-sharing-pages.test.tsx — the page shows an explicit not-available notice, makes no request, and the sharing form and access-log viewer no longer exist.',
    ],
    targetWave: 8,
    notes: 'The settings page used to sit on "Loading…" forever (it read an id from a route that has none) and then offered a form that could not save.',
  },
  {
    id: 'UE-MEMBERS-DIRECT-CREATE',
    title: 'Create a member record directly from the dashboard',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/[locale]/dashboard/members/new/page.tsx', 'app/api/organization/members/route.ts'],
    evidence: [
      'app/api/organization/members/route.ts serves GET only; organizations/{id}/members needs an identity-provider user_id and only creates a pending membership, so no route fits the form that was there.',
      'app/[locale]/dashboard/__tests__/members-new-and-sharing-pages.test.tsx — the page shows a not-available notice, and the "Add member" buttons are gone from the members console.',
    ],
    targetWave: 5,
    notes: 'A member joins through an invitation that binds an identity; a directory form that writes a row with no identity would create a member nobody can sign in as.',
  },
  {
    id: 'UE-HS-CORRECTIVE-ACTIONS',
    title: 'Health & safety corrective-action tracking',
    state: 'NOT_IMPLEMENTED',
    ownedBy: [],
    evidence: [
      'corrective_actions has no table declaration and its storage-authority entry is LATENT_UNREACHABLE; the tracker component and its tab were removed from app/[locale]/dashboard/health-safety/hazards/page.tsx rather than left to read a relation that does not exist.',
      'app/[locale]/dashboard/health-safety/__tests__ — the hazards page offers no corrective-action tab.',
    ],
    targetWave: 8,
  },
  {
    id: 'UE-HS-REPORT-EXPORT',
    title: 'Health & safety dashboard and inspection report PDF export',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['components/health-safety/HealthSafetyDashboard.tsx', 'components/health-safety/InspectionReportViewer.tsx'],
    evidence: [
      'No export route exists; the Export PDF buttons (and four "Exporting…" buttons that did nothing) were removed.',
      'components/health-safety/__tests__/health-safety-dashboard.test.tsx and inspection-report-viewer.test.tsx — the screens show what the stored rows record and offer no export.',
    ],
    targetWave: 8,
  },
  {
    id: 'UE-ORG-MEMBERS-BULK-TRANSFER',
    title: 'Bulk transfer of members between organizations',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['components/organization/organization-members.tsx'],
    evidence: [
      'No transfer route exists; the transfer button, dialog and row selection were removed.',
      'components/organization/__tests__/organization-members.test.tsx — the roster reads every page, shows an error with Retry instead of an empty list, and exports CSV of the rows it loaded.',
    ],
    targetWave: 8,
    notes: 'Moving a member between organizations changes who may see their records and their dues obligations; it needs an authority decision and an audited server operation first.',
  },
  {
    id: 'UE-FIN-DUES-ADMIN-PAYMENTS',
    title: 'Dues payments administration (list and detail)',
    state: 'NOT_IMPLEMENTED',
    ownedBy: [
      'app/api/admin/dues/payments/route.ts',
      'app/api/admin/dues/payments/[id]/route.ts',
      'app/[locale]/dashboard/admin/dues/payments/page.tsx',
      'app/[locale]/dashboard/admin/dues/payments/[id]/page.tsx',
    ],
    evidence: [
      'app/api/admin/dues/payments/route.ts answers HTTP 501; it used to return the member roster labelled as payments.',
      'app/[locale]/dashboard/__tests__/unavailable-capability-pages.test.tsx — both pages show an explicit not-available notice and make no request.',
    ],
    targetWave: 8,
    notes: 'The payment ledger a member sees (GET /api/dues/payment-history) is a different, per-member read; an administrator-level payments register needs its own authority and model.',
  },
  {
    id: 'UE-ACTION-ORG-BULK-IMPORT',
    title: 'Bulk import of organizations',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/admin/organizations/bulk-import/route.ts'],
    evidence: [
      'app/api/admin/organizations/bulk-import/route.ts answers HTTP 501.',
      'components/admin/bulk-import-organizations.tsx and its entry in the organizations admin page were removed rather than left offering an import that cannot run.',
    ],
    targetWave: 8,
  },
  {
    id: 'UE-ORGANIZER-IMPACT',
    title: 'Organizer impact measurement',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/organizer/impact/route.ts', 'app/[locale]/dashboard/organizer/impact/page.tsx'],
    evidence: [
      'app/api/organizer/impact/route.ts answers HTTP 501: no impact is measured anywhere.',
      'app/[locale]/dashboard/__tests__/unavailable-capability-pages.test.tsx — the page shows an explicit not-available notice and makes no request.',
    ],
    targetWave: 8,
  },
  {
    id: 'UE-ORGANIZING-FIELD-NOTES',
    title: 'Organizing field notes',
    state: 'NOT_IMPLEMENTED',
    ownedBy: [
      'app/api/organizing/notes/route.ts',
      'app/api/organizing/notes/[id]/route.ts',
      'app/[locale]/dashboard/organizing/notes/page.tsx',
      'app/[locale]/dashboard/organizing/notes/new/page.tsx',
    ],
    evidence: [
      'app/api/organizing/notes/** answer HTTP 501: field_notes has no storage authority (NONE) and no note store is open to the application.',
      'app/[locale]/dashboard/__tests__/unavailable-capability-pages.test.tsx — the pages show an explicit not-available notice and make no request.',
    ],
    targetWave: 8,
    notes: 'Field notes about named workers are sensitive records; a store needs classification, retention and access rules before any screen may write one.',
  },
  {
    id: 'UE-MOVEMENT-INSIGHTS-CONSENT-REVOCATION',
    title: 'Revocation of data-aggregation consent',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['lib/movement-insights/consent-manager.ts'],
    evidence: [
      'data_aggregation_consent is SELECT-only for the runtime role, and /api/consent writes consent_records, a different table the feature does not read: a revoke control could only appear to work.',
      'app/[locale]/dashboard/settings/data-sharing/__tests__/data-sharing-page.test.tsx — the page is a read-only status page and shows CapabilityUnavailable for revocation.',
    ],
    targetWave: 8,
  },
  {
    id: 'UE-MOVEMENT-INSIGHTS-CONSENT-GRANT',
    title: 'Granting data-aggregation consent',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['lib/movement-insights/consent-manager.ts'],
    evidence: [
      'No route writes data_aggregation_consent and the runtime role may only SELECT it, so a consent form would record a consent the feature never reads.',
      'app/[locale]/dashboard/settings/data-sharing/__tests__/data-sharing-page.test.tsx — the page reads the stored consent in a tenant context and shows CapabilityUnavailable for granting.',
    ],
    targetWave: 8,
  },
  {
    id: 'UE-MOVEMENT-INSIGHTS-LEGISLATIVE-BRIEF',
    title: 'Legislative brief export (movement insights)',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/[locale]/dashboard/movement-insights/export/page.tsx'],
    evidence: [
      'app/[locale]/dashboard/movement-insights/export/page.tsx — renders CapabilityUnavailable for this id and makes no request.',
      'The page used to brief on the last thirty days of movement_trends, which nothing in the application populates, so it showed NaN and -Infinity figures and an "Export PDF" button that did nothing; no PDF is produced anywhere.',
    ],
    targetWave: 8,
    notes: 'A cross-union export of aggregated data needs the privacy thresholds of the aggregation service applied to rows that carry their contributing organizations.',
  },
  {
    id: 'UE-MEMBER-CASE-TIMELINE',
    title: 'Member case timeline (/dashboard/member/timeline/[caseId])',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/[locale]/dashboard/member/timeline/[caseId]/page.tsx'],
    evidence: [
      'app/[locale]/dashboard/member/timeline/[caseId]/page.tsx — renders CapabilityUnavailable for this id and makes no request.',
      'The page used to read `data.timeline`, a case-journey object /api/cases/{caseId}/timeline never sends (it answers { data: [updates] } and names the person who wrote each update), so every visit ended in notFound().',
    ],
    targetWave: 8,
    notes: 'It returns when a member-safe source of the case\'s stages exists. Nothing links to the page.',
  },
  {
    id: 'UE-BARGAINING-NEGOTIATION-DETAIL',
    title: 'Negotiation detail view (/dashboard/bargaining/negotiations/[id])',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/[locale]/dashboard/bargaining/negotiations/[id]/page.tsx'],
    evidence: [
      'app/[locale]/dashboard/bargaining/negotiations/[id]/page.tsx — renders CapabilityUnavailable for this id and makes no request.',
      'The page used to fetch /api/bargaining/negotiations/{id} without forwarding the credentials (the route refused it, so every visit ended in notFound()) and to read a combined answer (negotiation, proposals, tentativeAgreements, sessions, teamMembers, statistics) that no route sends.',
    ],
    targetWave: 8,
    notes: 'The negotiation, its proposals (/api/bargaining/proposals) and its tentative agreements (/api/bargaining/tentative-agreements) are separate routes; a view is built from them, with the person\'s own request, not from an aggregate that does not exist.',
  },
  {
    id: 'UE-PILOT-TRAINING-GUIDES',
    title: 'Pilot training guides (/docs/guides/*)',
    state: 'NOT_IMPLEMENTED',
    ownedBy: [],
    evidence: [
      'app/[locale]/dashboard/admin/onboarding — the pilot onboarding console no longer shows a training-links panel.',
      'The panel linked to four guides under /docs/guides/ that the application does not serve (the folder is not part of the site); every link led to a 404.',
    ],
    targetWave: 8,
    notes: 'Training guides are a content deliverable. When they are written and published at an address the application serves, a panel of links can return; until then there is nothing to link to.',
  },
  {
    id: 'UE-COMPLIANCE-CHARTER-STATUS',
    title: 'Charter compliance status and reporting deadlines (/dashboard/compliance)',
    state: 'NOT_IMPLEMENTED',
    ownedBy: [],
    evidence: [
      'app/[locale]/dashboard/compliance/page.tsx — the alerts and reports sections read /api/compliance/alerts and /api/compliance/reports (and say so when a read fails); the charter section renders CapabilityUnavailable for this id.',
      'The page used to show fixed green and amber checks for elections, financial reporting and member rights and fixed due dates ("March 31", "within 30 days"); nothing measured either, and the dates depend on the organization\'s jurisdiction and constitution.',
    ],
    targetWave: 8,
    notes: 'A charter status needs the organization\'s governing instrument and its dated obligations as data; the page is partly live, so it is not listed as the owner.',
  },
  {
    id: 'UE-COMPLIANCE-POSTURE-REPORTING',
    title: 'Compliance score, regulatory status, risk assessment and downloadable compliance reports (/dashboard/compliance-admin)',
    state: 'NOT_IMPLEMENTED',
    ownedBy: [],
    evidence: [
      'app/[locale]/dashboard/compliance-admin/page.tsx — the audit trail reads /api/compliance/audit-logs through components/compliance/compliance-audit-trail.tsx (and says so when the read fails); the posture section renders CapabilityUnavailable for this id.',
      'The page used to show a computed "compliance score", fixed "Compliant" and "Passed" results with "2 hours ago" times, fixed risk bars and three download buttons with no action; its own read of the audit trail never sent the person\'s credentials and looked for a field the route does not return, so it always showed an empty trail.',
    ],
    targetWave: 8,
    notes: 'A compliance score or risk rating needs a defined, measured control set per organization and jurisdiction; reports need a generator and a stored result. None exists, and the page is partly live, so it is not listed as the owner.',
  },
  {
    id: 'UE-DOCUMENT-APPROVAL-WORKFLOW',
    title: 'Document approval workflow (reviewers, stages, approve and reject decisions)',
    state: 'NOT_IMPLEMENTED',
    ownedBy: [],
    evidence: [
      'components/documents/documents-console.tsx — the console has no Approvals tab; components/documents/document-approval-workflow.tsx is deleted (see retiredPaths in lib/documents/UE_CURSOR_DOCUMENT_CONSUMER_MATRIX.json).',
      'The tab used to keep the workflow configuration and each reviewer decision in React state only: nothing was sent to a route, no table holds document approvals, and the decision was gone on reload. Its reviewers were the uploaders\' ids shown as names.',
    ],
    targetWave: 8,
    notes: 'A document approval needs stored stages and reviewers, a decision record with who decided and when, and the document\'s authority rules (who may review which privacy label). None exists; the console is a repository, a library, a search, templates, retention and bulk download.',
  },
  {
    id: 'UE-DOCUMENT-TEMPLATE-AUTHORING',
    title: 'Document template authoring (create, edit, delete, usage counts)',
    state: 'NOT_IMPLEMENTED',
    ownedBy: [],
    evidence: [
      'components/documents/document-template-manager.tsx — offers New, Edit and Delete only when the caller supplies the handler; the documents console supplies none, so it lists the repository documents filed as templates and offers Use and Preview.',
      'The manager used to show New Template, Edit and Delete whatever the caller supplied (the dialogs closed as if the template were saved or deleted) and a usage count of 0 that the console wrote as a constant.',
    ],
    targetWave: 8,
    notes: 'A template library needs a template store (body, variables, owner, versions) and a count of uses; documents filed as templates are ordinary documents, so they cannot be edited or deleted as templates.',
  },
  {
    id: 'UE-ADMIN-SYSTEM-SETTINGS',
    title: 'Admin system settings',
    state: 'NOT_IMPLEMENTED',
    ownedBy: [],
    evidence: ['app/[locale]/dashboard/admin/__tests__/admin-page.test.tsx — the admin page shows CapabilityUnavailable for the system-settings section; no settings route or store exists.'],
    targetWave: 8,
  },
  {
    id: 'UE-ADMIN-SECURITY-OVERVIEW',
    title: 'Admin security overview',
    state: 'NOT_IMPLEMENTED',
    ownedBy: [],
    evidence: ['app/[locale]/dashboard/admin/__tests__/admin-page.test.tsx — the admin page shows CapabilityUnavailable for the security section; the security dashboard has its own page and owner.'],
    targetWave: 8,
  },
  {
    id: 'UE-ADMIN-REPORTS-HUB',
    title: 'Admin reports hub',
    state: 'NOT_IMPLEMENTED',
    ownedBy: [],
    evidence: ['app/[locale]/dashboard/admin/__tests__/admin-page.test.tsx — the admin page shows CapabilityUnavailable for the reports section; no admin report store exists.'],
    targetWave: 8,
  },
  {
    id: 'UE-ADMIN-SYSTEM-CACHE-CLEAR',
    title: 'Admin "clear application cache" action — REMOVED',
    state: 'REMOVED',
    ownedBy: [],
    evidence: [
      'The admin system page offered a cache-clear action and an "Application Cache" card that showed the database size; both were removed. No cache-clear route exists.',
    ],
    targetWave: 8,
  },
  {
    id: 'UE-CLC-ANALYTICS-EXPORT',
    title: 'CLC analytics dashboard PDF export — REMOVED',
    state: 'REMOVED',
    ownedBy: [],
    evidence: ['components/admin/clc-analytics-dashboard.tsx — the Export PDF button and its handler were removed; no export route exists.'],
    targetWave: 8,
  },

  // ------------------------------------------------------------------------
  // Financial Officer 2.1 containment (UE-FINANCIAL-OFFICER-2.1-CONVERGENCE).
  // Source-level evidence only: state is NOT_IMPLEMENTED, never operational.
  // ------------------------------------------------------------------------
  {
    id: 'UE-FIN-UNION-BUDGETS-EXPENSES-VENDORS',
    title: 'Union budgets, expenses and vendors',
    state: 'NOT_IMPLEMENTED',
    ownedBy: [
      'app/api/financial/budgets/route.ts',
      'app/api/financial/expenses/route.ts',
      'app/api/financial/vendors/route.ts',
      'lib/finance/retired-financial-route.ts',
    ],
    evidence: [
      'app/api/financial/{budgets,expenses,vendors}/** — all methods answer HTTP 501 via lib/finance/retired-financial-route.ts; previously a 200 deprecation payload.',
      'The budgets, expenses and vendors tables were never created (see lib/api/deprecation.ts registry).',
      'app/api/__tests__/financial-officer-containment.test.ts — asserts 501 and absence of any pointer to Nzila billing reports.',
    ],
    targetWave: 8,
    notes:
      'Nzila billing reports are not a union budget or expense record. A qualified union-finance record store, ' +
      'policy and migration are required before any replacement; do not create a generic schema to satisfy the UI.',
  },
  {
    id: 'UE-FIN-STRIKE-FUNDS',
    title: 'Strike funds, stipends, disbursements, eligibility, picket lines',
    state: 'NOT_IMPLEMENTED',
    ownedBy: [
      'app/api/strike/funds/route.ts',
      'app/api/strike/disbursements/route.ts',
      'app/api/strike/stipends/route.ts',
      'app/api/strike/eligibility/route.ts',
      'app/api/strike/picket-lines/route.ts',
    ],
    evidence: [
      'These routes were bound to votingSessions via crudRoutes, serving voting records as fund data; they now answer HTTP 501 and import no database table.',
      'app/api/__tests__/financial-officer-containment.test.ts — asserts no votingSessions/crudRoutes import and a 501 result.',
    ],
    targetWave: 8,
    notes:
      'Only strike_fund_payment_audit exists in the schema; there is no qualified strike-fund balance, stipend or ' +
      'eligibility model. The strike-fund dashboard pages render an explicit not-available state.',
  },
  {
    id: 'UE-FIN-AFFILIATE-REMITTANCES',
    title: 'CLC / National / federation affiliate remittances',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/admin/clc/remittances/route.ts'],
    evidence: [
      'app/api/admin/clc/remittances/** — previously bound to organizationMembers (membership rows served/mutated as remittances; export/submit stubs answered "accepted"); all now answer HTTP 501.',
      'app/api/__tests__/financial-officer-containment.test.ts — asserts no organizationMembers/crudRoutes import and no "accepted" stub.',
      'app/[locale]/dashboard/federation/remittances/page.tsx — reflects four counts from the remittance records that reached the organization (lib/organizations/per-capita-standing.ts, read in its own context), says dues are handled in an external system, and offers no filter, ledger or export; with no records it says so, and a failed read is an error, not zeros.',
    ],
    targetWave: 8,
    notes:
      'Owner decision (closed): affiliate per-capita remittances are handled in an external system; Union Eyes reflects the records that reach it, read-only, and does not collect, calculate, submit, reconcile or export them. No remittance ledger is to be built here. ' +
      'Affiliate (per-capita) remittances are distinct from employer payroll-deduction remittances.',
  },
  {
    id: 'UE-FIN-PENSION-TRUSTEE-ADMIN',
    title: 'Pension trustee appointment and administration',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/pension/trustees/route.ts', 'app/api/pension/trustees/[id]/route.ts', 'components/pension/trustee-portal-page.tsx'],
    evidence: [
      'POST/PATCH/DELETE previously required only minRole steward; they now fail closed with HTTP 501 for every role.',
      'app/api/__tests__/financial-officer-containment.test.ts — asserts 501 for trustee create/update/delete.',
      'app/[locale]/dashboard/__tests__/unavailable-capability-pages.test.tsx — the trustee page shows an explicit not-available notice instead of a form that could only fail.',
    ],
    targetWave: 8,
    notes:
      'Trustee administration requires an independently verified trustee-administration authority and approval ' +
      'workflow. Secretary-Treasurer status does not imply it. GET (read) is unchanged.',
  },
  {
    id: 'UE-FIN-PENSION-REPORTS',
    title: 'Pension administration reports (T4A generation)',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['components/pension/pension-admin-console.tsx', 'app/api/pension/t4a/route.ts'],
    evidence: [
      'POST /api/pension/t4a answers HTTP 501: no T4A slip generator exists, so a "generate reports" control could only look as though it did something.',
      'components/pension/pension-consoles.test.tsx — the admin console shows CapabilityUnavailable for reports and offers no generate action.',
    ],
    targetWave: 8,
  },
  {
    id: 'UE-FIN-PENSION-BENEFIT-ESTIMATE',
    title: 'Pension benefit estimate for a member',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['components/pension/pension-member-console.tsx'],
    evidence: [
      'No accrual rules are stored, so an estimate would be an invented figure; the member console shows the stored contributions and eligibility and CapabilityUnavailable for the estimate.',
      'components/pension/pension-consoles.test.tsx — the member console shows CapabilityUnavailable for the benefit estimate.',
    ],
    targetWave: 8,
  },
  {
    id: 'UE-FIN-DUES-REPORTS',
    title: 'Dues reports (admin)',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/[locale]/dashboard/admin/dues/reports/page.tsx'],
    evidence: [
      'The dues report routes live under the retired /api/v2 tree and answer HTTP 410; the page showed fixed figures (94.2%, 67.7%, ...) that nothing measured.',
      'app/[locale]/dashboard/admin/dues/reports/page.tsx — shows CapabilityUnavailable and makes no request.',
    ],
    targetWave: 8,
  },
  {
    id: 'UE-FIN-DUES-BILLING-CYCLE-HISTORY',
    title: 'Billing cycle history (admin)',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/[locale]/dashboard/admin/dues/billing-cycles/page.tsx', 'app/api/admin/billing-cycles/route.ts'],
    evidence: [
      'GET /api/admin/billing-cycles answers HTTP 501: no billing-cycle history is stored, so the history list could only be empty or invented.',
      'app/[locale]/dashboard/admin/dues/billing-cycles/page.tsx — the page shows CapabilityUnavailable for the history; the preview and trigger controls that have routes stay.',
    ],
    targetWave: 8,
  },
  {
    id: 'UE-SURVEYS-RESPOND',
    title: 'Answering a survey',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/[locale]/surveys/[surveyId]/page.tsx'],
    evidence: [
      'There is no route that lists a survey\'s questions and none that records an answer, so a survey form could only appear to submit.',
      'app/[locale]/surveys/[surveyId]/page.tsx — shows CapabilityUnavailable and makes no request.',
    ],
    targetWave: 8,
  },
  {
    id: 'UE-ANALYTICS-OVERVIEW',
    title: 'Analytics overview console',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['components/analytics/analytics-overview-console.tsx'],
    evidence: [
      'The routes behind the overview are copy-paste lists or retired /api/v2 routes (HTTP 410); the console showed figures none of them produced.',
      'components/analytics/unavailable-consoles.test.tsx — the console shows CapabilityUnavailable and makes no request.',
    ],
    targetWave: 8,
  },
  {
    id: 'UE-ANALYTICS-COMPARATIVE',
    title: 'Comparative analytics',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['components/analytics/analytics-dashboard.tsx'],
    evidence: [
      'No route computes a comparison between organizations or periods; the dashboard\'s trends and insights are real (trend_analyses, insights) and stay.',
      'components/analytics/analytics-dashboard.test.tsx — the comparative section shows CapabilityUnavailable.',
    ],
    targetWave: 8,
  },
  {
    id: 'UE-CROSS-UNION-ANALYTICS',
    title: 'Cross-union analytics',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['components/cross-union-analytics/cross-union-analytics-console.tsx'],
    evidence: [
      'Cross-union benchmarking needs consent-based sharing between organizations that does not exist; the routes answer HTTP 410 or return lists no collector fills.',
      'components/analytics/unavailable-consoles.test.tsx — the console shows CapabilityUnavailable and makes no request.',
    ],
    targetWave: 8,
  },
  {
    id: 'UE-CLC-INTELLIGENCE',
    title: 'CLC labour intelligence',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['components/clc/clc-intelligence-console.tsx'],
    evidence: [
      'The labour-intelligence routes are retired (HTTP 410) or return lists nothing populates; the six panels showed invented figures.',
      'components/analytics/unavailable-consoles.test.tsx — the console shows CapabilityUnavailable and makes no request.',
    ],
    targetWave: 8,
  },
  {
    id: 'UE-SOCIAL-MEDIA-UI',
    title: 'Social media management screens',
    state: 'LIMITED',
    ownedBy: ['app/api/social-media/posts/route.ts', 'app/api/social-media/posts/review/route.ts', 'app/api/social-media/accounts/route.ts', 'app/api/social-media/campaigns/route.ts', 'app/api/social-media/analytics/route.ts'],
    evidence: [
      'The backend saves post drafts that need a second officer\'s approval, and the analytics route reads social_analytics rows that no collector writes; nothing publishes a post.',
      'The seven social-media screens (composer, scheduler, dashboard, analytics) were deleted: they implied publishing and metrics that do not exist.',
    ],
    targetWave: 8,
    notes: 'A screen may return only with a publisher job and an analytics collector; until then the routes are reachable by API for drafts and review only.',
  },
  {
    id: 'UE-ANALYTICS-ENGAGEMENT-DASHBOARDS',
    title: 'Engagement, benchmark and communication analytics dashboards — REMOVED',
    state: 'REMOVED',
    ownedBy: [],
    evidence: ['The engagement, benchmark and communication analytics components were deleted: they fetched retired /api/v2 routes (HTTP 410) and filled the screen with invented figures when those failed.'],
    targetWave: 8,
  },
  {
    id: 'UE-CLC-AGED-RECEIVABLES',
    title: 'CLC aged receivables report — REMOVED',
    state: 'REMOVED',
    ownedBy: [],
    evidence: ['The aged-receivables screen (components/financial/APAgingReport.tsx) was deleted: its route is retired (HTTP 410) and no receivables ledger exists to age.'],
    targetWave: 8,
  },
  {
    id: 'UE-FIN-EMPLOYER-REMITTANCE-INGESTION',
    title: 'Employer remittance upload (source preservation only)',
    state: 'LIMITED',
    ownedBy: ['app/api/dues/remittances/upload/route.ts'],
    evidence: [
      'app/api/dues/remittances/upload/route.ts — SHA-256 hashes and preserves the original bytes in blob storage before creating a record; a failed store creates no record; duplicate hashes are rejected.',
      'app/api/__tests__/dues-remittances-upload.route.test.ts — mocked storage/db only; no live storage was exercised.',
    ],
    targetWave: 8,
    notes:
      'Records are SOURCE_PRESERVED_UNPARSED: no parsing, member matching, employer-ownership validation or ' +
      'reconciliation occurs; zero totals are placeholders. PATCH /api/dues/remittances/[id] can no longer set ' +
      'reconciliation, completion or result fields (strict schema), so no remittance can become reconciled until ' +
      'an engine-driven transition exists.',
  },

  // ------------------------------------------------------------------------
  // Representative 2.2 convergence (UE-REP-2.2-CONVERGENCE). Source- and
  // test-level state only; none of this has runtime acceptance evidence.
  // ------------------------------------------------------------------------
  {
    id: 'UE-REP-CASE-AUTHORITY-SCOPING',
    title: 'Representative case, member-directory and document authority scoping',
    state: 'LIMITED',
    ownedBy: [
      'apps/union-eyes/lib/cases/grievance-list-scope.ts',
      'apps/union-eyes/lib/cases/workbench-projection.ts',
      'apps/union-eyes/lib/members/directory-access.ts',
    ],
    evidence: [
      'lib/cases/grievance-list-scope.pglite.test.ts and lib/cases/case-mandate-changes.pglite.test.ts — assignment, reassignment, expiry/revocation, demotion and cross-organization scoping asserted against PostgreSQL semantics (PGlite)',
      'app/api/__tests__/grievances-access.route.test.ts, grievances-status.route.test.ts, workbench-authorization.route.test.ts, members-directory-authorization.route.test.ts, claims-evidence-authorization.route.test.ts — route-level negative and positive authorization with mocked persistence',
    ],
    targetWave: 1,
    notes:
      'LIMITED, not REAL: an ordinary steward holds case-resource authority only through assignment, ownership, ' +
      'creation, or an explicit collaborator grant. Representative 2.2 also gave chief steward and above a ' +
      'role-derived supervisory read over every grievance; that cross-case read was deliberately NOT ' +
      'integrated (a supervisory scope needs an issued mandate with territory and expiry, UE-CONV-E-001). Proven ' +
      'only at source, unit and PGlite level — no deployed RLS probe, no native browser ' +
      'acceptance. Intake conversion still makes the converting steward the owner (an implicit self-assignment ' +
      'whose protocol per operating model needs stakeholder validation).',
  },
  {
    id: 'UE-REP-PROTOCOL-GOVERNANCE',
    title: 'Representation protocol: administrator-saved, separately approved, audited',
    state: 'LIMITED',
    ownedBy: [
      'apps/union-eyes/app/api/admin/representation-protocol/route.ts',
      'apps/union-eyes/lib/representation/protocol-service.ts',
    ],
    evidence: [
      'lib/representation/protocol-service.ts — saveRepresentationProtocol, submitLegacyRepresentationProtocolForApproval, approveRepresentationProtocol and resetRepresentationProtocol each write persistAtomicAudit in the same transaction as the protocol change',
      'lib/representation/protocol-service.ts approveRepresentationProtocol — SELF_APPROVAL_FORBIDDEN: a protocol is approved only by someone other than its author',
      'lib/representation/__tests__/protocol-resolution.test.ts, lib/__tests__/representation-protocol.test.ts and app/api/__tests__/admin-representation-protocol.route.test.ts — resolution, separation of duties and route behaviour with mocked persistence',
    ],
    targetWave: 1,
    notes:
      'LIMITED, not REAL: assignment, filing and escalation consume only an approved (executable) protocol, but the model is a single ' +
      'organization-wide setting. The GET read is logged by the API audit logger, not recorded atomically. There is no per-office, ' +
      'per-jurisdiction or per-affiliate protocol, and the protocol is not yet a mandate (UE-REP-MANDATE-RECUSAL-DELEGATION). ' +
      'Source and mocked-persistence evidence only; no native or browser run. Added so that a real, separation-of-duties flow is owned by ' +
      'a named capability (DEF-0B1-REP-PROTOCOL-NOT-IN-CAPABILITY-MODEL); the frozen register entry is unchanged.',
  },
  {
    id: 'UE-SSO-SIGN-IN',
    title: 'Enterprise SSO sign-in, token exchange, provisioning and SCIM driven by a stored provider',
    state: 'NOT_IMPLEMENTED',
    ownedBy: [],
    evidence: [
      'app/api/enterprise/sso/providers/route.ts and [id]/route.ts — the only readers and writers of sso_providers; every response and audit record carries lib/reality/configuration-effect.ts SSO_SIGN_IN_EFFECT (inEffect: false)',
      'no sign-in, token-exchange, provisioning or SCIM code reads sso_providers, and the OIDC client-secret decryption helper has no caller',
    ],
    targetWave: 2,
    notes:
      'Provider configuration can be stored, and a provider is created disabled unless the administrator asks otherwise, but nothing consumes it: enabling a provider or auto-provisioning does not change how anyone signs in. A consumer needs the identity-provider protocol work and a real provider to qualify against; the stored configuration says so on every read and write rather than implying an effect.',
  },
  {
    id: 'UE-EXT-INTEGRATION-SYNC',
    title: 'Integration synchronization driven by a stored api_integrations configuration',
    state: 'NOT_IMPLEMENTED',
    ownedBy: [],
    evidence: [
      'app/api/extensions/[id]/route.ts — reads, updates and deletes api_integrations rows; every response and audit record carries lib/reality/configuration-effect.ts INTEGRATION_SYNC_EFFECT (inEffect: false)',
      'no route creates a row and nothing outside that route and the schema reads the table or its apiEndpoint',
    ],
    targetWave: 2,
    notes:
      'Enabling an integration, setting a sync frequency or repointing an endpoint is recorded but starts and redirects nothing, because no synchronization runs from the configuration. A creation path was deliberately not added: it would store more configuration that nothing consumes. The synchronization worker and its provider qualification are the missing capability.',
  },
  {
    id: 'UE-REP-MANDATE-RECUSAL-DELEGATION',
    title: 'Representative mandate model: recusal, territory, privileged-matter restriction, temporary delegation',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['apps/union-eyes/lib/cases/case-authorization.ts'],
    evidence: [
      'lib/cases/case-authorization.ts caseReadScope — chief_steward, business_agent, officer and admin read every case in the organization; no recusal, conflict-of-interest, territory or privileged-matter predicate exists',
      'db/schema — no recusal, territory-mandate or temporary-delegation table for claims or grievances (document privacy labels and the retired pre-kernel collaborator table do not model these)',
    ],
    targetWave: 2,
    notes:
      'A business agent territory or a chief steward oversight mandate currently implies read access to every ' +
      'confidential matter in the organization. A recusal and territory model needs a schema decision and ' +
      'stakeholder-validated policy per operating model (CAPE, CUPE, LIUNA); it is deliberately not simulated.',
  },
  {
    id: 'UE-WORKAID-SPECIALIST-REFERRAL',
    title: 'WorkAid specialist referral, acknowledgement and milestone integration',
    state: 'NOT_IMPLEMENTED',
    ownedBy: [],
    evidence: [
      'Union-side referral, consent and disclosure records exist (see UE-WORKAID-UNION-SIDE-DISCLOSURE); no counsel-side connector, transmission, acknowledgement, WSIB/WSIAT filing or Clio code exists',
      'Member and staff screens show union-side consent, document release and referral status. They do not show counsel progress, acknowledgement or a specialist feed',
    ],
    targetWave: 3,
    readinessImpact: 'non_blocking',
    disposition: 'OPTIONAL_NATIVE_CAPABILITY',
    notes:
      'WorkAid is an independent professional service with its own engagement, acceptance and filing authority. ' +
      'Prerequisites before any live progress is shown: an operational connector, referral authorization and ' +
      'member sharing consent, secure transmission with actual acknowledgement, WorkAid acceptance or rejection, ' +
      'purpose-limited document exchange, revocation and closure. Direct WorkAid engagement must not be ' +
      'visible to the union by membership alone. No Clio record, professional note or filing validity may be ' +
      'invented. Design reference only: the WorkAid v0.3 contracts under docs/union-eyes/workaid on the ' +
      'agents/workaid-prep-20261023 branch.',
  },
  {
    id: 'UE-WORKAID-UNION-SIDE-DISCLOSURE',
    title: 'WorkAid union-side consent, referral record, document authorisation and revocation',
    state: 'LIMITED',
    ownedBy: ['lib/authority/store/workaid-disclosure.ts', 'app/api/workaid/consents/route.ts', 'app/api/workaid/referrals/route.ts', 'components/workaid/workaid-journey.tsx'],
    evidence: [
      'db/__tests__/workaid-union-side.pglite.test.ts — consent scope, per-document authorisation, revocation, recusal and removed-representative denial, audit-fault rollback, cross-tenant isolation (PGlite on the real kernel storage; not a native or credentialed run)',
      'Counsel reads fail closed (COUNSEL_NOT_VERIFIABLE) because no CounselAssertionVerifier is configured',
    ],
    targetWave: 3,
    readinessImpact: 'non_blocking',
    disposition: 'OPTIONAL_NATIVE_CAPABILITY',
    notes:
      'A union-side record only: a referral is not delivery to counsel, and no counsel HTTP route or counsel UI exists. Member and staff screens call the union-side routes. ' +
      'Consent capture stays refused until a legally approved wording version is recorded. Two external gates stay separate and closed: ' +
      'counsel-side activation (a counsel-side system and its issuer allow-list) and key custody (UE-CONV-G-003).',
  },
  {
    id: 'UE-PLATFORM-USAGE-TELEMETRY',
    title: 'Platform usage telemetry: page views, sign-ins and feature adoption per organization',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['components/platform/usage-telemetry-notice.tsx'],
    evidence: [
      'No relation holds usage telemetry and nothing writes it: platform_login_events, platform_page_views and platform_feature_adoption exist in no migration, no Django model and no Drizzle declaration; the mismatch census (scripts/runtime/mismatch-census.ts, UE-CONV-H-013) found three dashboards querying them',
      'The analytics-admin, customer-success and sector-analytics dashboards no longer query them; they show the usage-telemetry notice instead of a zero (components/platform/usage-telemetry-notice.tsx)',
      'The customer-success health score is taken out of the signals that are recorded (status, active members, NPS, CLC affiliation, open grievances); it no longer awards points for logins or page views',
    ],
    targetWave: 5,
    notes:
      'Recording how union members move through the product is a privacy decision (purpose, consent, retention, who may see per-organization figures) that has not been made, ' +
      'and Microsoft Entra, not the application, issues sign-in events. The dashboards under app/[locale]/dashboard/{analytics-admin,customer-success,sector-analytics} are ' +
      'real pages over organization, member, grievance, agreement, ticket and NPS data, so they are not listed in ownedBy: an ownedBy page of a NOT_IMPLEMENTED entry is ' +
      'treated as an unconditional 404 by getRegistryTracked404DashboardRoutes.',
  },
  {
    id: 'UE-AI-SEMANTIC-SEARCH',
    title: 'Semantic search over the knowledge base: search, chatbot retrieval and exit-interview indexing (needs pgvector)',
    state: 'LIMITED',
    ownedBy: [
      'lib/ai/vector-readiness.ts',
      'lib/ai/knowledge-base-embeddings.ts',
      'lib/ai/chatbot-service.ts',
      'lib/services/ai/vector-search-service.ts',
      'lib/knowledge-transfer/indexing/semantic-indexer.ts',
      'lib/knowledge-transfer/search/hybrid-search.ts',
      'app/api/ai/search/route.ts',
      'app/api/ai/semantic-search/route.ts',
      'app/api/exit-interviews/[id]/index/route.ts',
    ],
    evidence: [
      'db/__tests__/semantic-search.postgres.test.ts — native, as union_eyes_runtime under FORCE row-level security: with no vector column the table still reads and writes through its declaration and search, write, chatbot retrieval and indexing all answer unavailable before anything is sent to the embedding service; with the column (PostgreSQL 15 and 16, pgvector installed on the disposable server by .github/workflows/ue-native-postgres.yml) the database scores and orders the matches, an expired, inactive or unembedded row is never returned, knowledge made from an exit interview is returned only for a level the reader may read and only with consent, one organization never sees another\'s rows, a vector of the wrong size is refused, and the indexer writes the row, its vector, the interview status and the audit record in one transaction',
      'lib/ai/vector-readiness.ts asks whether the vector extension and the column exist (cached for a minute); /api/ai/search and /api/ai/semantic-search answer 501 and the exit-interview index route answers 501 where they do not, and the chatbot answers without retrieved context',
      'knowledge_base.embedding is not declared in either Drizzle declaration of the table (a declared column is part of every select(), so it made every read of the table fail where pgvector is absent); it is read and written only through lib/ai/knowledge-base-embeddings.ts',
    ],
    targetWave: 5,
    notes:
      'Works only where the deployment offers the pgvector extension, which is an operator decision: platform 0063 creates knowledge_base.embedding (vector(1536)) only on a server that offers it. ' +
      'The exit-interview indexer is the only writer of embeddings, so semantic search finds exit-interview knowledge only; the other knowledge rows (bylaws, policies, summaries) are never embedded. ' +
      'cba_clauses.embedding and arbitration_decisions.embedding are text columns that nothing writes or converts, so clause and precedent semantic search answer unavailable on every database. ' +
      'The embedding model must produce 1536 numbers; any other size is refused. The match is an exact per-organization scan (no approximate index), which is correct at the current size of an organization\'s knowledge base. ' +
      'The native test runs in CI on PostgreSQL 15 and 16; where the extension is missing it fails (UE_NATIVE_REQUIRE_PGVECTOR) instead of skipping.',
  },
  {
    id: 'UE-GOVERNANCE-POLICY-LIFECYCLE',
    title: 'Policy lifecycle governance: governed policies, approval chains, conflicts, replay, events and snapshots',
    state: 'NOT_IMPLEMENTED',
    ownedBy: [
      'lib/governance/policy-lifecycle-unavailable.ts',
      'lib/governance/policy-approval-authority.ts',
      'app/api/governance/lifecycle/policies/route.ts',
      'app/api/governance/lifecycle/conflicts/route.ts',
      'app/api/governance/lifecycle/deprecation-watch/route.ts',
      'app/api/governance/lifecycle/policy-events/route.ts',
      'app/api/governance/lifecycle/snapshots/route.ts',
      'app/api/governance/lifecycle/policies/[id]/route.ts',
      'app/api/governance/lifecycle/policies/[id]/approvals/route.ts',
      'app/api/governance/lifecycle/policies/[id]/conflicts/route.ts',
      'app/api/governance/lifecycle/policies/[id]/lineage/route.ts',
      'app/api/governance/lifecycle/policies/[id]/replay/route.ts',
      'app/api/governance/lifecycle/policies/[id]/versions/route.ts',
      'app/api/governance/lifecycle/conflicts/[conflictId]/route.ts',
      'app/api/governance/lifecycle/snapshots/[at]/route.ts',
    ],
    evidence: [
      'The mismatch census (scripts/runtime/mismatch-census.ts, UE-CONV-H-013) found governed_policies, policy_approval_chains, policy_approval_actions, policy_conflicts, policy_replay_sessions, policy_governance_events and policy_governance_snapshots read and written through Union Eyes\' own database handle: they exist in no Union Eyes migration, Django model or Drizzle declaration (they are the platform\'s, @nzila/db/schema), so every call failed',
      'app/api/__tests__/governance-lifecycle-unavailable.contract.test.ts — all thirteen routes answer 501 for every method behind the administrator and entitlement gate, and import no database, audit or system-context code',
      'The pages (app/[locale]/dashboard/governance/lifecycle) and components (components/policy-governance) that called the routes were removed; nothing linked to them',
    ],
    targetWave: 6,
    notes:
      'What is missing is a decision, not a column: whose policies these are (the platform\'s or each organization\'s), who may approve them and where the record is kept. ' +
      'The handlers ran as the system role, so had the relations existed here an administrator of any one organization would have been writing policy for the whole platform, and the audit record would have sat in a different database from the change. ' +
      'lib/governance/policy-approval-authority.ts is the decision logic written for the approval path (identity and role from the session only; a body asserts neither) and stays, tested, until a store exists. ' +
      'apps/platform-admin reads policies and snapshots from these routes and shows the answer. Part of Governance Officer 2.1 G06 (policy creation, versioning, review and supersession), whose implementation is not certified.',
  },
  {
    id: 'UE-ACTION-SMS-SEND',
    title: 'Sending SMS messages and campaigns',
    state: 'NOT_IMPLEMENTED',
    ownedBy: [
      'app/api/communications/sms/route.ts',
      'app/api/communications/sms/campaigns/route.ts',
      'app/api/communications/sms/conversations/route.ts',
      'components/communications/sms-console.tsx',
    ],
    evidence: [
      'POST on the three collection routes answers HTTP 501 (lib/api/records-a-send-only.ts): the rows record a send, and no route sends. The provider adapter that was in lib/services/messaging/sms-service.ts had no caller and was deleted; services/twilio-sms-service.ts sendSms is imported only by services/clc/remittance-notifications.ts, which nothing imports.',
      'sms_templates, sms_opt_outs and sms_campaign_recipients are CONTAINED_NO_AUTHORITY: there is no recipient list with recorded consent and no opt-out record, so the campaign builder and template editor were deleted rather than left to write nothing.',
      'components/communications/__tests__/sms-console.test.tsx — the console shows the stored messages and campaigns, offers no send and names this capability.',
    ],
    targetWave: 8,
    notes: 'A text to a member needs recorded consent and an honoured opt-out before the first one leaves; neither has an authority yet.',
  },
  {
    id: 'UE-ACTION-SMS-CONVERSATIONS',
    title: 'SMS inbox: marking conversations read and archiving them',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/communications/sms/conversations/[conversationId]/read/route.ts', 'components/communications/sms-inbox.tsx'],
    evidence: [
      'The read route answers HTTP 501; sms_conversations is open to the runtime role for SELECT and INSERT only (db/rls-storage-authority/communications-notifications.ts), so no update of a conversation can run, and no archive route exists.',
      'components/communications/__tests__/sms-inbox.test.tsx — the inbox lists what is stored, offers no state change and names this capability.',
    ],
    targetWave: 8,
  },
  {
    id: 'UE-ACTION-CHATBOT-MESSAGE-FEEDBACK',
    title: 'Chatbot message feedback (thumbs up / down)',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['components/ai/ai-chatbot.tsx'],
    evidence: [
      'chat_messages is open to the runtime role for SELECT and INSERT only (db/rls-storage-authority/communications-notifications.ts), so a rating cannot be stored on a message; the thumbs were removed rather than left to appear to record one.',
    ],
    targetWave: 8,
  },
  {
    id: 'UE-ACTION-CHATBOT-SESSION-ARCHIVE',
    title: 'Archive a chatbot session',
    state: 'LIMITED',
    ownedBy: ['app/api/chatbot/sessions/[sessionId]/archive/route.ts', 'components/ai/ai-chatbot.tsx'],
    evidence: [
      'POST archives the caller\'s own session (organization and user from the resolved session, never the body), moves it active to archived under a status predicate and writes its audit record in the same transaction; another member\'s or organization\'s session answers 404.',
      'app/api/__tests__/chatbot-session-archive.route.test.ts — the route against a mocked database; no native or staging proof of the row-level-security UPDATE path.',
    ],
    targetWave: 8,
    notes: 'Nothing is deleted: the transcript is kept. The UI no longer offers a "Delete" that only archived.',
  },
  {
    id: 'UE-ACTION-CALENDAR-ATTENDEES-RECURRENCE',
    title: 'Calendar event attendees and recurrence',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['components/calendar/EventDialog.tsx', 'app/api/events/[id]/occurrences/route.ts'],
    evidence: [
      'event_attendees is CONTAINED_NO_AUTHORITY (db/rls-storage-authority/reference-latent.ts) and /api/events/[id]/occurrences answers HTTP 501, so an attendee list or a recurrence rule would be stored or shown without ever taking effect; the event form offers neither.',
      'app/[locale]/calendar/__tests__/calendar-page.test.tsx and lib/calendar/event-form.test.ts — the form sends only the fields an event stores.',
    ],
    targetWave: 8,
  },
  {
    id: 'UE-ACTION-CALENDAR-SYNC',
    title: 'External calendar synchronization (Google, Outlook)',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['components/calendar/CalendarSyncManager.tsx', 'app/api/calendar-sync/connections/[id]/sync/route.ts', 'app/api/cron/calendar-sync/route.ts'],
    evidence: [
      'The provider OAuth callbacks create a connection with no calendar mapping, no route lists a provider\'s calendars or stores a mapping, the scheduled job answers "No calendar mappings configured", and a manual sync needs ids the screen cannot know: Connect, Sync now, Auto-sync and Direction would only look as though they did something.',
      'components/calendar/__tests__/calendar-sync-manager.test.tsx — the manager lists the real connections, disconnects them (reporting whether the provider revoked access) and shows CapabilityUnavailable for synchronization.',
    ],
    targetWave: 8,
    notes: 'A mapping step (choose the provider calendar and the local calendar) has to exist before Connect and Sync can return.',
  },
  {
    id: 'UE-ACTION-CAMPAIGN-SEND',
    title: 'Sending and scheduling communication campaigns',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/communications/campaigns/[id]/schedule/route.ts', 'app/api/communications/campaigns/[id]/send-test/route.ts'],
    evidence: [
      'schedule and send-test answer HTTP 501. The campaign sender (lib/services/messaging/campaign-service.ts) had no caller and was deleted, and no job reads a scheduled campaign: a campaign is a draft record and is never sent.',
      'The campaign pages create and show drafts and say that sending is not available in this release (CapabilityUnavailable capability="UE-ACTION-CAMPAIGN-SEND").',
      'The create route does not accept scheduledAt or sendImmediately and the item route blocks them in a PATCH (lib/api/__tests__/f12-communications.contract.test.ts): a body that scheduled or sent a campaign would be stored and never honoured.',
    ],
    targetWave: 8,
    notes: 'Sending needs recipients with recorded consent, an honoured unsubscribe and a delivery job; none exists. The one-click unsubscribe route (communications/unsubscribe/[recipientId]) is live and verifies a signed link, but nothing issues one.',
  },
  {
    id: 'UE-ACTION-NOTIFICATION-DELIVERY-PREFERENCES',
    title: 'Notification content categories, digest frequency and quiet hours',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/notifications/preferences/route.ts'],
    evidence: [
      'Content categories and a time zone have no column; digest frequency and quiet hours are stored but no sender reads them, so a control for them would only look as though it did something. app/[locale]/dashboard/settings/communications/page.tsx offers the per-channel switches the notification route reads and writes.',
      'app/[locale]/dashboard/settings/communications/__tests__ — the page reads and saves GET / PUT /api/notifications/preferences and shows the server\'s error when the save fails.',
    ],
    targetWave: 8,
  },
  {
    id: 'UE-HS-INSPECTION-SCHEDULING',
    title: 'Health & safety inspection scheduling',
    state: 'NOT_IMPLEMENTED',
    ownedBy: ['app/api/health-safety/inspections/route.ts'],
    evidence: [
      'POST /api/health-safety/inspections is the generic crud-factory create for safety_inspections, open to an administrator; no screen schedules an inspection, and the "Schedule Inspection" control that had no handler was removed from the inspections page rather than left dead.',
      'components/health-safety/__tests__ — the inspections list and stats show what is stored and offer no scheduling.',
    ],
    targetWave: 8,
  },
  {
    id: 'UE-HS-ATTACHMENTS',
    title: 'Hazard photos and incident attachments',
    state: 'NOT_IMPLEMENTED',
    ownedBy: [],
    evidence: [
      'No route stores an uploaded file for a hazard or an incident: the report forms had a draft and an attachment list that nothing saved, and both were removed. Fields the incidents route cannot store are written into the incident narrative instead of being dropped.',
      'components/health-safety/__tests__ — the hazard and incident forms submit what the routes accept and offer no attachment.',
    ],
    targetWave: 8,
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
 * The NOT_IMPLEMENTED capabilities that own each tracked dashboard page, by route. A capability lists a dashboard page in `ownedBy` only when the page is
 * wholly its surface, and a page that stands in for a capability that does not exist must be honest about it: it is either a bare `notFound()` or it renders
 * `<CapabilityUnavailable capability="…">` naming the capability that owns it. A page that is partly live (a tab or a form was removed from it) is not listed:
 * its unavailable part is the component or route that was removed, not the page.
 */
export function getRegistryTrackedDashboardPageOwners(): ReadonlyMap<string, readonly string[]> {
  const owners = new Map<string, string[]>();
  for (const cap of CAPABILITY_REGISTRY) {
    if (cap.state !== 'NOT_IMPLEMENTED') continue;
    for (const owned of cap.ownedBy) {
      const m = owned.match(/^app\/\[locale\]\/(dashboard\/[^/]+(?:\/[^/]+)*)\/(?:page|layout)\.tsx$/);
      if (!m) continue;
      owners.set(`/${m[1]}`, [...(owners.get(`/${m[1]}`) ?? []), cap.id]);
    }
  }
  return owners;
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
