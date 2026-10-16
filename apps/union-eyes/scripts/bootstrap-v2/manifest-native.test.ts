import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import pg from 'pg'
import { describe, expect, it } from 'vitest'
import {
  applyV2,
  catalogDigest,
  connectLocalV2,
  createCurrentState,
  inspectCatalog,
} from './installer'
import { beginManifestTrace, producerBytes } from './manifest-trace'
import { buildNativeManifest, renderManifestMarkdown, verifyDeclaredSource } from './manifest'
import { qualifyNativePrivileges } from './manifest-security'
import type { V2Plan } from './source'

const image =
  'pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337'
const docker = (args: string[]) =>
  execFileSync('docker', args, { encoding: 'utf8', timeout: 120000 }).trim()
const roleSql =
  'CREATE ROLE ue_v2_owner NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; CREATE ROLE union_eyes_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; CREATE ROLE union_eyes_system NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;'

describe.skipIf(process.env.UE_V2_NATIVE_MANIFEST !== '1')(
  'real local PostgreSQL manifest qualification',
  () => {
    it('measures native producers, validates declarations and exercises actual lifecycle and drift', async () => {
      const name = `ue-v2-manifest-${randomUUID()}`
      const password = randomBytes(24).toString('hex')
      const clients: pg.Client[] = []
      let container: string | undefined
      let admin: pg.Client | undefined
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
            'nzila.mission=UE_V2_MANIFEST_NATIVE_TEST',
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
        const config = {
          host: '127.0.0.1',
          port: Number(ports['5432/tcp'][0].HostPort),
          user: 'postgres',
          password,
        }
        for (let attempt = 0; attempt < 60; attempt++) {
          const candidate = new pg.Client({
            ...config,
            database: 'postgres',
            connectionTimeoutMillis: 1000,
          })
          try {
            await candidate.connect()
            admin = candidate
            break
          } catch {
            await candidate.end()
            await new Promise((resolve) => setTimeout(resolve, 100))
          }
        }
        assert(admin, 'LOCAL_NATIVE_DATABASE_NOT_RESPONSIVE')
        await admin.query(roleSql)
        const database = async (suffix: string) => {
          await admin!.query(`CREATE DATABASE ue_v2_clean_manifest_${suffix} OWNER ue_v2_owner`)
          const client = await connectLocalV2({
            ...config,
            database: `ue_v2_clean_manifest_${suffix}`,
          })
          clients.push(client)
          return client
        }
        const source = 'apps/union-eyes/scripts/bootstrap-v2/manifest-native.test.ts'
        const digest = producerBytes(source)
        const plan: V2Plan = {
          contractVersion: '2.0',
          lineage: 'PROSPECTIVE_UE_BOOTSTRAP_V2',
          scope: 'UE_OPERATIONAL',
          sourceCommitments: { [source]: digest },
          decisions: [],
          exclusions: [],
          securityBlockers: [],
          currentModels: {
            lineage: 'PROSPECTIVE_UE_BOOTSTRAP_V2',
            contractVersion: '2.0',
            djangoVersion: 'synthetic-test',
            lockDigest: digest,
            sourceDigests: {},
            models: [],
            ddl: [],
            sourceModelChecks: 'SYNTHETIC_DECLARATIONS',
            historicalMigrationReplay: false,
            databaseConnectionsDuringCollection: 0,
          },
          tables: [
            {
              name: 'manifest_example',
              source,
              sourceDigest: digest,
              authority: null,
              columns: [
                { name: 'id', type: 'integer', notNull: true },
                { name: 'title', type: 'text', notNull: false },
              ],
              foreignKeys: [],
            },
            {
              name: 'manifest_defaults',
              source,
              sourceDigest: digest,
              authority: null,
              columns: [
                { name: 'id', type: 'uuid', notNull: true },
                { name: 'created_at', type: 'timestamp', notNull: true },
              ],
              foreignKeys: [],
            },
            {
              name: 'user_management.manifest_declared',
              source,
              sourceDigest: digest,
              authority: null,
              columns: [
                { name: 'id', type: 'integer', notNull: true },
                { name: 'created_at', type: 'timestamp', notNull: false },
              ],
              foreignKeys: [],
            },
          ],
          statements: [
            {
              canonicalId: 'CURRENT_EXTENSION:vector',
              sql: "CREATE EXTENSION vector WITH VERSION '0.8.1';",
              source,
              sourceDigest: digest,
            },
            ...[
              "CREATE TYPE public.manifest_enum AS ENUM ('a','b')",
              'CREATE DOMAIN public.manifest_domain AS integer CHECK (VALUE>0)',
              'CREATE TABLE public.manifest_example(id integer PRIMARY KEY,title text UNIQUE)',
              'ALTER TABLE public.manifest_example ADD COLUMN later text',
              "ALTER TABLE public.manifest_example ALTER COLUMN title SET DEFAULT 'late'",
              'ALTER TABLE public.manifest_example ADD CONSTRAINT manifest_late_unique UNIQUE(later)',
              'CREATE VIEW public.manifest_view AS SELECT id,title FROM public.manifest_example',
              'CREATE UNIQUE INDEX manifest_composite_key ON public.manifest_example(id,title)',
              'CREATE SCHEMA user_management',
              'CREATE TABLE user_management.manifest_declared(id integer PRIMARY KEY,created_at timestamp)',
              'CREATE TABLE public.manifest_defaults(id uuid NOT NULL DEFAULT gen_random_uuid(),created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)',
            ].map((sql, index) => ({
              canonicalId: `SYNTHETIC_DECLARATION:${index}`,
              sql,
              source,
              sourceDigest: digest,
            })),
          ],
        }
        plan.currentModels.models.push({
          table: 'manifest_defaults',
          app: 'synthetic',
          model: 'SyntheticCanonicalDefaults',
          source,
          sourceDigest: digest,
          columns: [
            { name: 'id', type: 'uuid', defaultKind: 'UUID4' as const },
            { name: 'created_at', type: 'timestamp', defaultKind: 'AUDIT_NOW' as const },
          ].map((column) => ({
            ...column,
            notNull: true,
            primaryKey: false,
            unique: false,
            index: false,
            hasClientDefault: true,
            clientDefault: null,
            choices: [],
            foreignKey: null,
          })),
          uniqueTogether: [],
          constraints: [],
        })
        plan.currentModels.models.push({
          table: 'manifest_example',
          app: 'synthetic',
          model: 'SyntheticDeclaredKeys',
          source,
          sourceDigest: digest,
          columns: [],
          uniqueTogether: [['id', 'title']],
          constraints: [[[], { name: 'manifest_composite_key', fields: ['id', 'title'] }]],
        })
        const reference = await database('reference')
        await reference.query('BEGIN')
        const recorder = await beginManifestTrace(reference)
        await createCurrentState(reference, plan, recorder.hook)
        const trace = await recorder.finish()
        await reference.query('COMMIT')
        const expected = await inspectCatalog(reference)
        expect(expected.some((object) => object.id.includes('ue_v2_manifest_trace'))).toBe(false)
        const manifest = await buildNativeManifest(reference, plan, expected, trace, {
          image,
          roleSql,
        })
        expect(manifest.blockers).toEqual([])
        const object = (id: string) => manifest.objects.find((entry) => entry.CANONICAL_ID === id)!
        expect(
          object('column:public.manifest_example.later').CREATION_ORDER.execution,
        ).toBeGreaterThan(object('column:public.manifest_example.id').CREATION_ORDER.execution!)
        expect(object('role:ue_v2_owner').DATABASE_SCOPE).toBe('CLUSTER_PREREQUISITE')
        expect(object('role:ue_v2_owner').CREATION_ORDER.execution).toBeNull()
        expect(object('type:public._manifest_enum').SOURCE_AUTHORITY.length).toBeGreaterThan(0)
        expect(object('column:public.manifest_example.id').DEPENDENCIES.length).toBeGreaterThan(0)
        const defaultExecution = trace.executions.find((entry) =>
          entry.producer.sql.includes("ALTER COLUMN title SET DEFAULT 'late'"),
        )!
        const lateIndexExecution = trace.executions.find((entry) =>
          entry.producer.sql.includes('ADD CONSTRAINT manifest_late_unique'),
        )!
        expect(object('column_default:public.manifest_example.title').CREATION_ORDER).toEqual({
          execution: defaultExecution.order,
          basis: 'DDL_EVENT',
        })
        expect(
          object('column_default:public.manifest_example.title').SOURCE_AUTHORITY[0].producerId,
        ).toBe(defaultExecution.producer.canonicalId)
        expect(object('index:public.manifest_late_unique').CREATION_ORDER).toEqual({
          execution: lateIndexExecution.order,
          basis: 'DDL_EVENT',
        })
        expect(
          object('column_default:public.manifest_example.title').CREATION_ORDER.execution,
        ).toBeGreaterThan(object('column:public.manifest_example.title').CREATION_ORDER.execution!)
        expect(renderManifestMarkdown(manifest)).toBe(renderManifestMarkdown(manifest))
        expect(
          manifest.objects.some((entry) => entry.CANONICAL_ID.startsWith('operator_class:')),
        ).toBe(true)
        expect(
          manifest.objects.some((entry) => entry.CANONICAL_ID.startsWith('access_method:')),
        ).toBe(true)
        const fresh = await database('fresh')
        expect((await applyV2(fresh, plan, expected)).result).toBe('CREATED')
        expect((await applyV2(fresh, plan, expected)).result).toBe('NOOP')
        const initialized = await fresh.query(
          'INSERT INTO public.manifest_defaults DEFAULT VALUES RETURNING id,created_at',
        )
        expect(initialized.rows[0].id).toMatch(/^[a-f0-9-]{36}$/)
        expect(initialized.rows[0].created_at).toBeInstanceOf(Date)
        await fresh.query(`
          ALTER TABLE public.manifest_defaults ALTER COLUMN id DROP DEFAULT;
          ALTER TABLE public.manifest_defaults ALTER COLUMN created_at DROP DEFAULT;
        `)
        expect((await verifyDeclaredSource(fresh, plan)).mismatches).toEqual(
          expect.arrayContaining([
            'DECLARED_SERVER_DEFAULT_MISSING:manifest_defaults.id',
            'DECLARED_SERVER_DEFAULT_MISSING:manifest_defaults.created_at',
          ]),
        )
        await expect(
          fresh.query('INSERT INTO public.manifest_defaults DEFAULT VALUES'),
        ).rejects.toThrow('null value')
        await fresh.query('ALTER TABLE public.manifest_example ALTER COLUMN title SET NOT NULL')
        expect((await verifyDeclaredSource(fresh, plan)).mismatches).toContain(
          'DECLARED_COLUMN_MISMATCH:manifest_example.title',
        )
        await expect(applyV2(fresh, plan, expected)).rejects.toThrow(
          'UE_V2_PRESENT_DRIFTED_OR_PARTIAL_DENIED',
        )
        await reference.query(
          'GRANT SELECT(title) ON public.manifest_example TO union_eyes_runtime',
        )
        expect((await qualifyNativePrivileges(reference, plan)).mismatches).toContain(
          'TABLE_GRANT_MISMATCH:public.manifest_example:union_eyes_runtime:SELECT',
        )
        const partial = await database('partial')
        await partial.query('CREATE TABLE public.partial(id integer)')
        const before = catalogDigest(await inspectCatalog(partial))
        await expect(applyV2(partial, plan, expected)).rejects.toThrow(
          'UE_V2_PRESENT_DRIFTED_OR_PARTIAL_DENIED',
        )
        expect(catalogDigest(await inspectCatalog(partial))).toBe(before)
        for (const fault of ['verify', 'receipt', 'commit'] as const) {
          const client = await database(`rollback_${fault}`)
          const baseline = catalogDigest(await inspectCatalog(client))
          await expect(applyV2(client, plan, expected, fault)).rejects.toThrow()
          expect(catalogDigest(await inspectCatalog(client))).toBe(baseline)
        }
        const recreated = await database('recreated')
        await applyV2(recreated, plan, expected)
        await recreated.end()
        clients.splice(clients.indexOf(recreated), 1)
        await admin.query('DROP DATABASE ue_v2_clean_manifest_recreated')
        const again = await database('recreated')
        expect((await applyV2(again, plan, expected)).result).toBe('CREATED')
        expect(catalogDigest(await inspectCatalog(again))).toBe(catalogDigest(expected))
        await again.query(`
          SET ROLE ue_v2_owner;
          CREATE FUNCTION public.manifest_system_unpinned() RETURNS integer LANGUAGE sql AS 'SELECT 1';
          REVOKE ALL ON FUNCTION public.manifest_system_unpinned() FROM PUBLIC;
          GRANT EXECUTE ON FUNCTION public.manifest_system_unpinned() TO union_eyes_system;
          CREATE SEQUENCE public.manifest_undeclared_sequence;
          GRANT USAGE ON SEQUENCE public.manifest_undeclared_sequence TO union_eyes_system;
          RESET ROLE;
        `)
        const privilegeDrift = await qualifyNativePrivileges(again, plan)
        expect(privilegeDrift.mismatches).toContain(
          'FUNCTION_SEARCH_PATH_NOT_PINNED:manifest_system_unpinned()',
        )
        expect(privilegeDrift.mismatches).toContain(
          'UNDECLARED_SEQUENCE_GRANT:manifest_undeclared_sequence:union_eyes_system:USAGE',
        )
      } finally {
        for (const client of clients) await client.end()
        if (admin) await admin.end()
        if (container) {
          expect(
            docker(['inspect', '--format', '{{index .Config.Labels "nzila.mission"}}', container]),
          ).toBe('UE_V2_MANIFEST_NATIVE_TEST')
          docker(['rm', '-f', container])
        }
      }
    }, 120000)
  },
)
