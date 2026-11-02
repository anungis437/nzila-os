/**
 * Django models equal the physical schema (UE-CONV-H-008): every Django model, measured against the database that Django `migrate`
 * plus the approved platform bootstrap builds, by `manage.py ue_physical_parity`.
 *
 * Proves:
 *   - the strict classes are empty: no model asks for a column or type the table lacks, none may send NULL into a NOT NULL column, no
 *     NOT NULL column without a default is unknown to its model (every ORM insert would fail), no model can write a value an enum
 *     or a CHECK rejects, no foreign key (of the two a column can carry) points where the model does not, and no model writes a
 *     default of its own over the column's (a Django write and a Drizzle write of one row agree);
 *     (backend/core/management/commands/ue_physical_parity.py defines each class);
 *   - every column of every table is described by its model (COLUMN_UNKNOWN is zero): the models are complete, and what a response
 *     returns is named by the response (backend/core/api_projection.py, backend/core/api_surface.json), not by the model;
 *   - the advisory classes may only shrink: each has a pinned ceiling;
 *   - Django's migration state equals the models (`makemigrations --check`), so the migration history records what the tables are.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at a disposable, fully bootstrapped database AND UE_AUTHORITY_DJANGO=1 (python with
 * the backend requirements is on PATH). It only reads.
 */
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const ENABLED = !!URL && process.env.UE_AUTHORITY_DJANGO === '1'
const BACKEND = resolve(__dirname, '..', '..', 'backend')

/** Advisory classes that remain open: a change that adds to one fails here; closing findings means lowering the ceiling. */
const ADVISORY_CEILING: Record<string, number> = {
  COLUMN_UNKNOWN: 0,
  CHECK_ABSENT: 0,
  FK_ABSENT: 0,
  PK_ABSENT: 0,
  TYPE_LOOSE: 0,
  UNIQUE_ABSENT: 0,
  // A model that requires a value where the table accepts NULL: the table is the looser side, and tightening it is a platform migration.
  NOT_NULL_ABSENT: 10,
  // Columns that are `timestamp without time zone` under a DateTimeField: the platform declares them naive, and retyping them is a data decision.
  TIMESTAMP_NAIVE: 361,
}

interface Finding {
  kind: string
  table: string
  column: string | null
  detail: Record<string, unknown>
}
interface Report {
  measured: number
  strict: number
  summary: Record<string, number>
  findings: Finding[]
}

describe.skipIf(!ENABLED)('Django models equal the physical schema', () => {
  const env = () => {
    const u = new globalThis.URL(URL!)
    return {
      ...process.env,
      DJANGO_SETTINGS_MODULE: 'config.settings',
      DJANGO_SECRET_KEY: 'parity-test-only',
      DJANGO_DEBUG: 'True',
      PGDATABASE: u.pathname.replace(/^\//, ''),
      PGUSER: decodeURIComponent(u.username),
      PGPASSWORD: decodeURIComponent(u.password),
      PGHOST: u.hostname,
      PGPORT: u.port || '5432',
      REDIS_URL: 'redis://127.0.0.1:6379/15',
    }
  }
  const manage = (args: string[]) =>
    spawnSync(process.env.UE_CLEANROOM_PYTHON || 'python', ['manage.py', ...args], {
      cwd: BACKEND,
      env: env(),
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    })

  let report: Report
  const measure = () => {
    if (report) return report
    const run = manage(['ue_physical_parity', '--json'])
    const line = `${run.stdout}`.split('\n').find((l) => l.startsWith('PARITY_JSON='))
    if (!line) throw new Error(`ue_physical_parity produced no report (exit ${run.status}): ${run.stderr.slice(-800)}`)
    report = JSON.parse(line.slice('PARITY_JSON='.length)) as Report
    return report
  }
  const render = (findings: readonly Finding[]) => findings.slice(0, 12).map((f) => `${f.kind} ${f.table}.${f.column ?? ''}`).join('\n')

  it('measures every Django model of the project', () => {
    expect(measure().measured).toBeGreaterThan(500)
  })

  it('has no strict finding: no ORM operation through a model fails or corrupts data', () => {
    const strict = measure().findings.filter((f) =>
      [
        'TABLE_ABSENT',
        'COLUMN_ABSENT',
        'TYPE_MISMATCH',
        'NARROWER_PHYSICAL',
        'NULL_CONTRACT_MISMATCH',
        'REQUIRED_COLUMN_UNKNOWN',
        'ENUM_MEMBER_ABSENT',
        'FK_TARGET_MISMATCH',
        'DEFAULT_DIVERGES',
        'CHECK_REFUSES_CHOICE',
      ].includes(f.kind),
    )
    expect(render(strict)).toBe('')
    expect(measure().strict).toBe(0)
  })

  it('holds every advisory class at or below its ceiling, and has no class that has no ceiling', () => {
    const over = Object.entries(measure().summary)
      .filter(([kind]) => kind in ADVISORY_CEILING)
      .filter(([kind, n]) => n > ADVISORY_CEILING[kind])
      .map(([kind, n]) => `${kind}: ${n} > ${ADVISORY_CEILING[kind]}`)
    expect(over).toEqual([])
    const unlisted = Object.keys(measure().summary).filter((k) => !(k in ADVISORY_CEILING))
    expect(unlisted).toEqual([])
  })

  it("has Django's migration state equal to the models", () => {
    const run = manage(['makemigrations', '--check', '--dry-run'])
    expect({ status: run.status, out: `${run.stdout}`.slice(-600) }).toEqual({ status: 0, out: expect.stringContaining('No changes detected') })
  })
})
