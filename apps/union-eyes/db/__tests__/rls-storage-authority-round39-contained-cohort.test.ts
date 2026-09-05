/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 39 (ORIGINALLY): parameterized cohort matrix proving the
 * SIMPLE_TENANT:org external-integration adapter cohort's dispositions
 * mechanically, rather than one bespoke test file per table — see
 * scripts/generate-storage-authority-census.ts's "close by cohort, not
 * one table at a time" doctrine (round 38) and round 39's evidence matrix
 * in its closing report.
 *
 * STRUCTURAL CORRECTION (round 40 correction pass): round 39 proved 17 of
 * these 18 tables CONTAINED_NO_AUTHORITY because the ONLY orchestration
 * layer that existed at the time (lib/integrations/factory.ts +
 * sync-engine.ts + webhook-router.ts, wired only through the dead
 * lib/graphql/resolvers.ts / initializeIntegrationFramework() paths) was
 * genuinely unreachable — that finding was correct at its own boundary and
 * is preserved below as historical record (see 'round 39 shared evidence').
 *
 * Round 40 (PR #752) then built a NEW, genuinely live orchestration root,
 * lib/integrations/control-plane.ts, wired to app/api/integrations/framework/**,
 * which reopened reachability for all 17 tables through their respective
 * control-plane-approved adapters (lib/integrations/provider-policy.ts).
 * This file's cohort assertions were updated to match: REOPENED_COHORT below
 * now proves each table is TENANT_RLS_REQUIRED with the DML its specific
 * adapter actually performs (SELECT+INSERT+UPDATE for HRIS/accounting/
 * insurance adapters that do a findFirst existence check before writing;
 * INSERT+UPDATE only for the LMS adapter, which upserts via
 * onConflictDoUpdate with no separate SELECT).
 *
 * external_invoices remains the cohort's one table that was ALREADY
 * TENANT_RLS_REQUIRED before round 40, via its own independent real,
 * legitimate live path (app/api/billing/invoices/route.ts, a
 * lib/api/crud-factory.ts orgScoped collection route, SELECT+INSERT only —
 * no PATCH/DELETE route exists) — unaffected by this correction.
 *
 * Any future cohort change in this family should extend REOPENED_COHORT
 * below rather than add a new standalone test file.
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
  dml: readonly string[];
}

// SELECT+INSERT+UPDATE: adapter does a findFirst existence check, then
// insert-or-update (Workday/BambooHR/ADP HRIS, QuickBooks/Xero accounting,
// SunLife/Manulife insurance).
const REOPENED_SELECT_INSERT_UPDATE: CohortRow[] = [
  { table: 'external_benefit_coverage', dml: ['SELECT', 'INSERT', 'UPDATE'] },
  { table: 'external_benefit_dependents', dml: ['SELECT', 'INSERT', 'UPDATE'] },
  { table: 'external_benefit_enrollments', dml: ['SELECT', 'INSERT', 'UPDATE'] },
  { table: 'external_benefit_plans', dml: ['SELECT', 'INSERT', 'UPDATE'] },
  { table: 'external_benefit_utilization', dml: ['SELECT', 'INSERT', 'UPDATE'] },
  { table: 'external_customers', dml: ['SELECT', 'INSERT', 'UPDATE'] },
  { table: 'external_departments', dml: ['SELECT', 'INSERT', 'UPDATE'] },
  { table: 'external_employees', dml: ['SELECT', 'INSERT', 'UPDATE'] },
  { table: 'external_insurance_beneficiaries', dml: ['SELECT', 'INSERT', 'UPDATE'] },
  { table: 'external_insurance_policies', dml: ['SELECT', 'INSERT', 'UPDATE'] },
  { table: 'external_payments', dml: ['SELECT', 'INSERT', 'UPDATE'] },
  { table: 'external_positions', dml: ['SELECT', 'INSERT', 'UPDATE'] },
];

// INSERT+UPDATE only: LinkedIn Learning adapter upserts via
// .insert(...).onConflictDoUpdate({target:[orgId,provider,externalId]}),
// with no separate SELECT statement.
const REOPENED_INSERT_UPDATE_ONLY: CohortRow[] = [
  { table: 'external_lms_completions', dml: ['INSERT', 'UPDATE'] },
  { table: 'external_lms_courses', dml: ['INSERT', 'UPDATE'] },
  { table: 'external_lms_enrollments', dml: ['INSERT', 'UPDATE'] },
  { table: 'external_lms_learners', dml: ['INSERT', 'UPDATE'] },
  { table: 'external_lms_progress', dml: ['INSERT', 'UPDATE'] },
];

const REOPENED_COHORT: CohortRow[] = [...REOPENED_SELECT_INSERT_UPDATE, ...REOPENED_INSERT_UPDATE_ONLY];

function tableToCamelExportName(table: string): string {
  return table.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

describe('round 39 shared evidence: lib/graphql/resolvers.ts is dead code', () => {
  it('has zero importers anywhere in the app outside its own test file', () => {
    // Historical record: this was the sole non-adapter TS reference to
    // external_insurance_policies at the time of round 39, and the sole
    // production call site of the OLD IntegrationFactory.getIntegration()
    // path (with a hardcoded 'org_123' literal). It remains dead code —
    // round 40's live path is a SEPARATE orchestration root
    // (lib/integrations/control-plane.ts), not this module.
    const importers = realImporterFiles('lib/graphql/resolvers', ['*.ts', '*.tsx']).filter(
      (f) => f !== 'lib/graphql/resolvers.ts',
    );
    expect(importers).toEqual([]);
  });
});

describe.each(REOPENED_COHORT)('round 40 REOPENED cohort (was round-39 CONTAINED_NO_AUTHORITY): $table', ({ table, dml }) => {
  it('is classified TENANT_RLS_REQUIRED with the adapter-verified DML set', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === table);
    expect(entry, `${table}: no manifest entry found`).toBeTruthy();
    expect(entry!.classification).toBe('TENANT_RLS_REQUIRED');
    expect(entry!.requiredRuntimePrivileges).toEqual(dml);
    expect(entry!.requiredSystemPrivileges).toEqual([]);
    expect(entry!.invocationAuthority).toBe('TENANT_USER');
    expect(entry!.dbExecutionPrincipal).toBe('TENANT_RUNTIME');
    expect(entry!.reviewPriority).toBe('HIGH');
  });

  it('the Django ViewSet is router-registered (reachable) but uses an unconditional deny-all permission', () => {
    const pascalName = toPascalCase(table);
    const django = findDjangoModel(pascalName);
    expect(django, `${table}: no Django model found for ${pascalName}`).toBeTruthy();
    expect(django!.modelFile).toBe(DJANGO_APP_FILE.replace('views.py', 'models.py'));
    expect(django!.routerRegistered, `${table}: Django ViewSet must remain reachable (router-registered), not merely absent`).toBe(true);
    expect(django!.usesDenyAll, `${table}: Django ViewSet must use an unconditional deny-all permission`).toBe(true);
  });

  it('has zero real production TS/TSX consumers outside the control-plane-approved adapter and orchestration files (reachability ratchet)', () => {
    // The only legitimate consumers are: the table's specific adapter(s)
    // under lib/integrations/adapters/**, and the control-plane
    // orchestration root itself. If a NEW consumer appears outside those,
    // this table's authority must be re-reviewed before shipping.
    const camelName = tableToCamelExportName(table);
    const importers = realImporterFiles(`\\b${camelName}\\b`, ['*.ts', '*.tsx']).filter(
      (f) =>
        !f.startsWith('lib/integrations/adapters/') &&
        f !== 'lib/graphql/resolvers.ts' &&
        f !== 'lib/integrations/control-plane.ts' &&
        f !== 'db/schema/domains/data/hris.ts' &&
        f !== 'db/schema/domains/data/accounting.ts' &&
        f !== 'db/schema/domains/data/insurance.ts' &&
        f !== 'db/schema/domains/data/lms.ts',
    );
    expect(importers, `${table}: a new production consumer appeared outside the approved adapter/control-plane layer — re-review before shipping`).toEqual([]);
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

describe('round 39 exception (unaffected by round 40): external_invoices (TENANT_RLS_REQUIRED, real live path)', () => {
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

