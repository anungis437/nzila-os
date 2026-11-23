import { nativePostgres16Image } from './native-postgres-image'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import pg from 'pg'
import { describe, expect, it } from 'vitest'
import {
  compileAuthBootstrapSql,
  AUTH_EXECUTION_ROLES,
  AUTH_PRIVILEGE_EXPECTATIONS,
  AUTH_FUNCTION_EXPECTATIONS,
  authColumnPrivilegeAllowed,
  authSystemColumnPrivilegeAllowed,
  authTablePrivilegeAllowed,
} from './auth-sql'
import { compileSyntheticAuthFixtureSql } from './auth-fixture'
import { assertMinimumInstaller, compileMinimumRoleProvisioningSql } from './minimum-installer'
import { compileAuthorityMembershipReaderSql } from '../../lib/authority/store/platform-identity'
import { parseSql } from '../lib/sql-census/parse'

const image = nativePostgres16Image()
const docker = (args: string[]) =>
  execFileSync('docker', args, { encoding: 'utf8', timeout: 120000 }).trim()

/** Diagnose the actual compiler statement, preserving its original SQL bytes. */
async function replayCompiler(client: pg.Client, sql: string) {
  const parsed = await parseSql(sql)
  assert(parsed.ok, 'AUTH_BOOTSTRAP_COMPILER_MUST_PARSE')
  for (const [index, statement] of parsed.texts.entries()) {
    try {
      await client.query(statement)
    } catch (cause) {
      throw new Error(`AUTH_BOOTSTRAP_STATEMENT:${index + 1}:${statement.split('\n')[0]}`, {
        cause,
      })
    }
  }
}

async function verifyCorePrivileges(client: pg.Client) {
  // The whole-UE census additionally expects later queued-mail companion grants.
  // This isolated compiler must match the independent core contract exactly.
  const roles = [...Object.values(AUTH_EXECUTION_ROLES), 'union_eyes_runtime', 'union_eyes_system']
  const columns = await client.query<{
    role: string
    table_name: string
    column_name: string
    attribute_number: number
    privilege: string
    allowed: boolean
  }>(
    `
    SELECT r.role,c.relname AS table_name,a.attname AS column_name,a.attnum AS attribute_number,v.privilege,
      has_column_privilege(r.role,c.oid,a.attname,v.privilege) AS allowed
    FROM unnest($1::text[]) r(role) CROSS JOIN pg_attribute a
    JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) v(privilege)
    WHERE n.nspname='user_management' AND c.relkind='r' AND a.attnum<>0 AND NOT a.attisdropped`,
    [roles],
  )
  expect(columns.rows.length).toBeGreaterThan(0)
  for (const row of columns.rows) {
    const expected = AUTH_PRIVILEGE_EXPECTATIONS[row.role]?.[row.table_name]?.[row.privilege]
    expect(row.allowed, `${row.role}:${row.table_name}.${row.column_name}:${row.privilege}`).toBe(
      row.attribute_number < 0
        ? authSystemColumnPrivilegeAllowed(row.role, row.table_name, row.column_name, row.privilege)
        : authColumnPrivilegeAllowed(row.table_name, row.column_name, expected),
    )
  }
  const tables = await client.query<{
    role: string
    table_name: string
    privilege: string
    allowed: boolean
    relrowsecurity: boolean
    relforcerowsecurity: boolean
    owner: string
  }>(
    `
    SELECT r.role,c.relname AS table_name,v.privilege,has_table_privilege(r.role,c.oid,v.privilege) AS allowed,
      c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner
    FROM unnest($1::text[]) r(role) CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES','DELETE','TRUNCATE','TRIGGER']) v(privilege)
    WHERE n.nspname='user_management' AND c.relkind='r'`,
    [roles],
  )
  expect(tables.rows.length).toBeGreaterThan(0)
  for (const row of tables.rows) {
    expect(row.allowed, `${row.role}:${row.table_name}:${row.privilege}`).toBe(
      authTablePrivilegeAllowed(
        row.privilege,
        AUTH_PRIVILEGE_EXPECTATIONS[row.role]?.[row.table_name]?.[row.privilege],
      ),
    )
    expect([row.relrowsecurity, row.relforcerowsecurity, row.owner]).toEqual([
      true,
      true,
      'ue_v2_owner',
    ])
  }
  for (const expected of AUTH_FUNCTION_EXPECTATIONS) {
    const { rows } = await client.query(
      `SELECT p.oid::text AS oid,p.prosecdef,p.proconfig,pg_get_userbyid(p.proowner) AS owner,
      EXISTS(SELECT FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='user_management' AND p.proname=$1`,
      [expected.name],
    )
    expect(rows).toEqual([
      {
        oid: expect.any(String),
        prosecdef: true,
        proconfig: ['search_path=pg_catalog'],
        owner: expected.owner,
        public_execute: false,
      },
    ])
    for (const role of roles) {
      expect(
        (
          await client.query("SELECT has_function_privilege($1,$2::oid,'EXECUTE') AS allowed", [
            role,
            rows[0].oid,
          ])
        ).rows,
      ).toEqual([
        {
          allowed:
            role === expected.owner || (expected.callers as readonly string[]).includes(role),
        },
      ])
    }
  }
}

describe.skipIf(process.env.UE_V2_NATIVE_MANIFEST !== '1')(
  'canonical auth compiler with genuine restricted installer',
  () => {
    it('installs through the declared owner delegations and leaves exact reader ACLs and forced RLS', async () => {
      const name = `ue-v2-auth-minimum-${randomUUID()}`
      const password = randomBytes(24).toString('hex')
      const mission = 'UE_AUTH_MINIMUM_INSTALLER_NATIVE_TEST'
      let container: string | undefined
      let operator: pg.Client | undefined
      let installer: pg.Client | undefined
      try {
        container = execFileSync(
          'docker',
          [
            'run',
            '-d',
            '--pull',
            'never',
            '--name',
            name,
            '--label',
            `nzila.mission=${mission}`,
            '--memory',
            '512m',
            '--tmpfs',
            '/var/lib/postgresql/data:rw,size=256m',
            '-p',
            '127.0.0.1::5432',
            '-e',
            'POSTGRES_PASSWORD',
            image,
          ],
          {
            encoding: 'utf8',
            timeout: 120000,
            env: { ...process.env, POSTGRES_PASSWORD: password },
          },
        ).trim()
        const ports = JSON.parse(
          docker(['inspect', '--format', '{{json .NetworkSettings.Ports}}', container]),
        )
        const config = { host: '127.0.0.1', port: Number(ports['5432/tcp'][0].HostPort), password }
        for (let attempt = 0; attempt < 60; attempt++) {
          const candidate = new pg.Client({
            ...config,
            user: 'postgres',
            database: 'postgres',
            connectionTimeoutMillis: 1000,
          })
          try {
            await candidate.connect()
            operator = candidate
            break
          } catch {
            await candidate.end()
            await new Promise((resolve) => setTimeout(resolve, 100))
          }
        }
        assert(operator, 'LOCAL_NATIVE_DATABASE_NOT_RESPONSIVE')
        // The operator provisions only the declared cluster prerequisite. Every
        // schema/table/compiler statement below runs as the restricted login.
        await operator.query(compileMinimumRoleProvisioningSql())
        await operator.query(`CREATE ROLE ue_v2_fixture_installer LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}';
        GRANT ue_v2_owner TO ue_v2_fixture_installer WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;`)
        await operator.query('CREATE DATABASE ue_v2_clean_auth_minimum OWNER ue_v2_owner')
        installer = new pg.Client({
          ...config,
          user: 'ue_v2_fixture_installer',
          database: 'ue_v2_clean_auth_minimum',
        })
        await installer.connect()
        await installer.query(
          'BEGIN; SET LOCAL ROLE ue_v2_owner; SET LOCAL search_path=public,pg_catalog,pg_temp',
        )
        await assertMinimumInstaller(installer, { vectorRequired: false })
        expect(
          (
            await installer.query(`SELECT session_user,current_user,
        rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=session_user`)
          ).rows,
        ).toEqual([
          {
            session_user: 'ue_v2_fixture_installer',
            current_user: 'ue_v2_owner',
            rolsuper: false,
            rolbypassrls: false,
            rolcreatedb: false,
            rolcreaterole: false,
          },
        ])
        await installer.query(compileSyntheticAuthFixtureSql())
        expect(
          (
            await installer.query(
              `SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='user_management'`,
            )
          ).rows,
        ).toEqual([{ owner: 'ue_v2_owner' }])
        await replayCompiler(installer, compileAuthBootstrapSql({ rolesPreprovisioned: true }))
        await replayCompiler(installer, compileAuthorityMembershipReaderSql())
        await verifyCorePrivileges(installer)
        const reader = AUTH_EXECUTION_ROLES.orgAuthorityReader
        expect(
          (
            await installer.query(
              `SELECT has_schema_privilege($1,'user_management','USAGE') AS usage,
        has_schema_privilege($1,'user_management','CREATE') AS create`,
              [reader],
            )
          ).rows,
        ).toEqual([{ usage: true, create: false }])
        expect(
          (
            await installer.query(`SELECT p.proname,pg_get_userbyid(p.proowner) AS owner FROM pg_proc p
        JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='user_management'
        AND p.proname IN ('auth_invite_inviter_live','auth_revoke_pending_invites',
          'auth_revoke_invites_on_user_change','auth_revoke_invites_on_membership_change') ORDER BY p.proname`)
          ).rows,
        ).toEqual(
          [
            'auth_invite_inviter_live',
            'auth_revoke_invites_on_membership_change',
            'auth_revoke_invites_on_user_change',
            'auth_revoke_pending_invites',
          ].map((proname) => ({ proname, owner: reader })),
        )
        await installer.query('COMMIT')
        expect((await installer.query('SELECT current_user')).rows).toEqual([
          { current_user: 'ue_v2_fixture_installer' },
        ])
        // A real committed install must still have no runtime/system auth-table
        // SELECT, schema CREATE or ability to assume the private reader role.
        expect(
          (
            await installer.query(
              `SELECT r.rolname,
        has_table_privilege(r.rolname,c.oid,'SELECT') AS read_users,
        has_schema_privilege(r.rolname,'user_management','CREATE') AS create,
        pg_has_role(r.rolname,$1,'MEMBER') AS reader FROM pg_roles r CROSS JOIN pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='user_management' AND c.relname='users'
          AND r.rolname IN ('union_eyes_runtime','union_eyes_system') ORDER BY r.rolname`,
              [reader],
            )
          ).rows,
        ).toEqual([
          { rolname: 'union_eyes_runtime', read_users: false, create: false, reader: false },
          { rolname: 'union_eyes_system', read_users: false, create: false, reader: false },
        ])
      } finally {
        if (installer) await installer.end()
        if (operator) await operator.end()
        if (container) {
          expect(
            docker(['inspect', '--format', '{{index .Config.Labels "nzila.mission"}}', container]),
          ).toBe(mission)
          docker(['rm', '-f', '-v', container])
        }
      }
    }, 120000)
  },
)
