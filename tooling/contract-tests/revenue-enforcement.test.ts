/**
 * Contract test: Universal Revenue Enforcement
 *
 * REV-001: No app may import raw Stripe/payment SDKs directly — all payments
 *          flow through @nzila/platform-revenue or @nzila/payments-stripe.
 * REV-002: Every revenue-capable app must depend on @nzila/platform-revenue.
 * REV-003: No inline payment processing (raw fetch to Stripe / PayPal URLs).
 * REV-004: Every revenue event type must be represented in the RevenueEventType enum.
 * REV-005: Payout/fee/transaction amounts must use UnifiedRevenueRecord shape.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const APPS_DIR = join(ROOT, 'apps')

/** Apps that handle revenue and MUST depend on platform-revenue */
const REVENUE_APPS = ['zonga', 'cfo', 'flow', 'partners', 'trade']

/** Packages allowed to import raw Stripe SDK */
const STRIPE_ALLOWLIST = new Set([
  'payments-stripe',     // thin wrapper — allowed
  'platform-revenue',    // orchestration layer — allowed
  'commerce-services',   // legacy bridge — allowed
])

function readJSON(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

function listApps(): string[] {
  return readdirSync(APPS_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => e.name)
}

function collectTSFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const found: string[] = []
  const stack = [dir]
  while (stack.length > 0) {
    const d = stack.pop()!
    let entries: import('node:fs').Dirent[]
    try { entries = readdirSync(d, { withFileTypes: true }) } catch { continue }
    for (const e of entries) {
      const full = join(d, e.name)
      if (e.isDirectory()) {
        if (['node_modules', '.git', 'dist', '.next', '.turbo', 'drizzle'].includes(e.name)) continue
        stack.push(full)
      } else if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.tsx'))) {
        found.push(full)
      }
    }
  }
  return found
}

/**
 * App-level files allowed to import raw Stripe SDK:
 * - Thin wrappers (e.g., lib/stripe.ts) that re-export a configured client
 * - Webhook handlers that receive Stripe event payloads
 * Type-only imports in these files are expected.
 */
const APP_STRIPE_PATH_ALLOWLIST = [
  /\/lib\/stripe\.ts$/,              // app-level Stripe client wrapper
  /\/webhooks\/stripe\//,            // Stripe webhook handlers
]

/**
 * Files excluded from payment URL scanning — CSP headers, config files,
 * and doc comments are not actual payment API calls.
 */
const PAYMENT_URL_EXCLUDED_FILES = [
  /next\.config\.(ts|js|mjs)$/,     // CSP connect-src directives
  /\.config\.(ts|js|mjs)$/,         // general config files
  /\/lib\/api-client\.ts$/,         // centralized API client wrappers (pre-platform-revenue)
  /\/lib\/stripe\.ts$/,             // app-level Stripe client module
]

// ── REV-001: No app directly imports raw Stripe SDK ─────────────────────────

describe('REV-001: No raw Stripe SDK imports outside allowlist', () => {
  const apps = listApps()

  for (const app of apps) {
    it(`${app} does not import stripe directly`, () => {
      const files = collectTSFiles(join(APPS_DIR, app))
      const violations: string[] = []

      for (const file of files) {
        const rel = file.replace(ROOT + '/', '').replace(ROOT + '\\', '').replace(/\\/g, '/')
        // Skip app-level Stripe wrappers and webhook handlers
        if (APP_STRIPE_PATH_ALLOWLIST.some(p => p.test(rel))) continue
        const content = readFileSync(file, 'utf-8')
        // Match: import ... from 'stripe' or require('stripe')
        if (/(?:from\s+['"]stripe['"]|require\(\s*['"]stripe['"]\s*\))/.test(content)) {
          violations.push(rel)
        }
      }

      expect(
        violations,
        `${app} imports stripe directly — route through @nzila/payments-stripe or @nzila/platform-revenue: ${violations.join(', ')}`,
      ).toHaveLength(0)
    })
  }
})

// ── REV-002: Revenue apps depend on @nzila/platform-revenue ─────────────────

describe('REV-002: Revenue-capable apps depend on @nzila/platform-revenue', () => {
  for (const app of REVENUE_APPS) {
    it(`${app} has @nzila/platform-revenue dependency`, () => {
      const pkgPath = join(APPS_DIR, app, 'package.json')
      if (!existsSync(pkgPath)) return

      const pkg = readJSON(pkgPath)
      const deps = {
        ...(pkg?.dependencies as Record<string, string> | undefined),
        ...(pkg?.devDependencies as Record<string, string> | undefined),
      }

      expect(
        deps['@nzila/platform-revenue'],
        `${app} must depend on @nzila/platform-revenue`,
      ).toBeDefined()
    })
  }
})

// ── REV-003: No inline payment URLs ─────────────────────────────────────────

describe('REV-003: No inline payment URLs in app source', () => {
  const apps = listApps()

  const PAYMENT_URL_PATTERNS = [
    /https:\/\/api\.stripe\.com/,
    /https:\/\/api\.paypal\.com/,
    /https:\/\/api\.square\.com/,
  ]

  for (const app of apps) {
    it(`${app} has no hardcoded payment API URLs`, () => {
      const files = collectTSFiles(join(APPS_DIR, app))
      const violations: string[] = []

      for (const file of files) {
        // Skip test files
        if (file.includes('.test.') || file.includes('__tests__')) continue
        // Skip config files (CSP headers in next.config.ts, etc.)
        const rel = file.replace(ROOT + '/', '').replace(ROOT + '\\', '').replace(/\\/g, '/')
        if (PAYMENT_URL_EXCLUDED_FILES.some(p => p.test(rel))) continue
        const content = readFileSync(file, 'utf-8')

        for (const pattern of PAYMENT_URL_PATTERNS) {
          if (pattern.test(content)) {
            const rel = file.replace(ROOT + '/', '').replace(ROOT + '\\', '')
            violations.push(rel)
            break
          }
        }
      }

      expect(
        violations,
        `${app} has hardcoded payment API URLs — all payment calls must go through platform-revenue: ${violations.join(', ')}`,
      ).toHaveLength(0)
    })
  }
})

// ── REV-004: RevenueEventType enum covers all domains ───────────────────────

describe('REV-004: Revenue event types cover all domains', () => {
  it('RevenueEventType has required event types', () => {
    const typesPath = join(ROOT, 'packages/platform-revenue/src/types.ts')
    expect(existsSync(typesPath), 'platform-revenue types.ts must exist').toBe(true)

    const content = readFileSync(typesPath, 'utf-8')

    const requiredEvents = [
      'SUBSCRIPTION_STARTED',
      'SUBSCRIPTION_RENEWED',
      'SUBSCRIPTION_CANCELLED',
      'ZONGA_REVENUE',
      'COMMERCE_REVENUE',
      'ONE_TIME_PAYMENT',
    ]

    for (const evt of requiredEvents) {
      expect(content, `Missing RevenueEventType: ${evt}`).toContain(evt)
    }
  })
})

// ── REV-005: UnifiedRevenueRecord has mandatory financial fields ────────────

describe('REV-005: UnifiedRevenueRecord has mandatory fields', () => {
  it('UnifiedRevenueRecordSchema has all required fields', () => {
    const typesPath = join(ROOT, 'packages/platform-revenue/src/types.ts')
    const content = readFileSync(typesPath, 'utf-8')

    const requiredFields = [
      'orgId',
      'appSource',
      'revenueType',
      'grossAmount',
      'platformFee',
      'netAmount',
      'currency',
      'status',
    ]

    for (const field of requiredFields) {
      expect(content, `UnifiedRevenueRecord missing field: ${field}`).toContain(field)
    }
  })
})
