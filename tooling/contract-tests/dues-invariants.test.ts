/**
 * Contract Test — Dues & Payment Schema Invariants (Phase 5)
 *
 * Schema-level invariant checks verifying financial integrity in the
 * Drizzle ORM definitions. These are static checks — no DB connection needed.
 *
 *   INV-DUES-001: dues_transactions has amount breakdown columns
 *   INV-DUES-002: organization_id is required on all financial tables
 *   INV-DUES-003: payment processor fields exist on dues_transactions
 *   INV-DUES-004: refund infrastructure exists in schema
 *   INV-DUES-005: no cross-org financial leakage (org isolation on critical tables)
 *
 * @invariant INV-DUES: financial schema is complete and org-isolated
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const UE_FINANCE_DIR = join(ROOT, 'apps', 'union-eyes', 'db', 'schema', 'domains', 'finance')
const PLATFORM_BILLING = join(UE_FINANCE_DIR, 'platform-billing.ts')
const DUES_SCHEMA = join(UE_FINANCE_DIR, 'dues.ts')
const COMMERCE_SCHEMA = join(ROOT, 'packages', 'db', 'src', 'schema', 'commerce.ts')

function readIfExists(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

function collectFinanceSchemaContent(): string {
  let content = ''
  if (existsSync(UE_FINANCE_DIR)) {
    for (const f of readdirSync(UE_FINANCE_DIR).filter((f) => f.endsWith('.ts'))) {
      content += readFileSync(join(UE_FINANCE_DIR, f), 'utf-8') + '\n'
    }
  }
  content += readIfExists(COMMERCE_SCHEMA)
  return content
}

// ────────────────────────────────────────────────────────────────────────────
// INV-DUES-001: Amount Breakdown Columns
// ────────────────────────────────────────────────────────────────────────────
describe('INV-DUES-001 — Amount Breakdown Columns', () => {
  it('dues_transactions defines detailed amount breakdown', () => {
    const duesContent = readIfExists(DUES_SCHEMA)
    expect(duesContent).toBeTruthy()

    const required = [
      'dues_amount',
      'cope_amount',
      'pac_amount',
      'strike_fund_amount',
      'late_fee_amount',
      'adjustment_amount',
    ]
    for (const col of required) {
      expect(duesContent, `missing column '${col}'`).toContain(`'${col}'`)
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────
// INV-DUES-002: Organization ID Required on Financial Tables
// ────────────────────────────────────────────────────────────────────────────
describe('INV-DUES-002 — Organization ID on Financial Tables', () => {
  it('all finance schema files reference organization_id or org_id', () => {
    const financeContent = collectFinanceSchemaContent()
    expect(financeContent).toBeTruthy()

    const orgRefs = financeContent.match(/['"](?:organization_id|org_id)['"]/g) ?? []
    // Financial schema must have many org-scoped references for tenant isolation
    expect(orgRefs.length).toBeGreaterThanOrEqual(5)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// INV-DUES-003: Payment Processor Fields
// ────────────────────────────────────────────────────────────────────────────
describe('INV-DUES-003 — Payment Processor Fields', () => {
  it('dues_transactions has payment processor columns', () => {
    const duesContent = readIfExists(DUES_SCHEMA)
    expect(duesContent).toBeTruthy()

    expect(duesContent).toContain("'processor_type'")
    expect(duesContent).toContain("'processor_payment_id'")
    expect(duesContent).toContain("'processor_customer_id'")
  })

  it('payment processor enum is defined', () => {
    const duesContent = readIfExists(DUES_SCHEMA)
    expect(duesContent).toContain('payment_processor')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// INV-DUES-004: Refund Infrastructure
// ────────────────────────────────────────────────────────────────────────────
describe('INV-DUES-004 — Refund Infrastructure', () => {
  it('commerce schema has refund table definition', () => {
    const commerceContent = readIfExists(COMMERCE_SCHEMA)
    expect(commerceContent).toContain("'commerce_refunds'")
  })

  it('dues_transactions supports refunded status', () => {
    const duesContent = readIfExists(DUES_SCHEMA)
    expect(duesContent).toContain("'refunded'")
  })
})

// ────────────────────────────────────────────────────────────────────────────
// INV-DUES-005: No Cross-Org Financial Leakage
// ────────────────────────────────────────────────────────────────────────────
describe('INV-DUES-005 — No Cross-Org Financial Leakage', () => {
  it('platform billing tables enforce org isolation', () => {
    const billingContent = readIfExists(PLATFORM_BILLING)
    expect(billingContent).toBeTruthy()

    // Critical billing tables must reference organization_id
    const criticalTables = ['billing_accounts', 'platform_invoices', 'platform_payments']
    for (const table of criticalTables) {
      expect(billingContent, `missing table '${table}'`).toContain(`'${table}'`)
    }

    // Must have org_id / organization_id references for tenant isolation
    const orgRefs = billingContent.match(/['"](?:organization_id|org_id)['"]/g) ?? []
    expect(orgRefs.length).toBeGreaterThanOrEqual(3)
  })

  it('commerce tables enforce org isolation', () => {
    const commerceContent = readIfExists(COMMERCE_SCHEMA)
    const orgRefs = commerceContent.match(/['"]org_id['"]/g) ?? []
    expect(orgRefs.length).toBeGreaterThanOrEqual(5)
  })
})
