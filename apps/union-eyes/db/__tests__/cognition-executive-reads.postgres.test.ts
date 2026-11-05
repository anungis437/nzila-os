/**
 * The cognition dashboard's and the executive dashboard's reads (lib/cognition/ue-adapter.ts, lib/services/dashboard-kpi-service.ts) on real PostgreSQL,
 * as the real roles.
 *
 * Both read grievances, stewards, assignments, alerts and members through the module-level handle with no organization set. As the runtime role that
 * showed every organization no case, no steward and no alert, so the pages rendered empty sections as if the organization had nothing to report. This runs the
 * unmodified functions, with only the context boundary replaced by the harness's (a tenant transaction with app.current_org_id set) and the cache (an
 * external service) by an empty one, and proves that
 *   - a steward's workload, a case's risk and the recently changed cases are scored from the organization's own rows, and another organization's case is not found;
 *   - the leadership figures count the organization's own grievances and alerts and nothing of another organization's;
 *   - the same selects with no organization set (the old behaviour) find nothing.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { memory as cognitionMemory } from '@nzila/platform-cognition-core'
import { setUeCognitionStoreRoot } from '@nzila/ue-cognition'
import { insertOrganization } from './page-reads-seed'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

vi.mock('@/db/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/lib/db/with-rls-context', async () => (await import('./native-route-harness')).rlsContextModule)
vi.mock('@/lib/services/cache-service', () => ({ cacheGet: vi.fn(async () => null), cacheSet: vi.fn(async () => undefined) }))

const { harness, RUNTIME_ROLE } = await import('./native-route-harness')
const adapter = URL ? await import('@/lib/cognition/ue-adapter') : null
const kpi = URL ? await import('@/lib/services/dashboard-kpi-service') : null
const schema = URL ? await import('@/db/schema') : null

describe.skipIf(!URL)('the cognition and executive dashboard reads on the combined schema, as the real roles', () => {
  const tag = `cg${randomUUID().slice(0, 8)}`
  // The cognition packages keep their records as files; a run must not leave any in the repository's ops/ directory.
  const storeRoot = path.join(process.cwd(), 'node_modules', '.cache', `native-cognition-${tag}`)
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const stewardA = randomUUID()
  const repUserA = randomUUID()
  let admin: pg.Client
  const ids = { a1: '', a2: '', aOld: '', b1: '', stewardRowA: '' }

  const grievance = async (organizationId: string, number: string, status: string, extra: { repId?: string | null; updatedAt?: string; deadline?: string | null } = {}) =>
    (
      await admin.query(
        `INSERT INTO grievances (grievance_number, description, organization_id, title, type, status, union_rep_id, updated_at, response_deadline, filed_date)
         VALUES ($1, 'd', $2, $3, 'grievance', $4, $5, $6, $7, now() - interval '20 days') RETURNING id::text AS id`,
        [`${number}-${tag}`, organizationId, `Title ${number}`, status, extra.repId ?? null, extra.updatedAt ?? new Date().toISOString(), extra.deadline ?? null],
      )
    ).rows[0].id as string

  beforeAll(async () => {
    fs.mkdirSync(storeRoot, { recursive: true })
    setUeCognitionStoreRoot(path.join(storeRoot, 'ue-cognition'))
    cognitionMemory.setMemoryStoreRoot(path.join(storeRoot, 'cognition-memory'))
    admin = await harness.start(URL!)
    await insertOrganization(admin, tag, { id: ORG_A })
    await insertOrganization(admin, tag, { id: ORG_B })

    ids.stewardRowA = (await admin.query(`INSERT INTO stewards (org_id, user_id, active, max_caseload, current_caseload) VALUES ($1, $2, true, 10, 4) RETURNING id::text AS id`, [ORG_A, repUserA])).rows[0].id
    await admin.query(`INSERT INTO stewards (org_id, user_id, active, max_caseload, current_caseload) VALUES ($1, $2, false, 10, 9), ($3, $4, true, 8, 8)`, [ORG_A, stewardA, ORG_B, randomUUID()])

    ids.a1 = await grievance(ORG_A, 'a1', 'escalated', { repId: repUserA, deadline: new Date(Date.now() - 86_400_000).toISOString() })
    ids.a2 = await grievance(ORG_A, 'a2', 'filed')
    ids.aOld = await grievance(ORG_A, 'a-old', 'closed', { updatedAt: '2020-01-01T00:00:00Z' })
    ids.b1 = await grievance(ORG_B, 'b1', 'escalated')
    await admin.query(`INSERT INTO grievance_events (grievance_id, event_type, actor_user_id) VALUES ($1, 'escalated', 'u'), ($1, 'created', 'u')`, [ids.a1])
    await admin.query(`INSERT INTO steward_assignments (organization_id, steward_id, steward_type, start_date, grievance_id) VALUES ($1, $2, 'steward', CURRENT_DATE, $3)`, [ORG_A, ids.stewardRowA, ids.a1])

    const employer = async (organizationId: string) =>
      (await admin.query(`INSERT INTO employers (organization_id, name, employer_type) VALUES ($1, $2, 'private') RETURNING id::text AS id`, [organizationId, `Employer ${tag}`])).rows[0].id as string
    const employerA = await employer(ORG_A)
    const employerB = await employer(ORG_B)
    await admin.query(`INSERT INTO compliance_alerts (org_id, employer_id, alert_type, severity) VALUES ($1, $2, 'reporting_overdue', 'high'), ($1, $2, 'grievance_spike', 'low'), ($3, $4, 'reporting_overdue', 'critical')`, [ORG_A, employerA, ORG_B, employerB])
  }, 120_000)

  afterAll(async () => {
    setUeCognitionStoreRoot(null)
    cognitionMemory.setMemoryStoreRoot(null)
    fs.rmSync(storeRoot, { recursive: true, force: true })
    await admin?.end()
    await harness.stop()
  })

  describe('the cognition adapter', () => {
    it('scores the workload of the organization\'s active stewards only', async () => {
      const workloads = await adapter!.scoreStewardWorkloads(ORG_A)
      expect(workloads).toHaveLength(1)
      expect(workloads[0]).toMatchObject({ stewardId: ids.stewardRowA, currentCaseload: 4, maxCaseload: 10 })
      expect(await adapter!.scoreStewardWorkloads(ORG_B)).toHaveLength(1)
      expect(JSON.stringify(await adapter!.scoreStewardWorkloads(ORG_B))).not.toContain(ids.stewardRowA)
    })

    it('scores a case of the organization, and does not find another organization\'s case or an unknown one', async () => {
      const risk = await adapter!.scoreGrievanceRisk(ORG_A, ids.a1)
      expect(risk).not.toBeNull()
      expect(JSON.stringify(risk)).toContain(ids.a1)
      expect(await adapter!.scoreGrievanceRisk(ORG_A, ids.b1)).toBeNull()
      expect(await adapter!.scoreGrievanceRisk(ORG_B, ids.a1)).toBeNull()
      expect(await adapter!.scoreGrievanceRisk(ORG_A, randomUUID())).toBeNull()
    })

    it('scores the cases changed in the window, the organization\'s own, and leaves an old one out', async () => {
      const recent = await adapter!.scoreOrgRecentCases(ORG_A, 30)
      const text = JSON.stringify(recent)
      expect(recent).toHaveLength(2)
      expect(text).toContain(ids.a1)
      expect(text).toContain(ids.a2)
      expect(text).not.toContain(ids.aOld)
      expect(text).not.toContain(ids.b1)
    })
  })

  describe('the leadership figures', () => {
    it('counts the organization\'s own grievances and alerts, and nothing of another organization\'s', async () => {
      const asA = await kpi!.getLeadershipDashboardMetrics({ organizationId: ORG_A, timeframe: 'monthly' })
      expect(asA.kpi.activeGrievances).toBe(2)
      expect(asA.compliance.metrics.openAlerts).toBe(2)
      expect(asA.compliance.alerts.map((alert) => alert.severity).sort()).toEqual(['high', 'low'])
      const asB = await kpi!.getLeadershipDashboardMetrics({ organizationId: ORG_B, timeframe: 'monthly' })
      expect(asB.kpi.activeGrievances).toBe(1)
      expect(asB.compliance.alerts.map((alert) => alert.severity)).toEqual(['critical'])
    })

    it('shows an organization with nothing real zeros from a real read', async () => {
      const empty = await kpi!.getLeadershipDashboardMetrics({ organizationId: randomUUID(), timeframe: 'monthly' })
      expect(empty.kpi.activeGrievances).toBe(0)
      expect(empty.compliance.alerts).toEqual([])
    })

    it('counts the executive figures from the organization\'s own members and grievances', async () => {
      const executive = await kpi!.getExecutiveMetrics({ organizationId: ORG_A, timeframe: 'monthly' })
      expect(executive.activeGrievances).toBe(2)
    })
  })

  it('control: the same tables read with no organization set show the runtime role nothing, which is why every read needs its context', async () => {
    const seen = await harness.tenant(RUNTIME_ROLE, null, null, async (tx) => ({
      grievances: await tx.select().from(schema!.grievances),
      stewards: await tx.select().from(schema!.stewards),
      alerts: await tx.select().from(schema!.complianceAlerts),
    }))
    expect(seen).toEqual({ grievances: [], stewards: [], alerts: [] })
  })
})
