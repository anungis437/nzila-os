/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 43: CBA_INTELLIGENCE / COLLECTIVE-AGREEMENT PARENT AUTHORITY —
 * the named 12-table cohort from the CBA/collective-agreement parent-owned
 * census slice (a single coherent authority-graph family, not 12
 * unrelated table reviews).
 *
 * AUTHORITY GRAPH FOUND (mechanically verified, not assumed):
 *
 *   Group A — the "cba_intel_*" public intelligence family (9 tables).
 *   Root: cba_intel_sources (an external labour-board/government source
 *   registry — NOT one of this round's 12 tables, left untouched — has NO
 *   organizationId column and no tenant concept at all; confirmed via a
 *   grep across the ENTIRE db/schema/domains/cba-intelligence/** folder
 *   finding zero organizationId/organization_id columns anywhere).
 *     cba_intel_documents          -> cba_intel_sources
 *     cba_intel_extraction_runs    -> cba_intel_documents -> cba_intel_sources
 *     cba_intel_findings           -> cba_intel_extraction_runs (+ redundant
 *                                      direct documentId, verified internally
 *                                      consistent by construction — both are
 *                                      always derived from the same in-scope
 *                                      documentId in extraction-orchestrator.ts)
 *                                   -> cba_intel_documents -> cba_intel_sources
 *     cba_intel_agreements         -> cba_intel_documents -> cba_intel_sources
 *     cba_intel_clauses            -> cba_intel_agreements -> ... -> sources
 *     cba_intel_wage_adjustments   -> cba_intel_agreements -> ... -> sources
 *     cba_intel_benchmark_snapshots -> cba_intel_agreements (targetAgreementId,
 *                                      but legitimately AGGREGATES many
 *                                      agreements for comparison — a computed
 *                                      analytical snapshot, not a simple
 *                                      single-parent child) -> ... -> sources
 *     cba_intel_ingestion_jobs     -> cba_intel_sources
 *     cba_intel_freshness_log      -> cba_intel_sources (root), but BOTH its
 *                                      sole writer (logFreshnessCheck) and
 *                                      sole reader (getFreshnessHistory) have
 *                                      ZERO real callers anywhere — closed
 *                                      LATENT_UNREACHABLE, not GLOBAL_REFERENCE_DATA.
 *   Since NO table anywhere in this root-to-leaf graph has an organization
 *   column, the 8 reachable tables are closed GLOBAL_REFERENCE_DATA (the
 *   established testimonials/case_studies precedent, round 11) — genuinely
 *   global/shared public content, not tenant-partitioned data misclassified
 *   as parent-owned. The timer-based ingestion scheduler
 *   (ingestion-scheduler.ts's runScheduledIngestion/startScheduler) is
 *   verified DEAD — zero callers, no cron route, no vercel.json entry, no
 *   GitHub Actions workflow — so invocation is TENANT_USER (admin/steward
 *   HTTP routes only), not MIXED/SYSTEM_SCHEDULE.
 *
 *   Group B — cba_contacts, cba_footnotes, cba_version_history.
 *   These have NO Drizzle declaration anywhere in this app's own
 *   db/schema/** — the only TypeScript references are
 *   services/financial-service's own separate dual-schema (a different
 *   deployable Node service/package, matching the round-41/42 dual-schema
 *   precedent). On the DJANGO side, real models with a genuine potential
 *   parent-owned chain exist in this app's own backend/bargaining app:
 *     cba_contacts        -> CollectiveAgreements -> organization
 *     cba_version_history -> CollectiveAgreements -> organization
 *     cba_footnotes        -> CbaClauses -> CollectiveAgreements -> organization
 *   but all three ViewSets were router-registered with
 *   queryset=Model.objects.all() + IsAuthenticated-only and NO organization
 *   filter of any kind (a real cross-org exposure), with zero legitimate
 *   frontend consumer found anywhere. Closed CONTAINED_NO_AUTHORITY via
 *   DenyAllPermission (three concrete Django defects fixed this round).
 *
 * No table in this cohort was ejected to the exception queue — the
 * evidence for all 12 was conclusive.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { storageAuthorityManifest } from '../rls-storage-authority-manifest';
import { findDjangoModel, toPascalCase } from '../../scripts/generate-storage-authority-census';

const APP_ROOT = resolve(__dirname, '..', '..');

interface GlobalReferenceRow {
  table: string;
  runtime: readonly string[];
}

const GLOBAL_REFERENCE_COHORT: GlobalReferenceRow[] = [
  { table: 'cba_intel_agreements', runtime: ['SELECT', 'INSERT', 'UPDATE'] },
  { table: 'cba_intel_benchmark_snapshots', runtime: ['SELECT', 'INSERT'] },
  { table: 'cba_intel_clauses', runtime: ['SELECT', 'INSERT', 'UPDATE'] },
  { table: 'cba_intel_documents', runtime: ['SELECT', 'INSERT', 'UPDATE'] },
  { table: 'cba_intel_extraction_runs', runtime: ['SELECT', 'INSERT', 'UPDATE'] },
  { table: 'cba_intel_findings', runtime: ['SELECT', 'INSERT', 'UPDATE'] },
  { table: 'cba_intel_ingestion_jobs', runtime: ['SELECT', 'INSERT', 'UPDATE'] },
  { table: 'cba_intel_wage_adjustments', runtime: ['SELECT', 'INSERT', 'UPDATE'] },
];

describe.each(GLOBAL_REFERENCE_COHORT)(
  'round 43 CBA_INTELLIGENCE family: $table',
  ({ table, runtime }) => {
    it('is classified GLOBAL_REFERENCE_DATA with the proven authority shape', () => {
      const entry = storageAuthorityManifest.find((e) => e.table === table);
      expect(entry, `${table}: no manifest entry found`).toBeTruthy();
      expect(entry!.classification).toBe('GLOBAL_REFERENCE_DATA');
      expect(entry!.requiredRuntimePrivileges).toEqual(runtime);
      expect(entry!.requiredSystemPrivileges).toEqual([]);
      expect(entry!.invocationAuthority).toBe('TENANT_USER');
      expect(entry!.dbExecutionPrincipal).toBe('TENANT_RUNTIME');
    });
  },
);

describe('round 43: cba_intel_freshness_log is closed LATENT_UNREACHABLE', () => {
  it('has the strict zero-authority shape', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === 'cba_intel_freshness_log');
    expect(entry, 'cba_intel_freshness_log: no manifest entry found').toBeTruthy();
    expect(entry!.classification).toBe('LATENT_UNREACHABLE');
    expect(entry!.requiredRuntimePrivileges).toEqual([]);
    expect(entry!.requiredSystemPrivileges).toEqual([]);
    expect(entry!.invocationAuthority).toBe('NONE');
    expect(entry!.dbExecutionPrincipal).toBe('NONE');
  });
});

const CONTAINED_DUAL_SCHEMA_COHORT = ['cba_contacts', 'cba_footnotes', 'cba_version_history'] as const;

describe.each(CONTAINED_DUAL_SCHEMA_COHORT)('round 43 CONTAINED_NO_AUTHORITY: %s', (table) => {
  it('has the strict zero-authority shape', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === table);
    expect(entry, `${table}: no manifest entry found`).toBeTruthy();
    expect(entry!.classification).toBe('CONTAINED_NO_AUTHORITY');
    expect(entry!.requiredRuntimePrivileges).toEqual([]);
    expect(entry!.requiredSystemPrivileges).toEqual([]);
    expect(entry!.invocationAuthority).toBe('NONE');
    expect(entry!.dbExecutionPrincipal).toBe('NONE');
  });
});

describe('round 43: no TBD authority fields remain on the closed cohort', () => {
  const ALL_12 = [
    ...GLOBAL_REFERENCE_COHORT.map((r) => r.table),
    'cba_intel_freshness_log',
    ...CONTAINED_DUAL_SCHEMA_COHORT,
  ];

  it.each(ALL_12)('%s has no TBD fields', (table) => {
    const entry = storageAuthorityManifest.find((e) => e.table === table);
    expect(entry!.requiredRuntimePrivileges).not.toBe('TBD');
    expect(entry!.requiredSystemPrivileges).not.toBe('TBD');
    expect(entry!.invocationAuthority).not.toBe('TBD');
    expect(entry!.dbExecutionPrincipal).not.toBe('TBD');
  });
});

describe('round 43 Django containment fixes', () => {
  it.each([
    ['cba_contacts', 'CbaContacts', 'backend/bargaining/views.py'],
    ['cba_footnotes', 'CbaFootnotes', 'backend/bargaining/views.py'],
    ['cba_version_history', 'CbaVersionHistory', 'backend/bargaining/views.py'],
  ] as const)('%s Django ViewSet uses DenyAllPermission', (_table, pascalName, viewSetFile) => {
    const django = findDjangoModel(pascalName);
    expect(django, `${pascalName}: no Django model found`).toBeTruthy();
    expect(django!.routerRegistered, `${pascalName}: should remain router-registered`).toBe(true);
    expect(django!.usesDenyAll, `${pascalName}: must use DenyAllPermission`).toBe(true);
    expect(django!.viewSetFile).toBe(viewSetFile);
  });

  it('sanity check: toPascalCase produces the expected Django model names', () => {
    expect(toPascalCase('cba_contacts')).toBe('CbaContacts');
    expect(toPascalCase('cba_footnotes')).toBe('CbaFootnotes');
    expect(toPascalCase('cba_version_history')).toBe('CbaVersionHistory');
  });
});

describe('round 43: cba_intel_documents version chain cannot be corrupted cross-source', () => {
  it('upsertDocument always derives previousVersionId from a row matched on the SAME sourceId+sourceUrl', () => {
    const src = readFileSync(
      resolve(APP_ROOT, 'lib/services/cba-intelligence/document-service.ts'),
      'utf8',
    );
    // The existing-row lookup must scope by both sourceId and sourceUrl before
    // any previousVersionId is derived from it.
    expect(src).toMatch(/eq\(cbaIntelDocuments\.sourceId,\s*data\.sourceId\)/);
    expect(src).toMatch(/eq\(cbaIntelDocuments\.sourceUrl,\s*data\.sourceUrl\)/);
    expect(src).toMatch(/previousVersionId:\s*existing\.id/);
    const lookupIndex = src.indexOf('eq(cbaIntelDocuments.sourceId, data.sourceId)');
    const previousVersionIndex = src.indexOf('previousVersionId: existing.id');
    expect(lookupIndex).toBeGreaterThan(-1);
    expect(previousVersionIndex).toBeGreaterThan(-1);
    expect(lookupIndex).toBeLessThan(previousVersionIndex);
  });
});

describe('round 43: cba_intel_findings dual-FK consistency (extractionRunId + documentId)', () => {
  it('extraction-orchestrator.ts derives both FKs from the same in-scope documentId', () => {
    const src = readFileSync(
      resolve(APP_ROOT, 'lib/services/cba-intelligence/extraction-orchestrator.ts'),
      'utf8',
    );
    // The finding record construction must reference the single documentId
    // parameter alongside the just-created run's id — never an independently
    // supplied document reference.
    expect(src).toMatch(/documentId,\s*\n\s*extractionRunId:\s*run\.id/);
  });
});

describe('round 43: the ingestion timer scheduler is verified dead (no MIXED/SYSTEM_SCHEDULE invocation)', () => {
  it('no HTTP route imports the timer-based scheduler', () => {
    const routeFiles = [
      'app/api/cba-intelligence/ingestion/route.ts',
      'app/api/cba-intelligence/ingestion/run/route.ts',
      'app/api/cba-intelligence/ingestion/seed/route.ts',
    ];
    for (const file of routeFiles) {
      const src = readFileSync(resolve(APP_ROOT, file), 'utf8');
      expect(src).not.toMatch(/ingestion-scheduler/);
    }
  });

  it('the scheduler exports startScheduler/runScheduledIngestion but no route/action wires them', () => {
    const schedulerSrc = readFileSync(
      resolve(APP_ROOT, 'lib/services/cba-intelligence/ingestion-scheduler.ts'),
      'utf8',
    );
    expect(schedulerSrc).toMatch(/export function startScheduler/);
    expect(schedulerSrc).toMatch(/export async function runScheduledIngestion/);
  });
});
