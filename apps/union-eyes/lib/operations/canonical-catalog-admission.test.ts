import { describe, expect, it } from 'vitest'
import base from './catalog-authority-contract.json'
import { assessCatalogAdmission, catalogContractDigest } from './catalog-admission-core.mjs'
import { canonicalCatalogContract, inspectCanonicalAuthCatalog } from './canonical-catalog-admission'

const canonical = canonicalCatalogContract()
const safeRole = { rolsuper: false, rolbypassrls: false, rolcreatedb: false, rolcreaterole: false }
function snapshots() {
  return {
    roles: ['union_eyes_runtime', 'union_eyes_system'].map(rolname => ({ rolname, ...safeRole })),
    schemaUsage: [
      ...base.payload.runtimeSchemaUsage.map(nspname => ({ rolname: 'union_eyes_runtime', nspname })),
      { rolname: 'union_eyes_system', nspname: 'public' },
    ],
  }
}
const approvedFunction = {
  nspname: 'user_management', proname: 'auth_business_org_authorized', owner: 'nzila_auth_org_authority_reader',
  proconfig: ['search_path=pg_catalog'], runtime_execute: true, system_execute: false, public_execute: false,
}

describe('canonical catalog admission', () => {
  it('preserves every public manifest privilege and the original legacy contract', () => {
    expect(canonical.payload.entries.slice(0, base.payload.entries.length)).toEqual(base.payload.entries)
    expect(catalogContractDigest(base.payload)).toBe(base.digest)
    expect(catalogContractDigest(canonical.payload)).toBe(canonical.digest)
    expect(canonical.payload.nonPublic.filter(row => row.schema === 'user_management')
      .every(row => row.runtime.length === 0 && row.system.length === 0)).toBe(true)
    expect(base.payload.nonPublic.find(row => row.table === 'users')?.runtime).toEqual(['SELECT'])
  })

  it('does not repair or re-sign a corrupt packaged contract', () => {
    const corrupt = { ...base, digest: '0'.repeat(64) }
    expect(canonicalCatalogContract(corrupt)).toBe(corrupt)
    expect(assessCatalogAdmission(canonicalCatalogContract(corrupt), snapshots()).ok).toBe(false)
  })

  it('admits only the source-approved runtime definer with exact owner and execution scope', () => {
    expect(assessCatalogAdmission(canonical, { ...snapshots(), definers: [approvedFunction] }).violations).toEqual([])
    for (const change of [
      { owner: 'nzilaadmin' }, { proconfig: ['search_path=public'] }, { public_execute: true },
      { system_execute: true }, { runtime_execute: false }, { proname: 'unapproved_helper' },
    ]) {
      expect(assessCatalogAdmission(canonical, { ...snapshots(), definers: [{ ...approvedFunction, ...change }] }).ok).toBe(false)
    }
    expect(assessCatalogAdmission(base, { ...snapshots(), definers: [approvedFunction] }).violations
      .some(message => message.includes('SECURITY DEFINER'))).toBe(true)
  })

  it('continues rejecting broad public grants and legacy runtime access to raw profiles', () => {
    for (const relation of [
      { schema_name: 'public', table_name: 'ab_test_assignments', runtime: ['SELECT'], system: [] },
      { schema_name: 'user_management', table_name: 'users', runtime: ['SELECT'], system: [] },
    ]) {
      expect(assessCatalogAdmission(canonical, { ...snapshots(), relations: [{ ...relation, relkind: 'r', relrowsecurity: true, relforcerowsecurity: true }] }).violations
        .some(message => message.includes('privileges are'))).toBe(true)
    }
  })

  it('rejects an extra sensitive column even for an approved auth execution role', () => {
    const result = assessCatalogAdmission(canonical, { ...snapshots(), columnGrants: [{
      schema_name: 'user_management', table_name: 'users', column_name: 'password_hash',
      role_name: 'nzila_auth_system_mutation', privilege_type: 'UPDATE',
    }] })
    expect(result.violations).toContain('user_management.users.password_hash has an unapproved column ACL (nzila_auth_system_mutation UPDATE)')
  })

  it('requires actual canonical roles, relations and functions rather than admitting an empty inspection', async () => {
    const violations = await inspectCanonicalAuthCatalog(async () => [])
    expect(violations).toContain('nzila_auth_gateway: unsafe or missing canonical role/schema authority')
    expect(violations).toContain('users: canonical auth relation is absent')
    expect(violations).toContain('auth_provider_binding: missing or overloaded canonical function')
  })
})
