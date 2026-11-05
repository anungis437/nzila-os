import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { similarNames } from '../lib/sql-census/classify'
import { parametersInsideLiterals } from '../lib/sql-census/judge'
import { extractSites, type SqlSite } from '../lib/sql-census/sites'

const FIXTURES = path.resolve(__dirname, 'fixtures', 'sql-census')

function sitesOf(): SqlSite[] {
  const program = ts.createProgram([path.join(FIXTURES, 'sample.ts')], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
  })
  return extractSites(program, FIXTURES.replace(/\\/g, '/')).sites
}

const where = (sites: SqlSite[], marker: string): SqlSite => {
  const found = sites.find((site) => site.variants.some((variant) => variant.text.includes(marker)))
  if (!found) throw new Error(`no site contains ${marker}: ${JSON.stringify(sites.map((site) => site.variants.map((variant) => variant.text)))}`)
  return found
}

describe('sql-census site extraction', () => {
  const sites = sitesOf()

  it('renders a drizzle column and table with their physical names and binds a value', () => {
    expect(where(sites, '"things"."id"').variants[0]).toMatchObject({
      text: 'SELECT "things"."id", "things"."title_col" FROM "things" WHERE "things"."id" = $1',
      parameters: 1,
      holes: [],
    })
  })

  it('yields both branches of a conditional fragment', () => {
    const texts = where(sites, 'SELECT 1 FROM things').variants.map((variant) => variant.text.replace(/\s+/g, ' ').trim())
    expect(texts).toEqual(expect.arrayContaining(['SELECT 1 FROM things WHERE id = $1', 'SELECT 1 FROM things']))
  })

  it('follows constants into a string passed to query() and binds the pg placeholder as written', () => {
    const site = where(sites, 'SELECT id, title_col FROM things')
    expect(site).toMatchObject({ form: 'string-argument', executor: 'client' })
    expect(site.variants[0].text).toBe('SELECT id, title_col FROM things WHERE id = $1')
  })

  it('spreads an array bound into a drizzle template into a row, which is what drizzle sends', () => {
    expect(where(sites, 'ANY(').variants[0].text).toBe('SELECT 1 FROM things WHERE id = ANY(($1, $2))')
  })

  it('marks a branch written for another engine', () => {
    expect(sites.find((site) => site.variants[0].text === 'GETUTCDATE()')?.dialect).toBe('mssql')
    expect(sites.find((site) => site.variants[0].text === 'NOW()')?.dialect).toBeNull()
  })

  it('names what it cannot know instead of guessing', () => {
    const variant = where(sites, 'WHERE __hole__').variants[0]
    expect(variant.holes).toEqual([expect.stringContaining('untyped-parameter')])
  })

  it('records a value spliced into SQL text, which is not bound', () => {
    expect(where(sites, "title_col = '__hole__'").interpolated).toEqual(['name'])
  })

  it('keeps English that begins like a statement as a literal for the judge to refuse, not as a statement', () => {
    const site = sites.find((candidate) => candidate.form === 'string-literal')
    expect(site?.variants[0].text).toBe('Select an option from the list below')
  })
})

describe('sql-census parameters inside literals', () => {
  it('finds a placeholder the driver would never bind', () => {
    expect(parametersInsideLiterals("SELECT 1 WHERE x LIKE '%$1%' AND y = $2")).toEqual(['$1'])
    expect(parametersInsideLiterals("SELECT now() - INTERVAL '$1 days'")).toEqual(['$1'])
  })

  it('ignores placeholders outside literals, in identifiers, comments and dollar-quoted bodies', () => {
    expect(parametersInsideLiterals('SELECT $1, $2')).toEqual([])
    expect(parametersInsideLiterals('SELECT "a$1" FROM t')).toEqual([])
    expect(parametersInsideLiterals("SELECT 1 -- '$1'\n")).toEqual([])
    expect(parametersInsideLiterals("DO $body$ BEGIN PERFORM '$1'; END $body$")).toEqual([])
    expect(parametersInsideLiterals("SELECT 'it''s' || $1")).toEqual([])
  })
})

describe('sql-census similar names', () => {
  it('finds the physical name a statement meant', () => {
    expect(similarNames('subtotal_cad', ['subtotal', 'tax_amount', 'total_amount'])[0]).toBe('subtotal')
    expect(similarNames('holiday_calendar', ['holidays', 'claims', 'users'])).toContain('holidays')
    expect(similarNames('governed_policies', ['governance_policies', 'users'])).toContain('governance_policies')
  })

  it('offers nothing when nothing resembles it', () => {
    expect(similarNames('platform_login_events', ['claims', 'grievances', 'users'])).toEqual([])
  })
})
