/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 39: parameterized cohort matrix proving the
 * SIMPLE_TENANT:org external-integration adapter cohort's dispositions
 * mechanically, rather than one bespoke test file per table — see
 * scripts/generate-storage-authority-census.ts's "close by cohort, not
 * one table at a time" doctrine (round 38) and this round's evidence
 * matrix in the round-39 closing report.
 *
 * Scope: 18 tables from db/rls-storage-authority/integrations-workers.ts
 * spanning accounting (external_customers/invoices/payments), HRIS
 * (external_employees/positions/departments), insurance/benefits
 * (external_benefit_*, external_insurance_*), and LMS (external_lms_*)
 * external-data mirrors. All 18 share the same TS orchestration layer
 * (lib/integrations/factory.ts + sync-engine.ts + webhook-router.ts),
 * independently proven this round to be entirely dead in production:
 * IntegrationFactory.getIntegration()'s sole call site,
 * lib/graphql/resolvers.ts, is itself unreachable (zero importers
 * anywhere outside its own test, no GraphQL server/route wires it) and
 * uses a hardcoded 'org_123' literal; SyncEngine/WebhookRouter are only
 * ever instantiated via lib/integrations/index.ts's
 * initializeIntegrationFramework(), which has zero production callers
 * and is documented by its own test as unconditionally throwing at
 * runtime. 17 of the 18 tables have no other real TS reference and no
 * real Django consumer either (their ExternalXViewSet in
 * backend/core/views.py was router-registered but unscoped and
 * IsAuthenticated-only — contained this round via DenyAllPermission,
 * see backend/core/isolation.py) -> CONTAINED_NO_AUTHORITY.
 *
 * external_invoices is the cohort's one exception: it has a REAL,
 * legitimate, already-audited live path
 * (app/api/billing/invoices/route.ts, a lib/api/crud-factory.ts
 * orgScoped collection route, SELECT+INSERT only — no PATCH/DELETE
 * route exists) -> TENANT_RLS_REQUIRED. Its own Django ViewSet has zero
 * legitimate consumer of its own and is contained the same way as the
 * other 17 (a legitimate TS path does not justify an unscoped Django
 * endpoint for the same table).
 *
 * Any future cohort promotion in this family should extend COHORT below
 * rather than add a new standalone test file.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { storageAuthorityManifest } from '../rls-storage-authority-manifest';
import { toPascalCase, findDjangoModel, realImporterFiles } from '../../scripts/generate-storage-authority-census';

const APP_ROOT = resolve(__dirname, '..', '..');
const DJANGO_APP_FILE = 'backend/core/views.py';

interface CohortRow {
  table: string;
}

const CONTAINED_COHORT: CohortRow[] = [
  { table: 'external_benefit_coverage' },
  { table: 'external_benefit_dependents' },
  { table: 'external_benefit_enrollments' },
  { table: 'external_benefit_plans' },
  { table: 'external_benefit_utilization' },
  { table: 'external_customers' },
  { table: 'external_departments' },
  { table: 'external_employees' },
  { table: 'external_insurance_beneficiaries' },
  { table: 'external_insurance_policies' },
  { table: 'external_lms_completions' },
  { table: 'external_lms_courses' },
  { table: 'external_lms_enrollments' },
  { table: 'external_lms_learners' },
  { table: 'external_lms_progress' },
  { table: 'external_payments' },
  { table: 'external_positions' },
];

function tableToCamelExportName(table: string): string {
  return table.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

describe('round 39 shared evidence: lib/graphql/resolvers.ts is dead code', () => {
  it('has zero importers anywhere in the app outside its own test file', () => {
    // This is the sole non-adapter TS reference to external_insurance_policies,
    // and the sole production call site of IntegrationFactory.getIntegration()
    // (with a hardcoded 'org_123' literal). If this module ever gains a real
    // importer (a GraphQL server/route wiring it up), every CONTAINED_NO_AUTHORITY
    // disposition in this cohort that relies on resolvers.ts being dead must be
    // re-reviewed before shipping.
    const importers = realImporterFiles('lib/graphql/resolvers', ['*.ts', '*.tsx']).filter(
      (f) => f !== 'lib/graphql/resolvers.ts',
    );
    expect(importers).toEqual([]);
  });
});

describe.each(CONTAINED_COHORT)('round 39 CONTAINED_NO_AUTHORITY cohort: $table', ({ table }) => {
  it('is classified CONTAINED_NO_AUTHORITY with the strict-zero authority shape', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === table);
    expect(entry, `${table}: no manifest entry found`).toBeTruthy();
    expect(entry!.classification).toBe('CONTAINED_NO_AUTHORITY');
    expect(entry!.requiredRuntimePrivileges).toEqual([]);
    expect(entry!.requiredSystemPrivileges).toEqual([]);
    expect(entry!.invocationAuthority).toBe('NONE');
    expect(entry!.dbExecutionPrincipal).toBe('NONE');
    expect(entry!.reviewPriority).toBe('NONE');
  });

  it('the Django ViewSet is router-registered (reachable) but uses an unconditional deny-all permission', () => {
    const pascalName = toPascalCase(table);
    const django = findDjangoModel(pascalName);
    expect(django, `${table}: no Django model found for ${pascalName}`).toBeTruthy();
    expect(django!.modelFile).toBe(DJANGO_APP_FILE.replace('views.py', 'models.py'));
    expect(django!.routerRegistered, `${table}: Django ViewSet must remain reachable (router-registered), not merely absent`).toBe(true);
    expect(django!.usesDenyAll, `${table}: Django ViewSet must use an unconditional deny-all permission`).toBe(true);
  });

  it('has zero real production TS/TSX consumers of the table\'s Drizzle export (reachability ratchet)', () => {
    // If this ever finds a real importer outside the dead orchestration
    // layer proven this round (lib/integrations/adapters/** and
    // lib/graphql/resolvers.ts, which has zero importers of its own
    // anywhere and is never wired to any GraphQL server/route — see the
    // 'external_invoices' exception block below for the one table where
    // resolvers.ts's own reachability was traced in full), CONTAINED_NO_AUTHORITY
    // is automatically invalidated per its doctrine (types.ts) and this
    // entry must revert to NEEDS_REVIEW before shipping.
    const camelName = tableToCamelExportName(table);
    const importers = realImporterFiles(`\\b${camelName}\\b`, ['*.ts', '*.tsx']).filter(
      (f) => !f.startsWith('lib/integrations/adapters/') && f !== 'lib/graphql/resolvers.ts',
    );
    expect(importers, `${table}: a new production consumer appeared outside the dead orchestration layer — CONTAINED_NO_AUTHORITY is invalidated, revert to NEEDS_REVIEW`).toEqual([]);
  });

  it('the Django ViewSet source uses DenyAllPermission, matching the manifest reason', () => {
    const src = readFileSync(resolve(APP_ROOT, DJANGO_APP_FILE), 'utf8');
    const pascalName = toPascalCase(table);
    const viewSetName = `${pascalName}ViewSet`;
    const classStart = src.indexOf(`class ${viewSetName}(`);
    expect(classStart, `${table}: ${viewSetName} not found in ${DJANGO_APP_FILE}`).toBeGreaterThan(-1);
    const nextClassStart = src.indexOf('\nclass ', classStart + 1);
    const classBlock = src.slice(classStart, nextClassStart === -1 ? undefined : nextClassStart);
    expect(classBlock).toMatch(/permission_classes\s*=\s*\[\s*DenyAllPermission\s*\]/);
  });
});

describe('round 39 exception: external_invoices (TENANT_RLS_REQUIRED, real live path)', () => {
  const table = 'external_invoices';

  it('is classified TENANT_RLS_REQUIRED with the minimum proven DML set (SELECT+INSERT only)', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === table);
    expect(entry, `${table}: no manifest entry found`).toBeTruthy();
    expect(entry!.classification).toBe('TENANT_RLS_REQUIRED');
    expect(entry!.requiredRuntimePrivileges).toEqual(['SELECT', 'INSERT']);
    expect(entry!.requiredSystemPrivileges).toEqual([]);
    expect(entry!.invocationAuthority).toBe('TENANT_USER');
    expect(entry!.dbExecutionPrincipal).toBe('TENANT_RUNTIME');
  });

  it('has a real, org-scoped crud-factory route as its sole legitimate consumer', () => {
    const routeSrc = readFileSync(resolve(APP_ROOT, 'app/api/billing/invoices/route.ts'), 'utf8');
    expect(routeSrc).toMatch(/table:\s*externalInvoices/);
    expect(routeSrc).toMatch(/orgScoped:\s*true/);
    // No item route (PATCH/DELETE) exists for this resource.
    expect(routeSrc).not.toMatch(/PATCH|DELETE/);
  });

  it('has no PATCH/DELETE item route for external_invoices', () => {
    const importers = realImporterFiles('\\bexternalInvoices\\b', ['*.ts', '*.tsx']).filter(
      (f) => f.startsWith('app/api/') && f !== 'app/api/billing/invoices/route.ts',
    );
    expect(importers, `${table}: a second HTTP route appeared for this table — re-verify its DML shape`).toEqual([]);
  });

  it('the Django ViewSet for external_invoices is separately contained via DenyAllPermission (a legitimate TS path does not justify an unscoped Django endpoint)', () => {
    const pascalName = toPascalCase(table);
    const django = findDjangoModel(pascalName);
    expect(django, `${table}: no Django model found for ${pascalName}`).toBeTruthy();
    expect(django!.routerRegistered).toBe(true);
    expect(django!.usesDenyAll).toBe(true);
  });
});
