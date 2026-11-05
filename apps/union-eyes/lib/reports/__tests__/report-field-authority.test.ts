/**
 * S54 / F06 R2 — field-level disclosure authority for ad-hoc reports.
 *
 * Every case is a way an officer could try to reconstruct member or claim information, or a way the earlier authority check was blind to:
 * a `distinct` aggregation that was really a plain column, a join that listed another table's rows, a filter whose executor-side column
 * differs from the id the route validated, identifiers used as filters, groups or sorts, and cells too small to be anonymous.
 */
import { describe, expect, it, vi } from 'vitest'
import type { ReportConfig } from '@/lib/report-executor'

vi.mock('@/lib/report-executor', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/report-executor')>()
  return { ...real, db: undefined }
})

import { assessReportDisclosure, dateFilterIsMonthCoarse } from '../report-field-authority'
import { adminOnlyReportSelections, suppressSmallGroups, validateReportConfig, withGroupSizeField } from '../report-config-validation'

const cfg = (over: Partial<ReportConfig> & { dataSourceId: string }): ReportConfig => ({ fields: [], ...over }) as ReportConfig
const count = (fieldId: string, table?: string) => ({ fieldId, fieldName: fieldId, aggregation: 'count' as const, ...(table ? { table } : {}) })

describe('what an officer may not do', () => {
  it.each([
    ['listing claim rows', cfg({ dataSourceId: 'claims', fields: [{ fieldId: 'claim_number', fieldName: 'n' }] }), 'claims.claim_number'],
    ['listing member names', cfg({ dataSourceId: 'organization_members', fields: [{ fieldId: 'name', fieldName: 'n' }] }), 'organization_members.name'],
    ['listing member e-mail', cfg({ dataSourceId: 'organization_members', fields: [{ fieldId: 'email', fieldName: 'n' }] }), 'organization_members.email'],
    ['listing matter attributes row by row', cfg({ dataSourceId: 'claims', fields: [{ fieldId: 'status', fieldName: 's' }] }), 'claims.status (row listing)'],
    ['listing dues amounts row by row', cfg({ dataSourceId: 'dues_assignments', fields: [{ fieldId: 'amount', fieldName: 'a' }] }), 'dues_assignments.amount (row listing)'],
  ])('refuses %s', (_label, config, expected) => {
    expect(adminOnlyReportSelections(config)).toContain(expected)
  })

  it('refuses a `distinct` aggregation of an identifier, which the executor ran as a plain column', () => {
    const config = cfg({ dataSourceId: 'claims', fields: [{ fieldId: 'claim_number', fieldName: 'n', aggregation: 'distinct' as never }] })
    expect(validateReportConfig(config)).toBeNull()
    // translated to the executor's own count_distinct, which releases a number and not the column
    expect(config.fields[0].aggregation).toBe('count_distinct')
    expect(adminOnlyReportSelections(config)).toEqual([])
  })

  it('refuses an aggregation the executor does not run (string_agg lists identifiers, min/max of one releases it)', () => {
    expect(validateReportConfig(cfg({ dataSourceId: 'claims', fields: [{ fieldId: 'claim_number', fieldName: 'n', aggregation: 'string_agg' as never }] }))).toMatch(/Invalid aggregation/)
    expect(adminOnlyReportSelections(cfg({ dataSourceId: 'claims', fields: [{ fieldId: 'claim_number', fieldName: 'n', aggregation: 'min' }] }))).toContain('claims.claim_number (min)')
    expect(adminOnlyReportSelections(cfg({ dataSourceId: 'organization_members', fields: [{ fieldId: 'email', fieldName: 'e', aggregation: 'max' }] }))).toContain('organization_members.email (max)')
  })

  it('refuses claim rows listed through a join from a source an officer may otherwise report on', () => {
    const config = cfg({
      dataSourceId: 'organization_members',
      fields: [{ fieldId: 'role', fieldName: 'r' }, { fieldId: 'status', fieldName: 's', table: 'claims' }],
      joins: [{ table: 'claims', type: 'inner', on: { leftField: 'organization_members.id', rightField: 'claims.member_id' } }],
    })
    expect(adminOnlyReportSelections(config)).toContain('claims.status (row listing)')
  })

  it('refuses a filter whose executor-side column is an identifier though the validated id is not', () => {
    const config = cfg({
      dataSourceId: 'claims',
      fields: [count('id')],
      filters: [{ fieldId: 'status', fieldName: 'claims.claim_number', operator: 'ilike', value: 'A' }],
    })
    expect(adminOnlyReportSelections(config)).toContain('claims.claim_number')
  })

  it.each([
    ['filtering by', { filters: [{ fieldId: 'member_id', operator: 'eq' as const, value: 'm1' }] }],
    ['grouping by', { groupBy: ['member_id'] }],
    ['sorting by', { sortBy: [{ fieldId: 'assigned_to', direction: 'asc' as const }] }],
    ['a having condition on', { having: [{ fieldId: 'claim_number', operator: 'eq' as const, value: 'x' }] }],
  ])('refuses %s a person or matter identifier (a search oracle and a way to isolate one person)', (_label, extra) => {
    const config = cfg({ dataSourceId: 'claims', fields: [count('id')], ...extra })
    expect(adminOnlyReportSelections(config).length).toBeGreaterThan(0)
  })

  it('treats an unknown column as an identifier', () => {
    expect(adminOnlyReportSelections(cfg({ dataSourceId: 'claims', fields: [count('id')], filters: [{ fieldId: 'ssn', operator: 'eq', value: '1' }] })).length).toBeGreaterThan(0)
    expect(adminOnlyReportSelections(cfg({ dataSourceId: 'claims', fields: [count('id')], groupBy: ['claims.secret'] })).length).toBeGreaterThan(0)
  })
})

describe('what an officer may still do', () => {
  it('counts and groups by non-identifying matter dimensions', () => {
    const config = cfg({
      dataSourceId: 'claims',
      fields: [{ fieldId: 'status', fieldName: 's' }, count('id')],
      groupBy: ['status'],
      filters: [{ fieldId: 'created_at', operator: 'gte', value: '2026-01-01' }],
    })
    expect(adminOnlyReportSelections(config)).toEqual([])
  })

  it('counts distinct people and sums dues over a population', () => {
    expect(adminOnlyReportSelections(cfg({ dataSourceId: 'dues_assignments', fields: [{ fieldId: 'member_id', fieldName: 'm', aggregation: 'count_distinct' }, { fieldId: 'amount', fieldName: 'a', aggregation: 'sum' }] }))).toEqual([])
  })

  it('lists only operational columns that identify nobody', () => {
    expect(adminOnlyReportSelections(cfg({ dataSourceId: 'organization_members', fields: [{ fieldId: 'status', fieldName: 's' }] }))).toEqual([])
  })

  it('records the classes it returns and a value-free shape of the question', () => {
    const a = assessReportDisclosure(cfg({ dataSourceId: 'claims', fields: [{ fieldId: 'status', fieldName: 's' }, count('id')], groupBy: ['status'], filters: [{ fieldId: 'priority', operator: 'eq', value: 'high' }] }))
    const b = assessReportDisclosure(cfg({ dataSourceId: 'claims', fields: [{ fieldId: 'status', fieldName: 's' }, count('id')], groupBy: ['status'], filters: [{ fieldId: 'priority', operator: 'eq', value: 'low' }] }))
    expect(a.classesReturned).toEqual(['matter'])
    expect(a.filtered).toContain('claims.priority')
    expect(a.shape).toBe(b.shape)
    expect(JSON.stringify(a)).not.toContain('high')
  })
})

describe('cells too small to be anonymous', () => {
  it('measures size and people on the base table by itself, for a grouped report and an ungrouped aggregate, and never for a listing', () => {
    const grouped = withGroupSizeField(cfg({ dataSourceId: 'claims', fields: [count('id')], groupBy: ['status'] }))
    expect(grouped.fields.slice(-2).map((f) => [f.fieldId, f.table, f.aggregation, f.alias])).toEqual([
      ['member_id', 'claims', 'count_distinct', 'ue_group_people'],
      ['id', 'claims', 'count_distinct', 'ue_group_size'],
    ])
    expect(withGroupSizeField(cfg({ dataSourceId: 'claim_deadlines', fields: [count('id')] })).fields.slice(-2)[0].fieldId).toBe('claim_id')
    const listing = cfg({ dataSourceId: 'organization_members', fields: [{ fieldId: 'status', fieldName: 's' }] })
    expect(withGroupSizeField(listing)).toBe(listing)
  })

  it('withholds on either count and withholds a lone suppressed neighbour so a total cannot be subtracted', () => {
    const out = suppressSmallGroups([
      { k: 'a', ue_group_size: 50, ue_group_people: 2 },
      { k: 'b', ue_group_size: 6, ue_group_people: 6 },
      { k: 'c', ue_group_size: 30, ue_group_people: 20 },
    ])
    expect(out.rows).toEqual([{ k: 'c' }])
    expect(out).toMatchObject({ suppressed: 1, complementary: 1 })
  })

  it('does not add a complementary cell when several are withheld or when nothing is', () => {
    const several = suppressSmallGroups([
      { k: 'a', ue_group_size: 1, ue_group_people: 1 },
      { k: 'b', ue_group_size: 2, ue_group_people: 2 },
      { k: 'c', ue_group_size: 9, ue_group_people: 9 },
    ])
    expect(several.rows).toEqual([{ k: 'c' }])
    expect(several.complementary).toBe(0)
    const none = suppressSmallGroups([{ k: 'a', ue_group_size: 9, ue_group_people: 9 }])
    expect(none).toMatchObject({ suppressed: 0, complementary: 0 })
    expect(none.rows).toEqual([{ k: 'a' }])
  })

  it('treats a missing or non-numeric measure as too small', () => {
    expect(suppressSmallGroups([{ k: 'a' }, { k: 'b', ue_group_size: 'x', ue_group_people: 9 }]).rows).toEqual([])
  })
})

describe('date filters that would let two large cells be subtracted into one person', () => {
  const claimsBy = (filter: Record<string, unknown>) => cfg({ dataSourceId: 'claims', fields: [count('id')], filters: [{ fieldId: 'created_at', ...filter } as never] })

  it.each([
    ['a start-of-month lower bound', { operator: 'gte', value: '2026-03-01' }, true],
    ['a month-start timestamp', { operator: 'lt', value: '2026-04-01T00:00:00Z' }, true],
    ['a year-month', { operator: 'gte', value: '2026-03' }, true],
    ['a range between month starts', { operator: 'between', values: ['2026-03-01', '2026-04-01'] }, true],
    ['a null test', { operator: 'is_null' }, true],
    ['a day', { operator: 'gte', value: '2026-03-14' }, false],
    ['a range ending on a day', { operator: 'between', values: ['2026-03-01', '2026-03-31'] }, false],
    ['a single instant', { operator: 'eq', value: '2026-03-01' }, false],
    ['a list of dates', { operator: 'in', values: ['2026-03-01'] }, false],
    ['a pattern', { operator: 'like', value: '2026-03%' }, false],
    ['a number', { operator: 'gte', value: 20260301 }, false],
    ['no value at all', { operator: 'gte' }, false],
  ])('judges %s', (_name, filter, coarse) => {
    expect(dateFilterIsMonthCoarse(filter as never)).toBe(coarse)
    const restricted = assessReportDisclosure(claimsBy(filter)).restricted
    expect(restricted.includes('claims.created_at (date filter finer than a month)')).toBe(!coarse)
  })

  it('applies to every date column, whatever its class, and not to a column that is not a date', () => {
    const day = { operator: 'gte', value: '2026-03-14' }
    for (const [source, column] of [['organization_members', 'hire_date'], ['organization_members', 'created_at'], ['claims', 'resolved_at'], ['claim_deadlines', 'due_date'], ['dues_assignments', 'effective_date']]) {
      const config = cfg({ dataSourceId: source, fields: [count('id')], filters: [{ fieldId: column, ...day } as never] })
      expect(assessReportDisclosure(config).restricted, `${source}.${column}`).toContain(`${source}.${column} (date filter finer than a month)`)
    }
    const status = cfg({ dataSourceId: 'claims', fields: [count('id')], filters: [{ fieldId: 'status', operator: 'eq', value: 'open' } as never] })
    expect(assessReportDisclosure(status).restricted.some((entry) => entry.includes('date filter'))).toBe(false)
  })

  it('catches the executor-side column named in fieldName as well as the validated id', () => {
    const config = cfg({ dataSourceId: 'claims', fields: [count('id')], filters: [{ fieldId: 'status', fieldName: 'claims.resolved_at', operator: 'gte', value: '2026-03-14' } as never] })
    expect(assessReportDisclosure(config).restricted).toContain('claims.resolved_at (date filter finer than a month)')
  })
})