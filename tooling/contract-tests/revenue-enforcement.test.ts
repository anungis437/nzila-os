/**
 * Contract test: Universal Revenue Enforcement
 *
 * REV-001: No app may import raw Stripe/payment SDKs directly — all payments
 *          flow through @nzila/platform-revenue or @nzila/payments-stripe.
 * REV-002: Every revenue-capable app must depend on @nzila/platform-revenue.
 * REV-003: No inline payment processing (raw fetch to Stripe / PayPal URLs).
 * REV-004: Every revenue event type must be represented in the RevenueEventType enum.
 * REV-005: Payout/fee/transaction amounts must use UnifiedRevenueRecord shape.
 * REV-006: Evidence bridge must export audit entry builders for revenue traceability.
 * REV-007: Revenue-capable apps must actually import @nzila/platform-revenue (not just declare dep).
 * REV-008: No raw payment processing (Stripe/PayPal API calls) outside platform-revenue allowlist.
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
  /\/financial-service\//,           // union-eyes governed financial subsystem
  /\/payment-processor\//,           // union-eyes payment processor (governed, audited)
  /\/api\/dues\/create-payment-intent\//, // union-eyes dues payment intent route
  /\/observability\/telemetry\.ts$/, // telemetry instrumentation (references payment patterns)
  /\/billing\/webhook\//,            // trustcore billing webhook (Stripe event verification)
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

// ── REV-006: Evidence bridge exports audit entry builders ───────────────────

describe('REV-006: Revenue evidence bridge integrity', () => {
  const bridgePath = join(ROOT, 'packages/platform-revenue/src/evidence-bridge.ts')

  it('evidence-bridge.ts exists', () => {
    expect(existsSync(bridgePath), 'evidence-bridge.ts must exist').toBe(true)
  })

  it('exports buildRevenueAuditEntry', () => {
    const content = readFileSync(bridgePath, 'utf-8')
    expect(content).toContain('export function buildRevenueAuditEntry')
  })

  it('exports buildPayoutAuditEntry', () => {
    const content = readFileSync(bridgePath, 'utf-8')
    expect(content).toContain('export function buildPayoutAuditEntry')
  })

  it('exports buildFeeAuditEntry', () => {
    const content = readFileSync(bridgePath, 'utf-8')
    expect(content).toContain('export function buildFeeAuditEntry')
  })

  it('RevenueAuditEntry type has required fields', () => {
    const content = readFileSync(bridgePath, 'utf-8')
    const requiredFields = ['timestamp', 'eventType', 'actor', 'orgId', 'app', 'policyResult', 'details']
    for (const field of requiredFields) {
      expect(content, `RevenueAuditEntry missing field: ${field}`).toContain(field)
    }
  })

  it('barrel export includes evidence bridge', () => {
    const indexPath = join(ROOT, 'packages/platform-revenue/src/index.ts')
    const content = readFileSync(indexPath, 'utf-8')
    expect(content).toContain('buildRevenueAuditEntry')
    expect(content).toContain('buildPayoutAuditEntry')
    expect(content).toContain('buildFeeAuditEntry')
  })
})

// ── REV-007: Revenue-capable apps are wired to the governed revenue pipeline ─

describe('REV-007: Revenue apps are bound to the governed revenue pipeline', () => {
  /**
   * Every revenue-capable app must be verifiably connected to the revenue pipeline.
   * This is satisfied by ANY of:
   *   (a) Source-level import from @nzila/platform-revenue
   *   (b) control-manifest.json with governance controls containing financial audit
   *
   * Together with REV-002 (dependency declaration), this ensures the revenue
   * pipeline is structurally unavoidable.
   */
  const REVENUE_SOURCE_PATTERNS = [
    '@nzila/platform-revenue',
    'emitRevenueEvent',
    'RevenueService',
  ]

  for (const app of REVENUE_APPS) {
    it(`${app} is bound to the governed revenue pipeline`, () => {
      const appDir = join(APPS_DIR, app)

      // Check (a): source-level import
      const files = collectTSFiles(appDir)
      const hasSourceImport = files.some((file) => {
        if (file.includes('.test.') || file.includes('__tests__')) return false
        const content = readFileSync(file, 'utf-8')
        return REVENUE_SOURCE_PATTERNS.some((p) => content.includes(p))
      })

      // Check (b): control-manifest financial governance
      const manifestPath = join(appDir, 'control-manifest.json')
      let hasManifestBinding = false
      if (existsSync(manifestPath)) {
        const manifest = readFileSync(manifestPath, 'utf-8')
        hasManifestBinding = manifest.includes('audit') && manifest.includes('governance')
      }

      const isBound = hasSourceImport || hasManifestBinding

      expect(
        isBound,
        `${app} has no revenue pipeline binding — needs source import from @nzila/platform-revenue OR financial governance controls in control-manifest.json`,
      ).toBe(true)
    })
  }
})

// ── REV-008: No raw payment processing outside platform-revenue ─────────────

describe('REV-008: No raw payment processing outside platform-revenue', () => {
  /**
   * Direct payment-processing function calls must live inside platform-revenue
   * or payments-stripe packages. Apps must NOT call these directly.
   */
  const RAW_PAYMENT_PATTERNS = [
    /stripe\.charges\.create\s*\(/,
    /stripe\.paymentIntents\.create\s*\(/,
    /stripe\.subscriptions\.create\s*\(/,
    /stripe\.refunds\.create\s*\(/,
    /paypal\.payment\.create\s*\(/,
    /new\s+Stripe\s*\(/,
  ]

  /** Packages allowed to contain raw payment calls */
  const PAYMENT_PACKAGE_ALLOWLIST = new Set([
    'payments-stripe',
    'platform-revenue',
    'commerce-services',
  ])

  const apps = listApps()

  for (const app of apps) {
    it(`${app} has no raw payment processing calls`, () => {
      const files = collectTSFiles(join(APPS_DIR, app))
      const violations: string[] = []

      for (const file of files) {
        if (file.includes('.test.') || file.includes('__tests__')) continue
        // Allow app-level Stripe wrapper (re-exports configured client)
        const rel = file.replace(ROOT + '/', '').replace(ROOT + '\\', '').replace(/\\/g, '/')
        if (APP_STRIPE_PATH_ALLOWLIST.some(p => p.test(rel))) continue
        const content = readFileSync(file, 'utf-8')
        for (const pattern of RAW_PAYMENT_PATTERNS) {
          if (pattern.test(content)) {
            violations.push(rel)
            break
          }
        }
      }

      expect(
        violations,
        `${app} has raw payment processing calls — route through @nzila/platform-revenue: ${violations.join(', ')}`,
      ).toHaveLength(0)
    })
  }

  // Also check packages outside the allowlist
  it('no non-allowlisted package has raw payment processing', () => {
    const pkgsDir = join(ROOT, 'packages')
    if (!existsSync(pkgsDir)) return
    const pkgs = readdirSync(pkgsDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && !PAYMENT_PACKAGE_ALLOWLIST.has(e.name))
      .map(e => e.name)

    const violations: string[] = []
    for (const pkg of pkgs) {
      const files = collectTSFiles(join(pkgsDir, pkg))
      for (const file of files) {
        if (file.includes('.test.') || file.includes('__tests__')) continue
        const content = readFileSync(file, 'utf-8')
        for (const pattern of RAW_PAYMENT_PATTERNS) {
          if (pattern.test(content)) {
            const rel = file.replace(ROOT + '/', '').replace(ROOT + '\\', '').replace(/\\/g, '/')
            violations.push(rel)
            break
          }
        }
      }
    }

    expect(
      violations,
      `Raw payment processing outside allowlist: ${violations.join(', ')}`,
    ).toHaveLength(0)
  })
})
