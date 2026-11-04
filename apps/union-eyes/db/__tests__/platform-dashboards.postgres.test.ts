/**
 * The platform dashboards' cross-organization reads (lib/customer-success/dashboard-data.ts, lib/platform-economics/billing-admin-data.ts) on real
 * PostgreSQL, as the real roles.
 *
 * Both dashboards show figures across every organization, so they run on the system role, behind a platform-role check in the page. The billing
 * dashboard read through the module-level handle with no context and the customer success loaders ran wherever the page happened to call them; this
 * runs the unmodified loaders with only the context boundary replaced by the harness's (a system transaction for withSystemContext) and proves that
 *   - the system role reads every organization's rows (what an independent superuser count says), and the per-organization health, onboarding
 *     and survey rows carry the seeded organizations' own figures;
 *   - the billing read returns the subscriptions, invoices and payments of both seeded organizations with the organization names joined;
 *   - control: a tenant session sees only its own organization's subscriptions and, with no organization, nothing, so a tenant context cannot serve these pages.
 *
 * The system role needs SELECT on subscription_plans, which neither the manifest nor the bootstrap grant it today (runtime SELECT only). This applies exactly
 * the grant the proposed manifest entry declares, as workbook-capability.postgres.test.ts does for the workbook tables; without it the billing subscriptions
 * list fails with "permission denied" on the real roles. The system role holds no privilege on settlements, so the customer success overview reads none
 * and carries no settlement figure.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { insertOrganization } from './page-reads-seed'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

vi.mock('@/db/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/lib/db/with-rls-context', async () => {
  const { harness, rlsContextModule, SYSTEM_ROLE } = await import('./native-route-harness')
  return {
    ...rlsContextModule,
    // The raw statements read their rows as an array, as the application's driver returns them; this driver returns { rows }.
    withSystemContext: <T>(work: (tx: unknown) => Promise<T>) =>
      harness.tenant(SYSTEM_ROLE, null, null, (tx) => {
        const run = tx.execute.bind(tx)
        ;(tx as unknown as { execute: unknown }).execute = async (query: never) => (await run(query)).rows
        return work(tx)
      }),
  }
})
vi.mock('@/lib/audit-logger', () => ({ auditLog: vi.fn(), AuditEventType: {}, AuditSeverity: {} }))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn() }))

const { harness, RUNTIME_ROLE } = await import('./native-route-harness')
const success = URL ? await import('@/lib/customer-success/dashboard-data') : null
const billing = URL ? await import('@/lib/platform-economics/billing-admin-data') : null
const schema = URL ? await import('@/db/schema') : null
const { withSystemContext } = await import('@/lib/db/with-rls-context')

describe.skipIf(!URL)('the platform dashboards\' reads on the combined schema, as the real roles', () => {
  const tag = `pp${randomUUID().slice(0, 8)}`
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const PLATFORM_ORG = randomUUID()
  let admin: pg.Client

  const count = async (table: string) => (await admin.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n as number

  beforeAll(async () => {
    admin = await harness.start(URL!)
    // The grant the proposed manifest entry declares for the system role.
    await admin.query('GRANT SELECT ON subscription_plans TO union_eyes_system')

    await insertOrganization(admin, tag, { id: ORG_A, name: `Alpha ${tag}`, memberCount: 40 })
    await insertOrganization(admin, tag, { id: ORG_B, name: `Beta ${tag}`, memberCount: 60 })
    await insertOrganization(admin, tag, { id: PLATFORM_ORG, name: `Platform ${tag}`, type: 'congress' })

    const grievance = async (organizationId: string, number: string, status: string) =>
      (await admin.query(`INSERT INTO grievances (grievance_number, description, organization_id, title, type, status) VALUES ($1, 'd', $2, 't', 'grievance', $3) RETURNING id::text AS id`, [`${number}-${tag}`, organizationId, status])).rows[0].id as string
    await grievance(ORG_A, 'a-settled', 'settled')
    await grievance(ORG_A, 'a-open', 'filed')
    await grievance(ORG_B, 'b-open', 'filed')
    await admin.query(
      `INSERT INTO collective_agreements (organization_id, cba_number, title, jurisdiction, employer_name, union_name, effective_date, expiry_date, industry_sector, status)
       VALUES ($1, $2, 'CBA', 'ontario', 'E', 'U', now(), now() + interval '1 year', 'public', 'active')`,
      [ORG_A, `cba-a-${tag}`],
    )
    await admin.query(
      `INSERT INTO support_tickets (ticket_number, organization_id, requestor_email, subject, description, category, source, status, satisfaction_rating)
       VALUES ($1, $2, 'a@example.test', 's', 'd', 'other', 'email', 'open', NULL), ($3, $2, 'a@example.test', 's', 'd', 'other', 'email', 'closed', 4)`,
      [`T1-${tag}`, ORG_A, `T2-${tag}`],
    )
    await admin.query(`INSERT INTO customer_nps_surveys (organization_id, respondent_name, score, feedback) VALUES ($1, $2, 10, 'great'), ($3, $4, 3, 'poor')`, [ORG_A, `Ann ${tag}`, ORG_B, `Bob ${tag}`])
    await admin.query(`INSERT INTO customer_onboarding_milestones (organization_id, milestone, status) VALUES ($1, $2, 'completed'), ($3, $4, 'pending')`, [ORG_A, `kickoff-${tag}`, ORG_B, `training-${tag}`])

    const plan = (await admin.query(`INSERT INTO subscription_plans (code, name, base_fee) VALUES ($1, $2, 199.00) RETURNING id::text AS id`, [`plan-${tag}`, `Plan ${tag}`])).rows[0].id as string
    for (const [organizationId, label] of [[ORG_A, 'A'], [ORG_B, 'B']]) {
      const account = (await admin.query(`INSERT INTO billing_accounts (organization_id, display_name, billing_email) VALUES ($1, $2, 'b@example.test') RETURNING id::text AS id`, [organizationId, `Account ${label} ${tag}`])).rows[0].id as string
      await admin.query(`INSERT INTO org_subscriptions (billing_account_id, plan_id, organization_id) VALUES ($1, $2, $3)`, [account, plan, organizationId])
      await admin.query(`INSERT INTO platform_invoices (billing_account_id, organization_id, invoice_number) VALUES ($1, $2, $3)`, [account, organizationId, `INV-${label}-${tag}`])
      await admin.query(`INSERT INTO platform_payments (billing_account_id, organization_id, amount) VALUES ($1, $2, 99)`, [account, organizationId])
    }
  }, 120_000)

  afterAll(async () => {
    await admin?.end()
    await harness.stop()
  })

  describe('customer success', () => {
    it('reads the platform-wide figures across every organization, as an independent count of the tables does', async () => {
      const overview = await withSystemContext(() => success!.loadOverview())
      expect(overview.totalGrievances).toBe(await count('grievances'))
      expect(overview.totalNpsSurveys).toBe(await count('customer_nps_surveys'))
      expect(overview.totalCBAs).toBe(await count('collective_agreements'))
      expect(overview.totalGrievances).toBeGreaterThanOrEqual(3)
      expect(overview.openTickets).toBeGreaterThanOrEqual(1)
      expect(Object.keys(overview).filter((key) => /settlement/i.test(key))).toEqual([])
    })

    it('has no privilege on settlements as the system role, so none can be read for the platform', async () => {
      const { rows } = await admin.query(`SELECT has_table_privilege('union_eyes_system', 'settlements', 'SELECT') AS ok`)
      expect(rows[0].ok).toBe(false)
    })

    it('gives each organization its own health row, and leaves the congress organization out', async () => {
      const health = await withSystemContext(() => success!.loadOrgHealth())
      const alpha = health.find((row) => row.id === ORG_A)
      const beta = health.find((row) => row.id === ORG_B)
      expect(alpha).toMatchObject({ name: `Alpha ${tag}`, memberCount: 40, openGrievances: 1, resolvedGrievances: 1, openTickets: 1, totalCBAs: 1, npsAvg: 10 })
      expect(beta).toMatchObject({ name: `Beta ${tag}`, memberCount: 60, openGrievances: 1, resolvedGrievances: 0, openTickets: 0, totalCBAs: 0, npsAvg: 3 })
      expect(health.some((row) => row.id === PLATFORM_ORG)).toBe(false)
    })

    it('lists every organization\'s onboarding milestones and survey answers with the organization names joined', async () => {
      const onboarding = (await withSystemContext(() => success!.loadOnboarding())).filter((row) => row.milestone.endsWith(tag))
      expect(onboarding.map((row) => [row.orgName, row.milestone, row.status])).toEqual([
        [`Alpha ${tag}`, `kickoff-${tag}`, 'completed'],
        [`Beta ${tag}`, `training-${tag}`, 'pending'],
      ])
      const surveys = (await withSystemContext(() => success!.loadNpsSurveys())).filter((row) => row.respondentName.endsWith(tag))
      expect(surveys.map((row) => [row.orgName, row.score]).sort()).toEqual([[`Alpha ${tag}`, 10], [`Beta ${tag}`, 3]])
    })

    it('control: a tenant session reads none of these tables\' other organizations, and with no organization nothing at all', async () => {
      const asAlpha = await harness.tenant(RUNTIME_ROLE, ORG_A, null, (tx) => tx.select({ id: schema!.grievances.id, organizationId: schema!.grievances.organizationId }).from(schema!.grievances))
      expect(new Set(asAlpha.map((row) => row.organizationId))).toEqual(new Set([ORG_A]))
      expect(await harness.tenant(RUNTIME_ROLE, null, null, (tx) => tx.select().from(schema!.grievances))).toEqual([])
    })
  })

  describe('billing administration', () => {
    it('reads both organizations\' subscriptions, invoices and payments with the organization names joined', async () => {
      const { subscriptions, invoices, payments } = await billing!.loadBillingAdminData()
      const mine = <T extends { organizationId: string }>(rows: T[]) => rows.filter((row) => row.organizationId === ORG_A || row.organizationId === ORG_B)
      expect(mine(subscriptions).map((row) => [row.orgName, row.planCode, row.status]).sort()).toEqual([[`Alpha ${tag}`, `plan-${tag}`, 'active'], [`Beta ${tag}`, `plan-${tag}`, 'active']])
      expect(mine(invoices).map((row) => [row.orgName, row.invoiceNumber]).sort()).toEqual([[`Alpha ${tag}`, `INV-A-${tag}`], [`Beta ${tag}`, `INV-B-${tag}`]])
      expect(mine(payments).map((row) => row.orgName).sort()).toEqual([`Alpha ${tag}`, `Beta ${tag}`])
    })

    it('control: a tenant session sees only its own organization\'s subscriptions, and with no organization none', async () => {
      const asAlpha = await harness.tenant(RUNTIME_ROLE, ORG_A, null, (tx) => tx.select({ organizationId: schema!.orgSubscriptions.organizationId }).from(schema!.orgSubscriptions))
      expect(new Set(asAlpha.map((row) => row.organizationId))).toEqual(new Set([ORG_A]))
      expect(await harness.tenant(RUNTIME_ROLE, null, null, (tx) => tx.select().from(schema!.orgSubscriptions))).toEqual([])
    })
  })
})
