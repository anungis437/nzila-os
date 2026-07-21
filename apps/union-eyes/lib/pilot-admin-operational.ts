/**
 * Operational pilot-health probes (Wave 0 §7 expansion).
 *
 * Each probe returns an `OperationalHealthCheck` with the full mandated
 * shape: capabilityId, state, severity, observedValue, expectedValue,
 * measuredTimestamp, dependency, evidenceReference, remediationGuidance.
 *
 * Probes that cannot be measured against the deployed runtime today
 * MUST return `state: 'unknown'` with a helpful `remediationGuidance`
 * — NEVER default to `'pass'`. `unknown` is contagious in the rollup
 * (see `runHealthChecks` in `pilot-admin.ts`).
 *
 * See: docs/union-eyes/reality-remediation/00_PROGRAM_CHARTER.md §7.
 */

export type OperationalState = 'pass' | 'warn' | 'fail' | 'unknown';
export type OperationalSeverity = 'info' | 'warn' | 'error' | 'critical';

export interface OperationalHealthCheck {
  /** Stable identifier that matches the capability registry entry. */
  capabilityId: string;
  /** Human name for dashboards. */
  name: string;
  state: OperationalState;
  severity: OperationalSeverity;
  /** The value actually observed (or `null` if the probe could not run). */
  observedValue: unknown;
  /** The value considered healthy. */
  expectedValue: unknown;
  measuredTimestamp: string;
  /** External dependency this probe touches, e.g. `postgres`, `redis`. */
  dependency: string;
  /** Where to look for corroborating evidence (log query, dashboard, doc). */
  evidenceReference: string;
  /** Concrete action the operator should take when this probe is not `pass`. */
  remediationGuidance: string;
}

/** Utility: build an `unknown` probe with correct shape. */
function unknownProbe(partial: Omit<OperationalHealthCheck, 'state' | 'severity' | 'observedValue' | 'measuredTimestamp'>): OperationalHealthCheck {
  return {
    ...partial,
    state: 'unknown',
    severity: 'error',
    observedValue: null,
    measuredTimestamp: new Date().toISOString(),
  };
}

/**
 * Probe: PostgreSQL SELECT 1 round-trip.
 * Uses the caller-supplied `db.execute(sql)` runner to keep this module
 * free of Drizzle imports (the app already imports Drizzle from lots of
 * places; this way tests can inject a stub).
 */
export async function probePostgresPing(
  runSelectOne: () => Promise<unknown>,
): Promise<OperationalHealthCheck> {
  const start = Date.now();
  try {
    await runSelectOne();
    return {
      capabilityId: 'UE-DB-POSTGRES-PING',
      name: 'PostgreSQL round-trip',
      state: 'pass',
      severity: 'info',
      observedValue: `SELECT 1 succeeded in ${Date.now() - start}ms`,
      expectedValue: 'SELECT 1 succeeds',
      measuredTimestamp: new Date().toISOString(),
      dependency: 'postgres',
      evidenceReference: 'apps/union-eyes/db/index.ts',
      remediationGuidance: 'None — probe healthy.',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      capabilityId: 'UE-DB-POSTGRES-PING',
      name: 'PostgreSQL round-trip',
      state: 'fail',
      severity: 'critical',
      observedValue: `SELECT 1 failed: ${message}`,
      expectedValue: 'SELECT 1 succeeds',
      measuredTimestamp: new Date().toISOString(),
      dependency: 'postgres',
      evidenceReference: 'apps/union-eyes/db/index.ts',
      remediationGuidance:
        'Verify `DATABASE_URL` env var, network reachability from Container App to nzila-staging-db, and firewall rules.',
    };
  }
}

/**
 * Probe: presence of a required secret ENV VAR by name.
 * Never reads or returns the secret value — only reports presence.
 */
export function probeSecretPresence(
  envVarName: string,
  capabilityId: string,
  humanName: string,
  remediationGuidance: string,
): OperationalHealthCheck {
  const present = typeof process.env[envVarName] === 'string' && process.env[envVarName]!.length > 0;
  return {
    capabilityId,
    name: humanName,
    state: present ? 'pass' : 'fail',
    severity: present ? 'info' : 'error',
    observedValue: present ? `${envVarName} is set (${(process.env[envVarName] ?? '').length} chars, value NOT logged)` : `${envVarName} is unset`,
    expectedValue: `${envVarName} is set to a non-empty string`,
    measuredTimestamp: new Date().toISOString(),
    dependency: envVarName,
    evidenceReference: 'Azure Key Vault: nzila-staging-kv',
    remediationGuidance,
  };
}

/**
 * Probe: demo profile enforcement.
 * Passes only when neither UE_FEATURE_PROFILE nor NEXT_PUBLIC_UE_DEMO_PROFILE
 * carries a demo value in a non-development target environment.
 */
export function probeDemoProfileEnforcement(env: {
  targetEnvironment?: string;
  ueFeatureProfile?: string;
  publicDemoProfile?: string;
}): OperationalHealthCheck {
  const now = new Date().toISOString();
  const target = (env.targetEnvironment ?? 'production').toLowerCase();
  const demoValues = ['demo', 'sample', 'placeholder', 'fixture'];
  const demoActive =
    demoValues.includes((env.ueFeatureProfile ?? '').toLowerCase()) ||
    demoValues.includes((env.publicDemoProfile ?? '').toLowerCase());
  const devTargets = ['development', 'local', 'test'];
  if (!demoActive) {
    return {
      capabilityId: 'UE-REALITY-DEMO-GUARD',
      name: 'Demo profile enforcement',
      state: 'pass',
      severity: 'info',
      observedValue: `demo profile inactive (target=${target})`,
      expectedValue: 'demo profile inactive OR target in {development,local,test}',
      measuredTimestamp: now,
      dependency: 'UE_FEATURE_PROFILE',
      evidenceReference: 'apps/union-eyes/lib/reality/demo-deployment-guard.ts',
      remediationGuidance: 'None — probe healthy.',
    };
  }
  if (devTargets.includes(target)) {
    return {
      capabilityId: 'UE-REALITY-DEMO-GUARD',
      name: 'Demo profile enforcement',
      state: 'pass',
      severity: 'info',
      observedValue: `demo profile active in development target=${target}`,
      expectedValue: 'demo profile inactive OR target in {development,local,test}',
      measuredTimestamp: now,
      dependency: 'UE_FEATURE_PROFILE',
      evidenceReference: 'apps/union-eyes/lib/reality/demo-deployment-guard.ts',
      remediationGuidance: 'None — probe healthy.',
    };
  }
  return {
    capabilityId: 'UE-REALITY-DEMO-GUARD',
    name: 'Demo profile enforcement',
    state: 'fail',
    severity: 'critical',
    observedValue: `demo profile active in target=${target}`,
    expectedValue: 'demo profile inactive OR target in {development,local,test}',
    measuredTimestamp: now,
    dependency: 'UE_FEATURE_PROFILE',
    evidenceReference: 'apps/union-eyes/lib/reality/demo-deployment-guard.ts',
    remediationGuidance:
      'Unset UE_FEATURE_PROFILE and NEXT_PUBLIC_UE_DEMO_PROFILE in this environment. The container SHOULD have refused to start via instrumentation.ts assertDemoDeploymentGuard().',
  };
}

// -------------------------------------------------------------------
// Unmeasured probes (Wave 0 stubs — return `unknown` with guidance).
// Each of these is a real capability that the mandate requires; the
// endpoint MUST report `unknown` for anything that is not yet wired
// against the deployed runtime.
// -------------------------------------------------------------------

export function unmeasuredProbes(): OperationalHealthCheck[] {
  return [
    unknownProbe({
      capabilityId: 'UE-DB-MIGRATIONS-APPLIED',
      name: 'Database migrations applied',
      expectedValue: 'no unapplied migrations',
      dependency: 'drizzle',
      evidenceReference: 'apps/union-eyes/drizzle/meta/_journal.json vs applied migrations table',
      remediationGuidance:
        'Query drizzle metadata table and compare against journal; expose count of unapplied migrations.',
    }),
    unknownProbe({
      capabilityId: 'UE-TENANT-ISOLATION',
      name: 'Tenant isolation enforcement',
      expectedValue: 'all pilot-critical queries scoped to organizationId',
      dependency: 'postgres row-level security',
      evidenceReference: 'apps/union-eyes/lib/rls/**',
      remediationGuidance:
        'Wire a synthetic query as tenant B against tenant A rows; assert 0 rows returned.',
    }),
    unknownProbe({
      capabilityId: 'UE-REDIS-PING',
      name: 'Redis reachability',
      expectedValue: 'PING → PONG',
      dependency: 'redis',
      evidenceReference: 'staging Container Apps env',
      remediationGuidance:
        'No Redis is currently deployed in nzila-canada-staging-rg (removed 2026-04-05). Provision Azure Cache for Redis or accept degraded rate-limiter state.',
    }),
    unknownProbe({
      capabilityId: 'UE-DJANGO-SIDECAR-HEALTH',
      name: 'Django sidecar health',
      expectedValue: 'GET /api/auth_core/health/ returns 200',
      dependency: 'django-sidecar container',
      evidenceReference: 'apps/union-eyes/services/django/**',
      remediationGuidance:
        'Fetch the sidecar health URL from within the Node container; report status code and latency.',
    }),
    unknownProbe({
      capabilityId: 'UE-QUEUE-DEPTH',
      name: 'Job queue depth',
      expectedValue: 'depth < 100 items and > 0 workers running',
      dependency: 'queue infrastructure',
      evidenceReference: 'apps/union-eyes/lib/workers/**',
      remediationGuidance:
        'Wire a queue backend (bullmq/pg-boss) and read depth per queue.',
    }),
    unknownProbe({
      capabilityId: 'UE-WORKER-HEARTBEAT',
      name: 'Worker heartbeat freshness',
      expectedValue: 'at least one worker updated heartbeat in last 60s',
      dependency: 'worker registry table',
      evidenceReference: 'apps/union-eyes/lib/workers/**',
      remediationGuidance:
        'Have each worker upsert into `worker_heartbeats(worker_id, updated_at)`; query max(updated_at).',
    }),
    unknownProbe({
      capabilityId: 'UE-CRON-FRESHNESS',
      name: 'Cron freshness',
      expectedValue: 'each configured cron ran within 2× its interval',
      dependency: 'cron execution log',
      evidenceReference: 'apps/union-eyes/app/api/cron/**',
      remediationGuidance:
        'Persist cron execution rows to `cron_runs(name, started_at, finished_at, status)` and query recency.',
    }),
    unknownProbe({
      capabilityId: 'UE-EMAIL-PROBE',
      name: 'Email deliverability',
      expectedValue: 'test email to postmaster@ delivers via Resend',
      dependency: 'resend',
      evidenceReference: 'apps/union-eyes/lib/email-service.ts',
      remediationGuidance:
        'Set RESEND_API_KEY; run synthetic send-to-blackhole address; scrape Resend event log.',
    }),
    unknownProbe({
      capabilityId: 'UE-SMS-PROBE',
      name: 'SMS deliverability',
      expectedValue: 'SMS provider reachable and quota available',
      dependency: 'twilio (or equivalent)',
      evidenceReference: 'not implemented',
      remediationGuidance: 'Choose SMS vendor, wire adapter, then implement probe.',
    }),
    unknownProbe({
      capabilityId: 'UE-CLAMAV-PROBE',
      name: 'Malware scanner reachability',
      expectedValue: 'CLAMAV_URL /scan returns 200 for empty payload',
      dependency: 'clamav sidecar',
      evidenceReference: 'apps/union-eyes/lib/security/clamav.ts',
      remediationGuidance:
        'Provision ClamAV sidecar in nzila-canada-staging-env; set CLAMAV_URL secret.',
    }),
    unknownProbe({
      capabilityId: 'UE-STORAGE-PROBE',
      name: 'Blob storage reachability',
      expectedValue: 'HEAD on a canary blob returns 200',
      dependency: 'nzilacanadastore',
      evidenceReference: 'apps/union-eyes/lib/blob-client.ts',
      remediationGuidance:
        'Wire an unauthenticated HEAD to a public canary blob or a managed-identity call.',
    }),
    unknownProbe({
      capabilityId: 'UE-PAYMENT-PROBE',
      name: 'Payment provider reachability',
      expectedValue: 'stripe.balance.retrieve() returns 200',
      dependency: 'stripe',
      evidenceReference: 'apps/union-eyes/lib/stripe.ts',
      remediationGuidance:
        'Set STRIPE_SECRET_KEY (test-mode is fine for staging); implement probe using balance.retrieve.',
    }),
    unknownProbe({
      capabilityId: 'UE-SENTRY-PROBE',
      name: 'Error monitoring reachability',
      expectedValue: 'Sentry DSN valid; synthetic captureMessage acknowledged',
      dependency: 'sentry',
      evidenceReference: 'apps/union-eyes/instrumentation.ts',
      remediationGuidance:
        'Provision Sentry project (`nzila-mcp-server-2` org via MCP); set SENTRY_DSN in KV.',
    }),
    unknownProbe({
      capabilityId: 'UE-SYNTHETIC-MONITORING',
      name: 'Synthetic monitoring',
      expectedValue: 'at least 1 external probe every 5 min returning 200',
      dependency: 'external monitor (Uptime, Datadog synthetics, Application Insights)',
      evidenceReference: 'not configured',
      remediationGuidance:
        'Choose synthetic monitoring vendor; wire against `/api/healthz` (create if absent).',
    }),
    unknownProbe({
      capabilityId: 'UE-AUDIT-SEAL',
      name: 'Audit log tamper seal',
      expectedValue: 'daily audit-seal row within last 25h and hash-chain valid',
      dependency: 'audit_seals table',
      evidenceReference: 'apps/union-eyes/lib/middleware/auth-middleware.ts',
      remediationGuidance:
        'Move audit trail off in-memory static (F-05) into `audit_events` + `audit_seals(day, tip_hash)`; nightly cron computes and stores tip.',
    }),
    unknownProbe({
      capabilityId: 'UE-BACKUP-FRESHNESS',
      name: 'Backup freshness',
      expectedValue: 'newest full backup < 26h old',
      dependency: 'Azure PostgreSQL Flexible backup',
      evidenceReference: 'nzila-staging-db backups',
      remediationGuidance:
        'Query Azure REST for latest backup timestamp; expose delta in seconds.',
    }),
    unknownProbe({
      capabilityId: 'UE-RESTORE-PROOF',
      name: 'Restore proof',
      expectedValue: 'last successful restore drill < 30d old',
      dependency: 'operational runbook',
      evidenceReference: 'docs/union-eyes/reality-remediation/**',
      remediationGuidance:
        'Run monthly PITR restore drill; log outcome to `restore_drills(run_at, verdict, notes)`.',
    }),
    unknownProbe({
      capabilityId: 'UE-REGISTRY-CONSISTENCY',
      name: 'Capability registry consistency',
      expectedValue: 'zero routes discovered without a registry entry',
      dependency: 'tooling/reality/capability-inventory.ts',
      evidenceReference: 'reports/union-eyes-capability-inventory.json',
      remediationGuidance:
        'Run `pnpm reality:inventory`; back-fill missing entries; then flip R-7 severity from warning to error in the scanner.',
    }),
    unknownProbe({
      capabilityId: 'UE-DEPLOYMENT-REVISION',
      name: 'Container Apps revision alignment',
      expectedValue: 'active revision matches the CI-recorded image digest',
      dependency: 'Azure Container Apps',
      evidenceReference: 'nzila-os-union-eyes revisions',
      remediationGuidance:
        'Record `git_sha`, `image_digest`, `revision_name` at deploy time in `deployments` table; probe reads latest row and compares to the running container.',
    }),
  ];
}
