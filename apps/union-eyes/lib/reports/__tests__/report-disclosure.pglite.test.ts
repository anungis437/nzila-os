/**
 * F06 R2 on real SQL — the officer disclosure pipeline (authority assessment, server-measured cell sizes, suppression) run against the
 * real executor over two organizations. Proves the added count columns are valid SQL for grouped, ungrouped and joined reports, that a
 * cell is judged on distinct people and not only rows, that another organization's rows never enter a count, and that the repeated-question
 * attempts that would isolate a person are refused before any query runs.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'

const state = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('@/db/db', async () => {
  const { lateBoundDb } = await import('../../../app/api/__tests__/support/pglite-tables')
  return { db: lateBoundDb(state) }
})

import { ReportExecutor, type ReportConfig } from '@/lib/report-executor'
import { assessReportDisclosure } from '../report-field-authority'
import { suppressSmallGroups, validateReportConfig, withGroupSizeField } from '../report-config-validation'
import { isCellReport } from '../report-disclosure-limits'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'
let pg: PGlite

beforeAll(async () => {
  const { PGlite: Engine } = await import('@electric-sql/pglite')
  pg = new Engine()
  state.db = drizzle(pg)
  await pg.exec(`
    CREATE TABLE claims (id text primary key, organization_id uuid not null, claim_number text, status text, priority text,
      claim_type text, created_at timestamptz default now(), resolved_at timestamptz, member_id text, assigned_to text, resolution_outcome text);
    CREATE TABLE organization_members (id text primary key, organization_id uuid not null, name text, email text, hire_date date, role text, status text, created_at timestamptz default now());
  `)
})
afterAll(async () => { await pg.close() })

beforeEach(async () => {
  await pg.exec('TRUNCATE claims, organization_members')
  // Org A: six open claims of six people, two stale claims of two people, and one person with four closed claims.
  for (let i = 1; i <= 6; i += 1) {
    await pg.query(`INSERT INTO claims (id, organization_id, status, member_id) VALUES ($1, $2, 'open', $3)`, [`a-open-${i}`, ORG_A, `m-${i}`])
    await pg.query(`INSERT INTO organization_members (id, organization_id, name, email, role, status) VALUES ($1, $2, $3, $4, 'steward', 'active')`, [`m-${i}`, ORG_A, `Name ${i}`, `m${i}@a.test`])
  }
  for (let i = 1; i <= 2; i += 1) await pg.query(`INSERT INTO claims (id, organization_id, status, member_id) VALUES ($1, $2, 'stale', $3)`, [`a-stale-${i}`, ORG_A, `m-${i}`])
  for (let i = 1; i <= 4; i += 1) await pg.query(`INSERT INTO claims (id, organization_id, status, member_id) VALUES ($1, $2, 'closed', 'm-1')`, [`a-closed-${i}`, ORG_A])
  await pg.query(`INSERT INTO claims (id, organization_id, status, member_id) VALUES ('b-open-1', $1, 'open', 'b-m-1')`, [ORG_B])
})

/** What the route does for an officer, on the real executor. */
async function officerReport(organizationId: string, config: ReportConfig) {
  const invalid = validateReportConfig(config)
  if (invalid) return { refused: invalid }
  const disclosure = assessReportDisclosure(config)
  if (disclosure.restricted.length > 0) return { refused: disclosure.restricted }
  const cell = isCellReport(config)
  const result = await new ReportExecutor(organizationId).execute(cell ? withGroupSizeField(config) : config)
  if (!result.success) return { failed: result.error }
  const raw = ((result.data as unknown as { rows?: unknown[] }).rows ?? result.data) as Array<Record<string, unknown>>
  if (!cell) return { rows: raw, suppressed: 0 }
  const out = suppressSmallGroups(raw)
  return { rows: out.rows, suppressed: out.suppressed + out.complementary }
}

const count = { fieldId: 'id', fieldName: 'Claims', aggregation: 'count' as const }

describe('officer cells on real SQL', () => {
  it('releases a grouped report whose groups are large enough and strips the measured columns', async () => {
    // open: 6 claims / 6 people (released); closed: 4 claims / 1 person (withheld on rows and on people); stale: 2 (withheld)
    const out = await officerReport(ORG_A, { dataSourceId: 'claims', fields: [{ fieldId: 'status', fieldName: 'Status' }, count], groupBy: ['status'] })
    expect(out.suppressed).toBeGreaterThanOrEqual(2)
    expect(JSON.stringify(out.rows)).not.toContain('ue_group_')
  })

  it('judges a group on distinct people, not only rows: four claims of one person are withheld even beside a large group', async () => {
    await pg.query(`INSERT INTO claims (id, organization_id, status, member_id) VALUES ('a-closed-5', $1, 'closed', 'm-1')`, [ORG_A])
    await pg.query(`INSERT INTO claims (id, organization_id, status, member_id) VALUES ('a-closed-6', $1, 'closed', 'm-1')`, [ORG_A])
    for (let i = 1; i <= 6; i += 1) await pg.query(`INSERT INTO claims (id, organization_id, status, member_id) VALUES ($1, $2, 'denied', $3)`, [`a-denied-${i}`, ORG_A, `m-${i}`])
    const out = await officerReport(ORG_A, { dataSourceId: 'claims', fields: [{ fieldId: 'status', fieldName: 'Status' }, count], groupBy: ['status'] })
    const statuses = (out.rows as Array<{ status: string }>).map((r) => r.status).sort()
    expect(statuses).toContain('open')
    expect(statuses).toContain('denied')
    expect(statuses).not.toContain('closed')
    expect(statuses).not.toContain('stale')
  })

  it('withholds an ungrouped aggregate over a small population and counts only the caller\'s own organization', async () => {
    const own = await officerReport(ORG_A, { dataSourceId: 'claims', fields: [count] })
    expect((own.rows as Array<Record<string, unknown>>)[0]).toMatchObject({ id_count: 12 })

    // Organization B has one claim: its aggregate is withheld, and nothing of organization A's twelve is counted into it.
    const other = await officerReport(ORG_B, { dataSourceId: 'claims', fields: [count] })
    expect(other.rows).toEqual([])
    expect(other.suppressed).toBe(1)
  })

  it('runs the measured counts through a join without an ambiguous column', async () => {
    const out = await officerReport(ORG_A, {
      dataSourceId: 'organization_members',
      fields: [{ fieldId: 'role', fieldName: 'Role', table: 'organization_members' }, { fieldId: 'id', fieldName: 'Members', table: 'organization_members', aggregation: 'count' }],
      groupBy: ['role'],
      joins: [{ table: 'claims', type: 'inner', on: { leftField: 'organization_members.id', rightField: 'claims.member_id' } }],
    })
    expect(out).not.toHaveProperty('failed')
    // six members joined to their twelve claims: twelve joined rows, six distinct members behind the one group
    expect(out.rows).toEqual([expect.objectContaining({ role: 'steward', id_count: 12 })])
  })
})

describe('reconstruction attempts are refused before any query runs', () => {
  it.each([
    ['isolating one person by filter', { dataSourceId: 'claims', fields: [{ fieldId: 'status', fieldName: 's' }, count], groupBy: ['status'], filters: [{ fieldId: 'member_id', operator: 'eq' as const, value: 'm-1' }] }],
    ['grouping by a person', { dataSourceId: 'claims', fields: [{ fieldId: 'member_id', fieldName: 'm' }, count], groupBy: ['member_id'] }],
    ['a distinct "aggregate" that is a column', { dataSourceId: 'claims', fields: [{ fieldId: 'claim_number', fieldName: 'n', aggregation: 'distinct' as never }, count], groupBy: ['claim_number'] }],
    ['an e-mail search oracle through a mismatched executor column', { dataSourceId: 'organization_members', fields: [count], filters: [{ fieldId: 'status', fieldName: 'organization_members.email', operator: 'ilike' as const, value: 'm1@' }] }],
    ['member names listed through a join to claims', { dataSourceId: 'organization_members', fields: [{ fieldId: 'name', fieldName: 'n' }, { fieldId: 'status', fieldName: 's', table: 'claims' }], joins: [{ table: 'claims', type: 'inner' as const, on: { leftField: 'organization_members.id', rightField: 'claims.member_id' } }] }],
  ])('%s', async (_label, config) => {
    const out = await officerReport(ORG_A, config as ReportConfig)
    expect(out).toHaveProperty('refused')
  })

  it('narrowing a population with an organization filter is not a way into another organization', async () => {
    const out = await officerReport(ORG_A, { dataSourceId: 'claims', fields: [count], filters: [{ fieldId: 'organization_id', operator: 'eq', value: ORG_B }] })
    expect(out).toHaveProperty('refused')
  })
})
