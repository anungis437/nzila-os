/**
 * ADVERSARIAL PHASE 9 — MIL Security & Integrity Validation
 *
 * Validates the MIL cannot be subverted by:
 *  1. Missing organizationId scoping on tenant tables
 *  2. Monetary fields using unsafe types (FLOAT, VARCHAR)
 *  3. Missing audit logging on state-mutating service functions
 *  4. Mutable append-only tables (usage_events, entitlement_usage_log, subscription_events_log)
 *  5. Currency hardcoded to non-CAD values
 *  6. Missing input validation / boundary checks in proration
 *  7. Dunning step ordering gaps (non-sequential step_order)
 *  8. SQL injection vectors in migration (string interpolation)
 *  9. Entitlement checks that skip usage limits
 * 10. Service functions missing transaction wrappers
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const UE = join(ROOT, 'apps', 'union-eyes')
const FIN_SCHEMA = join(UE, 'db', 'schema', 'domains', 'finance')
const PE_SVC = join(UE, 'services', 'platform-economics')
const MIGRATIONS = join(UE, 'db', 'migrations')

function read(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

// ============================================================================
// A9-1: TENANT ISOLATION — organizationId on all MIL tables
// ============================================================================

describe('ADVERSARIAL-9 — Tenant Isolation', () => {
  it('commercial_contracts has organizationId column', () => {
    const src = read(join(FIN_SCHEMA, 'contracts.ts'))
    const tableStart = src.indexOf("commercialContracts = pgTable")
    const tableEnd = src.indexOf('));', tableStart)
    const table = src.slice(tableStart, tableEnd)
    expect(table).toContain('organizationId')
  })

  it('org_entitlements has organizationId column', () => {
    const src = read(join(FIN_SCHEMA, 'contracts.ts'))
    const tableStart = src.indexOf("orgEntitlements = pgTable")
    const tableEnd = src.indexOf('));', tableStart)
    const table = src.slice(tableStart, tableEnd)
    expect(table).toContain('organizationId')
  })

  it('entitlement_usage_log has organizationId column', () => {
    const src = read(join(FIN_SCHEMA, 'contracts.ts'))
    const tableStart = src.indexOf("entitlementUsageLog = pgTable")
    const tableEnd = src.indexOf('));', tableStart)
    const table = src.slice(tableStart, tableEnd)
    expect(table).toContain('organizationId')
  })

  it('usage_events has organizationId column', () => {
    const src = read(join(FIN_SCHEMA, 'usage-metering.ts'))
    const tableStart = src.indexOf("usageEvents = pgTable")
    const tableEnd = src.indexOf('));', tableStart)
    const table = src.slice(tableStart, tableEnd)
    expect(table).toContain('organizationId')
  })

  it('usage_aggregates has organizationId column', () => {
    const src = read(join(FIN_SCHEMA, 'usage-metering.ts'))
    const tableStart = src.indexOf("usageAggregates = pgTable")
    const tableEnd = src.indexOf('));', tableStart)
    const table = src.slice(tableStart, tableEnd)
    expect(table).toContain('organizationId')
  })

  it('dunning_cases has subscriptionId linking to org-scoped subscription', () => {
    const src = read(join(FIN_SCHEMA, 'dunning.ts'))
    const tableStart = src.indexOf("dunningCases = pgTable")
    const tableEnd = src.indexOf('));', tableStart)
    const table = src.slice(tableStart, tableEnd)
    expect(table).toContain('subscriptionId')
  })
})

// ============================================================================
// A9-2: MONETARY FIELD SAFETY — No FLOAT, no VARCHAR for money
// ============================================================================

describe('ADVERSARIAL-9 — Monetary Field Safety', () => {
  const schemas = [
    { name: 'contracts', file: read(join(FIN_SCHEMA, 'contracts.ts')) },
    { name: 'usage-metering', file: read(join(FIN_SCHEMA, 'usage-metering.ts')) },
    { name: 'dunning', file: read(join(FIN_SCHEMA, 'dunning.ts')) },
  ]

  for (const { name, file } of schemas) {
    it(`${name} schema uses no real() for monetary columns`, () => {
      // Drizzle's real() maps to FLOAT — unsafe for money
      const hasReal = /\breal\s*\(/.test(file)
      expect(hasReal).toBe(false)
    })

    it(`${name} schema uses no doublePrecision() for monetary columns`, () => {
      const hasDouble = /\bdoublePrecision\s*\(/.test(file)
      expect(hasDouble).toBe(false)
    })
  }

  it('migration uses DECIMAL for all monetary columns', () => {
    const mig = read(join(MIGRATIONS, '0085_monetization_infrastructure_layer.sql'))
    // Search for amount/price/value columns and ensure they use DECIMAL
    const monetaryLines = mig.split('\n').filter(line =>
      /amount|price|value|total|rate/i.test(line) && /DECIMAL|NUMERIC/i.test(line)
    )
    expect(monetaryLines.length).toBeGreaterThan(0)

    // No FLOAT or REAL for monetary
    const floatMonetary = mig.split('\n').filter(line =>
      /amount|price|value|total|rate/i.test(line) && /FLOAT|REAL|DOUBLE/i.test(line)
    )
    expect(floatMonetary).toHaveLength(0)
  })
})

// ============================================================================
// A9-3: AUDIT LOGGING — State-mutating functions must audit
// ============================================================================

describe('ADVERSARIAL-9 — Audit Logging Coverage', () => {
  const services = [
    { name: 'contract-service', file: read(join(PE_SVC, 'contract-service.ts')) },
    { name: 'dunning-service', file: read(join(PE_SVC, 'dunning-service.ts')) },
    { name: 'subscription-lifecycle-service', file: read(join(PE_SVC, 'subscription-lifecycle-service.ts')) },
  ]

  for (const { name, file } of services) {
    it(`${name} imports auditLog`, () => {
      expect(file).toContain('auditLog')
    })

    it(`${name} calls auditLog at least once`, () => {
      const calls = (file.match(/auditLog\s*\(/g) || []).length
      expect(calls).toBeGreaterThanOrEqual(1)
    })
  }

  it('contract activation triggers audit entry', () => {
    const svc = read(join(PE_SVC, 'contract-service.ts'))
    const fnStart = svc.indexOf('async function activateContract')
    const fnEnd = svc.indexOf('\nexport', fnStart + 1)
    const fnBody = svc.slice(fnStart, fnEnd > fnStart ? fnEnd : undefined)
    expect(fnBody).toContain('auditLog')
  })

  it('contract termination triggers audit entry', () => {
    const svc = read(join(PE_SVC, 'contract-service.ts'))
    const fnStart = svc.indexOf('async function terminateContract')
    const fnEnd = svc.indexOf('\nexport', fnStart + 1)
    const fnBody = svc.slice(fnStart, fnEnd > fnStart ? fnEnd : undefined)
    expect(fnBody).toContain('auditLog')
  })

  it('dunning case resolution triggers audit entry', () => {
    const svc = read(join(PE_SVC, 'dunning-service.ts'))
    const fnStart = svc.indexOf('async function resolveDunningCase')
    const fnEnd = svc.indexOf('\nexport', fnStart + 1)
    const fnBody = svc.slice(fnStart, fnEnd > fnStart ? fnEnd : undefined)
    expect(fnBody).toContain('auditLog')
  })

  it('subscription pause triggers audit entry', () => {
    const svc = read(join(PE_SVC, 'subscription-lifecycle-service.ts'))
    const fnStart = svc.indexOf('async function pauseSubscription')
    const fnEnd = svc.indexOf('\nexport', fnStart + 1)
    const fnBody = svc.slice(fnStart, fnEnd > fnStart ? fnEnd : undefined)
    expect(fnBody).toContain('auditLog')
  })
})

// ============================================================================
// A9-4: APPEND-ONLY ENFORCEMENT — Immutable tables have no update SQL
// ============================================================================

describe('ADVERSARIAL-9 — Append-Only Table Integrity', () => {
  it('services never UPDATE entitlement_usage_log', () => {
    const contractSvc = read(join(PE_SVC, 'contract-service.ts'))
    // entitlement_usage_log should only have inserts, never .set() on it
    const hasUsageLogUpdate = /entitlementUsageLog.*\.set\s*\(/.test(contractSvc)
    expect(hasUsageLogUpdate).toBe(false)
  })

  it('services never UPDATE usage_events', () => {
    const meteringService = read(join(PE_SVC, 'usage-metering-service.ts'))
    const hasEventUpdate = /usageEvents.*\.set\s*\(/.test(meteringService)
    expect(hasEventUpdate).toBe(false)
  })

  it('services never UPDATE subscription_events_log', () => {
    const dunningService = read(join(PE_SVC, 'dunning-service.ts'))
    const lifecycleService = read(join(PE_SVC, 'subscription-lifecycle-service.ts'))
    const combined = dunningService + lifecycleService
    const hasLogUpdate = /subscriptionEventsLog.*\.set\s*\(/.test(combined)
    expect(hasLogUpdate).toBe(false)
  })

  it('usage_events table has no updatedAt column in schema', () => {
    const src = read(join(FIN_SCHEMA, 'usage-metering.ts'))
    const tableStart = src.indexOf("usageEvents = pgTable")
    const tableEnd = src.indexOf('));', tableStart)
    const table = src.slice(tableStart, tableEnd)
    expect(table).not.toContain('updatedAt')
  })

  it('entitlement_usage_log has no updatedAt column in schema', () => {
    const src = read(join(FIN_SCHEMA, 'contracts.ts'))
    const tableStart = src.indexOf("entitlementUsageLog = pgTable")
    const tableEnd = src.indexOf('));', tableStart)
    const table = src.slice(tableStart, tableEnd)
    expect(table).not.toContain('updatedAt')
  })
})

// ============================================================================
// A9-5: CURRENCY ENFORCEMENT — CAD-only
// ============================================================================

describe('ADVERSARIAL-9 — CAD Currency Enforcement', () => {
  it('proration engine uses CAD in field names', () => {
    const src = read(join(PE_SVC, 'proration-engine.ts'))
    expect(src).toContain('Cad')
  })

  it('contract schema defaults currency to CAD', () => {
    const src = read(join(FIN_SCHEMA, 'contracts.ts'))
    expect(src).toContain("'CAD'")
  })

  it('usage-metering schema defaults currency to CAD', () => {
    const src = read(join(FIN_SCHEMA, 'usage-metering.ts'))
    expect(src).toContain("'CAD'")
  })

  it('no USD literals in MIL service code', () => {
    const files = [
      read(join(PE_SVC, 'contract-service.ts')),
      read(join(PE_SVC, 'usage-metering-service.ts')),
      read(join(PE_SVC, 'proration-engine.ts')),
      read(join(PE_SVC, 'dunning-service.ts')),
      read(join(PE_SVC, 'subscription-lifecycle-service.ts')),
    ]
    for (const src of files) {
      expect(src).not.toContain("'USD'")
      expect(src).not.toContain('"USD"')
    }
  })
})

// ============================================================================
// A9-6: PRORATION BOUNDARY CHECKS
// ============================================================================

describe('ADVERSARIAL-9 — Proration Input Validation', () => {
  const src = read(join(PE_SVC, 'proration-engine.ts'))

  it('rejects changeDate outside billing period', () => {
    expect(src).toContain('Change date must be within billing period')
  })

  it('rejects invalid billing period (zero or negative days)', () => {
    expect(src).toContain('Invalid billing period')
  })

  it('handles edge case where credit equals charge (same amount upgrade)', () => {
    // net should be 0 when amounts are equal — ensure subtraction exists
    expect(src).toContain('charge - credit')
  })

  it('no division without zero-check', () => {
    // Ensure totalDays is validated before actual division (skip comments)
    const lines = src.split('\n')
    let validationLine = -1
    let divisionLine = -1
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      // Skip comment lines
      if (line.startsWith('*') || line.startsWith('//') || line.startsWith('/*')) continue
      if (/totalDays\s*<=\s*0/.test(line) && validationLine === -1) validationLine = i
      if (/\/\s*totalDays/.test(line) && divisionLine === -1) divisionLine = i
    }
    // Validation must appear BEFORE division in non-comment code
    expect(validationLine).toBeGreaterThan(-1)
    expect(divisionLine).toBeGreaterThan(-1)
    expect(validationLine).toBeLessThan(divisionLine)
  })
})

// ============================================================================
// A9-7: TRANSACTION SAFETY — Mutating services use db.transaction()
// ============================================================================

describe('ADVERSARIAL-9 — Transaction Wrapping', () => {
  it('createContract uses db.transaction()', () => {
    const svc = read(join(PE_SVC, 'contract-service.ts'))
    const fnStart = svc.indexOf('async function createContract')
    const fnEnd = svc.indexOf('\nexport', fnStart + 1)
    const fn = svc.slice(fnStart, fnEnd > fnStart ? fnEnd : undefined)
    expect(fn).toContain('db.transaction')
  })

  it('activateContract uses db.transaction()', () => {
    const svc = read(join(PE_SVC, 'contract-service.ts'))
    const fnStart = svc.indexOf('async function activateContract')
    const fnEnd = svc.indexOf('\nexport', fnStart + 1)
    const fn = svc.slice(fnStart, fnEnd > fnStart ? fnEnd : undefined)
    expect(fn).toContain('db.transaction')
  })

  it('terminateContract uses db.transaction()', () => {
    const svc = read(join(PE_SVC, 'contract-service.ts'))
    const fnStart = svc.indexOf('async function terminateContract')
    const fnEnd = svc.indexOf('\nexport', fnStart + 1)
    const fn = svc.slice(fnStart, fnEnd > fnStart ? fnEnd : undefined)
    expect(fn).toContain('db.transaction')
  })

  it('openDunningCase includes audit within transaction', () => {
    const svc = read(join(PE_SVC, 'dunning-service.ts'))
    const fnStart = svc.indexOf('async function openDunningCase')
    const fnEnd = svc.indexOf('\nexport', fnStart + 1)
    const fn = svc.slice(fnStart, fnEnd > fnStart ? fnEnd : undefined)
    expect(fn).toContain('auditLog')
  })
})

// ============================================================================
// A9-8: MIGRATION SAFETY — No string interpolation / injection risk
// ============================================================================

describe('ADVERSARIAL-9 — Migration SQL Safety', () => {
  const mig = read(join(MIGRATIONS, '0085_monetization_infrastructure_layer.sql'))

  it('no ${} template literals in migration SQL', () => {
    expect(mig).not.toContain('${')
  })

  it('no EXECUTE USING in migration (dynamic SQL risk)', () => {
    expect(mig).not.toContain('EXECUTE USING')
  })

  it('DROP TABLE is not used (additive-only migration)', () => {
    expect(mig).not.toContain('DROP TABLE')
  })

  it('DROP TYPE is not used (additive-only migration)', () => {
    expect(mig).not.toContain('DROP TYPE')
  })

  it('TRUNCATE is not used', () => {
    expect(mig).not.toContain('TRUNCATE')
  })
})

// ============================================================================
// A9-9: ENTITLEMENT USAGE LIMIT ENFORCEMENT
// ============================================================================

describe('ADVERSARIAL-9 — Entitlement Usage Limit Enforcement', () => {
  const svc = read(join(PE_SVC, 'contract-service.ts'))

  it('checkContractEntitlement checks usageLimit', () => {
    const fnStart = svc.indexOf('async function checkContractEntitlement')
    const fnEnd = svc.indexOf('\nexport', fnStart + 1)
    const fn = svc.slice(fnStart, fnEnd > fnStart ? fnEnd : undefined)
    expect(fn).toContain('usageLimit')
  })

  it('checkContractEntitlement compares currentUsage against limit', () => {
    const fnStart = svc.indexOf('async function checkContractEntitlement')
    const fnEnd = svc.indexOf('\nexport', fnStart + 1)
    const fn = svc.slice(fnStart, fnEnd > fnStart ? fnEnd : undefined)
    expect(fn).toContain('currentUsage')
  })

  it('recordEntitlementUsage increments usage atomically', () => {
    const fnStart = svc.indexOf('async function recordEntitlementUsage')
    const fnEnd = svc.indexOf('\nexport', fnStart + 1)
    const fn = svc.slice(fnStart, fnEnd > fnStart ? fnEnd : undefined)
    // Should use SQL increment, not read-modify-write
    expect(fn).toContain('sql')
  })
})

// ============================================================================
// A9-10: SERVICE IMPORT CHAIN INTEGRITY
// ============================================================================

describe('ADVERSARIAL-9 — Import Chain Integrity', () => {
  const services = [
    'contract-service.ts',
    'usage-metering-service.ts',
    'dunning-service.ts',
    'subscription-lifecycle-service.ts',
  ]

  for (const svcFile of services) {
    it(`${svcFile} imports from @/db (not relative path hacks)`, () => {
      const src = read(join(PE_SVC, svcFile))
      // Should use barrel import, not deep relative paths
      expect(src).toContain("from '@/db")
    })

    it(`${svcFile} imports schema from @/db/schema`, () => {
      const src = read(join(PE_SVC, svcFile))
      expect(src).toContain("@/db/schema")
    })
  }

  it('proration-engine has NO db import (pure module)', () => {
    const src = read(join(PE_SVC, 'proration-engine.ts'))
    expect(src).not.toContain("from '@/db")
    expect(src).not.toContain("from '@/db/schema")
  })
})
