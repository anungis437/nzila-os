/**
 * The admin routes on real PostgreSQL, as the real roles (UE-CONV-H-019).
 *
 * Every route here was wrapped by a deprecated guard that authenticated the caller and gave the handler no database context, and what each one reads or writes
 * needs one:
 *   - the CLC analytics read the organization's per-capita remittances, and the representation protocol is a row of the organization's configuration. Outside a
 *     tenant transaction the ambient handle is the runtime role with no organization, on which row-level security shows both as empty;
 *   - the billing, dues-reminder and payment-retry operations are platform operations: they work across every organization, so they run as the system role
 *     (organization_billing_config is system-only, and the runtime role cannot read it at all), and only for a caller with platform authority.
 * The unit tests replace the database and the CI HTTP runtime connects as a superuser, so neither noticed. This runs the unmodified routes and services against
 * the combined Django + Drizzle schema, with only the request boundary replaced (see native-route-harness.ts) and the e-mail and billing-cycle boundaries
 * recorded, and proves that
 *   - the analytics routes ask for a tenant transaction, an organization's analytics are computed from its own remittances and never another organization's, and a
 *     handle with no organization sees no remittance;
 *   - the representation protocol is saved in the caller organization (as pending approval, audited with the save), read back only there, approved only by a
 *     different administrator, and a body that is not an approval is never read as one;
 *   - the platform operations see every organization's records: the reminder job reminds and marks the dues of both organizations, the retry job escalates the
 *     failed payments of both, the billing trigger enumerates the billing configuration of both, while a tenant handle sees only its own organization and the
 *     runtime role cannot read the billing configuration; each is recorded as an audited platform operation of the acting organization and user;
 *   - a caller below a route's role floor is refused before any statement runs.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

const boundary = vi.hoisted(() => ({
  messages: [] as Array<Record<string, any>>,
  cycles: [] as Array<Record<string, any>>,
}))

vi.mock('@/db/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/lib/db/with-rls-context', async () => (await import('./native-route-harness')).rlsContextModule)
vi.mock('@/lib/audit/atomic-audit', async () => ({ persistAtomicAudit: (await import('./native-route-harness')).recordAudit }))
vi.mock('@/lib/api/with-api', async () => ({ withApi: (await import('./native-route-harness')).emulatedWithApi }))
// The rate limiter's counters live in Redis, which this database does not have: that boundary answers "allowed"
vi.mock('@/lib/rate-limiter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limiter')>()),
  checkRateLimit: async () => ({ allowed: true, limit: 100, remaining: 99, resetIn: 60 }),
}))
// The e-mail and the per-organization billing cycle are the boundaries; what the jobs hand to them is what is asserted.
vi.mock('@/lib/services/notification-service', () => ({
  getNotificationService: () => ({
    send: async (message: Record<string, any>) => {
      boundary.messages.push(message)
      return { id: `message-${boundary.messages.length}` }
    },
  }),
}))
vi.mock('@/lib/services/billing-cycle-service', () => ({
  BillingCycleService: {
    calculatePeriodDates: () => ({ periodStart: new Date('2026-01-01T00:00:00Z'), periodEnd: new Date('2026-01-31T00:00:00Z') }),
    generateBillingCycle: async (params: Record<string, any>) => {
      boundary.cycles.push(params)
      return { success: true, transactionsCreated: 0, totalAmount: 0 }
    },
  },
}))

const { harness, RUNTIME_ROLE } = await import('./native-route-harness')
const annualReport = URL ? await import('@/app/api/admin/clc/analytics/annual-report/route') : null
const forecast = URL ? await import('@/app/api/admin/clc/analytics/forecast/route') : null
const trends = URL ? await import('@/app/api/admin/clc/analytics/multi-year-trends/route') : null
const protocol = URL ? await import('@/app/api/admin/representation-protocol/route') : null
const reminders = URL ? await import('@/app/api/admin/dues/send-reminders/route') : null
const retry = URL ? await import('@/app/api/admin/payments/retry-failed/route') : null
const billing = URL ? await import('@/app/api/admin/billing-cycles/trigger-scheduled/route') : null

type Row = Record<string, any>
type Who = { organizationId: string; userId: string; role: string }
type Handler = (ctx: unknown) => Promise<Response>
const run = (handler: unknown, ctx: unknown) => (handler as Handler)(ctx)
const rejection = async (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error as { code?: string; message?: string })
const answer = async (response: Response) => ({ status: response.status, body: (await response.json()) as Row })

describe.skipIf(!URL)('the admin routes on the combined schema, as the real roles', () => {
  const tag = randomUUID().slice(0, 8)
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const ORG_C = randomUUID()
  const adminA: Who = { organizationId: ORG_A, userId: `admin-a-${tag}`, role: 'admin' }
  const secondAdminA: Who = { organizationId: ORG_A, userId: `admin-a2-${tag}`, role: 'admin' }
  const adminB: Who = { organizationId: ORG_B, userId: `admin-b-${tag}`, role: 'admin' }
  const officerA: Who = { organizationId: ORG_A, userId: `officer-a-${tag}`, role: 'officer' }
  const leadA: Who = { organizationId: ORG_A, userId: `lead-a-${tag}`, role: 'platform_lead' }
  const stewardA: Who = { organizationId: ORG_A, userId: `steward-a-${tag}`, role: 'steward' }
  const MEMBER_A = randomUUID()
  const MEMBER_B = randomUUID()
  const DUES_A = randomUUID()
  const DUES_B = randomUUID()
  const DUES_LEGACY = randomUUID()
  const FAILED_A = randomUUID()
  const FAILED_B = randomUUID()
  let admin: pg.Client

  const query = async (sql: string, params: unknown[] = []) => (await admin.query(sql, params)).rows as Row[]
  const as = (who: Who, url: string, init: RequestInit = {}) => ({ organizationId: who.organizationId, userId: who.userId, role: who.role, request: new NextRequest(url, init as ConstructorParameters<typeof NextRequest>[1]) })
  const post = (who: Who, url: string, body?: unknown) =>
    as(who, url, { method: 'POST', ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }) })
  const summaryOf = (summary: string) => harness.configs.find((config) => config.openapi?.summary === summary) as unknown as { rlsOrgContext?: boolean; auth?: { minRole?: string } }

  const newOrganization = (id: string, name: string) =>
    admin.query(
      `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
       VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
      [id, name, `${name.toLowerCase().replace(/\W+/g, '-')}-${tag}-${id.slice(0, 6)}`],
    )
  const monthsAgo = (count: number) => {
    const date = new Date()
    date.setDate(1)
    date.setMonth(date.getMonth() - count)
    return { month: date.getMonth() + 1, year: date.getFullYear() }
  }
  const daysFromNow = (count: number) => {
    const date = new Date()
    date.setDate(date.getDate() + count)
    return date.toISOString().split('T')[0]
  }
  const newRemittance = (from: string, count: number, amount: string, status: string) => {
    const { month, year } = monthsAgo(count)
    return admin.query(
      `INSERT INTO per_capita_remittances (organization_id, from_organization_id, to_organization_id, remittance_month, remittance_year, due_date, total_members, good_standing_members, remittable_members, per_capita_rate, total_amount, status)
       VALUES ($1,$1,$2,$3,$4,$5,100,90,90,1.00,$6,$7)`,
      [from, ORG_C, month, year, `${year}-${String(month).padStart(2, '0')}-28`, amount, status],
    )
  }
  const newDues = (id: string, organizationId: string, memberId: string, dueDate: string, metadata: Record<string, unknown>) =>
    admin.query(
      `INSERT INTO dues_transactions (id, organization_id, member_id, transaction_type, amount, period_start, period_end, due_date, status, dues_amount, total_amount, metadata)
       VALUES ($1,$2,$3,'monthly_dues',50.00,'2026-01-01','2026-01-31',$4,'pending',50.00,50.00,$5::jsonb)`,
      [id, organizationId, memberId, dueDate, JSON.stringify(metadata)],
    )

  beforeAll(async () => {
    admin = await harness.start(URL!)
    for (const [id, name] of [[ORG_A, 'Admin A'], [ORG_B, 'Admin B'], [ORG_C, 'Admin Congress']] as const) await newOrganization(id, `${name} ${tag}`)
    for (const who of [adminA, secondAdminA, adminB, officerA, leadA, stewardA]) harness.setRole(who.userId, who.organizationId, who.role)

    await newRemittance(ORG_A, 1, '100.00', 'paid')
    await newRemittance(ORG_A, 2, '200.00', 'paid')
    await newRemittance(ORG_A, 3, '300.00', 'pending')
    await newRemittance(ORG_B, 1, '999.00', 'paid')

    for (const [id, userId, organizationId, name] of [[MEMBER_A, `member-a-${tag}`, ORG_A, 'Member A'], [MEMBER_B, `member-b-${tag}`, ORG_B, 'Member B']] as const) {
      await admin.query(
        `INSERT INTO organization_members (id, user_id, organization_id, role, status, is_primary, name, email, joined_at, created_at, updated_at)
         VALUES ($1,$2,$3,'member','active',false,$4,$5,now(),now(),now())`,
        [id, userId, organizationId, name, `${userId}@union.test`],
      )
    }
    await newDues(DUES_A, ORG_A, MEMBER_A, daysFromNow(7), {})
    await newDues(DUES_B, ORG_B, MEMBER_B, daysFromNow(7), {})
    // A legacy dues row whose member id is not a uuid: no member can be found for it
    await newDues(DUES_LEGACY, ORG_A, 'legacy-member-17', daysFromNow(7), {})
    await newDues(FAILED_A, ORG_A, MEMBER_A, daysFromNow(30), { failureCount: 4 })
    await newDues(FAILED_B, ORG_B, MEMBER_B, daysFromNow(30), { failureCount: 4 })
    await admin.query(
      `INSERT INTO organization_billing_config (organization_id, billing_frequency, enabled) VALUES ($1,'monthly',true), ($2,'monthly',true)`,
      [ORG_A, ORG_B],
    )
  }, 120_000)

  afterAll(async () => {
    await admin?.end()
    await harness.stop()
  })

  describe('the analytics: why the routes open a tenant transaction', () => {
    it('asks the wrapper for one, for an administrator, on every analytics route', () => {
      for (const summary of ['CLC annual compliance report', 'CLC remittance forecast', 'CLC multi-year remittance trends']) {
        expect(summaryOf(summary)).toMatchObject({ rlsOrgContext: true, auth: { minRole: 'admin' } })
      }
    })

    it('sees no remittance on a handle with no organization, and only its own on a tenant handle', async () => {
      const schema = await import('@/db/schema')
      expect(await harness.tenant(RUNTIME_ROLE, null, adminA.userId, (tx) => tx.select().from(schema.perCapitaRemittances))).toEqual([])
      const own = await harness.tenant(RUNTIME_ROLE, ORG_B, adminB.userId, (tx) => tx.select().from(schema.perCapitaRemittances))
      expect(own.map((row) => row.fromOrganizationId)).toEqual([ORG_B])
    })
  })

  describe('the analytics', () => {
    it("forecasts from the caller organization's own remittances and no other organization's", async () => {
      const a = await answer(await run(forecast!.GET, as(adminA, 'http://localhost/api/admin/clc/analytics/forecast?months=3')))
      expect(a.status).toBe(200)
      expect(a.body).toHaveLength(3)
      expect(a.body[0]).toMatchObject({ forecastAmount: 200, method: 'moving_average' })
      const b = await answer(await run(forecast!.GET, as(adminB, 'http://localhost/api/admin/clc/analytics/forecast?months=3')))
      expect(b.body[0]).toMatchObject({ forecastAmount: 999, method: 'insufficient_data' })
    })

    it('reports the annual figures of the organization, not of the whole federation', async () => {
      const { year } = monthsAgo(1)
      const a = await answer(await run(annualReport!.GET, as(adminA, `http://localhost/api/admin/clc/analytics/annual-report?year=${year}`)))
      expect(a.status).toBe(200)
      expect(a.body.summary.totalOrganizations).toBe(1)
      expect(a.body.summary.totalAmount).toBeLessThanOrEqual(600)
      expect(a.body.organizationPerformance.map((row: Row) => row.organizationId)).toEqual([ORG_A])
      const b = await answer(await run(annualReport!.GET, as(adminB, `http://localhost/api/admin/clc/analytics/annual-report?year=${year}`)))
      expect(b.body.organizationPerformance.map((row: Row) => row.organizationId)).toEqual([ORG_B])
      expect(b.body.summary.totalAmount).toBe(999)
    })

    it('charts the multi-year trend of the organization, from its own remittances', async () => {
      const a = await answer(await run(trends!.GET, as(adminA, 'http://localhost/api/admin/clc/analytics/multi-year-trends?years=3')))
      expect(a.status).toBe(200)
      const totals = (body: Row) => body.totalAmountTrend.reduce((sum: number, entry: Row) => sum + entry.value, 0)
      expect(totals(a.body)).toBe(600)
      const b = await answer(await run(trends!.GET, as(adminB, 'http://localhost/api/admin/clc/analytics/multi-year-trends?years=3')))
      expect(totals(b.body)).toBe(999)
    })

    it('answers a malformed parameter as a client error', async () => {
      expect((await run(forecast!.GET, as(adminA, 'http://localhost/api/admin/clc/analytics/forecast?months=99'))).status).toBe(400)
      expect((await run(trends!.GET, as(adminA, 'http://localhost/api/admin/clc/analytics/multi-year-trends?years=4'))).status).toBe(400)
      expect((await run(annualReport!.GET, as(adminA, 'http://localhost/api/admin/clc/analytics/annual-report?year=1900'))).status).toBe(400)
    })
  })

  describe('the representation protocol', () => {
    const url = 'http://localhost/api/admin/representation-protocol'
    const body = (primaryRepresentative = 'steward') => ({
      protocol: {
        version: 1,
        primaryRepresentative,
        stewardPermissions: { canFileGrievance: true, canRepresent: true, canBeAssigned: true, canContactEmployer: false, canEscalate: true },
        representativeLabel: 'Representative',
        stewardLabel: 'Steward',
        minimumFilingRole: 'member',
        minimumRepresentationRole: 'steward',
      },
    })
    const save = (who: Who, payload: unknown) => run(protocol!.PUT, as(who, url, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }))

    it('asks the wrapper for an administrator and a tenant transaction on every method', () => {
      for (const summary of [
        'Read the representation protocol of the current organization',
        'Save the representation protocol of the current organization as pending approval',
        'Approve the pending representation protocol, or submit the legacy one for approval',
      ]) {
        expect(summaryOf(summary)).toMatchObject({ rlsOrgContext: true, auth: { minRole: 'admin' } })
      }
    })

    it('has nothing configured for an organization that saved nothing, and sees no configuration on a handle with no organization', async () => {
      const read = await answer(await run(protocol!.GET, as(adminB, url)))
      expect(read.body.execution).toMatchObject({ status: 'missing', executable: false })
      const schema = await import('@/db/schema')
      expect(await harness.tenant(RUNTIME_ROLE, null, adminB.userId, (tx) => tx.select().from(schema.orgConfigurations))).toEqual([])
    })

    it('saves the protocol in the caller organization as pending approval, audits the save, and reads it back only there', async () => {
      const before = harness.audits.length
      const saved = await answer(await save(adminA, body('lro')))
      expect(saved.status).toBe(200)
      expect(saved.body.execution).toEqual({ status: 'pending_approval', executable: false })
      const rows = await query(`SELECT organization_id, updated_by, value FROM org_configurations WHERE key = 'representation_protocol' AND organization_id = $1`, [ORG_A])
      expect(rows).toHaveLength(1)
      expect(rows[0].value.approval).toMatchObject({ configuredBy: adminA.userId })
      expect(rows[0].value.approval.approvedBy).toBeUndefined()
      expect(harness.audits.slice(before)).toEqual([expect.objectContaining({ action: 'representation_protocol.save', organizationId: ORG_A, userId: adminA.userId })])

      const readA = await answer(await run(protocol!.GET, as(adminA, url)))
      expect(readA.body.protocol.primaryRepresentative).toBe('lro')
      expect(readA.body.execution).toMatchObject({ status: 'pending_approval', executable: false })
      const readB = await answer(await run(protocol!.GET, as(adminB, url)))
      expect(readB.body.execution.status).toBe('missing')
      expect(await query(`SELECT 1 FROM org_configurations WHERE key = 'representation_protocol' AND organization_id = $1`, [ORG_B])).toEqual([])
    })

    it('is refused a forged approval or a malformed protocol, and stores nothing new', async () => {
      const before = (await query(`SELECT value FROM org_configurations WHERE key = 'representation_protocol' AND organization_id = $1`, [ORG_A]))[0].value
      expect((await answer(await save(adminA, { protocol: { ...body().protocol, version: 2 } }))).status).toBe(400)
      expect((await answer(await save(adminA, 'not json'))).status).toBe(400)
      expect((await query(`SELECT value FROM org_configurations WHERE key = 'representation_protocol' AND organization_id = $1`, [ORG_A]))[0].value).toEqual(before)
    })

    it('is not approved by its author, nor by a body that is not an approval, and is approved by a different administrator, with the audit', async () => {
      expect((await answer(await run(protocol!.POST, post(adminA, url)))).status).toBe(403)
      for (const payload of ['{bad', JSON.stringify({ action: 'delete' }), JSON.stringify(['approve'])]) {
        expect((await answer(await run(protocol!.POST, post(secondAdminA, url, payload)))).status).toBe(400)
      }
      expect((await query(`SELECT value->'approval'->>'approvedBy' AS approver FROM org_configurations WHERE key = 'representation_protocol' AND organization_id = $1`, [ORG_A]))[0].approver).toBeNull()

      const before = harness.audits.length
      const approved = await answer(await run(protocol!.POST, post(secondAdminA, url)))
      expect(approved.status).toBe(200)
      expect(approved.body.execution).toEqual({ status: 'approved', executable: true })
      expect((await query(`SELECT value->'approval'->>'approvedBy' AS approver FROM org_configurations WHERE key = 'representation_protocol' AND organization_id = $1`, [ORG_A]))[0].approver).toBe(secondAdminA.userId)
      expect(harness.audits.slice(before)).toEqual([expect.objectContaining({ action: 'representation_protocol.approve', organizationId: ORG_A, userId: secondAdminA.userId })])
    })

    it('has nothing to approve for an organization that saved nothing', async () => {
      expect((await answer(await run(protocol!.POST, post(adminB, url)))).status).toBe(404)
    })
  })

  describe('the platform operations', () => {
    it('ask the wrapper for a platform lead, and for no tenant transaction: they run as the system role', () => {
      for (const summary of ['Manually trigger the dues reminder job', 'Manually trigger the failed payment retry job', 'Manually trigger scheduled billing for every organization']) {
        const options = summaryOf(summary)
        expect(options.auth?.minRole, summary).toBe('platform_lead')
        expect(options.rlsOrgContext, summary).toBeUndefined()
      }
    })

    it('shows a tenant handle only its own organization, and a handle with no organization nothing, which is why the jobs run as the system role', async () => {
      const schema = await import('@/db/schema')
      const owned = await harness.tenant(RUNTIME_ROLE, ORG_A, leadA.userId, (tx) => tx.select({ id: schema.duesTransactions.id }).from(schema.duesTransactions))
      expect(new Set(owned.map((row) => row.id))).toEqual(new Set([DUES_A, DUES_LEGACY, FAILED_A]))
      expect(await harness.tenant(RUNTIME_ROLE, null, leadA.userId, (tx) => tx.select().from(schema.duesTransactions))).toEqual([])
      const configuration = await rejection(harness.tenant(RUNTIME_ROLE, ORG_A, leadA.userId, (tx) => tx.select().from(schema.organizationBillingConfig)))
      expect(String((configuration as { cause?: { message?: string }; message?: string })?.cause?.message ?? configuration?.message)).toMatch(/permission denied/i)
    })

    it('reminds the members of every organization, marks their dues, and records the operation as the acting organization and user', async () => {
      const before = harness.audits.length
      boundary.messages.length = 0
      const result = await answer(await run(reminders!.POST, post(leadA, 'http://localhost/api/admin/dues/send-reminders')))
      expect(result.status).toBe(200)
      // The legacy dues row has no member to remind: it is reported as failed and never stops the others
      expect(result.body.data).toMatchObject({ totalProcessed: 3, remindersSent: 2, remindersFailed: 1 })
      expect(boundary.messages.map((message) => message.organizationId).sort()).toEqual([ORG_A, ORG_B].sort())
      expect(boundary.messages.map((message) => message.recipientEmail).sort()).toEqual([`member-a-${tag}@union.test`, `member-b-${tag}@union.test`].sort())
      const marked = await query(`SELECT id, metadata->>'sevenDayReminderSent' AS sent FROM dues_transactions WHERE id = ANY($1) ORDER BY id`, [[DUES_A, DUES_B, DUES_LEGACY].sort()])
      expect(Object.fromEntries(marked.map((row) => [row.id, row.sent]))).toEqual({ [DUES_A]: 'true', [DUES_B]: 'true', [DUES_LEGACY]: null })
      expect(harness.audits.slice(before)).toEqual(expect.arrayContaining([
        expect.objectContaining({ action: 'platform.dues.send_reminders.requested', organizationId: ORG_A, userId: leadA.userId }),
        expect.objectContaining({ action: 'platform.dues.send_reminders.completed', organizationId: ORG_A, userId: leadA.userId }),
      ]))
    })

    it('does not remind the same dues twice', async () => {
      boundary.messages.length = 0
      const again = await answer(await run(reminders!.POST, post(leadA, 'http://localhost/api/admin/dues/send-reminders')))
      expect(again.body.data).toMatchObject({ remindersSent: 0, remindersFailed: 1 })
      expect(boundary.messages).toEqual([])
    })

    it('escalates the payments that failed too often in every organization, as the system role, and tells each organization', async () => {
      const before = harness.audits.length
      boundary.messages.length = 0
      const result = await answer(await run(retry!.POST, post(leadA, 'http://localhost/api/admin/payments/retry-failed')))
      expect(result.status).toBe(200)
      expect(result.body.data).toMatchObject({ markedForAdmin: 2, retriesFailed: 0 })
      const escalated = await query(`SELECT id, status, metadata->>'requiresAdminIntervention' AS flagged FROM dues_transactions WHERE id = ANY($1) ORDER BY id`, [[FAILED_A, FAILED_B].sort()])
      expect(escalated.map((row) => [row.status, row.flagged])).toEqual([['overdue', 'true'], ['overdue', 'true']])
      // The administrators of each organization are told, from the dues of that organization (the member joins as text, inside the organization)
      expect(boundary.messages.map((message) => [message.organizationId, message.metadata?.type, message.metadata?.transactionId]).sort()).toEqual(
        [[ORG_A, 'dues_admin_intervention', FAILED_A], [ORG_B, 'dues_admin_intervention', FAILED_B]].sort(),
      )
      expect(harness.audits.slice(before)).toEqual(expect.arrayContaining([
        expect.objectContaining({ action: 'platform.payments.retry_failed.requested', organizationId: ORG_A, userId: leadA.userId }),
      ]))
    })

    it('does not escalate the same payment twice', async () => {
      boundary.messages.length = 0
      const again = await answer(await run(retry!.POST, post(leadA, 'http://localhost/api/admin/payments/retry-failed')))
      expect(again.body.data).toMatchObject({ totalProcessed: 0, markedForAdmin: 0 })
      expect(boundary.messages).toEqual([])
    })

    it('enumerates the billing configuration of every organization, which only the system role can read, and bills each', async () => {
      boundary.cycles.length = 0
      const before = harness.audits.length
      const result = await answer(await run(billing!.POST, post(leadA, 'http://localhost/api/admin/billing-cycles/trigger-scheduled', { frequency: 'monthly' })))
      expect(result.status).toBe(200)
      expect(result.body.data).toMatchObject({ failed: 0 })
      expect(boundary.cycles.map((cycle) => cycle.organizationId)).toEqual(expect.arrayContaining([ORG_A, ORG_B]))
      expect(harness.audits.slice(before)).toEqual(expect.arrayContaining([
        expect.objectContaining({ action: 'platform.billing_cycle.trigger_scheduled.requested', organizationId: ORG_A, userId: leadA.userId }),
      ]))
    })

    it('answers a billing trigger with no frequency as a client error, and bills nobody', async () => {
      boundary.cycles.length = 0
      expect((await answer(await run(billing!.POST, post(leadA, 'http://localhost/api/admin/billing-cycles/trigger-scheduled', {})))).status).toBe(400)
      expect(boundary.cycles).toEqual([])
    })
  })

  describe('the role floor', () => {
    it('refuses a caller below a route\'s floor before any statement runs', async () => {
      for (const [handler, ctx] of [
        [forecast!.GET, as(officerA, 'http://localhost/api/admin/clc/analytics/forecast')],
        [annualReport!.GET, as(stewardA, 'http://localhost/api/admin/clc/analytics/annual-report')],
        [protocol!.PUT, as(officerA, 'http://localhost/api/admin/representation-protocol', { method: 'PUT', body: '{}' })],
        [reminders!.POST, post(adminA, 'http://localhost/api/admin/dues/send-reminders')],
        [retry!.POST, post(adminA, 'http://localhost/api/admin/payments/retry-failed')],
        [billing!.POST, post(adminA, 'http://localhost/api/admin/billing-cycles/trigger-scheduled', { frequency: 'monthly' })],
      ] as const) {
        expect((await rejection(run(handler, ctx)))?.code).toBe('FORBIDDEN')
      }
    })
  })
})
