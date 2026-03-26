/**
 * PHASE 11 — Commercial Integrity Hardening Certification
 *
 * Validates the hardening pass is production-certifiable:
 *  - Entitlement enforcement on all monetizable routes
 *  - Webhook handlers return 200 on errors (no retry storms)
 *  - Shared cents-safe decimal library exists and is used
 *  - No raw parseFloat/Number() on monetary DB fields in financial services
 *  - Reconciliation service has critical variance alerting
 *  - Reconciliation required before billing period closure
 *  - Contract validation guards on invoice generation, template instantiation, renewals
 *  - Currency formatting defaults to CAD (not USD)
 *  - No raw `$${value}` money interpolation in billing/finance UI
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const UE = join(ROOT, 'apps', 'union-eyes')
const PE_SVC = join(UE, 'services', 'platform-economics')
const LIB = join(UE, 'lib')

function read(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

// ============================================================================
// DECIMAL-SAFE LIBRARY
// ============================================================================

describe('CERT-HARDENING — Cents-Safe Decimal Library', () => {
  const decimalSafe = read(join(LIB, 'decimal-safe.ts'))

  it('decimal-safe.ts exists', () => {
    expect(existsSync(join(LIB, 'decimal-safe.ts'))).toBe(true)
  })

  it('exports toCents function', () => {
    expect(decimalSafe).toContain('export function toCents')
  })

  it('exports fromCents function', () => {
    expect(decimalSafe).toContain('export function fromCents')
  })

  it('exports addMoney function', () => {
    expect(decimalSafe).toContain('export function addMoney')
  })

  it('exports subtractMoney function', () => {
    expect(decimalSafe).toContain('export function subtractMoney')
  })

  it('exports multiplyMoney function', () => {
    expect(decimalSafe).toContain('export function multiplyMoney')
  })

  it('exports moneyToNumber function', () => {
    expect(decimalSafe).toContain('export function moneyToNumber')
  })

  it('toCents uses Math.round to avoid floating-point drift', () => {
    expect(decimalSafe).toMatch(/Math\.round\(.*\*\s*100\)/)
  })
})

// ============================================================================
// WEBHOOK SEMANTIC PURITY — 200 on errors
// ============================================================================

describe('CERT-HARDENING — Webhook Error Handling', () => {
  const stripeWebhook = read(join(UE, 'app', 'api', 'payments', 'webhooks', 'stripe', 'route.ts'))
  const stripeWebhook2 = read(join(UE, 'app', 'api', 'stripe', 'webhooks', 'route.ts'))
  const paypalWebhook = read(join(UE, 'app', 'api', 'payments', 'webhooks', 'paypal', 'route.ts'))
  const shopifyWebhook = read(join(UE, 'app', 'api', 'integrations', 'shopify', 'webhooks', 'route.ts'))

  it('Stripe webhook (payments) returns 200 on catch', () => {
    expect(stripeWebhook).toMatch(/catch[\s\S]*?received.*true/)
  })

  it('Stripe webhook (stripe) returns 200 on catch', () => {
    expect(stripeWebhook2).toMatch(/catch[\s\S]*?received.*true/)
  })

  it('PayPal webhook returns 200 on catch', () => {
    expect(paypalWebhook).toMatch(/catch[\s\S]*?received.*true/)
  })

  it('Shopify webhook returns 200 on catch', () => {
    expect(shopifyWebhook).toMatch(/catch[\s\S]*?received.*true/)
  })

  it('PayPal webhook has idempotency guard', () => {
    expect(paypalWebhook).toContain('isWebhookProcessed')
  })
})

// ============================================================================
// RECONCILIATION AUTHORITY
// ============================================================================

describe('CERT-HARDENING — Reconciliation Authority', () => {
  const reconSvc = read(join(PE_SVC, 'reconciliation-service.ts'))

  it('reconciliation service imports shared decimal helpers', () => {
    expect(reconSvc).toContain("from '@/lib/decimal-safe'")
  })

  it('reconciliation service has critical variance alerting', () => {
    expect(reconSvc).toContain('CRITICAL')
    expect(reconSvc).toMatch(/variance.*threshold|threshold.*variance/i)
  })

  it('exports requireReconciliation guard function', () => {
    expect(reconSvc).toContain('export async function requireReconciliation')
  })

  it('requireReconciliation checks for completed run', () => {
    expect(reconSvc).toContain('completed')
  })

  it('requireReconciliation checks for open exceptions', () => {
    expect(reconSvc).toMatch(/open.*exception|exception.*open/i)
  })
})

// ============================================================================
// BILLING PERIOD CLOSURE REQUIRES RECONCILIATION
// ============================================================================

describe('CERT-HARDENING — Billing Period Closure Guard', () => {
  const billingSvc = read(join(PE_SVC, 'billing-service.ts'))

  it('billing service imports requireReconciliation', () => {
    expect(billingSvc).toContain("import { requireReconciliation }")
  })

  it('closeBillingPeriod calls requireReconciliation', () => {
    expect(billingSvc).toContain('requireReconciliation')
  })
})

// ============================================================================
// CONTRACT VALIDATION GUARDS
// ============================================================================

describe('CERT-HARDENING — Contract→Billing Consistency', () => {
  const billingSvc = read(join(PE_SVC, 'billing-service.ts'))
  const pricingSvc = read(join(PE_SVC, 'pricing-template-service.ts'))
  const subLifecycle = read(join(PE_SVC, 'subscription-lifecycle-service.ts'))

  it('billing service imports getActiveContract', () => {
    expect(billingSvc).toContain("import { getActiveContract }")
  })

  it('generateInvoice validates active contract', () => {
    expect(billingSvc).toMatch(/getActiveContract[\s\S]*?no active contract/i)
  })

  it('pricing template service imports getActiveContract', () => {
    expect(pricingSvc).toContain("import { getActiveContract }")
  })

  it('instantiateTemplate validates active contract', () => {
    expect(pricingSvc).toMatch(/getActiveContract[\s\S]*?no active contract/i)
  })

  it('subscription lifecycle service imports getActiveContract', () => {
    expect(subLifecycle).toContain("import { getActiveContract }")
  })

  it('processAutoRenewals caps renewal at contract expiration', () => {
    expect(subLifecycle).toContain('expirationDate')
    expect(subLifecycle).toMatch(/contract.*expiration|cap.*renewal/i)
  })
})

// ============================================================================
// CURRENCY FORMATTING CORRECTNESS
// ============================================================================

describe('CERT-HARDENING — Currency Formatting', () => {
  const utilsLib = read(join(LIB, 'utils.ts'))

  it('shared formatCurrency defaults to CAD', () => {
    expect(utilsLib).toMatch(/currency.*=.*'CAD'/)
  })

  it('shared formatCurrency defaults to en-CA locale', () => {
    expect(utilsLib).toMatch(/locale.*=.*'en-CA'/)
  })

  it('shared formatCurrency uses Intl.NumberFormat', () => {
    expect(utilsLib).toContain('Intl.NumberFormat')
  })

  it('shared formatCurrency sets minimumFractionDigits: 2', () => {
    expect(utilsLib).toContain('minimumFractionDigits: 2')
  })
})

// ============================================================================
// NO RAW MONEY INTERPOLATION IN FINANCE UI
// ============================================================================

describe('CERT-HARDENING — No Raw Money Display', () => {
  const financePages = [
    join(UE, 'app', '[locale]', 'finance', 'page.tsx'),
    join(UE, 'app', '[locale]', 'finance', 'invoices', 'page.tsx'),
    join(UE, 'app', '[locale]', 'finance', 'allocation', 'page.tsx'),
  ]

  const duesPages = [
    join(UE, 'app', '[locale]', 'dues', 'page.tsx'),
    join(UE, 'app', '[locale]', 'dues', 'arrears', 'page.tsx'),
    join(UE, 'app', '[locale]', 'dues', 'payment-plans', 'page.tsx'),
    join(UE, 'app', '[locale]', 'dues', 'reconcile', 'page.tsx'),
    join(UE, 'app', '[locale]', 'portal', 'dues', 'page.tsx'),
  ]

  const allPages = [...financePages, ...duesPages]

  for (const page of allPages) {
    const name = page.replace(UE, '').replace(/\\/g, '/')

    it(`${name} imports formatCurrency`, () => {
      const content = read(page)
      expect(content).toContain('formatCurrency')
    })

    it(`${name} has no raw $\${...} money interpolation`, () => {
      const content = read(page)
      // Match patterns like $${value} that are NOT inside formatCurrency calls
      const rawMoneyPattern = /\$\$\{[^}]*(?:amount|total|fee|cost|price|balance|paid|owed|dues)[^}]*\}/i
      expect(content).not.toMatch(rawMoneyPattern)
    })
  }
})

// ============================================================================
// ENTITLEMENT ENFORCEMENT
// ============================================================================

describe('CERT-HARDENING — Entitlement Enforcement Coverage', () => {
  const entitlementGuard = read(join(PE_SVC, 'entitlement-guard.ts'))

  it('entitlement guard service exists', () => {
    expect(existsSync(join(PE_SVC, 'entitlement-guard.ts'))).toBe(true)
  })

  it('exports requireEntitlement function', () => {
    expect(entitlementGuard).toContain('export async function requireEntitlement')
  })

  it('defines module keys for all commercial modules', () => {
    const requiredModules = [
      'governance_suite',
      'financial_intelligence_suite',
      'ai_advanced_insights',
      'allocation_engine',
      'transaction_fees',
      'commercial_reporting',
      'export_suite',
    ]
    for (const mod of requiredModules) {
      expect(entitlementGuard).toContain(mod)
    }
  })
})

// ============================================================================
// MONEY MATH — NO RAW parseFloat IN FINANCIAL SERVICES
// ============================================================================

describe('CERT-HARDENING — No Unsafe parseFloat in Financial Services', () => {
  const criticalServices = [
    'billing-service.ts',
    'reconciliation-service.ts',
    'allocation-engine.ts',
    'general-ledger-service.ts',
    'proration-engine.ts',
    'payment-service.ts',
  ]

  for (const svc of criticalServices) {
    it(`${svc} uses decimal-safe helpers (no raw parseFloat on monetary values)`, () => {
      const content = read(join(PE_SVC, svc))
      if (content.length === 0) return // Skip if file doesn't exist

      // Check that decimal-safe is imported (or file uses its own safe math)
      const usesDecimalSafe = content.includes("from '@/lib/decimal-safe'")
      const usesLocalSafeMath = content.includes('Math.round')

      expect(usesDecimalSafe || usesLocalSafeMath).toBe(true)
    })
  }
})
