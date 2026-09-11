/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 41: DIRECT_ORG_RUNTIME_BATCH — a mechanically derived
 * cohort of ordinary, direct-organization tenant tables (the
 * SIMPLE_TENANT:org:HIGH lane from scripts/generate-storage-authority-census.ts).
 *
 * Of the 27 candidates in that lane, 12 proved to be a clean archetype fit
 * (direct org ownership, TENANT_USER invocation, TENANT_RUNTIME execution,
 * no system/worker authority, no multi-party/parent complexity, no
 * credential special handling) and are closed here. The other 15 were
 * ejected to the round-41 exception queue (see the closing report) for
 * reasons including: dual authority roots with materially different
 * principals (pilot_enrollments/pilot_milestones — a platform-admin
 * cross-org overview route alongside the ordinary tenant route;
 * pilot_checklist_items — a bootstrap route provisioning a fixed non-caller
 * pilot org), unresolved TS/Django reachability ambiguity from an earlier
 * round (ai_budgets), credential-shaped special handling (sso_providers),
 * and a separate-service dual-schema concern (the 10 tables also declared
 * in services/financial-service's own schema).
 *
 * Two concrete defects were found and fixed as part of closing this batch:
 *   1. employer_contacts: POST accepted a client-supplied employerId (no
 *      DB-level FK) with no verification it belonged to the caller's
 *      organization — fixed with an ownership check before insert.
 *   2. policy_rules: PolicyEngine.evaluate() read active policy rules with
 *      NO organizationId predicate at all (a gap round 40 had flagged but
 *      left open) — fixed by threading organizationId through evaluate()
 *      and the route.
 * Two Django-side exposure gaps were also found and contained via
 * DenyAllPermission: api_integrations and organizer_tasks.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { storageAuthorityManifest } from '../rls-storage-authority-manifest';
import { findDjangoModel, toPascalCase } from '../../scripts/generate-storage-authority-census';

const APP_ROOT = resolve(__dirname, '..', '..');

interface ClosedRow {
  table: string;
  runtime: readonly string[];
}

const CLOSED_COHORT: ClosedRow[] = [
  { table: 'employer_execution_profiles', runtime: ['SELECT'] },
  { table: 'api_integrations', runtime: ['SELECT', 'UPDATE', 'DELETE'] },
  { table: 'ingestion_batches', runtime: ['SELECT', 'INSERT', 'UPDATE'] },
  { table: 'break_policies', runtime: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { table: 'duplicate_groups', runtime: ['SELECT', 'INSERT', 'UPDATE'] },
  { table: 'employer_contacts', runtime: ['SELECT', 'INSERT'] },
  { table: 'exit_interviews', runtime: ['SELECT', 'INSERT', 'UPDATE'] },
  { table: 'organizer_tasks', runtime: ['SELECT', 'INSERT'] },
  { table: 'pay_equity_exercises', runtime: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { table: 'pilot_demo_seeds', runtime: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { table: 'policy_rules', runtime: ['SELECT'] },
  { table: 'strategic_goals', runtime: ['SELECT'] },
];

describe.each(CLOSED_COHORT)('round 41 DIRECT_ORG_RUNTIME_BATCH: $table', ({ table, runtime }) => {
  it('is classified TENANT_RLS_REQUIRED with the proven authority shape', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === table);
    expect(entry, `${table}: no manifest entry found`).toBeTruthy();
    expect(entry!.classification).toBe('TENANT_RLS_REQUIRED');
    expect(entry!.requiredRuntimePrivileges).toEqual(runtime);
    expect(entry!.requiredSystemPrivileges).toEqual([]);
    expect(entry!.invocationAuthority).toBe('TENANT_USER');
    expect(entry!.dbExecutionPrincipal).toBe('TENANT_RUNTIME');
  });
});

describe('round 41: no TBD authority fields remain on the closed cohort', () => {
  it.each(CLOSED_COHORT)('$table has no TBD fields', ({ table }) => {
    const entry = storageAuthorityManifest.find((e) => e.table === table);
    expect(entry!.requiredRuntimePrivileges).not.toBe('TBD');
    expect(entry!.requiredSystemPrivileges).not.toBe('TBD');
    expect(entry!.invocationAuthority).not.toBe('TBD');
    expect(entry!.dbExecutionPrincipal).not.toBe('TBD');
  });
});

describe('round 41 Django containment fixes', () => {
  it('api_integrations and organizer_tasks Django ViewSets use DenyAllPermission', () => {
    for (const [table, viewSetFile] of [
      ['api_integrations', 'backend/core/views.py'],
      ['organizer_tasks', 'backend/unions/views.py'],
    ] as const) {
      const django = findDjangoModel(toPascalCase(table));
      expect(django, `${table}: no Django model found`).toBeTruthy();
      expect(django!.routerRegistered, `${table}: should remain router-registered`).toBe(true);
      expect(django!.usesDenyAll, `${table}: must use DenyAllPermission`).toBe(true);
      expect(django!.viewSetFile).toBe(viewSetFile);
    }
  });
});

describe('round 41 defect fix: employer_contacts verifies employer ownership before insert', () => {
  it('rejects employerId not belonging to the caller organization before insert', () => {
    const src = readFileSync(
      resolve(APP_ROOT, 'app/api/employers/communications/contacts/route.ts'),
      'utf8',
    );
    expect(src).toMatch(/eq\(employers\.id,\s*data\.employerId\)/);
    expect(src).toMatch(/eq\(employers\.organizationId,\s*organizationId\)/);
    // The ownership check must run before the insert, not after.
    const checkIndex = src.indexOf('eq(employers.id, data.employerId)');
    const insertIndex = src.indexOf('.insert(employerContacts)');
    expect(checkIndex).toBeGreaterThan(-1);
    expect(insertIndex).toBeGreaterThan(-1);
    expect(checkIndex).toBeLessThan(insertIndex);
  });
});

describe('round 41 defect fix: policy_rules evaluation is organization-scoped', () => {
  it('PolicyEngine.evaluate requires organizationId and filters by it', () => {
    const src = readFileSync(resolve(APP_ROOT, 'lib/services/policy-engine.ts'), 'utf8');
    expect(src).toMatch(/async evaluate\(\s*organizationId:\s*string/);
    expect(src).toMatch(/eq\(policyRules\.organizationId,\s*organizationId\)/);
  });

  it('the evaluate route requires and forwards the trusted organizationId', () => {
    const src = readFileSync(
      resolve(APP_ROOT, 'app/api/governance/policies/evaluate/route.ts'),
      'utf8',
    );
    expect(src).toMatch(/organizationId\s*}\s*\)\s*=>/);
    expect(src).toMatch(/policyEngine\.evaluate\(\s*organizationId/);
  });
});

describe('round 41 defect fix: sso_providers no longer echoes raw credential material', () => {
  it('GET response never returns the raw client secret or certificate', () => {
    const src = readFileSync(
      resolve(APP_ROOT, 'app/api/enterprise/sso/providers/route.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/return providers;/);
    expect(src).toMatch(/samlCertificate,\s*oidcClientSecret,\s*\.\.\.safe/);
  });
});
