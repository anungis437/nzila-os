/**
 * The finance routes on real PostgreSQL, as the real roles (UE-CONV-H-019).
 *
 * Every /api/finance route (and the dues calculator) was wrapped by a deprecated guard that authenticated the caller and gave the handler no database context.
 * The platform-economics services read the organization's billing account, invoices, payments, allocation rules, chargebacks and exports through the ambient
 * handle, which outside a tenant transaction is the runtime role with no organization: row-level security then shows every one of those tables as empty. The unit
 * tests replace the database and the CI HTTP runtime connects as a superuser, so neither noticed. This runs the unmodified routes and services against the
 * combined Django + Drizzle schema, with only the request boundary replaced (see native-route-harness.ts), and proves that
 *   - each route asks the wrapper for a tenant transaction, and a handle with no organization sees none of the finance tables (why it must);
 *   - an organization reads its own billing account, invoices, payments, allocation rules, chargebacks, dashboard and exports, and never another organization's;
 *   - another organization's invoice is "not found" on read, on export and on payment, and nothing is written for it;
 *   - what a write stores is stamped with the caller's organization and user whatever the body says, and is audited with them;
 *   - a caller below a route's role floor is refused before any statement runs.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

const audited = vi.hoisted(() => ({ entries: [] as Array<Record<string, unknown>> }))

// Production runs postgres.js, where `db.execute` answers the rows themselves; the harness's node-postgres driver answers `{ rows }`. The services read raw
// statements as postgres.js answers them (`const [row] = await db.execute(...)`), so the handle they are given answers the same way.
const asPostgresJs = vi.hoisted(() => (handle: Record<PropertyKey, any>) =>
  new Proxy({}, {
    get: (_target, property) => {
      if (property === 'execute') {
        return async (...args: unknown[]) => {
          const result = await handle.execute(...args)
          return Array.isArray(result) ? result : result.rows
        }
      }
      const value = handle[property]
      return typeof value === 'function' ? value.bind(handle) : value
    },
  }))

vi.mock('@/db/db', async () => ({ db: asPostgresJs((await import('./native-route-harness')).ambientDb as never) }))
vi.mock('@/db', async () => ({ db: asPostgresJs((await import('./native-route-harness')).ambientDb as never) }))
vi.mock('@/lib/db/with-rls-context', async () => (await import('./native-route-harness')).rlsContextModule)
vi.mock('@/lib/audit/atomic-audit', async () => ({ persistAtomicAudit: (await import('./native-route-harness')).recordAudit }))
vi.mock('@/lib/api/with-api', async () => ({ withApi: (await import('./native-route-harness')).emulatedWithApi }))
// The audit sink is the boundary; what the services record in it is what is asserted.
vi.mock('@/lib/audit-logger', () => ({
  auditLog: async (entry: Record<string, unknown>) => {
    audited.entries.push(entry)
  },
  AuditEventType: new Proxy({}, { get: (_target, key) => String(key) }),
  AuditSeverity: new Proxy({}, { get: (_target, key) => String(key) }),
}))

const { harness, RUNTIME_ROLE } = await import('./native-route-harness')
const billing = URL ? await import('@/app/api/finance/billing/route') : null
const invoices = URL ? await import('@/app/api/finance/invoices/route') : null
const invoice = URL ? await import('@/app/api/finance/invoices/[id]/route') : null
const payments = URL ? await import('@/app/api/finance/invoices/[id]/payments/route') : null
const allocation = URL ? await import('@/app/api/finance/allocation/route') : null
const allocationRun = URL ? await import('@/app/api/finance/allocation/run/route') : null
const simulation = URL ? await import('@/app/api/finance/simulation/route') : null
const chargebacks = URL ? await import('@/app/api/finance/chargebacks/route') : null
const dashboard = URL ? await import('@/app/api/finance/dashboard/route') : null
const exportsRoute = URL ? await import('@/app/api/finance/exports/route') : null

type Row = Record<string, any>
type Who = { organizationId: string; userId: string; role: string }
type Handler = (ctx: unknown) => Promise<Response>
const run = (handler: unknown, ctx: unknown) => (handler as Handler)(ctx)
const rejection = async (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error as { code?: string; message?: string })

describe.skipIf(!URL)('the finance routes on the combined schema, as the real roles', () => {
  const tag = randomUUID().slice(0, 8)
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const ORG_C = randomUUID()
  const LOCAL_ONE = randomUUID()
  const LOCAL_TWO = randomUUID()
  const treasurerA: Who = { organizationId: ORG_A, userId: `treasurer-a-${tag}`, role: 'secretary_treasurer' }
  const adminA: Who = { organizationId: ORG_A, userId: `admin-a-${tag}`, role: 'admin' }
  const stewardA: Who = { organizationId: ORG_A, userId: `steward-a-${tag}`, role: 'steward' }
  const treasurerB: Who = { organizationId: ORG_B, userId: `treasurer-b-${tag}`, role: 'secretary_treasurer' }
  const adminB: Who = { organizationId: ORG_B, userId: `admin-b-${tag}`, role: 'admin' }
  const adminC: Who = { organizationId: ORG_C, userId: `admin-c-${tag}`, role: 'admin' }
  const ACCOUNT_A = randomUUID()
  const ACCOUNT_B = randomUUID()
  const PERIOD_A = randomUUID()
  const PERIOD_A2 = randomUUID()
  const PERIOD_B = randomUUID()
  const INVOICE_A1 = randomUUID()
  const INVOICE_A2 = randomUUID()
  const INVOICE_B1 = randomUUID()
  const RULE_A = randomUUID()
  const RULE_B = randomUUID()
  const VERSION_A = randomUUID()
  const VERSION_B = randomUUID()
  const SEED_RUN_A = randomUUID()
  const SEED_RUN_B = randomUUID()
  let admin: pg.Client

  const query = async (sql: string, params: unknown[] = []) => (await admin.query(sql, params)).rows as Row[]
  const as = (who: Who, extra: Record<string, unknown> = {}, url = 'http://localhost/api/finance') => ({
    organizationId: who.organizationId,
    userId: who.userId,
    role: who.role,
    request: new Request(url),
    ...extra,
  })
  const withBody = (who: Who, method: string, payload: unknown, extra: Record<string, unknown> = {}) =>
    as(who, { request: new Request('http://localhost/api/finance', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }), ...extra })
  const optionsFor = (summary: string) => harness.configs.find((config) => config.openapi?.summary === summary) as unknown as { rlsOrgContext?: boolean; query?: { parse: (value: unknown) => unknown } }
  const parsedQuery = (summary: string, raw: Record<string, string>) => optionsFor(summary).query!.parse(raw)
  const answer = async (response: Response) => ({ status: response.status, body: (await response.json()) as Row })

  const newOrganization = (id: string, name: string, parent: string | null = null) =>
    admin.query(
      `INSERT INTO organizations (id, name, slug, organization_type, parent_id, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
       VALUES ($1,$2,$3,'local',$4,'{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
      [id, name, `${name.toLowerCase().replace(/\W+/g, '-')}-${tag}-${id.slice(0, 6)}`, parent],
    )

  beforeAll(async () => {
    admin = await harness.start(URL!)
    for (const [id, name] of [[ORG_A, 'Federation A'], [ORG_B, 'Federation B'], [ORG_C, 'Federation C']] as const) await newOrganization(id, name)
    for (const [id, name] of [[LOCAL_ONE, 'Local One'], [LOCAL_TWO, 'Local Two']] as const) await newOrganization(id, name, ORG_A)
    for (const who of [treasurerA, adminA, stewardA, treasurerB, adminB, adminC]) harness.setRole(who.userId, who.organizationId, who.role)

    await admin.query(`INSERT INTO billing_accounts (id, organization_id, display_name, billing_email) VALUES ($1,$2,$4,'a@example.test'), ($3,$5,$6,'b@example.test')`,
      [ACCOUNT_A, ORG_A, ACCOUNT_B, `Billing A ${tag}`, ORG_B, `Billing B ${tag}`])
    await admin.query(
      `INSERT INTO billing_periods (id, organization_id, period_start, period_end, label) VALUES
         ($1,$4,'2026-01-01','2026-01-31','January 2026'), ($2,$4,'2026-02-01','2026-02-28','February 2026'), ($3,$5,'2026-01-01','2026-01-31','January 2026 B')`,
      [PERIOD_A, PERIOD_A2, PERIOD_B, ORG_A, ORG_B],
    )
    await admin.query(
      `INSERT INTO platform_invoices (id, billing_account_id, organization_id, billing_period_id, invoice_number, issue_date, due_date, subtotal, tax_amount, total_amount, amount_paid, currency, status)
       VALUES ($1,$4,$7,$8,$10,'2026-01-31'::timestamp,now() + interval '30 days',100.00,0,100.00,0,'CAD','issued'),
              ($2,$4,$7,$9,$11,'2026-02-28'::timestamp,now() + interval '30 days',250.00,0,250.00,0,'CAD','issued'),
              ($3,$5,$6,$12,$13,'2026-01-31'::timestamp,now() + interval '30 days',900.00,0,900.00,0,'CAD','issued')`,
      [INVOICE_A1, INVOICE_A2, INVOICE_B1, ACCOUNT_A, ACCOUNT_B, ORG_B, ORG_A, PERIOD_A, PERIOD_A2, `INV-A1-${tag}`, `INV-A2-${tag}`, PERIOD_B, `INV-B1-${tag}`],
    )
    await admin.query(
      `INSERT INTO platform_invoice_line_items (invoice_id, description, cost_type, quantity, unit_price, amount) VALUES ($1,'Base subscription','base_subscription',1,100.00,100.00)`,
      [INVOICE_A1],
    )
    await admin.query(`INSERT INTO allocation_rules (id, organization_id, name) VALUES ($1,$3,$5), ($2,$4,$6)`, [RULE_A, RULE_B, ORG_A, ORG_B, `Rule A ${tag}`, `Rule B ${tag}`])
    await admin.query(`INSERT INTO allocation_rule_versions (id, rule_id, version, method, effective_from) VALUES ($1,$3,1,'per_member_count','2026-01-01'), ($2,$4,1,'per_member_count','2026-01-01')`, [VERSION_A, VERSION_B, RULE_A, RULE_B])
    await admin.query(
      `INSERT INTO allocation_runs (id, organization_id, billing_period_id, rule_version_id, total_amount) VALUES ($1,$3,$5,$7,400.00), ($2,$4,$6,$8,15.00)`,
      [SEED_RUN_A, SEED_RUN_B, ORG_A, ORG_B, PERIOD_A, PERIOD_B, VERSION_A, VERSION_B],
    )
    await admin.query(
      `INSERT INTO platform_cost_ledger_entries (organization_id, billing_period_id, cost_type, event_type, source_type, unit_price_cad, amount_cad, description) VALUES
         ($1,$2,'usage_fee','invoice_generated','invoice',1,600.00,'A cost'), ($3,$4,'usage_fee','invoice_generated','invoice',1,50.00,'B cost')`,
      [ORG_A, PERIOD_A, ORG_B, PERIOD_B],
    )
    await admin.query(
      `INSERT INTO chargeback_statements (organization_id, local_id, billing_period_id, allocation_run_id, total_amount, status) VALUES ($1,$2,$3,$7,400.00,'issued'), ($4,$5,$6,$8,15.00,'issued')`,
      [ORG_A, LOCAL_ONE, PERIOD_A, ORG_B, LOCAL_TWO, PERIOD_B, SEED_RUN_A, SEED_RUN_B],
    )
  }, 120_000)

  afterAll(async () => {
    await admin?.end()
    await harness.stop()
  })

  describe('why the routes open a tenant transaction', () => {
    it('asks the wrapper for one on every finance route', () => {
      for (const summary of [
        'Get the billing account of the current organization',
        'Create the billing account of the current organization',
        'Update the billing account of the current organization',
        'List invoices of the current organization',
        'Generate an invoice for a billing period',
        'Get an invoice with its line items',
        'List payments of an invoice',
        'Record a payment against an invoice',
        'List allocation rules',
        'Create an allocation rule',
        'Execute an allocation run',
        'List chargebacks of the current organization',
        'Finance dashboard summary of the current organization',
        'Generate Nzila platform-billing exports',
      ]) {
        expect(optionsFor(summary)?.rlsOrgContext, summary).toBe(true)
      }
    })

    it('sees none of the finance tables on a handle with no organization', async () => {
      const schema = await import('@/db/schema')
      for (const table of [schema.billingAccounts, schema.platformInvoices, schema.platformPayments, schema.allocationRules, schema.chargebackStatements, schema.platformCostLedgerEntries]) {
        const rows = await harness.tenant(RUNTIME_ROLE, null, treasurerA.userId, (tx) => tx.select().from(table))
        expect(rows).toEqual([])
      }
    })
  })

  describe('reading', () => {
    it("returns an organization's billing account and no other organization's", async () => {
      const a = await answer(await run(billing!.GET, as(treasurerA)))
      expect(a.status).toBe(200)
      expect(a.body.data).toMatchObject({ id: ACCOUNT_A, organizationId: ORG_A, displayName: `Billing A ${tag}` })
      const b = await answer(await run(billing!.GET, as(treasurerB)))
      expect(b.body.data).toMatchObject({ id: ACCOUNT_B, organizationId: ORG_B })
    })

    it('answers an organization with no billing account as not found', async () => {
      expect((await run(billing!.GET, as({ ...adminC, role: 'secretary_treasurer' }))).status).toBe(404)
    })

    it("lists an organization's invoices newest first, pages through them, and shows no other organization's", async () => {
      const summary = 'List invoices of the current organization'
      const first = await answer(await run(invoices!.GET, as(treasurerA, { query: parsedQuery(summary, {}) })))
      expect(first.body.data.map((row: Row) => row.id)).toEqual([INVOICE_A2, INVOICE_A1])
      expect(first.body.meta).toEqual({ total: 2, limit: 50, offset: 0 })

      const second = await answer(await run(invoices!.GET, as(treasurerA, { query: parsedQuery(summary, { limit: '1', offset: '1' }) })))
      expect(second.body.data.map((row: Row) => row.id)).toEqual([INVOICE_A1])

      const b = await answer(await run(invoices!.GET, as(treasurerB, { query: parsedQuery(summary, {}) })))
      expect(b.body.data.map((row: Row) => row.id)).toEqual([INVOICE_B1])
    })

    it("returns an invoice with its lines to its own organization, and reads another organization's invoice as not found", async () => {
      const own = await answer(await run(invoice!.GET, as(treasurerA, { params: { id: INVOICE_A1 } })))
      expect(own.status).toBe(200)
      expect(own.body.data.lineItems).toHaveLength(1)
      expect((await run(invoice!.GET, as(treasurerB, { params: { id: INVOICE_A1 } }))).status).toBe(404)
    })

    it('lists the allocation rules and the chargebacks of the caller organization only', async () => {
      const rules = await answer(await run(allocation!.GET, as(treasurerA)))
      expect(rules.body.data.map((row: Row) => row.id)).toEqual([RULE_A])
      const summary = 'List chargebacks of the current organization'
      const own = await answer(await run(chargebacks!.GET, as(treasurerA, { query: parsedQuery(summary, {}) })))
      expect(own.body.data.map((row: Row) => row.organizationId)).toEqual([ORG_A])
      const other = await answer(await run(chargebacks!.GET, as(treasurerB, { query: parsedQuery(summary, {}) })))
      expect(other.body.data.map((row: Row) => row.organizationId)).toEqual([ORG_B])
    })

    it("builds the dashboard from the caller organization's own records", async () => {
      const summary = 'Finance dashboard summary of the current organization'
      const a = await answer(await run(dashboard!.GET, as(treasurerA, { query: parsedQuery(summary, {}) })))
      expect(a.status).toBe(200)
      expect(a.body.data.billingAccount.id).toBe(ACCOUNT_A)
      expect(a.body.data.recentInvoices.map((row: Row) => row.id)).toEqual([INVOICE_A2, INVOICE_A1])
      expect(a.body.data.recentChargebacks.map((row: Row) => row.organizationId)).toEqual([ORG_A])
      const b = await answer(await run(dashboard!.GET, as(treasurerB, { query: parsedQuery(summary, {}) })))
      expect(b.body.data.recentInvoices.map((row: Row) => row.id)).toEqual([INVOICE_B1])
    })

    it("exports an organization's own invoice, and never another organization's", async () => {
      const summary = 'Generate Nzila platform-billing exports'
      const own = await answer(await run(exportsRoute!.GET, as(treasurerA, { query: parsedQuery(summary, { type: 'master_invoice', invoiceId: INVOICE_A1 }) })))
      expect(own.status).toBe(200)
      expect(own.body.data.invoice).toMatchObject({ invoiceNumber: `INV-A1-${tag}`, total: '100.00' })

      const foreign = await run(exportsRoute!.GET, as(treasurerB, { query: parsedQuery(summary, { type: 'master_invoice', invoiceId: INVOICE_A1 }) }))
      expect(foreign.status).not.toBe(200)
      expect(JSON.stringify(await foreign.json())).not.toContain(`INV-A1-${tag}`)
    })

    it('exports nothing for a malformed id, as a client error', async () => {
      const summary = 'Generate Nzila platform-billing exports'
      await expect(Promise.resolve().then(() => parsedQuery(summary, { type: 'master_invoice', invoiceId: 'not-a-uuid' }))).rejects.toThrow()
    })
  })

  describe('writing', () => {
    it('creates a billing account for the caller organization and user, whatever the body says, and audits it', async () => {
      const before = audited.entries.length
      const created = await answer(await run(billing!.POST, withBody(adminC, 'POST', {
        displayName: `Billing C ${tag}`,
        billingEmail: 'c@example.test',
        organizationId: ORG_A,
        createdBy: 'someone-else',
      })))
      expect(created.status).toBe(200)
      const rows = await query(`SELECT organization_id, display_name, created_by FROM billing_accounts WHERE display_name = $1`, [`Billing C ${tag}`])
      expect(rows).toEqual([expect.objectContaining({ organization_id: ORG_C, display_name: `Billing C ${tag}`, created_by: adminC.userId })])
      expect(audited.entries.slice(before)).toEqual(expect.arrayContaining([expect.objectContaining({ organizationId: ORG_C, userId: adminC.userId })]))
    })

    it("updates the caller organization's account and no other's", async () => {
      const updated = await answer(await run(billing!.PATCH, withBody(adminA, 'PATCH', { displayName: `Billing A renamed ${tag}` })))
      expect(updated.status).toBe(200)
      expect((await query(`SELECT display_name FROM billing_accounts WHERE id = $1`, [ACCOUNT_A]))[0].display_name).toBe(`Billing A renamed ${tag}`)
      expect((await query(`SELECT display_name FROM billing_accounts WHERE id = $1`, [ACCOUNT_B]))[0].display_name).toBe(`Billing B ${tag}`)
    })

    it('creates an allocation rule in the caller organization, as the caller, and lists it only there', async () => {
      const created = await answer(await run(allocation!.POST, withBody(adminA, 'POST', { name: `New rule ${tag}`, costType: 'dues', method: 'per_member_count', organizationId: ORG_B })))
      expect(created.status).toBe(200)
      const rows = await query(`SELECT organization_id, created_by FROM allocation_rules WHERE name = $1`, [`New rule ${tag}`])
      expect(rows).toEqual([{ organization_id: ORG_A, created_by: adminA.userId }])
      const listedForB = await answer(await run(allocation!.GET, as(treasurerB)))
      expect(listedForB.body.data.map((row: Row) => row.name)).not.toContain(`New rule ${tag}`)
    })

    it("records a payment on the caller organization's invoice, stamps the caller, settles the invoice, and audits it", async () => {
      const before = audited.entries.length
      const recorded = await answer(await run(payments!.POST, withBody(adminA, 'POST', { amount: '40.00', method: 'eft', externalReference: `ref-${tag}`, organizationId: ORG_B }, { params: { id: INVOICE_A1 } })))
      expect(recorded.status).toBe(200)
      const [payment] = await query(`SELECT organization_id, amount, status, created_by, billing_account_id FROM platform_payments WHERE external_reference = $1`, [`ref-${tag}`])
      expect(payment).toMatchObject({ organization_id: ORG_A, amount: '40.00', status: 'completed', created_by: adminA.userId, billing_account_id: ACCOUNT_A })
      const [settled] = await query(`SELECT amount_paid, status FROM platform_invoices WHERE id = $1`, [INVOICE_A1])
      expect(settled).toMatchObject({ amount_paid: '40.00', status: 'partially_paid' })
      expect(audited.entries.slice(before)).toEqual(expect.arrayContaining([expect.objectContaining({ organizationId: ORG_A, userId: adminA.userId, resourceId: recorded.body.data.id })]))

      const listed = await answer(await run(payments!.GET, as(treasurerA, { params: { id: INVOICE_A1 } })))
      expect(listed.body.data.map((row: Row) => row.externalReference)).toEqual([`ref-${tag}`])
      const listedForB = await answer(await run(payments!.GET, as(treasurerB, { params: { id: INVOICE_A1 } })))
      expect(listedForB.body.data).toEqual([])
    })

    it("answers a payment on another organization's invoice as not found, and writes nothing", async () => {
      const before = (await query(`SELECT count(*)::int AS n FROM platform_payments`))[0].n
      const refused = await run(payments!.POST, withBody(adminB, 'POST', { amount: '10.00', method: 'eft' }, { params: { id: INVOICE_A1 } }))
      expect(refused.status).toBe(404)
      expect((await query(`SELECT count(*)::int AS n FROM platform_payments`))[0].n).toBe(before)
      expect((await query(`SELECT amount_paid FROM platform_invoices WHERE id = $1`, [INVOICE_A1]))[0].amount_paid).toBe('40.00')
    })

    it("runs an allocation over the caller organization's own costs, rule and period, atomically, and never for another organization's", async () => {
      const body = {
        billingPeriodId: PERIOD_A,
        ruleId: RULE_A,
        localBasisData: [{ localId: LOCAL_ONE, memberCount: 30 }, { localId: LOCAL_TWO, memberCount: 10 }],
      }
      const posted = () => query(`SELECT organization_id, status, total_amount, created_by FROM allocation_runs WHERE created_by IS NOT NULL`)
      const chargebacksOfRun = () => query(`SELECT count(*)::int AS n FROM chargeback_statements WHERE organization_id = $1 AND allocation_run_id <> $2`, [ORG_A, SEED_RUN_A])

      // Another organization cannot run against this organization's rule and period: they do not exist for it.
      const foreign = await run(allocationRun!.POST, withBody(adminB, 'POST', body))
      expect(foreign.status).toBe(404)
      expect(await posted()).toEqual([])

      // Posting a run inserts the chargeback statements and marks the source cost entries of the period allocated. The runtime role holds exactly those
      // grants (chargeback_statements INSERT, platform_cost_ledger_entries UPDATE, allocation_run_lines SELECT), and not more on them.
      const [grants] = await query(
        `SELECT has_table_privilege('${RUNTIME_ROLE}', 'public.chargeback_statements', 'INSERT') AND has_table_privilege('${RUNTIME_ROLE}', 'public.platform_cost_ledger_entries', 'UPDATE') AND has_table_privilege('${RUNTIME_ROLE}', 'public.allocation_run_lines', 'SELECT') AS can_post,
                has_table_privilege('${RUNTIME_ROLE}', 'public.chargeback_statements', 'UPDATE') OR has_table_privilege('${RUNTIME_ROLE}', 'public.chargeback_statements', 'DELETE') OR has_table_privilege('${RUNTIME_ROLE}', 'public.platform_cost_ledger_entries', 'DELETE') AS can_rewrite`,
      )
      expect(grants).toEqual({ can_post: true, can_rewrite: false })
      const before = audited.entries.length
      const result = await answer(await run(allocationRun!.POST, withBody(adminA, 'POST', body)))
      expect(result.status).toBe(200)
      expect(result.body.data).toMatchObject({ isSimulation: false, totalAmount: '560.00' })
      expect(await posted()).toEqual([{ organization_id: ORG_A, status: 'posted', total_amount: '560.00', created_by: adminA.userId }])
      // The cost of the period is the 600.00 invoiced less the 40.00 payment credited to it earlier in this file, shared 30:10 between the locals
      expect(await query(`SELECT local_id, allocated_amount FROM allocation_run_lines ORDER BY allocated_amount DESC`)).toEqual([
        { local_id: LOCAL_ONE, allocated_amount: '420.00' },
        { local_id: LOCAL_TWO, allocated_amount: '140.00' },
      ])
      expect((await chargebacksOfRun())[0].n).toBe(2)
      // the source cost entries of the period (the invoice and the payment credit) are allocated to the run, in the same transaction
      const [source] = await query(`SELECT allocation_status, allocation_run_id FROM platform_cost_ledger_entries WHERE organization_id = $1 AND event_type = 'invoice_generated'`, [ORG_A])
      expect(source).toEqual({ allocation_status: 'allocated', allocation_run_id: result.body.data.runId })
      expect(await query(`SELECT count(*)::int AS n FROM platform_cost_ledger_entries WHERE organization_id = $1 AND billing_period_id = $2 AND allocation_status = 'unallocated'`, [ORG_A, PERIOD_A])).toEqual([{ n: 0 }])
      expect(audited.entries.slice(before)).toEqual(expect.arrayContaining([expect.objectContaining({ organizationId: ORG_A, userId: adminA.userId, action: 'allocation_posted' })]))
      expect((await query(`SELECT allocation_status FROM platform_cost_ledger_entries WHERE organization_id = $1 AND event_type = 'invoice_generated'`, [ORG_B]))[0].allocation_status).toBe('unallocated')

      // The period is unallocated no more, so a second run has no cost to allocate: a conflict, not a fault
      const again = await answer(await run(allocationRun!.POST, withBody(adminA, 'POST', body)))
      expect(again.status).toBe(409)
      expect(await posted()).toHaveLength(1)
    })

    it("simulates an allocation for the caller organization: a simulated run is stored, no ledger entry, chargeback or allocation mark is made, and another organization's period is not found", async () => {
      const body = {
        billingPeriodId: PERIOD_B,
        ruleId: RULE_B,
        localBasisData: [{ localId: LOCAL_ONE, memberCount: 3 }, { localId: LOCAL_TWO, memberCount: 1 }],
      }
      const ledgerBefore = (await query(`SELECT count(*)::int AS n FROM platform_cost_ledger_entries WHERE organization_id = $1`, [ORG_B]))[0].n
      const chargebacksBefore = (await query(`SELECT count(*)::int AS n FROM chargeback_statements WHERE organization_id = $1`, [ORG_B]))[0].n

      const foreign = await run(simulation!.POST, withBody(adminA, 'POST', body, { body }))
      expect(foreign.status).toBe(404)

      const simulated = await answer(await run(simulation!.POST, withBody(treasurerB, 'POST', body, { body })))
      expect(simulated.status).toBe(200)
      expect(simulated.body.data).toMatchObject({ simulation: true, isSimulation: true, totalAmount: '50.00' })
      expect(await query(`SELECT organization_id, status, is_simulation FROM allocation_runs WHERE id = $1`, [simulated.body.data.runId])).toEqual([
        { organization_id: ORG_B, status: 'simulated', is_simulation: true },
      ])
      expect((await query(`SELECT count(*)::int AS n FROM platform_cost_ledger_entries WHERE organization_id = $1`, [ORG_B]))[0].n).toBe(ledgerBefore)
      expect((await query(`SELECT count(*)::int AS n FROM chargeback_statements WHERE organization_id = $1`, [ORG_B]))[0].n).toBe(chargebacksBefore)
      expect((await query(`SELECT allocation_status FROM platform_cost_ledger_entries WHERE organization_id = $1 AND event_type = 'invoice_generated'`, [ORG_B]))[0].allocation_status).toBe('unallocated')
    })
  })

  describe('the role floor', () => {
    it('refuses a caller below a route\'s floor before any statement runs', async () => {
      for (const [handler, ctx] of [
        [billing!.GET, as(stewardA)],
        [invoices!.GET, as(stewardA)],
        [billing!.POST, withBody(treasurerA, 'POST', { displayName: 'x', billingEmail: 'x@example.test' })],
        [allocationRun!.POST, withBody(treasurerA, 'POST', {})],
        [payments!.POST, withBody(treasurerA, 'POST', { amount: '1.00', method: 'eft' }, { params: { id: INVOICE_A1 } })],
      ] as const) {
        const error = await rejection(run(handler, ctx))
        expect(error?.code).toBe('FORBIDDEN')
      }
    })
  })
})
