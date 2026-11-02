/**
 * Declared-versus-physical convergence on real PostgreSQL (UE-CONV-H-007): every Drizzle table declaration under db/schema, measured against the
 * database that Django `migrate` plus the approved platform bootstrap builds.
 *
 * Proves:
 *   - the strict classes are empty: every declared relation and column exists, no declared default is silently dropped, no NOT NULL column is
 *     one an insert through its declaration cannot fill, no column is narrower than declared, no declared unique key lacks the index ON CONFLICT
 *     needs, and no two declarations of one relation disagree on a type (scripts/runtime/schema-convergence.ts defines each class);
 *   - the advisory classes (foreign keys, indexes, NOT NULL, time zone, checks, declaration drift) may only shrink: each has a pinned ceiling;
 *   - platform migrations 0062 to 0065 are reversible and re-appliable: rolling them back restores the findings they closed, applying them again
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
  loadDeclarationSources,
  measureConvergence,
  STRICT_KINDS,
  summarize,
  type DeclarationSource,
  type Finding,
  type FindingKind,
} from '../../scripts/runtime/schema-convergence'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const APP_ROOT = join(__dirname, '..', '..')

/**
 * Advisory classes that remain open. Each ceiling is the count measured on the converged database; a change that adds to one fails here, and
 * closing findings means lowering the ceiling in the same change. EXTENSION_ABSENT is the pgvector column on a server that does not offer it.
 */
const ADVISORY_CEILING: Partial<Record<FindingKind, number>> = {
  FK_ABSENT: 370,
  INDEX_ABSENT: 794,
  NOT_NULL_ABSENT: 286,
  TZ_MISMATCH: 420,
  CHECK_ABSENT: 36,
  SHAPE_DRIFT: 13,
  VARIANT_REQUIRED: 19,
  EXTENSION_ABSENT: 1,
}

const MIGRATIONS = [
  '0062_declared_enum_convergence',
  '0063_declared_shape_convergence',
  '0064_declared_unique_keys',
  '0065_declared_absent_relations_2',
]

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
    // 623 distinct physical relations are declared across the barrel and the flat declaration files; fewer would mean a declaration went unmeasured.
    expect(measured.declared.length).toBeGreaterThanOrEqual(623)
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

  it('rolls platform migrations 0065 to 0062 back and applies them again', async () => {
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

    await run([...MIGRATIONS].reverse().map((tag) => `${tag}.rollback.sql`))
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
  }, 1_200_000)
})
