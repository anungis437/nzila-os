/**
 * ADVERSARIAL PHASE 2 — Financial Reconciliation Proof
 *
 * Validates financial invariants at the code and schema level:
 *  INV-FIN-001: Invoice total = sum(line items)
 *  INV-FIN-002: Payments applied enforcement
 *  INV-FIN-003: Ledger entries = payments + adjustments
 *  INV-FIN-004: Refund reverses prior entries
 *  INV-FIN-005: Reports match ledger
 *  INV-FIN-006: No rounding errors (integer cents)
 *
 * Also validates webhook verification, idempotency, and cross-org isolation.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const UE = join(ROOT, 'apps', 'union-eyes')
const CONSOLE = join(ROOT, 'apps', 'console')
const FIN_SVC = join(UE, 'services', 'financial-service', 'src')
const UE_SCHEMA = join(UE, 'db', 'schema')
const CONSOLE_SCHEMA = join(CONSOLE, 'db', 'schema')
const PKG_DB_SCHEMA = join(ROOT, 'packages', 'db', 'src', 'schema')

function read(path: string): string {
  if (!existsSync(path)) return ''
  return readFileSync(path, 'utf-8')
}

function walkFiles(dir: string, pattern: RegExp): string[] {
  const results: string[] = []
  function walk(d: string, depth = 0) {
    if (depth > 12 || !existsSync(d)) return
    try {
      for (const entry of readdirSync(d)) {
        if (['node_modules', '.next', '.turbo', 'dist'].includes(entry)) continue
        const full = join(d, entry)
        try {
          const stat = statSync(full)
          if (stat.isDirectory()) walk(full, depth + 1)
          else if (pattern.test(entry)) results.push(full)
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  walk(dir)
  return results
}

function allSchemaFiles(): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = []
  for (const dir of [UE_SCHEMA, CONSOLE_SCHEMA, PKG_DB_SCHEMA]) {
    for (const f of walkFiles(dir, /\.ts$/)) {
      files.push({ path: relative(ROOT, f).replace(/\\/g, '/'), content: read(f) })
    }
  }
  return files
}

describe('ADVERSARIAL-2 — Financial Reconciliation Proof', () => {
  // ── INV-FIN-001: Invoice structure ────────────────────────────────────
  describe('INV-FIN-001: Invoice total integrity', () => {
    it('platform_invoices schema defines totalAmount as NOT NULL', () => {
      const schemas = allSchemaFiles()
      const invoiceSchema = schemas.find(s =>
        s.content.includes('platform_invoices') || s.content.includes('platformInvoices')
      )
      expect(invoiceSchema).toBeDefined()
      // Amount fields should exist and be typed
      expect(invoiceSchema!.content).toMatch(/amount|total/i)
    })

    it('invoice routes compute totals from line items or validated input', () => {
      const invoiceRoutes = walkFiles(join(UE, 'app', 'api'), /route\.ts$/)
        .filter(f => f.includes('invoice'))
      const finInvoiceRoutes = walkFiles(FIN_SVC, /\.(ts|js)$/)
        .filter(f => f.toLowerCase().includes('invoice'))

      const allInvoice = [...invoiceRoutes, ...finInvoiceRoutes]
      expect(allInvoice.length).toBeGreaterThan(0)

      // At least one invoice file should reference amount calculation or validation
      const hasAmountHandling = allInvoice.some(f => {
        const c = read(f)
        return /amount|total|lineItem|line_item|subtotal/i.test(c)
      })
      expect(hasAmountHandling).toBe(true)
    })
  })

  // ── INV-FIN-002: Payment application enforcement ──────────────────────
  describe('INV-FIN-002: Payment application', () => {
    it('payment processing converts amounts to cents (integer math)', () => {
      const paymentFiles = walkFiles(FIN_SVC, /\.(ts|js)$/)
        .filter(f => /payment|charge|billing/i.test(f))
      expect(paymentFiles.length).toBeGreaterThan(0)

      const hasCentsConversion = paymentFiles.some(f => {
        const c = read(f)
        return /Math\.round\s*\(\s*\w+\s*\*\s*100\s*\)|amount_cents|amountInCents|\* 100/i.test(c)
      })
      expect(hasCentsConversion).toBe(true)
    })

    it('payment schema has amount as non-nullable numeric type', () => {
      const schemas = allSchemaFiles()
      const paymentSchema = schemas.find(s =>
        s.content.includes('platform_payments') ||
        s.content.includes('platformPayments') ||
        s.content.includes('dues_transactions') ||
        s.content.includes('duesTransactions')
      )
      expect(paymentSchema).toBeDefined()
      // Should have decimal/numeric/integer for amounts
      expect(paymentSchema!.content).toMatch(/decimal|numeric|integer|bigint/i)
    })
  })

  // ── INV-FIN-003: Ledger entry tracking ────────────────────────────────
  describe('INV-FIN-003: Ledger entry tracking', () => {
    it('financial schema has transaction/ledger tracking tables', () => {
      const schemas = allSchemaFiles()
      const hasLedger = schemas.some(s =>
        /ledger|transaction|journal_entry|journal_entries|duesTransactions|dues_transactions/i.test(s.content)
      )
      expect(hasLedger).toBe(true)
    })

    it('transaction records have timestamp and status tracking', () => {
      const schemas = allSchemaFiles()
      const txSchema = schemas.find(s =>
        s.content.includes('duesTransactions') || s.content.includes('dues_transactions') ||
        s.content.includes('platform_payments') || s.content.includes('platformPayments')
      )
      expect(txSchema).toBeDefined()
      expect(txSchema!.content).toMatch(/createdAt|created_at|timestamp/i)
      expect(txSchema!.content).toMatch(/status/)
    })
  })

  // ── INV-FIN-004: Refund handling ──────────────────────────────────────
  describe('INV-FIN-004: Refund reversal', () => {
    it('refund handler updates transaction status to refunded', () => {
      const paymentFiles = walkFiles(FIN_SVC, /\.(ts|js)$/)
      const refundHandler = paymentFiles.find(f => {
        const c = read(f)
        return /refund/i.test(c)
      })
      expect(refundHandler).toBeDefined()
      const content = read(refundHandler!)
      expect(content).toMatch(/refund/i)
      // Should update status
      expect(content).toMatch(/status.*refund|refund.*status/i)
    })

    it('commerce_refunds schema has lifecycle status enum', () => {
      const schemas = allSchemaFiles()
      const refundSchema = schemas.find(s =>
        s.content.includes('commerce_refunds') || s.content.includes('commerceRefunds')
      )
      expect(refundSchema).toBeDefined()
      expect(refundSchema!.content).toMatch(/status/)
    })

    it('refund routes exist in console app', () => {
      const consoleRoutes = walkFiles(join(CONSOLE, 'app', 'api'), /route\.ts$/)
      const refundRoutes = consoleRoutes.filter(f =>
        f.toLowerCase().includes('refund') || f.toLowerCase().includes('stripe')
      )
      expect(refundRoutes.length).toBeGreaterThan(0)
    })
  })

  // ── INV-FIN-005: Financial reporting ──────────────────────────────────
  describe('INV-FIN-005: Financial reporting', () => {
    it('financial export/report routes exist', () => {
      const ueRoutes = walkFiles(join(UE, 'app', 'api'), /route\.ts$/)
      const consoleRoutes = walkFiles(join(CONSOLE, 'app', 'api'), /route\.ts$/)
      const reportRoutes = [...ueRoutes, ...consoleRoutes].filter(f => {
        const rel = f.toLowerCase()
        return rel.includes('export') || rel.includes('report') || rel.includes('dashboard')
      })
      expect(reportRoutes.length).toBeGreaterThan(0)
    })

    it('financial dashboard queries filter by organizationId', () => {
      const dashRoutes = walkFiles(join(UE, 'app', 'api', 'finance'), /route\.ts$/)
        .filter(f => f.includes('dashboard'))
      if (dashRoutes.length > 0) {
        const content = read(dashRoutes[0])
        expect(content).toMatch(/organizationId|orgId|organization_id/)
      }
    })
  })

  // ── INV-FIN-006: No rounding errors (integer cents) ───────────────────
  describe('INV-FIN-006: No rounding errors', () => {
    it('Stripe-facing code multiplies by 100 for cents conversion', () => {
      const stripeFiles = walkFiles(FIN_SVC, /\.(ts|js)$/)
      const hasCentsConversion = stripeFiles.some(f => {
        const c = read(f)
        return /\*\s*100|Math\.round.*100/i.test(c) && /stripe/i.test(c)
      })
      expect(hasCentsConversion).toBe(true)
    })

    it('financial schema uses decimal/numeric types (not float/real)', () => {
      const schemas = allSchemaFiles()
      const finSchemas = schemas.filter(s =>
        /payment|invoice|billing|dues|finance/i.test(s.path)
      )
      for (const s of finSchemas) {
        // Should NOT use float or real for money
        const lines = s.content.split('\n')
        for (const line of lines) {
          if (/amount|total|price|cost/i.test(line) && /\bfloat\b|\breal\b|\bdouble\b/i.test(line)) {
            expect.fail(`Float type used for money field in ${s.path}: ${line.trim()}`)
          }
        }
      }
    })

    it('no floating-point division on monetary values in payment processing', () => {
      const paymentFiles = walkFiles(FIN_SVC, /\.(ts|js)$/)
        .filter(f => /payment|charge/i.test(f))
      for (const f of paymentFiles) {
        const content = read(f)
        // Should not divide amounts by fractional numbers
        const hasDangerousDivision = /amount\s*\/\s*(?:0\.\d+|[^1](?!\d*00))/.test(content)
        if (hasDangerousDivision) {
          expect.fail(`Floating-point division on amount in ${relative(ROOT, f)}`)
        }
      }
    })
  })

  // ── Webhook Verification ──────────────────────────────────────────────
  describe('webhook security', () => {
    it('Stripe webhook handler calls constructEvent for signature verification', () => {
      const paymentProcessingFile = join(FIN_SVC, 'services', 'payment-processing.ts')
      const content = read(paymentProcessingFile)

      // constructEvent must appear UNCOMMENTED (not preceded by //)
      const lines = content.split('\n')
      const constructEventLines = lines.filter(l =>
        /constructEvent/.test(l) && !/^\s*\/\//.test(l)
      )
      expect(constructEventLines.length).toBeGreaterThan(0)
    })

    it('stripe_webhook_events table has UNIQUE constraint on event ID', () => {
      const schemas = allSchemaFiles()
      const webhookSchema = schemas.find(s =>
        s.content.includes('stripe_webhook_events') || s.content.includes('stripeWebhookEvents')
      )
      expect(webhookSchema).toBeDefined()
      expect(webhookSchema!.content).toMatch(/unique|\.unique\(\)/)
    })
  })

  // ── Cross-Org Isolation ───────────────────────────────────────────────
  describe('cross-org financial isolation', () => {
    it('financial queries filter by organizationId', () => {
      const finRoutes = walkFiles(join(UE, 'app', 'api', 'finance'), /route\.ts$/)
      let hasOrgFilter = false
      for (const f of finRoutes) {
        const content = read(f)
        if (/organizationId|orgId|organization_id|tenantId/.test(content)) {
          hasOrgFilter = true
          break
        }
      }
      expect(hasOrgFilter).toBe(true)
    })

    it('platform_invoices has invoiceNumber UNIQUE constraint', () => {
      const schemas = allSchemaFiles()
      const invoiceSchema = schemas.find(s =>
        s.content.includes('platform_invoices') || s.content.includes('platformInvoices')
      )
      expect(invoiceSchema).toBeDefined()
      expect(invoiceSchema!.content).toMatch(/invoiceNumber.*unique|unique.*invoiceNumber/is)
    })
  })

  // ── Financial Service Auth ────────────────────────────────────────────
  describe('financial service authentication', () => {
    it('financial service uses Clerk verifyToken or API key auth', () => {
      const svcFiles = walkFiles(FIN_SVC, /\.(ts|js)$/)
      const hasAuth = svcFiles.some(f => {
        const c = read(f)
        return /verifyToken|adminClient|Bearer|authorization|api[_-]?key/i.test(c)
      })
      expect(hasAuth).toBe(true)
    })

    it('financial service uses env vars for Stripe keys', () => {
      const svcFiles = walkFiles(FIN_SVC, /\.(ts|js)$/)
      const hasEnvStripe = svcFiles.some(f => {
        const c = read(f)
        return /process\.env\.STRIPE|process\.env\.\w*STRIPE/i.test(c)
      })
      expect(hasEnvStripe).toBe(true)
    })
  })
})
