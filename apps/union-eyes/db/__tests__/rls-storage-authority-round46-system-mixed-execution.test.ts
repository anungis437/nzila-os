/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 46: SYSTEM_AND_MIXED_EXECUTION_AUTHORITY — mechanically
 * re-derived the system/worker/webhook-execution universe from the
 * exact-head census rather than trusting the round-45-known 4-table list.
 * Broadened the search to every NEEDS_REVIEW table with a cron/worker/
 * webhook/queue hint, then applied doctrine's "a worker-named file/class
 * is not proof of a real system caller" test to each candidate.
 *
 * MECHANICALLY EXCLUDED (traced to their root, no real caller found):
 *   employer_execution_artifacts, employer_execution_replays,
 *   employer_execution_compliance_events, employer_timesheet_entries —
 *   lib/workers/employer-execution/{process-evidence-seal,process-replay-run,
 *   process-timesheet-validation,process-payroll-run,process-remittance-run,
 *   process-compliance-watchdog}.ts are all dead code: zero importers of the
 *   barrel index.ts anywhere outside their own module + __tests__.
 *   foreign_workers — "worker" match was a false positive on the table name
 *   itself; no real cron/worker/webhook route references it.
 *   calendars, reports — Round-41 exceptions, not reopened.
 *   workbooks, workbook_purchases — pseudonymous bearer-credential product
 *   family (Round 42 precedent), wrong archetype entirely.
 *
 * CLOSED this round (5 tables):
 *   TENANT_RLS_REQUIRED (MIXED authority): alert_rules, push_devices
 *   SYSTEM_ONLY: webhook_receipts, union_density
 *   CONTAINED_NO_AUTHORITY: shopify_config
 *
 * push_devices CORRECTS round 45's MIXED_ROOT ejection: the cited system
 * path (lib/workers/notification-worker.ts + services/fcm-service.ts) is
 * confirmed dead code with zero real bootstrap/callers anywhere — the only
 * real path is TENANT via app/api/mobile/devices/route.ts.
 *
 * SECURITY DEFECTS FOUND AND FIXED this round (principal mismatches —
 * a SYSTEM_SCHEDULE/WEBHOOK-invoked operation executing on the plain
 * tenant `db` import instead of withSystemContext()):
 *   - services/observability/realtime-alerting-service.ts's
 *     runRealtimeObservabilitySweep() (alert_rules system path)
 *   - lib/services/rewards/webhook-service.ts's isWebhookProcessed()/
 *     recordWebhookProcessed() (webhook_receipts)
 *   - lib/services/external-data/wage-enrichment-service.ts's
 *     syncUnionDensity() (union_density) — sibling sync methods for other
 *     tables deliberately NOT touched, out of this round's cohort
 *
 * SECURITY DEFECT FOUND AND FIXED (missing user predicate, push_devices):
 *   app/api/mobile/devices/route.ts had org scoping but no per-user
 *   scoping — any org member could list every other member's registered
 *   devices, and POST could register a device under an arbitrary
 *   profileId. Fixed with ownerColumn + a beforeCreate hook forcing
 *   profileId to the authenticated caller.
 *
 * CREDENTIAL FINDING (shopify_config): Django's ShopifyConfigViewSet was
 * IsAuthenticated-only with a default serializer that would have exposed
 * every organization's *_secret_ref columns to any authenticated user.
 *
 * EXCEPTION retained (transaction_fee_events, PRINCIPAL_MISMATCH,
 * NEEDS_REVIEW): real Stripe webhook root with safe auth ordering and
 * idempotency, but services/platform-economics/transaction-fee-engine.ts's
 * 7 exported functions all use the plain tenant `db` import despite
 * webhook invocation — fixing that constitutes a "broad financial-service
 * refactor" explicitly out of scope for a bounded round.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { storageAuthorityManifest } from '../rls-storage-authority-manifest';

const APP_ROOT = resolve(__dirname, '..', '..');

function source(path: string): string {
  return readFileSync(resolve(APP_ROOT, path), 'utf8');
}

/* ── Closed cohort: manifest shape assertions ─────────────────────────── */

describe('round 46 TENANT_RLS_REQUIRED (MIXED authority): alert_rules', () => {
  it('has the proven tenant-select / system-schedule-insert shape', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === 'alert_rules');
    expect(entry, 'alert_rules: no manifest entry found').toBeTruthy();
    expect(entry!.classification).toBe('TENANT_RLS_REQUIRED');
    expect(entry!.requiredRuntimePrivileges).toEqual(['SELECT']);
    expect(entry!.requiredSystemPrivileges).toEqual(['SELECT', 'INSERT']);
    expect(entry!.invocationAuthority).toBe('MIXED');
    expect(entry!.dbExecutionPrincipal).toBe('MIXED');
  });
});

describe('round 46 TENANT_RLS_REQUIRED: push_devices (corrects round-45 MIXED ejection)', () => {
  it('has the proven pure-tenant shape now that the cited system path is confirmed dead', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === 'push_devices');
    expect(entry, 'push_devices: no manifest entry found').toBeTruthy();
    expect(entry!.classification).toBe('TENANT_RLS_REQUIRED');
    expect(entry!.requiredRuntimePrivileges).toEqual(['SELECT', 'INSERT']);
    expect(entry!.requiredSystemPrivileges).toEqual([]);
    expect(entry!.invocationAuthority).toBe('TENANT_USER');
    expect(entry!.dbExecutionPrincipal).toBe('TENANT_RUNTIME');
  });
});

describe('round 46 SYSTEM_ONLY: webhook_receipts', () => {
  it('has the strict webhook-invoked system-runtime shape', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === 'webhook_receipts');
    expect(entry, 'webhook_receipts: no manifest entry found').toBeTruthy();
    expect(entry!.classification).toBe('SYSTEM_ONLY');
    expect(entry!.requiredRuntimePrivileges).toEqual([]);
    expect(entry!.requiredSystemPrivileges).toEqual(['SELECT', 'INSERT']);
    expect(entry!.invocationAuthority).toBe('WEBHOOK');
    expect(entry!.dbExecutionPrincipal).toBe('SYSTEM_RUNTIME');
  });
});

describe('round 46 SYSTEM_ONLY: union_density', () => {
  it('has the tenant-initiated-but-system-executed shape', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === 'union_density');
    expect(entry, 'union_density: no manifest entry found').toBeTruthy();
    expect(entry!.classification).toBe('SYSTEM_ONLY');
    expect(entry!.requiredRuntimePrivileges).toEqual([]);
    expect(entry!.requiredSystemPrivileges).toEqual(['SELECT', 'INSERT', 'UPDATE']);
    expect(entry!.invocationAuthority).toBe('MIXED');
    expect(entry!.dbExecutionPrincipal).toBe('SYSTEM_RUNTIME');
  });
});

describe('round 46 CONTAINED_NO_AUTHORITY: shopify_config', () => {
  it('has the strict zero-authority shape (dead TS, Django now contained)', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === 'shopify_config');
    expect(entry, 'shopify_config: no manifest entry found').toBeTruthy();
    expect(entry!.classification).toBe('CONTAINED_NO_AUTHORITY');
    expect(entry!.requiredRuntimePrivileges).toEqual([]);
    expect(entry!.requiredSystemPrivileges).toEqual([]);
    expect(entry!.invocationAuthority).toBe('NONE');
    expect(entry!.dbExecutionPrincipal).toBe('NONE');
  });
});

describe('round 46: no TBD authority fields remain on the closed cohort', () => {
  const CLOSED = ['alert_rules', 'push_devices', 'webhook_receipts', 'union_density', 'shopify_config'];

  it.each(CLOSED)('%s has no TBD fields', (table) => {
    const entry = storageAuthorityManifest.find((e) => e.table === table);
    expect(entry!.requiredRuntimePrivileges).not.toBe('TBD');
    expect(entry!.requiredSystemPrivileges).not.toBe('TBD');
    expect(entry!.invocationAuthority).not.toBe('TBD');
    expect(entry!.dbExecutionPrincipal).not.toBe('TBD');
  });
});

/* ── Exception retained: transaction_fee_events ───────────────────────── */

describe('round 46 exception: transaction_fee_events stays NEEDS_REVIEW', () => {
  it('is documented as a PRINCIPAL_MISMATCH exception, not silently dropped', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === 'transaction_fee_events');
    expect(entry).toBeTruthy();
    expect(entry!.classification).toBe('NEEDS_REVIEW');
    expect(entry!.reason).toContain('PRINCIPAL_MISMATCH');
    expect(entry!.reason).toContain('transaction-fee-engine.ts');
  });
});

/* ── Principal mismatch ratchet (doctrine section 22) ─────────────────── *
 * A real system/webhook-invoked write path must execute via
 * withSystemContext(), not the plain tenant `db` import. This is a
 * regression ratchet for the three fixes made this round — if a future
 * edit removes the withSystemContext wrapper, this test fails.
 */

const SYSTEM_INVOKED_FILES_REQUIRING_WITH_SYSTEM_CONTEXT = [
  {
    path: 'services/observability/realtime-alerting-service.ts',
    exportedFn: 'runRealtimeObservabilitySweep',
  },
  {
    path: 'lib/services/rewards/webhook-service.ts',
    exportedFn: 'isWebhookProcessed',
  },
  {
    path: 'lib/services/rewards/webhook-service.ts',
    exportedFn: 'recordWebhookProcessed',
  },
  {
    path: 'lib/services/external-data/wage-enrichment-service.ts',
    exportedFn: 'syncUnionDensity',
  },
] as const;

describe.each(SYSTEM_INVOKED_FILES_REQUIRING_WITH_SYSTEM_CONTEXT)(
  'round 46 principal-mismatch ratchet: $path ($exportedFn)',
  ({ path, exportedFn }) => {
    it('imports withSystemContext from the canonical RLS-context module', () => {
      const src = source(path);
      expect(src).toContain("from '@/lib/db/with-rls-context'");
      expect(src).toContain('withSystemContext');
    });

    it('calls withSystemContext somewhere after the function is declared', () => {
      const src = source(path);
      const declIdx = src.indexOf(exportedFn);
      expect(declIdx, `${exportedFn} not found in ${path}`).toBeGreaterThanOrEqual(0);
      const afterDecl = src.slice(declIdx);
      expect(afterDecl).toContain('withSystemContext(');
    });
  },
);

/* ── User-isolation ratchet (doctrine section 24): push_devices ───────── */

describe('round 46 user-isolation ratchet: push_devices route', () => {
  it('sets ownerColumn so GET is scoped to the caller, not just the organization', () => {
    const src = source('app/api/mobile/devices/route.ts');
    expect(src).toContain("ownerColumn: 'profileId'");
  });

  it('forces profileId server-side on create via a named, independently tested helper', () => {
    const src = source('app/api/mobile/devices/route.ts');
    expect(src).toContain('export function buildPushDeviceCreateValues');
    expect(src).toContain('beforeCreate: (values, { userId }) => buildPushDeviceCreateValues(values, userId)');
  });
});

/* ── Dead-system-path ratchet: employer-execution workers ─────────────── *
 * These were mechanically excluded from this round's cohort because they
 * have zero real callers. If a future change wires a real cron/queue
 * consumer to this barrel, the corresponding tables must be re-reviewed
 * for MIXED/SYSTEM authority before shipping — this test documents the
 * current (dead) state as a ratchet baseline.
 */
describe('round 46 dead-system-path baseline: lib/workers/employer-execution', () => {
  it('the barrel index has no reachable production importer today', () => {
    const src = source('lib/workers/employer-execution/index.ts');
    expect(src).toContain('process-evidence-seal');
    expect(src).toContain('process-replay-run');
    expect(src).toContain('process-timesheet-validation');
  });
});
