/**
 * Platform 0072 (declared NOT NULL, second pass), 0073 (declared defaults the ORM fills itself) and 0074 (model defaults on Django-only relations) on real PostgreSQL
 * (UE-CONV-H-007, UE-CONV-H-008).
 *
 * Proves, on the database Django `migrate` plus the approved platform bootstrap builds:
 *   - 0072 leaves every column it lists NOT NULL, the four union-structure tables carry NOT NULL created_at and updated_at, and payments.amount stays nullable on purpose;
 *   - its rollback relaxes exactly those columns, applying it again restores them, and applying it twice changes nothing;
 *   - it is fail-closed: a column that holds NULL stops it, nothing is invented to fill the NULL, and the column stays nullable;
 *   - 0073 gives the declared defaults (including the PK ids of claims, grievances and organizations) to the database, so the mission-audits statement that omits
 *     impacts_consecutive_compliance succeeds and stores false; its rollback drops exactly what it set;
 *   - 0074 gives the 35 Django model defaults to the Django-only relations: a raw INSERT that names only what a model requires succeeds, a column that already has a
 *     default keeps it, a column that carries a comment is refused, and its rollback drops exactly what it set.
 *
 * Every case runs in a transaction that is rolled back. Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { describe, expect, it } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const sqlOf = (file: string) => readFileSync(join(__dirname, '..', 'migrations-platform', file), 'utf8')
const NOT_NULL_UP = sqlOf('0072_declared_not_null_2.sql')
const NOT_NULL_DOWN = sqlOf('0072_declared_not_null_2.rollback.sql')
const DECLARED_UP = sqlOf('0073_declared_defaults.sql')
const DECLARED_DOWN = sqlOf('0073_declared_defaults.rollback.sql')
const MODEL_UP = sqlOf('0074_model_defaults_physical.sql')
const MODEL_DOWN = sqlOf('0074_model_defaults_physical.rollback.sql')

const NOT_NULL_TAG = 'declared_not_null_2'
const DECLARED_TAG = 'platform-migration:declared_defaults:default'
const MODEL_TAG = 'platform-migration:model_defaults_physical:default'

/** The columns 0072 lists, read from the migration itself. */
const NOT_NULL_COLUMNS = [...NOT_NULL_UP.matchAll(/^\s+\('([^']+)', '([^']+)', '([^']+)'\)/gm)].map((m) => ({ schema: m[1], table: m[2], column: m[3] }))
/** The defaults 0073 sets, read from the migration itself. */
const DECLARED_DEFAULTS = (JSON.parse(/\$json\$(\[\{"s".*?\])\$json\$::jsonb\) LOOP/s.exec(DECLARED_UP)![1]) as Array<{ s: string; t: string; c: string; e: string }>).map((d) => ({
  schema: d.s,
  table: d.t,
  column: d.c,
  expression: d.e,
}))
/**
 * Declared defaults that a Django migration now sets before 0073 runs, so 0073 keeps the existing default instead of
 * tagging its own. claims.is_anonymous became opt-in (default false) in grievances/0010 (2026-11-04); 0073 still lists
 * the earlier declaration (true) and, run after Django as in every supported bootstrap, leaves the column alone.
 */
const OWNED_BY_DJANGO: Record<string, string> = { 'public.claims.is_anonymous': 'false' }
const keyOf = (d: { schema: string; table: string; column: string }) => `${d.schema}.${d.table}.${d.column}`
const APPLIED_DEFAULTS = DECLARED_DEFAULTS.filter((d) => !(keyOf(d) in OWNED_BY_DJANGO))
/** The defaults 0074 sets, read from the migration itself. */
const MODEL_DEFAULTS = [...MODEL_UP.matchAll(/^\s+\('([^']+)', '([^']+)', '([^']+)', '((?:[^']|'')*)'\)/gm)].map((m) => ({
  schema: m[1],
  table: m[2],
  column: m[3],
  expression: m[4].replace(/''/g, "'"),
}))

const UNION_STRUCTURE = ['employers', 'worksites', 'bargaining_units', 'committees']

describe.skipIf(!URL)('platform 0072, 0073 and 0074', () => {
  async function inTransaction<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
    const client = new pg.Client({ connectionString: URL })
    await client.connect()
    try {
      await client.query('BEGIN')
      return await run(client)
    } finally {
      await client.query('ROLLBACK').catch(() => undefined)
      await client.end()
    }
  }

  const column = async (client: pg.Client, schema: string, table: string, name: string) =>
    (
      await client.query<{ not_null: boolean; expression: string | null; tag: string | null }>(
        `SELECT a.attnotnull AS not_null, pg_get_expr(d.adbin, d.adrelid) AS expression, col_description(a.attrelid, a.attnum) AS tag
           FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
          WHERE a.attrelid = to_regclass(format('%I.%I', $1::text, $2::text)) AND a.attname = $3 AND a.attnum > 0 AND NOT a.attisdropped`,
        [schema, table, name],
      )
    ).rows[0]
  const notNullState = async (client: pg.Client) =>
    Object.fromEntries(
      await Promise.all(NOT_NULL_COLUMNS.map(async (c) => [`${c.schema}.${c.table}.${c.column}`, (await column(client, c.schema, c.table, c.column)).not_null] as const)),
    )
  const allDefaults = async (client: pg.Client) =>
    (
      await client.query<{ col: string; expression: string }>(
        `SELECT n.nspname || '.' || c.relname || '.' || a.attname AS col, pg_get_expr(d.adbin, d.adrelid) AS expression
           FROM pg_attrdef d JOIN pg_class c ON c.oid = d.adrelid JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
          WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND c.relkind IN ('r', 'p') ORDER BY 1`,
      )
    ).rows
  const taggedColumns = async (client: pg.Client, tag: string) =>
    (
      await client.query<{ col: string }>(
        `SELECT n.nspname || '.' || c.relname || '.' || a.attname AS col
           FROM pg_description d JOIN pg_class c ON c.oid = d.objoid AND d.classoid = 'pg_class'::regclass JOIN pg_namespace n ON n.oid = c.relnamespace
           JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid
          WHERE d.objsubid > 0 AND d.description = $1 AND NOT a.attisdropped ORDER BY 1`,
        [tag],
      )
    ).rows.map((r) => r.col)

  it('0072 lists 136 columns and leaves every one NOT NULL', async () => {
    expect(NOT_NULL_COLUMNS).toHaveLength(136)
    expect(NOT_NULL_UP).toContain(`platform-migration:${NOT_NULL_TAG}`)
    await inTransaction(async (client) => {
      const state = await notNullState(client)
      expect(Object.entries(state).filter(([, notNull]) => !notNull).map(([key]) => key)).toEqual([])
      for (const table of UNION_STRUCTURE) {
        for (const name of ['created_at', 'updated_at']) {
          expect((await column(client, 'public', table, name)).not_null, `${table}.${name}`).toBe(true)
          expect(NOT_NULL_COLUMNS.some((c) => c.table === table && c.column === name), `${table}.${name} is in the migration`).toBe(true)
        }
      }
      // The one column the platform leaves nullable on purpose (a payment recorded before the finance authority has no amount).
      expect((await column(client, 'public', 'payments', 'amount')).not_null).toBe(false)
    })
  })

  it('0072 rolls back to nullable, applies again, and applying twice changes nothing', async () => {
    await inTransaction(async (client) => {
      await client.query(NOT_NULL_DOWN)
      const relaxed = await notNullState(client)
      expect(Object.values(relaxed).every((notNull) => !notNull)).toBe(true)
      await client.query(NOT_NULL_DOWN)
      await client.query(NOT_NULL_UP)
      await client.query(NOT_NULL_UP)
      expect(Object.values(await notNullState(client)).every((notNull) => notNull)).toBe(true)
    })
  })

  it('0072 is fail-closed: a NULL stops it, nothing is invented, and the column stays nullable', async () => {
    await inTransaction(async (client) => {
      await client.query(NOT_NULL_DOWN)
      await client.query('SET LOCAL session_replication_role = replica')
      await client.query(
        `INSERT INTO employers (organization_id, name, employer_type, created_at) VALUES (gen_random_uuid(), 'native-proof', 'private', NULL)`,
      )
      await client.query('SET LOCAL session_replication_role = origin')
      await client.query('SAVEPOINT refused')
      await expect(client.query(NOT_NULL_UP)).rejects.toThrow(/fail-closed.*employers.*created_at.*holds NULL/s)
      await client.query('ROLLBACK TO SAVEPOINT refused')
      expect((await column(client, 'public', 'employers', 'created_at')).not_null).toBe(false)
      expect((await client.query(`SELECT count(*)::int AS n FROM employers WHERE created_at IS NULL`)).rows[0]).toEqual({ n: 1 })
    })
  })

  it('a union-structure row cannot be stored without its timestamps, and the default still stamps an omitted one', async () => {
    await inTransaction(async (client) => {
      await client.query('SET LOCAL session_replication_role = replica')
      const { rows } = await client.query<{ created_at: Date | null; updated_at: Date | null }>(
        `INSERT INTO employers (organization_id, name, employer_type) VALUES (gen_random_uuid(), 'native-proof', 'private') RETURNING created_at, updated_at`,
      )
      expect(rows[0].created_at).toBeInstanceOf(Date)
      expect(rows[0].updated_at).toBeInstanceOf(Date)
      await client.query('SAVEPOINT refused')
      await expect(
        client.query(`INSERT INTO employers (organization_id, name, employer_type, updated_at) VALUES (gen_random_uuid(), 'native-proof-2', 'private', NULL)`),
      ).rejects.toMatchObject({ code: '23502' })
      await client.query('ROLLBACK TO SAVEPOINT refused')
    })
  })

  it('0073 gives the database its declared defaults (34; one is owned by Django), and its rollback drops exactly those', async () => {
    expect(DECLARED_DEFAULTS).toHaveLength(35)
    expect(APPLIED_DEFAULTS).toHaveLength(34)
    await inTransaction(async (client) => {
      for (const d of APPLIED_DEFAULTS) {
        const state = await column(client, d.schema, d.table, d.column)
        expect(state.expression, `${d.table}.${d.column}`).not.toBeNull()
        expect(state.tag, `${d.table}.${d.column}`).toBe(DECLARED_TAG)
      }
      for (const d of DECLARED_DEFAULTS.filter((x) => keyOf(x) in OWNED_BY_DJANGO)) {
        const state = await column(client, d.schema, d.table, d.column)
        expect(state.expression, `${d.table}.${d.column} keeps the Django default`).toBe(OWNED_BY_DJANGO[keyOf(d)])
        expect(state.tag, `${d.table}.${d.column} is not 0073's`).not.toBe(DECLARED_TAG)
      }
      expect((await taggedColumns(client, DECLARED_TAG)).sort()).toEqual(APPLIED_DEFAULTS.map(keyOf).sort())
      const before = await allDefaults(client)
      await client.query(DECLARED_DOWN)
      const after = await allDefaults(client)
      const dropped = before.filter((b) => !after.some((a) => a.col === b.col)).map((b) => b.col)
      expect(dropped.sort()).toEqual(APPLIED_DEFAULTS.map(keyOf).sort())
      // Nothing else changed: every other default is still there, unchanged.
      expect(after.every((a) => before.some((b) => b.col === a.col && b.expression === a.expression))).toBe(true)
      await client.query(DECLARED_DOWN)
      await client.query(DECLARED_UP)
      await client.query(DECLARED_UP)
      expect(await allDefaults(client)).toEqual(before)
    })
  })

  it('the mission-audits statement, which names no impacts_consecutive_compliance, succeeds and stores false', async () => {
    await inTransaction(async (client) => {
      // The INSERT app/api/governance/mission-audits/route.ts runs; the column was NOT NULL with no default, so it failed on every call.
      const { rows } = await client.query<{ impacts_consecutive_compliance: boolean }>(
        `INSERT INTO mission_audits (
           id, created_at, updated_at, audit_year, audit_period_start, audit_period_end, auditor_firm, auditor_name, auditor_certification, audit_date,
           union_revenue_percent, member_satisfaction_percent, data_violations, union_revenue_threshold, member_satisfaction_threshold, data_violations_threshold,
           union_revenue_pass, member_satisfaction_pass, data_violations_pass, overall_pass, auditor_opinion
         ) VALUES (
           gen_random_uuid(), NOW(), NOW(), 2026, '2026-01-01'::date, '2026-12-31'::date, 'native-proof', 'native-proof', '', '2026-12-31'::date,
           60, 80, 0, 50, 70, 0, true, true, true, true, ''
         ) RETURNING impacts_consecutive_compliance`,
      )
      expect(rows[0]).toEqual({ impacts_consecutive_compliance: false })
    })
  })

  it('0074 gives the database the 35 Django model defaults, and its rollback drops exactly those', async () => {
    expect(MODEL_DEFAULTS).toHaveLength(35)
    await inTransaction(async (client) => {
      for (const d of MODEL_DEFAULTS) {
        const state = await column(client, d.schema, d.table, d.column)
        expect(state.expression, `${d.table}.${d.column}`).not.toBeNull()
        expect(state.tag, `${d.table}.${d.column}`).toBe(MODEL_TAG)
      }
      const before = await allDefaults(client)
      await client.query(MODEL_DOWN)
      const after = await allDefaults(client)
      expect(before.filter((b) => !after.some((a) => a.col === b.col)).map((b) => b.col).sort()).toEqual(
        MODEL_DEFAULTS.map((d) => `${d.schema}.${d.table}.${d.column}`).sort(),
      )
      expect(await taggedColumns(client, MODEL_TAG)).toEqual([])
      await client.query(MODEL_DOWN)
      await client.query(MODEL_UP)
      await client.query(MODEL_UP)
      expect(await allDefaults(client)).toEqual(before)
    })
  })

  it('0074 stores the value the model writes: a raw INSERT that names only what the model requires succeeds', async () => {
    await inTransaction(async (client) => {
      // rate_limit_events is declared only by the Django models; event_id was NOT NULL with no default.
      const { rows } = await client.query<{ event_id: string }>(`INSERT INTO rate_limit_events (id, created_at, updated_at) VALUES (gen_random_uuid(), now(), now()) RETURNING event_id`)
      expect(rows[0].event_id).toMatch(/^[0-9a-f-]{36}$/)
      const pack = await client.query<{ column_default: string }>(
        `SELECT column_default FROM information_schema.columns WHERE table_name = 'evidence_packs' AND column_name = 'status'`,
      )
      expect(pack.rows[0]).toEqual({ column_default: "'draft'::character varying" })
    })
  })

  it('0074 keeps a default someone set, and refuses a column that carries a comment', async () => {
    await inTransaction(async (client) => {
      await client.query(MODEL_DOWN)
      await client.query(`ALTER TABLE evidence_packs ALTER COLUMN status SET DEFAULT 'sealed'`)
      await client.query(MODEL_UP)
      expect((await column(client, 'public', 'evidence_packs', 'status')).expression).toBe("'sealed'::character varying")
      expect((await column(client, 'public', 'evidence_packs', 'status')).tag).toBeNull()
      // The rollback leaves it alone: it was not set by this migration.
      await client.query(MODEL_DOWN)
      expect((await column(client, 'public', 'evidence_packs', 'status')).expression).toBe("'sealed'::character varying")

      await client.query(`ALTER TABLE evidence_packs ALTER COLUMN status DROP DEFAULT`)
      await client.query(`COMMENT ON COLUMN evidence_packs.status IS 'someone else'`)
      await client.query('SAVEPOINT refused')
      await expect(client.query(MODEL_UP)).rejects.toThrow(/fail-closed.*evidence_packs\.status.*already carries a comment/s)
      await client.query('ROLLBACK TO SAVEPOINT refused')
    })
  })
})
