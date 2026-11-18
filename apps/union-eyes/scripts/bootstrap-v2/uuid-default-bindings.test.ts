/** Actual source DDL on disposable PGlite: UUID/default ABI only, not native
 * LOGIN, whole installer, protected consent or institutional qualification. */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildCurrentExternalReadSource, buildCurrentPlatformIdentitySource } from './source'
import {
  CURRENT_PUBLIC_TABLE_CREATION_SQL,
  CURRENT_UUID_DEFAULT_BINDING_QUERY,
  currentUuidDefaultBindingFailures,
  currentUuidDefaultRequirements,
  verifyCurrentUuidDefaultBindings,
  type CurrentUuidDefaultRow,
} from './uuid-default-bindings'

const root = path.resolve(__dirname, '../../../..')
const installers = [
  'apps/union-eyes/scripts/bootstrap-v2/installer.ts',
  'tooling/scripts/lib/union-eyes-current-security-installer.ts',
] as const
let identity: Awaited<ReturnType<typeof buildCurrentPlatformIdentitySource>>
let external: Awaited<ReturnType<typeof buildCurrentExternalReadSource>>
beforeAll(async () => {
  identity = await buildCurrentPlatformIdentitySource()
  external = await buildCurrentExternalReadSource()
})
const plan = () => ({ tables: [identity.table, ...external.tables] })

/** Execute the real creation context currently wired in each installer. The
 * legacy literal arm preserves the actual RED preimage before either repair. */
function installedCreationContext(file: string) {
  const source = readFileSync(path.join(root, file), 'utf8')
  const literal = source.match(
    /await\s+(?:client\.query|execute)\(\s*(['"])(SET LOCAL search_path\s*=\s*public(?:\s*,\s*pg_catalog)?\s*,\s*pg_temp)\1\s*\)/,
  )
  if (literal) return literal[2]
  expect(source).toMatch(
    /await\s+(?:client\.query|execute)\(\s*CURRENT_PUBLIC_TABLE_CREATION_SQL\s*\)/,
  )
  return CURRENT_PUBLIC_TABLE_CREATION_SQL
}

async function fixture(context: string) {
  const db = new PGlite()
  try {
    await db.exec(`CREATE ROLE ue_v2_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;
      CREATE ROLE ue_uuid_writer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;
      GRANT CREATE ON SCHEMA public TO ue_v2_owner;
      CREATE SCHEMA user_management AUTHORIZATION ue_v2_owner;
      SET ROLE ue_v2_owner;CREATE TABLE user_management.users(user_id varchar(255) PRIMARY KEY);
      INSERT INTO user_management.users VALUES('synthetic-user');RESET ROLE;
      CREATE FUNCTION public.gen_random_uuid() RETURNS uuid LANGUAGE sql VOLATILE AS $$ SELECT '00000000-0000-4000-8000-000000000000'::uuid $$;
      REVOKE ALL ON FUNCTION public.gen_random_uuid() FROM PUBLIC;
      BEGIN;SET LOCAL ROLE ue_v2_owner;`)
    await db.exec(context)
    const ddl = [...identity.statements, ...external.statements]
    for (const statement of [
      ...ddl.filter((row) => row.sql.startsWith('CREATE TABLE')),
      ...ddl.filter((row) => !row.sql.startsWith('CREATE TABLE')),
    ])
      await db.exec(statement.sql)
    await db.exec('COMMIT;RESET ROLE')
    const execute = async (sql: string, parameters: unknown[]) =>
      (await db.query<CurrentUuidDefaultRow>(sql, parameters)).rows
    return { db, execute }
  } catch (error) {
    await db.close()
    throw error
  }
}

describe('source-owned UUID default binding', () => {
  it.each(installers)(
    '%s creates current table defaults against the builtin despite a revoked public shadow',
    async (installer) => {
      const { db, execute } = await fixture(installedCreationContext(installer))
      try {
        expect(await verifyCurrentUuidDefaultBindings(plan(), execute)).toEqual({
          checkedColumns: 2,
        })
        expect(
          (
            await db.query(
              "SELECT n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname IN ('platform_identity_bindings','ue_external_read_consents','ue_external_read_qualifications') ORDER BY c.relname",
            )
          ).rows,
        ).toEqual([{ nspname: 'public' }, { nspname: 'public' }, { nspname: 'public' }])
      } finally {
        await db.close()
      }
    },
  )

  it('refuses wrong stored defaults even when the current search path makes the public alias appear unqualified; history and ACLs stay unchanged', async () => {
    const { db, execute } = await fixture('SET LOCAL search_path=public,pg_catalog,pg_temp')
    try {
      const id = randomUUID()
      await db.query(
        "INSERT INTO platform_identity_bindings(id,provider,provider_subject,platform_user_id,verified_at,provisioned_by) VALUES($1,'synthetic','retained','synthetic-user',now(),'fixture')",
        [id],
      )
      await db.exec('SET search_path=public,pg_catalog,pg_temp')
      const before = (
        await db.query('SELECT to_jsonb(b)::text AS row FROM public.platform_identity_bindings b')
      ).rows
      const defaults = await execute(CURRENT_UUID_DEFAULT_BINDING_QUERY, [
        ['platform_identity_bindings', 'ue_external_read_consents'],
      ])
      expect(
        defaults
          .filter((row) => row.column === 'id')
          .every((row) => row.default_expression === 'gen_random_uuid()'),
      ).toBe(true)
      await expect(verifyCurrentUuidDefaultBindings(plan(), execute)).rejects.toThrow(
        'FUNCTION_BINDING',
      )
      expect(
        (await db.query('SELECT to_jsonb(b)::text AS row FROM public.platform_identity_bindings b'))
          .rows,
      ).toEqual(before)
      expect(
        (
          await db.query(
            "SELECT has_function_privilege('ue_uuid_writer','public.gen_random_uuid()','EXECUTE') allowed",
          )
        ).rows,
      ).toEqual([{ allowed: false }])
      expect(
        await execute(CURRENT_UUID_DEFAULT_BINDING_QUERY, [
          ['platform_identity_bindings', 'ue_external_read_consents'],
        ]),
      ).toEqual(defaults)
    } finally {
      await db.close()
    }
  })

  it('executes both real source defaults for a restricted writer without granting the public function', async () => {
    const { db, execute } = await fixture(CURRENT_PUBLIC_TABLE_CREATION_SQL)
    try {
      await db.exec(`GRANT USAGE ON SCHEMA public TO ue_uuid_writer;
        GRANT INSERT ON public.platform_identity_bindings,public.ue_external_read_consents TO ue_uuid_writer;
        GRANT SELECT(id) ON public.platform_identity_bindings,public.ue_external_read_consents TO ue_uuid_writer;SET ROLE ue_uuid_writer;`)
      expect(
        (
          await db.query(
            "SELECT has_function_privilege(current_user,'public.gen_random_uuid()','EXECUTE') shadow,has_function_privilege(current_user,'pg_catalog.gen_random_uuid()','EXECUTE') builtin",
          )
        ).rows,
      ).toEqual([{ shadow: false, builtin: true }])
      const binding = await db.query<{ id: string }>(
        "INSERT INTO public.platform_identity_bindings(provider,provider_subject,platform_user_id,verified_at,provisioned_by) VALUES('synthetic','restricted','synthetic-user',now(),'fixture') RETURNING id",
      )
      const consent = await db.query<{ id: string }>(
        `INSERT INTO public.ue_external_read_consents(organization_id,matter_id,member_user_id,recipient_user_id,representative_organization_id,payload_hash,consent_text,consent_text_sha256,effective_at,expires_at)
        VALUES($1,$2,'synthetic-member','synthetic-recipient',$3,repeat('a',64),'SYNTHETIC DEFAULT ABI FIXTURE',repeat('b',64),now(),now()+interval '1 hour') RETURNING id`,
        [randomUUID(), randomUUID(), randomUUID()],
      )
      for (const result of [binding, consent]) {
        expect(result.rows[0].id).toMatch(/^[0-9a-f-]{36}$/)
        expect(result.rows[0].id).not.toBe('00000000-0000-4000-8000-000000000000')
      }
      await db.exec('RESET ROLE')
      expect(await verifyCurrentUuidDefaultBindings(plan(), execute)).toEqual({ checkedColumns: 2 })
    } finally {
      await db.close()
    }
  })

  it('derives exactly the two random defaults from live declarations; qualification IDs remain explicitly provided', () => {
    expect(
      currentUuidDefaultRequirements(plan())
        .map((row) => `${row.schema}.${row.table}.${row.column}`)
        .sort(),
    ).toEqual(['public.platform_identity_bindings.id', 'public.ue_external_read_consents.id'])
    expect(() =>
      currentUuidDefaultRequirements({
        tables: [{ ...identity.table, source: 'unapproved-source' }],
      }),
    ).toThrow('CURRENT_DECLARATION_REQUIRED')
  })

  it.each([
    'public-alias',
    'missing',
    'duplicate',
    'missing-builtin',
    'wrapper',
    'extra-call',
    'wrong-type',
  ] as const)(
    'rejects %s metadata instead of admitting an unchanged-installation shortcut',
    (mutation) => {
      const requirement = currentUuidDefaultRequirements(plan()).slice(0, 1)
      const row: CurrentUuidDefaultRow = {
        schema: 'public',
        table: requirement[0].table,
        column: 'id',
        type: 'uuid',
        default_expression: 'gen_random_uuid()',
        function_oids: ['3432'],
        builtin_oid: '3432',
      }
      if (mutation === 'public-alias') row.function_oids = ['99999']
      if (mutation === 'missing-builtin') row.builtin_oid = null
      if (mutation === 'wrapper') row.default_expression = 'coalesce(gen_random_uuid(),NULL::uuid)'
      if (mutation === 'extra-call') row.function_oids = ['3432', '99999']
      if (mutation === 'wrong-type') row.type = 'text'
      expect(
        currentUuidDefaultBindingFailures(
          requirement,
          mutation === 'missing' ? [] : mutation === 'duplicate' ? [row, row] : [row],
        ),
      ).not.toEqual([])
    },
  )
})
