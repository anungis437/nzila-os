/**
 * Platform 0060 (reachable stub shape, second tranche) on real PostgreSQL.
 *
 * Thirteen relations that Django creates as stubs are read and written through Drizzle declarations that name many more columns, so a plain
 * SELECT through each declaration failed with an undefined column. Platform 0060 adds those columns (nullable), gives id, created_at and
 * updated_at the defaults the Django base model omits, and refuses to run if it would change a constraint, index, policy, grant or
 * row-security setting. On the combined schema, with the roles the manifest granted, this proves
 *   - shape: every column every declaration names exists, a plain select through each declaration works, and the base defaults exist;
 *   - roles: where a role holds SELECT, a plain select through the declaration works as that role; no privilege is assumed or added;
 *   - authority: applying the migration again changes nothing, and the guard fails closed when a grant, a column grant, a constraint, an index,
 *     a policy or the row-security flag changes while it runs, when an existing column has another type, when an enum of the same name has other
 *     members, and when a relation is missing;
 *   - reversibility: the rollback removes exactly the tagged columns and enum types and nothing else, and applying again restores the same shape;
 *   - data: a relation that already holds rows keeps its new columns nullable (no value is invented), while an empty relation gets NOT NULL.
 *
 * Every change runs inside a transaction that is rolled back.
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { is } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import * as declarations from '../schema'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const TAG = 'platform-migration:0060_reachable_stub_shape_2'
const MIGRATIONS = path.resolve(__dirname, '../migrations-platform')
const sqlOf = (file: string) =>
  readFileSync(path.join(MIGRATIONS, file), 'utf8')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean)
const FORWARD = sqlOf('0060_reachable_stub_shape_2.sql')
const ROLLBACK = sqlOf('0060_reachable_stub_shape_2.rollback.sql')

const TABLES = [
  'alert_rules', 'arbitration_decisions', 'automation_rules', 'case_studies', 'clc_organization_sync_log', 'cost_of_living_data',
  'external_data_sync_log', 'provincial_privacy_config', 'reserved_matter_votes', 'support_tickets', 'union_density', 'wage_benchmarks',
  'webhook_receipts',
]

const declared: { table: PgTable; name: string; columns: string[] }[] = []
for (const value of new Set(Object.values(declarations as Record<string, unknown>))) {
  if (!is(value, PgTable)) continue
  const config = getTableConfig(value)
  if ((config.schema ?? 'public') === 'public' && TABLES.includes(config.name)) {
    declared.push({ table: value, name: config.name, columns: config.columns.map((column) => column.name) })
  }
}

interface ColumnRow { table_name: string; column_name: string; data_type: string; udt_name: string; column_default: string | null }
interface TypeRow { typname: string; labels: string; tag: string }
const columnKey = (row: { table_name: string; column_name: string }) => `${row.table_name}.${row.column_name}`

describe.skipIf(!URL)('platform 0060 reachable stub shape on the real combined schema', () => {
  let admin: pg.Client
  let db: ReturnType<typeof drizzle>

  const rows = async <T = Record<string, unknown>>(text: string, params: unknown[] = []) => (await admin.query(text, params)).rows as T[]
  const run = async (statements: string[]) => {
    for (const statement of statements) await admin.query(statement)
  }
  const inTransaction = async (work: () => Promise<void>) => {
    await admin.query('BEGIN')
    try {
      await work()
    } finally {
      await admin.query('ROLLBACK')
    }
  }

  const snapshot = async () => ({
    columns: await rows<ColumnRow>(
      `SELECT table_name, column_name, data_type, udt_name, column_default FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, column_name`,
    ),
    tagged: await rows<{ table_name: string; column_name: string }>(
      `SELECT c.relname AS table_name, a.attname AS column_name
         FROM pg_description d
         JOIN pg_class c ON c.oid = d.objoid AND c.relnamespace = 'public'::regnamespace
         JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid
        WHERE d.classoid = 'pg_class'::regclass AND d.objsubid > 0 AND d.description = $1 AND c.relname = ANY($2::text[])
        ORDER BY 1, 2`,
      [TAG, TABLES],
    ),
    types: await rows<TypeRow>(
      `SELECT t.typname, coalesce(string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder), '') AS labels, coalesce(obj_description(t.oid, 'pg_type'), '') AS tag
         FROM pg_type t LEFT JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typnamespace = 'public'::regnamespace AND t.typtype = 'e'
        GROUP BY t.oid, t.typname ORDER BY t.typname`,
    ),
    authority: await rows(
      `SELECT c.relname AS table_name, c.relrowsecurity AS row_security, c.relforcerowsecurity AS force_row_security, coalesce(c.relacl::text, '') AS table_acl,
              coalesce((SELECT string_agg(k.conname || ':' || pg_get_constraintdef(k.oid), '|' ORDER BY k.conname) FROM pg_constraint k WHERE k.conrelid = c.oid), '') AS constraints,
              coalesce((SELECT string_agg(i.relname || ':' || pg_get_indexdef(ix.indexrelid), '|' ORDER BY i.relname) FROM pg_index ix JOIN pg_class i ON i.oid = ix.indexrelid WHERE ix.indrelid = c.oid), '') AS indexes,
              coalesce((SELECT string_agg(p.polname || ':' || p.polcmd::text || ':' || coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ':' || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''), '|' ORDER BY p.polname) FROM pg_policy p WHERE p.polrelid = c.oid), '') AS policies,
              coalesce((SELECT string_agg(a.attname || ':' || a.attacl::text, '|' ORDER BY a.attname) FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped AND a.attacl IS NOT NULL), '') AS column_acls
         FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relname = ANY($1::text[]) ORDER BY c.relname`,
      [TABLES],
    ),
  })

  const taggedNullability = () =>
    rows<{ table_name: string; column_name: string; is_nullable: string }>(
      `SELECT c.table_name, c.column_name, c.is_nullable
         FROM information_schema.columns c
         JOIN pg_class k ON k.relname = c.table_name AND k.relnamespace = 'public'::regnamespace
         JOIN pg_attribute a ON a.attrelid = k.oid AND a.attname = c.column_name
         JOIN pg_description d ON d.objoid = k.oid AND d.objsubid = a.attnum AND d.classoid = 'pg_class'::regclass
        WHERE c.table_schema = 'public' AND d.description = $1 AND c.table_name = ANY($2::text[])
        ORDER BY 1, 2`,
      [TAG, TABLES],
    )

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    db = drizzle(admin)
  }, 60_000)

  afterAll(async () => {
    await admin?.query('ROLLBACK').catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  describe('shape', () => {
    it('serves every declaration of the thirteen relations: each declared column exists and a plain select works', async () => {
      expect(new Set(declared.map((entry) => entry.name))).toEqual(new Set(TABLES))
      const live = new Set(
        (await rows<{ table_name: string; column_name: string }>(
          `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
          [TABLES],
        )).map(columnKey),
      )
      const missing = declared.flatMap((entry) => entry.columns.map((column) => `${entry.name}.${column}`)).filter((key) => !live.has(key))
      expect(missing).toEqual([])

      const failures: string[] = []
      for (const entry of declared) {
        try {
          await db.select().from(entry.table).limit(0)
        } catch (error) {
          failures.push(`${entry.name}: ${(error as Error).message}`)
        }
      }
      expect(failures).toEqual([])
    })

    it('gives id, created_at and updated_at a database default wherever the relation has the column', async () => {
      const withoutDefault = await rows(
        `SELECT table_name, column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = ANY($1::text[]) AND column_name IN ('id', 'created_at', 'updated_at')
            AND column_default IS NULL AND is_generated = 'NEVER' AND is_identity = 'NO'
          ORDER BY 1, 2`,
        [TABLES],
      )
      expect(withoutDefault).toEqual([])
    })

    it('reads through each declaration as every role the manifest granted SELECT, without any privilege being added', async () => {
      const exercisedRoles = new Set<string>()
      for (const role of ['union_eyes_system', 'union_eyes_runtime']) {
        for (const entry of declared) {
          const granted = (await rows<{ ok: boolean }>(`SELECT has_table_privilege($1, format('public.%I', $2::text), 'SELECT') AS ok`, [role, entry.name]))[0].ok
          if (!granted) continue
          try {
            await inTransaction(async () => {
              await admin.query(`SET LOCAL ROLE ${role}`)
              await admin.query(`SELECT set_config('app.current_org_id', $1, true)`, [randomUUID()])
              await db.select().from(entry.table).limit(0)
            })
          } catch (error) {
            throw new Error(`${role} cannot read ${entry.name}: ${(error as Error).message}`)
          }
          exercisedRoles.add(role)
        }
      }
      expect([...exercisedRoles].sort()).toEqual(['union_eyes_runtime', 'union_eyes_system'])
    })
  })

  describe('reversibility', () => {
    it('is idempotent: applying it again alters no column, type, constraint, index, policy, grant or row-security setting', async () => {
      await inTransaction(async () => {
        const before = await snapshot()
        expect(before.tagged.length, 'platform 0060 is not applied to this database').toBeGreaterThan(0)
        await run(FORWARD)
        expect(await snapshot()).toEqual(before)
      })
    })

    it('rolls back exactly what it added and nothing else, and applying it again restores the same shape', async () => {
      await inTransaction(async () => {
        const applied = await snapshot()
        expect(applied.tagged.length, 'platform 0060 is not applied to this database').toBeGreaterThan(0)

        // It added only columns the declarations name.
        const declaredKeys = new Set(declared.flatMap((entry) => entry.columns.map((column) => `${entry.name}.${column}`)))
        expect(applied.tagged.map(columnKey).filter((key) => !declaredKeys.has(key))).toEqual([])

        await run(ROLLBACK)
        const rolledBack = await snapshot()
        const taggedKeys = new Set(applied.tagged.map(columnKey))
        expect(rolledBack.tagged).toEqual([])
        // Every other column keeps its type and default; the id, created_at and updated_at defaults deliberately stay.
        expect(rolledBack.columns).toEqual(applied.columns.filter((row) => !taggedKeys.has(columnKey(row))))
        // Enum types it created are gone; every enum that existed before it is untouched.
        expect(rolledBack.types).toEqual(applied.types.filter((row) => row.tag !== TAG))
        expect(applied.types.some((row) => row.tag === TAG)).toBe(true)
        expect(rolledBack.authority).toEqual(applied.authority)

        await run(FORWARD)
        expect(await snapshot()).toEqual(applied)
      })
    })

    it('adds no value to a relation that already holds rows: its new columns stay nullable, and an empty relation gets NOT NULL', async () => {
      await inTransaction(async () => {
        const strict = (await taggedNullability()).filter((row) => row.is_nullable === 'NO')
        const withStrictColumns = [...new Set(strict.map((row) => row.table_name))]
        expect(withStrictColumns.length, 'no relation has a NOT NULL column added by 0060 (are the relations empty at bootstrap?)').toBeGreaterThanOrEqual(2)

        await run(ROLLBACK)
        let populated: string | undefined
        for (const name of withStrictColumns) {
          await admin.query('SAVEPOINT probe')
          try {
            await admin.query(`INSERT INTO public.${name} DEFAULT VALUES`)
            populated = name
            break
          } catch {
            await admin.query('ROLLBACK TO SAVEPOINT probe')
          }
        }
        expect(populated, 'no relation accepts a default row once the added columns are removed').toBeDefined()
        let control: string | undefined
        for (const name of withStrictColumns.filter((candidate) => candidate !== populated)) {
          if (!(await rows<{ present: boolean }>(`SELECT EXISTS (SELECT 1 FROM public.${name}) AS present`))[0].present) {
            control = name
            break
          }
        }
        expect(control, 'no second, empty relation to compare against').toBeDefined()

        await run(FORWARD)
        const after = await taggedNullability()
        const nullabilityOf = (table: string) => new Map(after.filter((row) => row.table_name === table).map((row) => [row.column_name, row.is_nullable]))
        for (const row of strict.filter((candidate) => candidate.table_name === populated)) {
          expect(nullabilityOf(populated!).get(row.column_name), `${populated}.${row.column_name}`).toBe('YES')
        }
        for (const row of strict.filter((candidate) => candidate.table_name === control)) {
          expect(nullabilityOf(control!).get(row.column_name), `${control}.${row.column_name}`).toBe('NO')
        }
      })
    })
  })

  describe('the guard fails closed', () => {
    const postflight = FORWARD.length - 1

    it('is the last statement of the migration', () => {
      expect(FORWARD[postflight]).toContain('$postflight$')
    })

    const drifts: { name: string; statement: string; message: RegExp }[] = [
      { name: 'a table grant is added', statement: 'GRANT REFERENCES ON public.case_studies TO PUBLIC', message: /public\.case_studies grant definitions changed/ },
      { name: 'a column grant is added', statement: 'GRANT SELECT (id) ON public.support_tickets TO PUBLIC', message: /public\.support_tickets grant definitions changed/ },
      { name: 'a constraint is added', statement: 'ALTER TABLE public.union_density ADD CONSTRAINT ue_stub_shape_drift CHECK (true)', message: /public\.union_density constraint definitions changed/ },
      { name: 'an index is added', statement: 'CREATE INDEX ue_stub_shape_drift_idx ON public.wage_benchmarks (id)', message: /public\.wage_benchmarks index definitions changed/ },
      { name: 'a policy is added', statement: 'CREATE POLICY ue_stub_shape_drift ON public.cost_of_living_data USING (true)', message: /public\.cost_of_living_data policy definitions changed/ },
    ]
    for (const drift of drifts) {
      it(`when ${drift.name} while it runs`, async () => {
        await inTransaction(async () => {
          await run(FORWARD.slice(0, postflight))
          await admin.query(drift.statement)
          await expect(admin.query(FORWARD[postflight])).rejects.toThrow(drift.message)
        })
      })
    }

    it('when row security is switched while it runs', async () => {
      await inTransaction(async () => {
        const [state] = await rows<{ enabled: boolean }>(`SELECT relrowsecurity AS enabled FROM pg_class WHERE oid = 'public.provincial_privacy_config'::regclass`)
        await run(FORWARD.slice(0, postflight))
        await admin.query(`ALTER TABLE public.provincial_privacy_config ${state.enabled ? 'DISABLE' : 'ENABLE'} ROW LEVEL SECURITY`)
        await expect(admin.query(FORWARD[postflight])).rejects.toThrow(/public\.provincial_privacy_config row security changed/)
      })
    })

    it('when an existing column has another type than its declaration', async () => {
      await inTransaction(async () => {
        await run(ROLLBACK)
        await admin.query('ALTER TABLE public.arbitration_decisions ADD COLUMN case_title integer')
        await expect(run(FORWARD)).rejects.toThrow(/public\.arbitration_decisions\.case_title has type integer; expected character varying/)
      })
    })

    it('when an enum of the declared name exists with other members', async () => {
      await inTransaction(async () => {
        await run(ROLLBACK)
        expect((await rows<{ t: string | null }>(`SELECT to_regtype('public.ticket_priority')::text AS t`))[0].t, 'the rollback must remove the enum it created').toBeNull()
        await admin.query(`CREATE TYPE public.ticket_priority AS ENUM ('only_one')`)
        await expect(run(FORWARD)).rejects.toThrow(/enum public\.ticket_priority exists with other members than its declaration/)
      })
    })

    it('when a relation it must alter is missing', async () => {
      await inTransaction(async () => {
        await admin.query('ALTER TABLE public.alert_rules RENAME TO ue_stub_shape_alert_rules_moved')
        await expect(run(FORWARD)).rejects.toThrow(/expected 13 public relations before altering shape/)
      })
    })
  })
})
