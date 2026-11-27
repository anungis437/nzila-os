import { describe, expect, it } from 'vitest'
import oldPlan from '../../../../docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'
import { buildCurrentExternalReadSource, EXTERNAL_READ_DECLARATION_OWNERS, externalReadStorageAuthority, type V2Plan } from './source'
import { planCurrentExternalReadCreation } from '../../../../tooling/scripts/lib/union-eyes-current-security-installer'
import { currentSecurityProjection } from '../../../../tooling/scripts/lib/union-eyes-current-security-programs'
import { reconcileCurrentAuthority, reconcileCurrentDeclarationAuthority } from './current-authority'
import { compileSecurity } from './security'
import { compileMinimumRoleProvisioningSql } from './minimum-installer'
import { CANONICAL_BOOTSTRAP_ROLES, INSTALLER_FUNCTION_OWNER_ROLES } from './execution-roles'
import { EXTERNAL_READ_COLUMN_GRANTS, EXTERNAL_READ_OWNER, EXTERNAL_READ_STORAGE_TABLES, EXTERNAL_READ_FUNCTIONS, EXTERNAL_READ_PREREQUISITE_FUNCTIONS } from '../../lib/external-resource-read/source'
import { AUTH_FUNCTION_EXPECTATIONS as genericFunctions } from '../../../../packages/db/src/auth-storage-authority'
import { AUTH_FUNCTION_EXPECTATIONS as ueFunctions } from './auth-sql'
import { storageAuthorityManifest } from '../../db/rls-storage-authority'
import { EXTERNAL_AUTHORIZER_LIVE_FUNCTION } from '../../lib/external-resource-read/auth-bridge'

async function fixture() {
  const producer = await buildCurrentExternalReadSource()
  const names = new Set<string>(EXTERNAL_READ_STORAGE_TABLES)
  const base = structuredClone(oldPlan) as unknown as V2Plan
  const plan: V2Plan = { ...base,
    tables: [...base.tables.filter(table => !names.has(table.name)), ...producer.tables],
    statements: [...base.statements.filter(statement => !statement.canonicalId.startsWith('EXTERNAL_READ_CURRENT:')), ...producer.statements],
    sourceCommitments: { ...base.sourceCommitments, [producer.source]: producer.sourceDigest },
  }
  for (const table of plan.tables) {
    const model = plan.currentModels.models.find(model => model.table === table.name)
    if (model) table.authority = reconcileCurrentAuthority(model, storageAuthorityManifest.find(entry => entry.table === table.name) ?? null)
    table.authority = reconcileCurrentDeclarationAuthority(table, table.authority)
    if (Object.hasOwn(EXTERNAL_READ_DECLARATION_OWNERS, table.name)) table.authority = externalReadStorageAuthority(table.name, table.source)
  }
  const rows = plan.tables.filter(table => !names.has(table.name) && table.name !== 'platform_identity_bindings').map(table => ({
    schema: table.name.includes('.') ? table.name.split('.')[0] : 'public', table: table.name.split('.').at(-1),
    relkind: 'r', owner: 'uev2admin', relrowsecurity: false, relforcerowsecurity: false,
  }))
  return { plan, producer, rows }
}

describe('shared current external source registration', () => {
  it('retains exactly three declaration owners and adds exactly the two source tables without raw grant authority', async () => {
    const { plan, producer } = await fixture()
    expect(Object.keys(EXTERNAL_READ_DECLARATION_OWNERS)).toHaveLength(5)
    expect(producer.tables.map(table => table.name).sort()).toEqual([...EXTERNAL_READ_STORAGE_TABLES].sort())
    for (const [name, owner] of Object.entries(EXTERNAL_READ_DECLARATION_OWNERS)) {
      const table = plan.tables.find(table => table.name === name)!
      expect(table.source).toBe(owner)
      expect(table.authority).toMatchObject({ classification: 'CONTAINED_NO_AUTHORITY',
        requiredRuntimePrivileges: [], requiredSystemPrivileges: [], invocationAuthority: 'NONE', dbExecutionPrincipal: 'NONE' })
      expect(() => externalReadStorageAuthority(name, 'unknown-source')).toThrow('EXTERNAL_READ_STORAGE_SOURCE_REQUIRED')
    }
    const security = compileSecurity(plan)
    expect(security.blockers).toEqual([])
    const accepted = await planCurrentExternalReadCreation(plan, rowsOf(plan), [], producer)
    expect(accepted.tables).toEqual(producer.tables)
    expect(accepted.denyStatements).toHaveLength(6)
    expect(accepted.statements).toEqual(producer.statements.map(statement => statement.sql))
  })

  it('rejects mismatched source, DDL/column substitutions, unknown missing relations and partial object conflicts', async () => {
    const { plan, producer, rows } = await fixture()
    const substitutions = [
      { ...producer, source: 'unreviewed-source' },
      { ...producer, sourceDigest: '0'.repeat(64) },
      { ...producer, tables: producer.tables.map((table, i) => i ? table : { ...table, columns: [] }) },
      { ...producer, statements: producer.statements.map((statement, i) => i ? statement : { ...statement, sql: statement.sql.replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS') }) },
      { ...producer, statements: [...producer.statements, { ...producer.statements[0], sql: 'DROP TABLE public.claims' }] },
    ]
    for (const forged of substitutions) {
      const forgedPlan = { ...plan, tables: [...plan.tables.filter(table => !EXTERNAL_READ_STORAGE_TABLES.some(name => name === table.name)), ...forged.tables],
        statements: [...plan.statements.filter(statement => !statement.canonicalId.startsWith('EXTERNAL_READ_CURRENT:')), ...forged.statements] }
      await expect(planCurrentExternalReadCreation(forgedPlan, rows, [], forged)).rejects.toThrow('producer differs')
    }
    await expect(planCurrentExternalReadCreation(plan, rows.filter(row => row.table !== 'claims'), [], producer)).rejects.toThrow('prerequisites are missing')
    await expect(planCurrentExternalReadCreation(plan, [...rows, { ...rows[0], schema: 'public', table: EXTERNAL_READ_STORAGE_TABLES[0] }], [], producer)).rejects.toThrow('partial or conflicting')
    await expect(planCurrentExternalReadCreation(plan, rows, [{ kind: 'type', name: EXTERNAL_READ_STORAGE_TABLES[0] }], producer)).rejects.toThrow('partial or conflicting')
  })

  it('compiles fixed column-only grants, three prerequisites and the exact live-office BOOL without broadening generic auth', async () => {
    const { plan } = await fixture()
    const projection = await currentSecurityProjection(plan, { postgresMajor: 15 })
    expect(projection.functions.filter(fn => fn.owner === EXTERNAL_READ_OWNER)).toHaveLength(EXTERNAL_READ_FUNCTIONS.length)
    expect(projection.tableGrants.filter(grant => grant.role === EXTERNAL_READ_OWNER)).toEqual([])
    const expected = EXTERNAL_READ_COLUMN_GRANTS.flatMap(grant => [
      { schema: 'public', table: grant.table, role: EXTERNAL_READ_OWNER, privilege: 'SELECT', columns: [...grant.select].sort(), grantable: false },
      ...('insert' in grant ? [{ schema: 'public', table: grant.table, role: EXTERNAL_READ_OWNER, privilege: 'INSERT', columns: [...grant.insert].sort(), grantable: false }] : []),
      ...('update' in grant ? [{ schema: 'public', table: grant.table, role: EXTERNAL_READ_OWNER, privilege: 'UPDATE', columns: [...grant.update].sort(), grantable: false }] : []),
    ])
    expect(projection.columnGrants.filter(grant => grant.role === EXTERNAL_READ_OWNER).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
      .toEqual(expected.sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
    expect(projection.functions.filter(fn => fn.owner !== EXTERNAL_READ_OWNER && fn.executeAcl.some(grant => grant.role === EXTERNAL_READ_OWNER)).map(fn => fn.signature).sort())
      .toEqual([...EXTERNAL_READ_PREREQUISITE_FUNCTIONS,
        `public.${EXTERNAL_AUTHORIZER_LIVE_FUNCTION.name}(uuid,uuid,text)`].sort())
    for (const fn of genericFunctions) expect((fn.callers as readonly string[]).includes(EXTERNAL_READ_OWNER)).toBe(false)
    for (const name of ['auth_business_org_authorized','ue_authority_membership_rows'])
      expect(ueFunctions.find(fn => fn.name === name)?.callers).toContain(EXTERNAL_READ_OWNER)
  })

  it.each([15,16] as const)('preprovisions the PostgreSQL %s private role without permanent memberships or owner flag changes', major => {
    const sql = compileMinimumRoleProvisioningSql({ postgresMajor: major })
    expect(CANONICAL_BOOTSTRAP_ROLES.filter(role => role === EXTERNAL_READ_OWNER)).toHaveLength(1)
    expect(sql).toContain(`CREATE ROLE "${EXTERNAL_READ_OWNER}" NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`)
    expect((INSTALLER_FUNCTION_OWNER_ROLES as readonly string[]).includes(EXTERNAL_READ_OWNER)).toBe(false)
    expect(sql.split('\n').filter(line => line.startsWith('GRANT ') && line.includes(`"${EXTERNAL_READ_OWNER}"`))).toEqual([])
    expect(sql).toContain('CREATE ROLE "ue_v2_owner" NOLOGIN INHERIT')
  })
})
function rowsOf(plan: V2Plan) {
  return plan.tables.filter(table => !EXTERNAL_READ_STORAGE_TABLES.some(name => name === table.name) && table.name !== 'platform_identity_bindings')
    .map(table => ({ schema: table.name.includes('.') ? table.name.split('.')[0] : 'public', table: table.name.split('.').at(-1), relkind: 'r', owner: 'uev2admin' }))
}
