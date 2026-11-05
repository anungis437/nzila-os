/**
 * The representative (steward) dashboard's read (lib/stewards/dashboard-data.ts) on real PostgreSQL, as the real roles.
 *
 * The page read stewards, grievances and organization_members through the module-level handle with no organization set, so the runtime role saw
 * none of them, and a failure was rendered as zeros. This runs the unmodified loader, with only the context boundary replaced by the harness's
 * (a tenant transaction with app.current_org_id set), and proves that
 *   - the figures, the workload list and the escalations are the organization's own and match what was seeded;
 *   - another organization's stewards, grievances and members appear nowhere, and an organization with none gets zeros from a real read;
 *   - the same statements with no organization set (the old page behaviour) read nothing.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { insertMember, insertOrganization } from './page-reads-seed'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

vi.mock('@/db/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/lib/db/with-rls-context', async () => (await import('./native-route-harness')).rlsContextModule)

const { harness, RUNTIME_ROLE } = await import('./native-route-harness')
const dashboard = URL ? await import('@/lib/stewards/dashboard-data') : null
const schema = URL ? await import('@/db/schema') : null

describe.skipIf(!URL)('the stewards dashboard read on the combined schema, as the real roles', () => {
  const tag = `sd${randomUUID().slice(0, 8)}`
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const EMPTY = randomUUID()
  const stewardOne = randomUUID()
  const stewardTwo = randomUUID()
  let admin: pg.Client
  let memberTwoId = ''

  const grievance = (organizationId: string, number: string, status: string, extra: { repId?: string | null; closedAt?: string | null; resolvedAt?: string | null; grievant?: string } = {}) =>
    admin.query(
      `INSERT INTO grievances (grievance_number, description, organization_id, title, type, status, union_rep_id, closed_at, resolved_at, grievant_name, escalated_at)
       VALUES ($1, 'd', $2, $3, 'grievance', $4, $5, $6, $7, $8, now())`,
      [`${number}-${tag}`, organizationId, `Title ${number}`, status, extra.repId ?? null, extra.closedAt ?? null, extra.resolvedAt ?? null, extra.grievant ?? `Grievant ${number}`],
    )

  beforeAll(async () => {
    admin = await harness.start(URL!)
    for (const id of [ORG_A, ORG_B, EMPTY]) await insertOrganization(admin, tag, { id })

    // Names come from the organization's members: one matched by organization_members.userId, one by organization_members.id.
    await insertMember(admin, ORG_A, { userId: stewardOne, name: 'Steward One' })
    memberTwoId = await insertMember(admin, ORG_A, { userId: `entra-${tag}`, name: 'Steward Two' })
    await admin.query('UPDATE organization_members SET id = $1 WHERE id = $2', [stewardTwo, memberTwoId])
    await insertMember(admin, ORG_B, { userId: randomUUID(), name: 'Somebody Else' })

    await admin.query(`INSERT INTO stewards (org_id, user_id, active, max_caseload, current_caseload) VALUES ($1, $2, true, 10, 7), ($1, $3, true, 10, 3), ($1, $4, false, 10, 9)`, [ORG_A, stewardOne, stewardTwo, randomUUID()])
    await admin.query(`INSERT INTO stewards (org_id, user_id, active, max_caseload, current_caseload) VALUES ($1, $2, true, 5, 5)`, [ORG_B, randomUUID()])

    await grievance(ORG_A, 'A-esc-assigned', 'escalated', { repId: stewardOne })
    await grievance(ORG_A, 'A-esc-open', 'escalated')
    await grievance(ORG_A, 'A-draft', 'draft')
    await grievance(ORG_A, 'A-filed', 'filed')
    await grievance(ORG_A, 'A-closed', 'closed', { closedAt: new Date().toISOString() })
    await grievance(ORG_A, 'A-settled-long-ago', 'settled', { closedAt: '2020-01-01T00:00:00Z' })
    await grievance(ORG_A, 'A-withdrawn', 'withdrawn', { resolvedAt: new Date().toISOString() })
    await grievance(ORG_B, 'B-esc', 'escalated')
    await grievance(ORG_B, 'B-closed', 'closed', { closedAt: new Date().toISOString() })
  }, 120_000)

  afterAll(async () => {
    await admin?.end()
    await harness.stop()
  })

  it('reports the organization\'s own figures, workload and escalations, with the steward a case is assigned to', async () => {
    const view = await dashboard!.loadStewardsDashboard(ORG_A)
    expect(view.stats).toEqual({ totalStewards: 2, activeCases: 10, pendingEscalations: 2, completedThisMonth: 2, successRate: 50 })
    expect(view.workload).toEqual([
      { name: 'Steward One', active: 7, capacityFreePercent: 30 },
      { name: 'Steward Two', active: 3, capacityFreePercent: 70 },
    ])
    expect(view.escalations.map((row) => ({ id: row.id, steward: row.steward, member: row.member, reason: row.reason })).sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: `A-esc-assigned-${tag}`, steward: 'Steward One', member: 'Grievant A-esc-assigned', reason: 'Title A-esc-assigned' },
      { id: `A-esc-open-${tag}`, steward: dashboard!.UNASSIGNED, member: 'Grievant A-esc-open', reason: 'Title A-esc-open' },
    ])
  })

  it('shows another organization nothing of this one, and an organization with no stewards or cases real zeros', async () => {
    const other = await dashboard!.loadStewardsDashboard(ORG_B)
    expect(other.stats).toEqual({ totalStewards: 1, activeCases: 5, pendingEscalations: 1, completedThisMonth: 1, successRate: 50 })
    expect(other.workload).toEqual([{ name: dashboard!.UNKNOWN_NAME, active: 5, capacityFreePercent: 0 }])
    expect(JSON.stringify(other)).not.toContain('Steward One')

    expect(await dashboard!.loadStewardsDashboard(EMPTY)).toEqual({
      stats: { totalStewards: 0, activeCases: 0, pendingEscalations: 0, completedThisMonth: 0, successRate: 0 },
      workload: [],
      escalations: [],
    })
  })

  it('control: the same tables read with no organization set show the runtime role nothing, which is why the page read needs its context', async () => {
    const seen = await harness.tenant(RUNTIME_ROLE, null, null, async (tx) => ({
      stewards: await tx.select().from(schema!.stewards),
      grievances: await tx.select().from(schema!.grievances),
    }))
    expect(seen).toEqual({ stewards: [], grievances: [] })
  })
})
