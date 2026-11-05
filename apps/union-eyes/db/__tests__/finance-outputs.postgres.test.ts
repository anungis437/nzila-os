/**
 * The platform-economics finance exports on real PostgreSQL (UE-CONV-H-013).
 *
 * services/platform-economics/finance-outputs.ts was written against columns the tables never had (`subtotal_cad`, `balance_due_cad`, a per-run `method`,
 * gross/subsidy/net on a chargeback statement) and its only tests mocked `db.execute`, so every export failed on the first call and nothing noticed. The mismatch
 * census (scripts/runtime/mismatch-census.ts) found it. This runs the real exports over the real tables, with rows written the way the billing service and the
 * allocation engine write them:
 *   - an invoice's discount is a negative `credit` line and its subsidy a negative `subsidy` line, its stored subtotal is net of both, and the export recovers the
 *     charges, the discount and the subsidy from the lines and the balance from the totals;
 *   - an allocation run's method belongs to its lines (one name when they agree, `mixed` when they do not) and a line's share is its weight;
 *   - a chargeback statement records one amount, and the report totals it, newest period first;
 *   - the GL journal splits each ledger entry into a debit or a credit, and the evidence pack assembles all of them for one period;
 *   - another organization's invoice or run is not found.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import { PgDialect } from 'drizzle-orm/pg-core'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const h = vi.hoisted(() => ({ run: undefined as undefined | ((query: unknown) => Promise<unknown>) }))

vi.mock('@/db', () => ({ db: { execute: (query: unknown) => h.run!(query) } }))
vi.mock('@/lib/audit-logger', () => ({ auditLog: vi.fn(), AuditEventType: { DATA_EXPORT: 'data_export' }, AuditSeverity: { MEDIUM: 'medium' } }))

import { exportAllocationStatement, exportChargebackReport, exportGlJournal, exportMasterInvoice, generateEvidencePack } from '../../services/platform-economics/finance-outputs'

describe.skipIf(!URL)('the finance exports over the real billing, allocation and ledger tables', () => {
  let admin: pg.Client
  const ORG = randomUUID()
  const OTHER = randomUUID()
  const LOCAL_ONE = randomUUID()
  const LOCAL_TWO = randomUUID()
  const ACCOUNT = randomUUID()
  const JANUARY = randomUUID()
  const FEBRUARY = randomUUID()
  const INVOICE = randomUUID()
  const RULE = randomUUID()
  const VERSION = randomUUID()
  const RUN = randomUUID()
  const MIXED_RUN = randomUUID()
  const sfx = ORG.slice(0, 8)

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    const dialect = new PgDialect()
    h.run = async (query) => {
      const compiled = dialect.sqlToQuery(query as Parameters<PgDialect['sqlToQuery']>[0])
      return (await admin.query(compiled.sql, compiled.params)).rows
    }
    for (const [id, name] of [
      [ORG, 'Fixture Federation'],
      [OTHER, 'Another Federation'],
      [LOCAL_ONE, 'Local One'],
      [LOCAL_TWO, 'Local Two'],
    ]) {
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
        [id, name, `fx-${sfx}-${id.slice(0, 6)}`],
      )
    }
    await admin.query(`INSERT INTO billing_accounts (id, organization_id, display_name, billing_email) VALUES ($1,$2,'Fixture billing','billing@example.test')`, [ACCOUNT, ORG])
    await admin.query(
      `INSERT INTO billing_periods (id, organization_id, period_start, period_end, label) VALUES
         ($1,$3,'2026-01-01','2026-01-31','January 2026'), ($2,$3,'2026-02-01','2026-02-28','February 2026')`,
      [JANUARY, FEBRUARY, ORG],
    )
    // Written the way services/platform-economics/billing-service.ts writes an invoice: the subtotal is stored net of the discount and the subsidy.
    await admin.query(
      `INSERT INTO platform_invoices (id, billing_account_id, organization_id, billing_period_id, invoice_number, issue_date, due_date, subtotal, tax_amount, total_amount, amount_paid, currency, status)
       VALUES ($1,$2,$3,$4,$5,now(),now() + interval '30 days',130.00,0,130.00,30.00,'CAD','issued')`,
      [INVOICE, ACCOUNT, ORG, JANUARY, `INV-FX-${sfx}`],
    )
    await admin.query(
      `INSERT INTO platform_invoice_line_items (invoice_id, description, cost_type, quantity, unit_price, amount) VALUES
         ($1,'Usage','usage_fee',1,50.00,50.00), ($1,'Base subscription','base_subscription',1,100.00,100.00),
         ($1,'Discount (10%)','credit',1,-15.00,-15.00), ($1,'Platform Subsidy','subsidy',1,-5.00,-5.00)`,
      [INVOICE],
    )
    await admin.query(`INSERT INTO allocation_rules (id, organization_id, name) VALUES ($1,$2,'Fixture rule')`, [RULE, ORG])
    await admin.query(`INSERT INTO allocation_rule_versions (id, rule_id, version, method, effective_from) VALUES ($1,$2,1,'per_member_count',now())`, [VERSION, RULE])
    for (const run of [RUN, MIXED_RUN]) {
      await admin.query(`INSERT INTO allocation_runs (id, organization_id, billing_period_id, rule_version_id, total_amount) VALUES ($1,$2,$3,$4,600.00)`, [run, ORG, JANUARY, VERSION])
    }
    await admin.query(
      `INSERT INTO allocation_run_lines (run_id, local_id, local_name, method, basis_value, weight, allocated_amount, cost_type) VALUES
         ($1,$2,'Local One','per_member_count',40,66.67,400.00,'seat_fee'),
         ($1,$3,NULL,'per_member_count',20,33.33,200.00,'seat_fee'),
         ($4,$2,'Local One','per_member_count',40,50.00,300.00,'seat_fee'),
         ($4,$3,'Local Two','per_active_user',20,50.00,300.00,'module_fee')`,
      [RUN, LOCAL_ONE, LOCAL_TWO, MIXED_RUN],
    )
    await admin.query(
      `INSERT INTO chargeback_statements (organization_id, local_id, billing_period_id, allocation_run_id, total_amount, status) VALUES
         ($1,$2,$3,$5,400.00,'issued'), ($1,$2,$4,$5,125.50,'issued')`,
      [ORG, LOCAL_ONE, JANUARY, FEBRUARY, RUN],
    )
    await admin.query(
      `INSERT INTO platform_cost_ledger_entries (organization_id, billing_period_id, cost_type, event_type, source_type, unit_price_cad, amount_cad, description) VALUES
         ($1,$2,'usage_fee','invoice_generated','invoice',1,100.00,'charge'), ($1,$2,'credit','credit_applied','adjustment',-1,-20.00,'credit')`,
      [ORG, JANUARY],
    )
  }, 120_000)

  afterAll(async () => {
    await admin?.end().catch(() => undefined)
  })

  it('exports an invoice: the charges, the discount and the subsidy from its lines, the balance from its totals', async () => {
    const { invoice } = await exportMasterInvoice(ORG, INVOICE)
    expect(invoice).toMatchObject({
      invoiceNumber: `INV-FX-${sfx}`,
      orgName: 'Fixture Federation',
      billingPeriod: 'January 2026',
      subtotal: '150.00',
      discount: '15.00',
      subsidy: '5.00',
      total: '130.00',
      paidAmount: '30.00',
      balanceDue: '100.00',
      currency: 'CAD',
      paymentStatus: 'issued',
    })
    expect(Number(invoice.tax)).toBe(0)
    // Charges first, then the adjustments.
    expect(invoice.lineItems.map((line) => line.description)).toEqual(['Base subscription', 'Usage', 'Discount (10%)', 'Platform Subsidy'])
  })

  it("does not find another organization's invoice or run", async () => {
    await expect(exportMasterInvoice(OTHER, INVOICE)).rejects.toThrow('not found')
    await expect(exportAllocationStatement(OTHER, RUN)).rejects.toThrow('not found')
  })

  it("exports an allocation run: the method of its lines, the cost pool, each line's weight as its share, a name the line did not record from the organization", async () => {
    const statement = await exportAllocationStatement(ORG, RUN)
    expect(statement).toMatchObject({ method: 'per_member_count', costPool: '600.00', total: '600.00' })
    expect(statement.lines).toEqual([
      { localId: LOCAL_ONE, localName: 'Local One', basisValue: expect.stringMatching(/^40/), sharePercent: '66.67', allocatedAmount: '400.00' },
      { localId: LOCAL_TWO, localName: 'Local Two', basisValue: expect.stringMatching(/^20/), sharePercent: '33.33', allocatedAmount: '200.00' },
    ])
  })

  it('names the method `mixed` when the lines of a run were allocated differently', async () => {
    expect((await exportAllocationStatement(ORG, MIXED_RUN)).method).toBe('mixed')
  })

  it("reports a local's chargebacks, newest period first, with the one amount a statement records, and filters by period", async () => {
    const report = await exportChargebackReport(ORG, LOCAL_ONE)
    expect(report.localName).toBe('Local One')
    expect(report.chargebacks.map((row) => [row.periodLabel, row.amount, row.status])).toEqual([
      ['February 2026', '125.50', 'issued'],
      ['January 2026', '400.00', 'issued'],
    ])
    expect(report.totalAmount).toBe('525.50')
    expect((await exportChargebackReport(ORG, LOCAL_ONE, JANUARY)).totalAmount).toBe('400.00')
    expect((await exportChargebackReport(ORG, LOCAL_TWO)).chargebacks).toEqual([])
  })

  it('exports the GL journal, a debit or a credit per ledger entry, and assembles the evidence pack for the period', async () => {
    const journal = await exportGlJournal(ORG, JANUARY)
    expect(journal.rows.map((row) => [row.debit, row.credit]).sort()).toEqual([
      ['0.00', '20.00'],
      ['100.00', '0.00'],
    ])
    const pack = await generateEvidencePack(ORG, JANUARY)
    expect(pack.sections.invoices).toHaveLength(1)
    expect(pack.sections.allocations).toHaveLength(2)
    expect(pack.sections.chargebacks.map((report) => report.localId)).toEqual([LOCAL_ONE])
    expect(pack.sections.glJournal.rows).toHaveLength(2)
    expect(pack.sections.ledgerSummary.totalEntries).toBe(2)
    expect(Number(pack.sections.ledgerSummary.netBalanceCad)).toBe(80)
  })
})
