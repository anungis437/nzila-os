import { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, it } from 'vitest'
import { compileExternalReadInstallerBridge, assertExternalReadInstallerBridge, EXTERNAL_INSTALLER_BRIDGE_SCHEMA } from './external-read-installer-bridge'
import { compileMinimumRoleProvisioningSql } from './minimum-installer'
import { compileSyntheticAuthFixtureSql } from './auth-fixture'
import { compileAuthBootstrapSql, AUTH_BUSINESS_FUNCTION_CATALOG_QUERY as uePredicateQuery } from './auth-sql'
import { AUTH_BUSINESS_FUNCTION_CATALOG_QUERY as genericPredicateQuery } from '../../../../packages/db/src/auth-storage-authority'
import { buildCurrentExternalReadSource } from './source'
import { compileCaseDomainSupportSql } from '../../db/auth/case-primary-domain-guards'
import { compileAuthorityMembershipReaderSql } from '../../lib/authority/store/platform-identity'
import { compileExternalReadSql, EXTERNAL_READ_OWNER, EXTERNAL_READ_FUNCTIONS } from '../../lib/external-resource-read/source'
import { parseSql } from '../lib/sql-census/parse'
import { admissionQueries, externalReadRoleViolations } from '../../lib/operations/catalog-admission-core.mjs'
import { compileExternalAuthBridgeSql } from '../../lib/external-resource-read/auth-bridge'
let active: PGlite | undefined
afterEach(async () => { await active?.close(); active = undefined })

// These phases exercise actual compiled source functions and installer security
// contexts, not the external application journeys or a native TCP LOGIN.
async function fixture() {
  const db = active = new PGlite()
  await db.exec(compileMinimumRoleProvisioningSql({ postgresMajor: 16 }))
  await db.exec(`ALTER DATABASE postgres OWNER TO ue_v2_owner;
    CREATE ROLE ue_v2_fixture_installer LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    GRANT ue_v2_owner TO ue_v2_fixture_installer WITH ADMIN FALSE,INHERIT FALSE,SET TRUE;
    REVOKE ALL ON SCHEMA public FROM PUBLIC;GRANT USAGE,CREATE ON SCHEMA public TO ue_v2_owner;`)
  await db.exec(compileSyntheticAuthFixtureSql())
  await db.exec(compileAuthBootstrapSql({ rolesPreprovisioned: true, postgresMajor: 16 }))
  await db.exec(compileAuthorityMembershipReaderSql())
  const functionMetadataOnly = async (sql: string, schemaAtoms = false) => {
    const parsed = await parseSql(sql)
    if (!parsed.ok) throw new Error('Actual function source must parse')
    for (const [index, node] of parsed.statements.entries()) {
      if (node.CreateFunctionStmt || node.AlterOwnerStmt?.objectType === 'OBJECT_FUNCTION'
        || node.GrantStmt?.objtype === 'OBJECT_FUNCTION' || node.VariableSetStmt
        || (schemaAtoms && node.GrantStmt?.objtype === 'OBJECT_SCHEMA'))
        await db.exec(parsed.texts[index])
    }
  }
  await functionMetadataOnly(compileCaseDomainSupportSql(), true)
  const source = await buildCurrentExternalReadSource()
  await db.exec('SET ROLE ue_v2_owner')
  for (const statement of source.statements) await db.exec(statement.sql)
  for (const table of source.tables) await db.exec(`ALTER TABLE public.${table.name} ENABLE ROW LEVEL SECURITY;ALTER TABLE public.${table.name} FORCE ROW LEVEL SECURITY;`)
  await db.exec('RESET ROLE')
  const bridge = await compileExternalReadInstallerBridge('postgres')
  await db.exec(bridge.provisionSql)
  const execute = async (sql: string) => (await db.query(sql)).rows as Record<string, unknown>[]
  return { db, bridge, execute, functionMetadataOnly }
}

describe('fixed trusted external installer bridge source protocol', () => {
  it('constructs exact private functions and cleans every helper/edge in one restricted security-context transaction', async () => {
    const f = await fixture()
    await assertExternalReadInstallerBridge(f.bridge, f.execute)
    await f.db.exec('BEGIN;SET SESSION AUTHORIZATION ue_v2_fixture_installer')
    await f.db.exec(f.bridge.prepareSql)
    await f.db.exec('SET LOCAL ROLE ue_v2_owner')
    await f.functionMetadataOnly(compileExternalReadSql({ rolesPreprovisioned: true }))
    await f.db.exec(compileExternalAuthBridgeSql({ rolesPreprovisioned: true }))
    await f.db.exec('RESET ROLE')
    await assertExternalReadInstallerBridge(f.bridge, f.execute)
    await f.db.exec(f.bridge.finalizeSql)
    await f.db.exec('SET LOCAL ROLE ue_v2_owner')
    await f.db.exec(f.bridge.cleanupSql)
    await f.db.exec('RESET ROLE;COMMIT')
    expect((await f.db.query<{ current_user: string; session_user: string }>('SELECT current_user,session_user')).rows)
      .toEqual([{ current_user: 'ue_v2_fixture_installer', session_user: 'ue_v2_fixture_installer' }])
    // The disposable engine began as postgres; return to that test operator
    // only after the restricted construction transaction has committed.
    await f.db.exec('SET SESSION AUTHORIZATION postgres')
    expect((await f.db.query<{ current_user: string; session_user: string }>('SELECT current_user,session_user')).rows)
      .toEqual([{ current_user: 'postgres', session_user: 'postgres' }])
    expect((await f.db.query<{ namespace: string | null }>(`SELECT to_regnamespace('${EXTERNAL_INSTALLER_BRIDGE_SCHEMA}')::text AS namespace`)).rows[0].namespace).toBeNull()
    expect((await f.db.query<{ count: number }>(`SELECT count(*)::integer AS count FROM pg_auth_members m JOIN pg_roles r ON r.oid IN(m.roleid,m.member) WHERE r.rolname='${EXTERNAL_READ_OWNER}'`)).rows[0].count).toBe(0)
    expect((await f.db.query<{ create: boolean }>(`SELECT has_schema_privilege('${EXTERNAL_READ_OWNER}','public','CREATE') AS create`)).rows[0].create).toBe(false)
    expect((await f.db.query<{ count: number }>(`SELECT count(*)::integer AS count FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE r.rolname='${EXTERNAL_READ_OWNER}'`)).rows[0].count).toBe(EXTERNAL_READ_FUNCTIONS.length)
    expect((await f.db.query<{ rolinherit: boolean }>("SELECT rolinherit FROM pg_roles WHERE rolname='ue_v2_owner'")).rows[0].rolinherit).toBe(true)
    const snapshot = async () => Object.fromEntries(await Promise.all(
      admissionQueries.filter(query => ['externalReadRole', 'currentFunctions'].includes(query.name))
        .map(async query => [query.name, (await f.db.query(query.sql)).rows])))
    expect(externalReadRoleViolations(f.bridge.sourceFunctions, await snapshot())).toEqual([])
    const generic = (await f.db.query<{ name: string; exact_acl: boolean }>(genericPredicateQuery)).rows
    expect(generic.find(row => row.name === 'auth_business_org_authorized')?.exact_acl).toBe(false)
    expect((await f.db.query<{ exact_acl: boolean }>(uePredicateQuery)).rows.every(row => row.exact_acl)).toBe(true)
    await f.db.exec(`BEGIN;GRANT EXECUTE ON FUNCTION user_management.auth_business_member_parent_authorized(text,uuid) TO ${EXTERNAL_READ_OWNER}`)
    expect((await f.db.query<{ name: string; exact_acl: boolean }>(uePredicateQuery)).rows
      .find(row => row.name === 'auth_business_member_parent_authorized')?.exact_acl).toBe(false)
    await f.db.exec('ROLLBACK')
    try {
      await f.db.exec(`BEGIN;DROP OWNED BY ${EXTERNAL_READ_OWNER};DROP ROLE ${EXTERNAL_READ_OWNER};
        CREATE ROLE rogue_predicate_caller NOLOGIN NOINHERIT;
        GRANT EXECUTE ON FUNCTION user_management.auth_business_org_authorized(uuid,text[]) TO rogue_predicate_caller`)
    } catch (error) {
      throw new Error('Absent-source-role ACL control failed: ' + (error instanceof Error ? error.message : String(error)), { cause: error })
    }
    expect((await f.db.query<{ name: string; exact_acl: boolean }>(uePredicateQuery)).rows
      .find(row => row.name === 'auth_business_org_authorized')?.exact_acl).toBe(false)
    await f.db.exec('ROLLBACK')
    for (const mutation of [
      `ALTER ROLE ${EXTERNAL_READ_OWNER} LOGIN`,
      `GRANT ${EXTERNAL_READ_OWNER} TO union_eyes_runtime`,
      `GRANT USAGE ON SCHEMA user_management TO ${EXTERNAL_READ_OWNER} WITH GRANT OPTION`,
      `CREATE FUNCTION public.unreviewed_external_power() RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
        REVOKE ALL ON FUNCTION public.unreviewed_external_power() FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.unreviewed_external_power() TO ${EXTERNAL_READ_OWNER}`,
    ]) {
      await f.db.exec('BEGIN')
      await f.db.exec(mutation)
      expect(externalReadRoleViolations(f.bridge.sourceFunctions, await snapshot()), mutation).not.toEqual([])
      await f.db.exec('ROLLBACK')
    }
    expect(externalReadRoleViolations(f.bridge.sourceFunctions, await snapshot())).toEqual([])
  }, 30000)

  it('rolls the temporary authority and constructed source functions back without changing the canonical owner flags', async () => {
    const f = await fixture()
    await f.db.exec('BEGIN;SET SESSION AUTHORIZATION ue_v2_fixture_installer')
    await f.db.exec(f.bridge.prepareSql)
    await f.db.exec('SET LOCAL ROLE ue_v2_owner')
    await f.functionMetadataOnly(compileExternalReadSql({ rolesPreprovisioned: true }))
    await f.db.exec(compileExternalAuthBridgeSql({ rolesPreprovisioned: true }))
    await f.db.exec('ROLLBACK;RESET SESSION AUTHORIZATION')
    await assertExternalReadInstallerBridge(f.bridge, f.execute)
    expect((await f.db.query<{ count: number }>(`SELECT count(*)::integer AS count FROM pg_auth_members m JOIN pg_roles r ON r.oid IN(m.roleid,m.member) WHERE r.rolname='${EXTERNAL_READ_OWNER}'`)).rows[0].count).toBe(0)
    expect((await f.db.query<{ count: number }>(`SELECT count(*)::integer AS count FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE r.rolname='${EXTERNAL_READ_OWNER}'`)).rows[0].count).toBe(0)
  }, 30000)

  it('rejects ordinary helper callers and same-LOGIN finalization before preparation', async () => {
    const f = await fixture()
    await f.db.exec('BEGIN;SET SESSION AUTHORIZATION union_eyes_runtime')
    await expect(f.db.query(f.bridge.prepareSql)).rejects.toMatchObject({ code: '42501' })
    await f.db.exec('ROLLBACK;RESET SESSION AUTHORIZATION;BEGIN;SET SESSION AUTHORIZATION ue_v2_fixture_installer')
    await expect(f.db.query(f.bridge.finalizeSql)).rejects.toMatchObject({ code: '42501' })
    await f.db.exec('ROLLBACK;RESET SESSION AUTHORIZATION')
    await assertExternalReadInstallerBridge(f.bridge, f.execute)
  }, 30000)

  it('rejects altered helper source and duplicate trusted setup without overwriting anything', async () => {
    const f = await fixture()
    await expect(f.db.exec(f.bridge.provisionSql)).rejects.toMatchObject({ code: '42501' })
    await f.db.exec('BEGIN')
    await f.db.exec(`ALTER FUNCTION ${EXTERNAL_INSTALLER_BRIDGE_SCHEMA}.prepare_external_read() SET search_path=public`)
    await expect(assertExternalReadInstallerBridge(f.bridge, f.execute)).rejects.toThrow('trusted helper catalog differs')
    await f.db.exec('ROLLBACK')
    await assertExternalReadInstallerBridge(f.bridge, f.execute)
  }, 30000)
})
