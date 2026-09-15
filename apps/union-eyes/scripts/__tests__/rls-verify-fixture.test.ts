import { describe, expect, it } from 'vitest'
import { grievances } from '../../db/schema/domains/claims/grievances'
import { organizations } from '../../db/schema-organizations'
import {
  buildRlsVerifyGrievanceFixture,
  buildRlsVerifyOrganizationFixture,
  RLS_VERIFY_GRIEVANCE_FIXTURE_COLUMNS,
  RLS_VERIFY_ORGANIZATION_FIXTURE_COLUMNS,
  resolveBootstrapDatabaseUrl,
  resolveRuntimeDatabaseUrl,
  validateFullModePrincipalModel,
} from '../rls-verify'

function organizationColumns(): Record<string, { name: string; notNull: boolean; hasDefault: boolean }> {
  return (organizations as unknown as Record<symbol, unknown>)[Symbol.for('drizzle:Columns')] as Record<
    string,
    { name: string; notNull: boolean; hasDefault: boolean }
  >
}

function grievanceColumns(): Record<string, { name: string; notNull: boolean; hasDefault: boolean }> {
  return (grievances as unknown as Record<symbol, unknown>)[Symbol.for('drizzle:Columns')] as Record<
    string,
    { name: string; notNull: boolean; hasDefault: boolean }
  >
}

describe('RLS verifier organization fixture', () => {
  it('covers every required organizations column without a database default', () => {
    const requiredColumns = Object.values(organizationColumns())
      .filter((column) => column.notNull && !column.hasDefault)
      .map((column) => column.name)
      .sort()

    expect([...RLS_VERIFY_ORGANIZATION_FIXTURE_COLUMNS].sort()).toEqual(
      expect.arrayContaining(requiredColumns),
    )
  })

  it('builds a synthetic organization compatible with current required schema fields', () => {
    const id = '11111111-1111-4111-8111-111111111111'
    const fixture = buildRlsVerifyOrganizationFixture({
      id,
      name: 'UE_RA_TEST Org A',
      slug: 'ue-ra-test-org-a',
      runId: 'UE_RA_TEST',
    })

    expect(fixture).toMatchObject({
      id,
      name: 'UE_RA_TEST Org A',
      slug: 'ue-ra-test-org-a',
      organizationType: 'union',
      hierarchyPath: [id],
      hierarchyLevel: 0,
      status: 'active',
      settings: { rls_verify_fixture: true, run_id: 'UE_RA_TEST' },
    })
  })
})

describe('RLS verifier grievance fixture', () => {
  it('covers every required grievances column without a database default', () => {
    const requiredColumns = Object.values(grievanceColumns())
      .filter((column) => column.notNull && !column.hasDefault)
      .map((column) => column.name)
      .sort()

    expect([...RLS_VERIFY_GRIEVANCE_FIXTURE_COLUMNS].sort()).toEqual(
      expect.arrayContaining(requiredColumns),
    )
  })

  it('builds a synthetic grievance compatible with current required schema fields', () => {
    const id = '22222222-2222-4222-8222-222222222222'
    const organizationId = '11111111-1111-4111-8111-111111111111'
    const fixture = buildRlsVerifyGrievanceFixture({
      id,
      organizationId,
      runId: 'UE_RA_TEST',
      label: 'org-a',
    })

    expect(fixture).toEqual({
      id,
      grievanceNumber: 'UE_RA_TEST-org-a',
      type: 'other',
      title: 'UE_RA_TEST org-a',
      description: 'Synthetic RLS verifier grievance fixture for UE_RA_TEST / org-a.',
      organizationId,
    })
  })
})

describe('RLS verifier principal separation', () => {
  const runtime = {
    currentUser: 'union_eyes_runtime',
    rolsuper: false,
    rolbypassrls: false,
    rolcanlogin: true,
  }
  const bootstrap = {
    currentUser: 'migration_admin',
    rolsuper: false,
    rolbypassrls: false,
    rolcanlogin: true,
  }

  it('resolves the runtime URL only from runtime environment names', () => {
    expect(resolveRuntimeDatabaseUrl({ RLS_VERIFY_DATABASE_URL: 'runtime-url' })).toBe('runtime-url')
    expect(resolveRuntimeDatabaseUrl({ DATABASE_URL: 'database-url' })).toBe('database-url')
    expect(resolveRuntimeDatabaseUrl({ RLS_VERIFY_BOOTSTRAP_DATABASE_URL: 'bootstrap-url' })).toBeUndefined()
  })

  it('resolves the bootstrap URL from verifier or canonical admin environment names', () => {
    expect(resolveBootstrapDatabaseUrl({ RLS_VERIFY_BOOTSTRAP_DATABASE_URL: 'bootstrap-url' })).toBe('bootstrap-url')
    expect(resolveBootstrapDatabaseUrl({ RLS_ENFORCEMENT_ADMIN_DATABASE_URL: 'enforcement-admin-url' })).toBe('enforcement-admin-url')
    expect(resolveBootstrapDatabaseUrl({ RLS_MIGRATION_ADMIN_DATABASE_URL: 'migration-admin-url' })).toBe('migration-admin-url')
    expect(resolveBootstrapDatabaseUrl({ ADMIN_DATABASE_URL: 'admin-url' })).toBe('admin-url')
    expect(resolveBootstrapDatabaseUrl({ RLS_VERIFY_SYSTEM_DATABASE_URL: 'system-url' })).toBeUndefined()
  })

  it('accepts distinct bootstrap and runtime principals when runtime is unprivileged', () => {
    expect(validateFullModePrincipalModel({ runtime, bootstrap }).every((result) => result.pass)).toBe(true)
  })

  it('fails closed when bootstrap and runtime resolve to the same role', () => {
    const results = validateFullModePrincipalModel({ runtime, bootstrap: runtime })

    expect(results.find((result) => result.name.includes('bootstrap role differs'))?.pass).toBe(false)
  })

  it('fails closed when the runtime URL resolves to a privileged role', () => {
    const results = validateFullModePrincipalModel({
      runtime: { ...runtime, currentUser: 'migration_admin', rolsuper: true, rolbypassrls: true },
      bootstrap,
    })

    expect(results.filter((result) => !result.pass).map((result) => result.name)).toEqual(
      expect.arrayContaining([
        'full-mode runtime principal: connected as union_eyes_runtime',
        'full-mode runtime principal: NOSUPERUSER',
        'full-mode runtime principal: NOBYPASSRLS',
      ]),
    )
  })
})
