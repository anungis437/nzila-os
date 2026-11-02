import { describe, expect, it } from 'vitest'
import { Analyzer, type Analysis } from '../lib/sql-census/analyze'
import type { Catalog, CatalogRelation } from '../lib/sql-census/catalog'
import { parseSql } from '../lib/sql-census/parse'

/** `!` NOT NULL with nothing to fill it, `~` NOT NULL with a default, nothing: nullable. */
function relation(name: string, columns: string[], options: { uniques?: Array<{ columns: string[]; partial?: boolean }>; triggers?: string[]; kind?: string } = {}): CatalogRelation {
  const map = new Map<string, CatalogRelation['columns'] extends Map<string, infer C> ? C : never>()
  for (const spec of columns) {
    const column = spec.replace(/[!~]$/, '')
    map.set(column, { name: column, type: 'text', notNull: spec.endsWith('!') || spec.endsWith('~'), hasDefault: spec.endsWith('~'), generated: false })
  }
  return {
    schema: 'public',
    name,
    kind: options.kind ?? 'r',
    columns: map,
    uniques: (options.uniques ?? []).map((unique, index) => ({ name: `${name}_u${index}`, columns: unique.columns, partial: unique.partial ?? false, primary: false, expression: false })),
    beforeInsertTriggers: options.triggers ?? [],
  }
}

function catalog(): Catalog {
  const relations = [
    relation('grievances', ['id~', 'organization_id!', 'title!', 'type!', 'status~', 'created_at~'], { uniques: [{ columns: ['id'] }, { columns: ['organization_id', 'title'] }] }),
    relation('members', ['id~', 'organization_id!', 'email', 'name'], { uniques: [{ columns: ['id'] }, { columns: ['email'], partial: true }], triggers: ['members_fill'] }),
    relation('deadline_alerts', ['id~', 'deadline_id!', 'created_at~', 'organization_id']),
  ]
  const functions = new Map<string, Array<{ schema: string; name: string; kind: string; minArgs: number; maxArgs: number; variadic: boolean }>>()
  const fn = (name: string, minArgs: number, maxArgs = minArgs, variadic = false): void => {
    functions.set(`pg_catalog.${name}`, [...(functions.get(`pg_catalog.${name}`) ?? []), { schema: 'pg_catalog', name, kind: 'f', minArgs, maxArgs, variadic }])
  }
  fn('now', 0)
  fn('count', 0)
  fn('count', 1)
  fn('lower', 1)
  fn('coalesce', 1, 1, true)
  fn('unnest', 1)
  fn('generate_series', 2, 3)
  fn('set_config', 3)
  fn('current_setting', 1, 2)
  fn('percentile_cont', 2)
  return {
    relations: new Map(relations.map((entry) => [`public.${entry.name}`, entry])),
    functions,
    types: new Set(['pg_catalog.text', 'pg_catalog.int4', 'pg_catalog.uuid', 'public.claim_status']),
    enumLabels: new Map(),
    extensions: new Set(),
    searchPath: ['pg_catalog', 'public'],
  }
}

async function analyze(sql: string): Promise<Analysis> {
  const parsed = await parseSql(sql)
  if (!parsed.ok) throw new Error(parsed.message)
  return new Analyzer(catalog()).analyze(parsed.statements[0])
}

const kinds = (analysis: Analysis): string[] => analysis.findings.map((finding) => `${finding.kind}:${finding.object}`).sort()

describe('sql-census analyzer: what exists', () => {
  it('accepts references that all exist, through aliases, joins, subqueries and CTEs', async () => {
    const analysis = await analyze(`
      WITH recent AS (SELECT g.id, g.title FROM grievances g WHERE g.created_at > now())
      SELECT r.id, m.email, (SELECT count(*) FROM deadline_alerts d WHERE d.deadline_id = r.id) AS n
        FROM recent r JOIN members m ON m.id = r.id
       WHERE lower(m.email) = $1 AND EXISTS (SELECT 1 FROM grievances x WHERE x.organization_id = m.organization_id)
       ORDER BY n DESC`)
    expect(analysis.findings).toEqual([])
    expect(analysis.relations).toEqual(['deadline_alerts', 'grievances', 'members'])
    expect(analysis.parameters).toBe(1)
  })

  it('accepts function ranges, VALUES ranges and recordsets without inventing columns', async () => {
    const analysis = await analyze(`SELECT u.x, v.b, g FROM unnest($1::text[]) AS u(x), (VALUES (1, 2)) AS v(a, b), generate_series(1, 3) g`)
    expect(analysis.findings).toEqual([])
  })

  it('accepts an output alias in ORDER BY and GROUP BY but not in WHERE', async () => {
    expect((await analyze(`SELECT title AS t, count(*) AS c FROM grievances GROUP BY t ORDER BY c`)).findings).toEqual([])
    expect(kinds(await analyze(`SELECT title AS t FROM grievances WHERE t = 'x'`))).toEqual(['COLUMN_ABSENT:grievances.t'])
  })

  it('accepts EXCLUDED and RETURNING in an upsert whose conflict target has a unique index', async () => {
    const analysis = await analyze(`INSERT INTO grievances (organization_id, title, type) VALUES ($1, $2, $3) ON CONFLICT (organization_id, title) DO UPDATE SET status = EXCLUDED.status RETURNING id`)
    expect(analysis.findings).toEqual([])
    expect(analysis.writes).toEqual([{ operation: 'INSERT', relation: 'grievances' }])
  })

  it('counts the WITHIN GROUP arguments of an ordered-set aggregate', async () => {
    expect((await analyze(`SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY created_at) FROM grievances`)).findings).toEqual([])
  })
})

describe('sql-census analyzer: what does not exist', () => {
  it('lists every absent relation, column, function and type, not only the first', async () => {
    const analysis = await analyze(`
      SELECT g.id, g.nope, d.recipient_id, missing_fn(g.id), g.id::no_such_type
        FROM grievances g JOIN deadline_alerts d ON d.deadline_id = g.id AND d.alert_trigger = 'x'
        JOIN holiday_calendar h ON h.day = g.created_at`)
    expect(kinds(analysis)).toEqual([
      'COLUMN_ABSENT:deadline_alerts.alert_trigger',
      'COLUMN_ABSENT:deadline_alerts.recipient_id',
      'COLUMN_ABSENT:grievances.nope',
      'FUNCTION_ABSENT:missing_fn/1',
      'RELATION_ABSENT:holiday_calendar',
      'TYPE_ABSENT:no_such_type',
    ])
    expect(analysis.expectedShape).toEqual({ holiday_calendar: ['day'] })
  })

  it('records the shape the code expects of an absent relation, qualified or not', async () => {
    const analysis = await analyze(`SELECT a.x, y FROM staging_proof_runs a WHERE a.z = 1`)
    expect(kinds(analysis)).toEqual(['RELATION_ABSENT:staging_proof_runs'])
    expect(analysis.expectedShape).toEqual({ staging_proof_runs: ['x', 'y', 'z'] })
  })

  it('reports an alias that no FROM clause defines', async () => {
    expect(kinds(await analyze(`SELECT ra.recipient_id FROM grievances g`))).toEqual(['ALIAS_UNRESOLVED:ra.recipient_id'])
  })

  it('reports a column in INSERT, UPDATE SET, ON CONFLICT and RETURNING', async () => {
    expect(kinds(await analyze(`INSERT INTO grievances (id, nope, title, type, organization_id) VALUES ($1, $2, $3, $4, $5)`))).toEqual(['COLUMN_ABSENT:grievances.nope'])
    expect(kinds(await analyze(`UPDATE grievances SET missing = $1, status = $2 WHERE id = $3`))).toEqual(['COLUMN_ABSENT:grievances.missing'])
    expect(kinds(await analyze(`DELETE FROM grievances WHERE nope = $1 RETURNING gone`))).toEqual(['COLUMN_ABSENT:grievances.gone', 'COLUMN_ABSENT:grievances.nope'])
  })

  it('reports an unqualified column that no relation in scope has, naming the candidates', async () => {
    const analysis = await analyze(`SELECT email FROM grievances g JOIN deadline_alerts d ON d.deadline_id = g.id`)
    expect(analysis.findings).toHaveLength(1)
    expect(analysis.findings[0]).toMatchObject({ kind: 'COLUMN_ABSENT', column: 'email', relation: 'grievances|deadline_alerts' })
  })

  it('reports a function called with the wrong number of arguments', async () => {
    expect(kinds(await analyze(`SELECT lower($1, $2)`))).toEqual(['FUNCTION_ARITY:lower/2'])
    expect((await analyze(`SELECT coalesce($1, $2, $3)`)).findings).toEqual([])
  })
})

describe('sql-census analyzer: writes', () => {
  it('reports an INSERT that omits a NOT NULL column nothing fills, and names the triggers that might', async () => {
    const grievance = await analyze(`INSERT INTO grievances (id, organization_id, title) VALUES ($1, $2, $3)`)
    expect(grievance.findings).toMatchObject([{ kind: 'INSERT_OMITS_REQUIRED', relation: 'grievances', columns: ['type'] }])
    const member = await analyze(`INSERT INTO members (email) VALUES ($1)`)
    expect(member.findings).toMatchObject([{ kind: 'INSERT_OMITS_REQUIRED', columns: ['organization_id'], detail: expect.stringContaining('members_fill') }])
  })

  it('reports an explicit NULL into a NOT NULL column, even one with a default', async () => {
    expect(kinds(await analyze(`INSERT INTO grievances (organization_id, title, type, status) VALUES ($1, $2, $3, NULL)`))).toEqual(['NULL_INTO_NOT_NULL:grievances.status'])
    expect(kinds(await analyze(`UPDATE grievances SET title = NULL WHERE id = $1`))).toEqual(['NULL_INTO_NOT_NULL:grievances.title'])
  })

  it('maps a positional INSERT onto the leading columns and counts the values', async () => {
    expect((await analyze(`INSERT INTO deadline_alerts VALUES ($1, $2)`)).findings).toEqual([])
    expect(kinds(await analyze(`INSERT INTO deadline_alerts (id, deadline_id) VALUES ($1)`))).toEqual(['INSERT_VALUE_COUNT:deadline_alerts(2 columns, 1 values)'])
  })

  it('reports a conflict target that no unique index backs, and a partial index with no predicate', async () => {
    const none = await analyze(`INSERT INTO grievances (organization_id, title, type) VALUES ($1, $2, $3) ON CONFLICT (title) DO NOTHING`)
    expect(none.findings).toMatchObject([{ kind: 'ON_CONFLICT_NO_ARBITER', object: 'grievances(title)' }])
    const partial = await analyze(`INSERT INTO members (organization_id, email) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING`)
    expect(partial.findings.map((finding) => finding.kind)).toContain('ON_CONFLICT_NO_ARBITER')
    expect((await analyze(`INSERT INTO members (organization_id, email) VALUES ($1, $2) ON CONFLICT (email) WHERE email IS NOT NULL DO NOTHING`)).findings.map((finding) => finding.kind)).not.toContain('ON_CONFLICT_NO_ARBITER')
  })

  it('reads the session settings a statement sets and reads', async () => {
    const analysis = await analyze(`SELECT set_config('app.current_org_id', $1, true), current_setting('app.current_user_id', true)`)
    expect(analysis.gucWrites).toEqual(['app.current_org_id'])
    expect(analysis.gucReads).toEqual(['app.current_user_id'])
  })
})
