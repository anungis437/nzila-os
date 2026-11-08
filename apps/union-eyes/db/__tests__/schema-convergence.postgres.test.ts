/**
 * Declared-versus-physical convergence on real PostgreSQL (UE-CONV-H-007): every Drizzle table declaration under db/schema, measured against the
 * database that Django `migrate` plus the approved platform bootstrap builds.
 *
 * Proves:
 *   - the strict classes are empty: every declared relation and column exists, no declared default is silently dropped, no NOT NULL column is
 *     one an insert through its declaration cannot fill, no column is narrower than declared, no declared unique key lacks the index ON CONFLICT
 *     needs, and no two declarations of one relation disagree on a type (scripts/runtime/schema-convergence.ts defines each class);
 *   - the advisory classes (declaration drift, the contested relations) may only shrink: each has a pinned ceiling; the integrity classes (foreign
 *     keys, indexes, NOT NULL, time zone, checks) are held at zero;
 *   - the database is unambiguous on its own terms: no column carries two foreign keys, no index is defined twice, no constraint is left unvalidated
 *     (Django migrate and the platform bootstrap each name their own objects, so a column could carry both until platform 0070);
 *   - platform migrations 0062 to 0073 are reversible and re-appliable: rolling them back restores the findings they closed, applying them again
 *     closes them, and nothing else changes.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database that has no other session
 * open: the round trip runs in a clone of it (CREATE DATABASE ... TEMPLATE), which PostgreSQL only allows for a database that is not in use.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, describe, expect, it } from 'vitest'
import {
  foreignKeyDoctrineViolations,
  GRANDFATHERED_IDENTITY_REFERENCES,
  loadDeclarationSources,
  measureConvergence,
  NOT_NULL_DELIBERATELY_OPEN,
  STRICT_KINDS,
  summarize,
  type DeclarationSource,
  type Finding,
  type FindingKind,
} from '../../scripts/runtime/schema-convergence'
import { djangoLiveTables, djangoNullableColumns } from '../../scripts/runtime/django-writers'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const APP_ROOT = join(__dirname, '..', '..')

/**
 * Advisory classes that remain open. Each ceiling is the count measured on the converged database; a change that adds to one fails here, and
 * closing findings means lowering the ceiling in the same change. The integrity classes (foreign keys, indexes, time zone, checks, an unvalidated
 * constraint) are closed and held at zero. NOT NULL is closed everywhere the Django model requires the column too (the database may not be stricter
 * than the loosest legitimate writer), and 1 column is open on purpose (NOT_NULL_DELIBERATELY_OPEN); a test below holds the open set to exactly that rule.
 * What else remains is the 14 relations that several declarations name differently. The pgvector column is not declared (knowledge_base.embedding is read and written
 * only through lib/ai/knowledge-base-embeddings.ts, after asking whether it exists), so a server that does not offer the extension is no longer a finding.
 */
const ADVISORY_CEILING: Partial<Record<FindingKind, number>> = {
  FK_ABSENT: 0,
  INDEX_ABSENT: 0,
  NOT_NULL_ABSENT: 1,
  TZ_MISMATCH: 0,
  CHECK_ABSENT: 0,
  CONSTRAINT_NOT_VALIDATED: 0,
  SHAPE_DRIFT: 13,
  VARIANT_REQUIRED: 19,
  EXTENSION_ABSENT: 0,
}

/** The migrations that closed the integrity classes, in order, then the ones that converged shape. */
const INTEGRITY_MIGRATIONS = [
  '0066_declared_indexes',
  '0067_declared_checks',
  '0068_declared_foreign_keys',
  '0069_declared_not_null',
  '0070_unambiguous_constraints',
  '0072_declared_not_null_2',
]
const SHAPE_MIGRATIONS = [
  '0062_declared_enum_convergence',
  '0063_declared_shape_convergence',
  '0064_declared_unique_keys',
  '0065_declared_absent_relations_2',
  '0073_declared_defaults',
]
const MIGRATIONS = [...SHAPE_MIGRATIONS, ...INTEGRITY_MIGRATIONS]

const sqlOf = (file: string) => readFileSync(join(APP_ROOT, 'db', 'migrations-platform', file), 'utf8')
const strictOf = (findings: readonly Finding[]) => findings.filter((f) => STRICT_KINDS.includes(f.kind))
const render = (findings: readonly Finding[]) =>
  findings.slice(0, 25).map((f) => `${f.kind} ${f.table}${f.column ? `.${f.column}` : ''}: ${f.detail}`).join('\n')

let sources: DeclarationSource[] | undefined
async function declarationSources(): Promise<DeclarationSource[]> {
  sources ??= await loadDeclarationSources(APP_ROOT, (file) => import(/* @vite-ignore */ file) as Promise<Record<string, unknown>>)
  return sources
}

async function measure(connectionString: string) {
  const client = new pg.Client({ connectionString })
  await client.connect()
  try {
    return await measureConvergence(client, await declarationSources())
  } finally {
    await client.end()
  }
}

describe.skipIf(!URL)('declared-versus-physical convergence', () => {
  const clones: string[] = []
  const maintenanceUrl = () => {
    const url = new globalThis.URL(URL!)
    url.pathname = '/postgres'
    return url.toString()
  }
  afterAll(async () => {
    const admin = new pg.Client({ connectionString: maintenanceUrl() })
    await admin.connect()
    try {
      for (const name of clones) await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
    } finally {
      await admin.end()
    }
  })

  it('measures every declared relation', async () => {
    const measured = await measure(URL!)
    // 630 distinct physical relations are declared across the barrel and the flat declaration files (623, the four of the enhanced RBAC: platform 0075, and the three of
    // the staging proof ledger: platform 0078); fewer would mean a declaration went unmeasured.
    expect(measured.declared.length).toBeGreaterThanOrEqual(630)
    expect(measured.tables).toBe(measured.declared.length)
  }, 600_000)

  it('has no strict finding', async () => {
    const measured = await measure(URL!)
    const strict = strictOf(measured.findings)
    expect(strict.length, `${JSON.stringify(summarize(strict))}\n${render(strict)}`).toBe(0)
  }, 600_000)

  it('holds every advisory class at or below its pinned ceiling', async () => {
    const measured = await measure(URL!)
    const counts = summarize(measured.findings)
    for (const [kind, ceiling] of Object.entries(ADVISORY_CEILING)) {
      expect(counts[kind] ?? 0, `${kind} grew past its ceiling`).toBeLessThanOrEqual(ceiling)
    }
    // Every finding kind outside the strict and advisory sets would be an unclassified class.
    const known = new Set<string>([...STRICT_KINDS, ...Object.keys(ADVISORY_CEILING)])
    expect(Object.keys(counts).filter((kind) => !known.has(kind))).toEqual([])
  }, 600_000)

  it('leaves a NOT NULL column open only where a live Django ViewSet can store NULL in it, or on purpose', async () => {
    // The database may not be stricter than the loosest legitimate writer. A Django ViewSet that is not contained can store NULL in a column its
    // model leaves null=True, so such a column waits for the Django model and API to require it too; everywhere else the declared NOT NULL is applied,
    // except the columns the platform leaves nullable deliberately, each with the migration that says why.
    const measured = await measure(URL!)
    const live = djangoLiveTables(APP_ROOT)
    const nullable = djangoNullableColumns(APP_ROOT)
    const open = measured.findings.filter((f) => f.kind === 'NOT_NULL_ABSENT')
    expect(live.size).toBeGreaterThan(100)
    expect(nullable.size).toBeGreaterThan(300)
    expect(
      open
        .filter((f) => !NOT_NULL_DELIBERATELY_OPEN[`${f.table}.${f.column}`])
        .filter((f) => {
          const bare = f.table.split('.').pop()!
          return !(live.has(bare) && nullable.get(bare)?.has(f.column!))
        })
        .map((f) => `${f.table}.${f.column}`),
    ).toEqual([])
    // An exception that no longer applies (the column is now NOT NULL, or undeclared) must leave the list.
    for (const key of Object.keys(NOT_NULL_DELIBERATELY_OPEN)) expect(open.map((f) => `${f.table}.${f.column}`), `${key} is no longer open`).toContain(key)
  }, 600_000)

  it('declares no foreign key the doctrine forbids', async () => {
    // An identity string (profiles.user_id, users.user_id) is a value, not a key, and append-only evidence carries identifiers, not foreign keys.
    const measured = await measure(URL!)
    expect(foreignKeyDoctrineViolations(measured.declared)).toEqual([])
    // The grandfathered identity references are still declared, so they are still measured against the database.
    const declaredKeys = new Set(measured.declared.flatMap((t) => t.foreignKeys.map((fk) => `${t.label}.${fk.columns.join(',')}`)))
    expect(GRANDFATHERED_IDENTITY_REFERENCES.filter((key) => !declaredKeys.has(key))).toEqual([])
  }, 600_000)

  it('carries one foreign key per column, one index per definition, and no constraint PostgreSQL has not validated', async () => {
    // Two keys on one column that point at different columns of a parent (a Django key to claims.id beside the declared key to claims.claim_id) cannot
    // both hold for any row, so the table could never be written; two keys or two indexes with one definition are only a cost on every write.
    const client = new pg.Client({ connectionString: URL! })
    await client.connect()
    try {
      const keys = await client.query<{ relation: string; columns: string; keys: string }>(`
        WITH fk AS (
          SELECT n.nspname || '.' || t.relname AS relation, k.conname, k.confrelid::regclass::text AS parent,
                 (SELECT string_agg(a.attname, ',' ORDER BY u.ord) FROM unnest(k.conkey) WITH ORDINALITY u(attnum, ord)
                   JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = u.attnum) AS columns,
                 (SELECT string_agg(a.attname, ',' ORDER BY u.ord) FROM unnest(k.confkey) WITH ORDINALITY u(attnum, ord)
                   JOIN pg_attribute a ON a.attrelid = k.confrelid AND a.attnum = u.attnum) AS parent_columns
            FROM pg_constraint k JOIN pg_class t ON t.oid = k.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
           WHERE k.contype = 'f' AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        )
        SELECT relation, columns, string_agg(conname || ' -> ' || parent || '(' || parent_columns || ')', '; ' ORDER BY conname) AS keys
          FROM fk GROUP BY relation, columns HAVING count(*) > 1 ORDER BY 1, 2`)
      expect(keys.rows.map((r) => `${r.relation}.${r.columns}: ${r.keys}`)).toEqual([])

      const indexes = await client.query<{ relation: string; indexes: string }>(`
        SELECT n.nspname || '.' || t.relname AS relation, string_agg(c.relname, ', ' ORDER BY c.relname) AS indexes
          FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid JOIN pg_class t ON t.oid = i.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace
         WHERE i.indisvalid AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
         GROUP BY n.nspname, t.relname, t.oid, regexp_replace(pg_get_indexdef(i.indexrelid), 'INDEX \\S+ ON', 'INDEX x ON')
        HAVING count(*) > 1 ORDER BY 1`)
      expect(indexes.rows.map((r) => `${r.relation}: ${r.indexes}`)).toEqual([])

      const unvalidated = await client.query<{ name: string }>(`
        SELECT n.nspname || '.' || k.conname AS name FROM pg_constraint k JOIN pg_namespace n ON n.oid = k.connamespace
         WHERE NOT k.convalidated AND n.nspname NOT IN ('pg_catalog', 'information_schema') ORDER BY 1`)
      expect(unvalidated.rows.map((r) => r.name)).toEqual([])
    } finally {
      await client.end()
    }
  }, 600_000)

  it('rolls the integrity migrations and then the shape migrations back and applies them again', async () => {
    const name = `ue_conv_rt_${process.pid}_${Date.now().toString(36)}`
    clones.push(name)
    const admin = new pg.Client({ connectionString: maintenanceUrl() })
    await admin.connect()
    const templateName = decodeURIComponent(new globalThis.URL(URL!).pathname.slice(1))
    try {
      await admin.query(`CREATE DATABASE ${name} TEMPLATE ${templateName}`)
    } finally {
      await admin.end()
    }
    const cloneUrl = new globalThis.URL(URL!)
    cloneUrl.pathname = `/${name}`
    const run = async (files: string[]) => {
      for (const file of files) {
        const client = new pg.Client({ connectionString: cloneUrl.toString() })
        await client.connect()
        try {
          await client.query('BEGIN')
          await client.query(sqlOf(file))
          await client.query('COMMIT')
        } catch (error) {
          await client.query('ROLLBACK').catch(() => undefined)
          throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`)
        } finally {
          await client.end()
        }
      }
    }

    const before = await measure(cloneUrl.toString())
    expect(strictOf(before.findings)).toEqual([])

    // The integrity migrations first: what each added is gone again, the counts are the ones their generator was given, and the shape stays converged.
    await run([...INTEGRITY_MIGRATIONS].reverse().map((tag) => `${tag}.rollback.sql`))
    const integrityOpen = await measure(cloneUrl.toString())
    expect(strictOf(integrityOpen.findings)).toEqual([])
    const integrityCounts = summarize(integrityOpen.findings)
    expect(integrityCounts.FK_ABSENT).toBe(293)
    // Gate 0 corrective convergence: db/schema/award-templates-schema.ts (a dead duplicate reward_wallet_ledger
    // declaration) was deleted, taking its 3 declared indexes with it — 797 - 3 = 794.
    expect(integrityCounts.INDEX_ABSENT).toBe(794)
    expect(integrityCounts.CHECK_ABSENT).toBe(36)
    expect(integrityCounts.NOT_NULL_ABSENT).toBe(294)

    await run([...SHAPE_MIGRATIONS].reverse().map((tag) => `${tag}.rollback.sql`))
    const rolledBack = await measure(cloneUrl.toString())
    const open = summarize(strictOf(rolledBack.findings))
    // What the migrations added or relaxed is gone again; a widening, an enum member and a lossless retype are not reversed, by design.
    expect(open.MISSING_COLUMN ?? 0).toBeGreaterThan(2000)
    expect(open.TABLE_ABSENT).toBe(14)
    expect(open.UNIQUE_ABSENT ?? 0).toBeGreaterThan(80)
    expect(open.NO_DB_DEFAULT ?? 0).toBeGreaterThan(700)
    expect(open.NARROWER_PHYSICAL).toBeUndefined()
    expect(open.ENUM_MEMBER_ABSENT).toBeUndefined()

    await run(MIGRATIONS.map((tag) => `${tag}.sql`))
    const reapplied = await measure(cloneUrl.toString())
    expect(strictOf(reapplied.findings), render(strictOf(reapplied.findings))).toEqual([])
    expect(summarize(reapplied.findings)).toEqual(summarize(before.findings))
  }, 1_800_000)
})
