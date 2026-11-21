import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import base from './catalog-authority-contract.json'
import { assessCatalogAdmission, catalogContractDigest } from './catalog-admission-core.mjs'
import { canonicalCatalogContract, inspectCanonicalAuthCatalog } from './canonical-catalog-admission'
import { compileSecurity } from '../../scripts/bootstrap-v2/security'
import { compileAuthBootstrapSql } from '../../scripts/bootstrap-v2/auth-sql'
import { parseSql } from '../../scripts/lib/sql-census/parse'
import type { V2Plan } from '../../scripts/bootstrap-v2/source'

const canonical = canonicalCatalogContract()
// Classification/column fixtures isolate those checks; function authority has
// a separate real-producer fixture below, and complete native qualification.
const focusedPayload = {...canonical.payload,currentFunctions:[],requiredContainedParentPolicies:[],requiredPhysicalTriggers:[]}
const focused = {payload:focusedPayload,digest:catalogContractDigest(focusedPayload)}
let functionContract: typeof focused
let functionRow: Record<string,unknown>
const safeRole = { rolsuper: false, rolbypassrls: false, rolcreatedb: false, rolcreaterole: false }
function snapshots() {
  return {
    roles: ['union_eyes_runtime', 'union_eyes_system'].map(rolname => ({ rolname, ...safeRole })),
    schemaUsage: [
      ...canonical.payload.runtimeSchemaUsage.map(nspname => ({ rolname: 'union_eyes_runtime', nspname })),
      { rolname: 'union_eyes_system', nspname: 'public' },
    ],
  }
}
const approvedFunction = {
  nspname: 'user_management', proname: 'auth_business_org_authorized', owner: 'nzila_auth_org_authority_reader',
  proconfig: ['search_path=pg_catalog'], runtime_execute: true, system_execute: false, public_execute: false,
}

describe('canonical catalog admission', () => {
  beforeAll(async()=>{
    const parsed=await parseSql(compileAuthBootstrapSql({rolesPreprovisioned:true}))
    if(!parsed.ok) throw new Error('Current auth source must parse')
    const producer=parsed.statements.find(statement=>statement.CreateFunctionStmt?.funcname.at(-1)?.String.sval==='auth_business_org_authorized')!.CreateFunctionStmt
    const body=producer.options.find((option:Record<string,Record<string,unknown>>)=>option.DefElem.defname==='as').DefElem.arg.List.items[0].String.sval
    const spec=(canonical.payload as typeof canonical.payload & {currentFunctions:Record<string,unknown>[]}).currentFunctions.find(fn=>fn.name==='auth_business_org_authorized')!
    functionRow={...spec,body}
    const payload={...canonical.payload,currentFunctions:[spec],requiredContainedParentPolicies:[],requiredPhysicalTriggers:[]}
    functionContract={payload,digest:catalogContractDigest(payload)} as typeof focused
  })

  it('uses current source privileges and contains historical-only storage without changing the historical contract', () => {
    const root=path.resolve(import.meta.dirname,'../../../..')
    const plan=JSON.parse(readFileSync(path.join(root,'docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'),'utf8')) as V2Plan
    const rules=compileSecurity(plan).rules.filter(rule=>!rule.table.includes('.'))
    for(const rule of rules) expect(canonical.payload.entries.find(entry=>entry.table===rule.table)).toEqual({table:rule.table,classification:rule.classification,runtime:rule.runtimePrivileges,system:rule.systemPrivileges})
    for(const prior of base.payload.entries.filter(entry=>!rules.some(rule=>rule.table===entry.table)))
      expect(canonical.payload.entries.find(entry=>entry.table===prior.table)).toMatchObject({classification:'CONTAINED_NO_AUTHORITY',runtime:[],system:[]})
    expect(canonical.payload.entries.find(entry => entry.table === 'donations')).toMatchObject({
      classification: 'CONTAINED_NO_AUTHORITY', runtime: [], system: [],
    })
    expect(canonical.payload.entries.find(entry => entry.table === 'evidence_packs')).toMatchObject({ runtime: ['SELECT', 'INSERT', 'UPDATE'], system: ['SELECT'] })
    expect(base.payload.entries.find(entry => entry.table === 'donations')).toMatchObject({ classification: 'SEPARATE_DATABASE_BOUNDARY', runtime: [], system: [] })
    expect(canonical.payload.entries.find(entry => entry.table === 'ue_v2_bootstrap_receipt')).toMatchObject({ runtime: [], system: [] })
    expect(canonical.payload.runtimeSchemaUsage).toEqual(['public', 'user_management'])
    expect(catalogContractDigest(base.payload)).toBe(base.digest)
    expect(catalogContractDigest(canonical.payload)).toBe(canonical.digest)
    expect(canonical.payload.nonPublic.filter(row => row.schema === 'user_management')
      .every(row => row.runtime.length === 0 && row.system.length === 0)).toBe(true)
    expect(base.payload.nonPublic.find(row => row.table === 'users')?.runtime).toEqual(['SELECT'])
  })

  it('preserves fail-closed current-source geometry and rejects grants to unresolved features', () => {
    for (const table of ['arbitration_decisions', 'signature_audit_trail']) {
      expect(canonical.payload.entries.find(entry => entry.table === table)).toMatchObject({
        classification: 'CONTAINED_NO_AUTHORITY', runtime: [], system: [],
      })
      expect(base.payload.entries.find(entry => entry.table === table)?.runtime.length).toBeGreaterThan(0)
      const relation = { schema_name: 'public', table_name: table, relkind: 'r', relrowsecurity: true, relforcerowsecurity: true }
      expect(assessCatalogAdmission(focused, { ...snapshots(), relations: [{ ...relation, runtime: [], system: [] }] }).ok).toBe(true)
      expect(assessCatalogAdmission(focused, { ...snapshots(), relations: [{ ...relation, runtime: ['SELECT'], system: [] }] }).ok).toBe(false)
    }
  })

  it('grants these service reads only as exact column SELECTs, never table-level', () => {
    // commercial_contracts: the system role has no privilege at all (native matrix asserts 42501 for
    // every statement); the runtime reads exactly four module-admission columns.
    const contracts = canonical.payload.entries.find(entry => entry.table === 'commercial_contracts')!
    expect(contracts.system).toEqual([])
    expect(contracts.runtime).not.toContain('SELECT')
    expect(canonical.payload.approvedColumnGrants.filter(grant => grant.table === 'commercial_contracts')).toEqual([
      expect.objectContaining({ role: 'union_eyes_runtime', privilege: 'SELECT', columns: ['expiration_date', 'id', 'organization_id', 'status'], grantable: false }),
    ])
    // external_data_sync_log: the sync worker reads the thirteen overview fields by exact column grant;
    // table-level SELECT would widen it to every column.
    const syncLog = canonical.payload.entries.find(entry => entry.table === 'external_data_sync_log')!
    expect(syncLog.system).not.toContain('SELECT')
    const syncGrants = canonical.payload.approvedColumnGrants.filter(grant => grant.table === 'external_data_sync_log')
    expect(syncGrants).toHaveLength(1)
    expect(syncGrants[0]).toMatchObject({ role: 'union_eyes_system', privilege: 'SELECT', grantable: false })
    expect(syncGrants[0].columns).toHaveLength(13)
  })

  it('does not repair or re-sign a corrupt packaged contract', () => {
    const corrupt = { ...base, digest: '0'.repeat(64) }
    expect(canonicalCatalogContract(corrupt)).toBe(corrupt)
    expect(assessCatalogAdmission(canonicalCatalogContract(corrupt), snapshots()).ok).toBe(false)
  })

  it('admits only the source-approved runtime definer with exact owner and execution scope', () => {
    expect(assessCatalogAdmission(functionContract, { ...snapshots(), currentFunctions:[functionRow],definers: [approvedFunction] }).violations).toEqual([])
    for (const change of [
      { owner: 'nzilaadmin' }, { proconfig: ['search_path=public'] }, { public_execute: true },
      { system_execute: true }, { runtime_execute: false }, { proname: 'unapproved_helper' },
    ]) {
      expect(assessCatalogAdmission(functionContract, { ...snapshots(),currentFunctions:[functionRow], definers: [{ ...approvedFunction, ...change }] }).ok).toBe(false)
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
    expect(violations).toContain('business session policy: no runtime relations inspected')
  })
})
