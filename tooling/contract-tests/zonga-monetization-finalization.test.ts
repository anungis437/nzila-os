/**
 * Contract test: Zonga Monetization Finalization (PHASE 7)
 *
 * ZONGA-001: All monetization API routes exist
 * ZONGA-002: Payout engine has state machine
 * ZONGA-003: Revenue tracking has ledger backing
 * ZONGA-004: Subscription tiers defined with pricing
 * ZONGA-005: Event/ticketing system has capacity control
 * ZONGA-006: Analytics API exists with org-scoped access
 * ZONGA-007: Stripe webhook handler covers all critical events
 * ZONGA-008: Evidence pipeline covers all financial actions
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const ZONGA = join(ROOT, 'apps', 'zonga')

function readSafe(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

// ── ZONGA-001: All monetization routes exist ────────────────────────────────

describe('ZONGA-001: Monetization API routes exist', () => {
  const REQUIRED_ROUTES = [
    'app/api/payouts/route.ts',
    'app/api/revenue/route.ts',
    'app/api/events/route.ts',
    'app/api/subscriptions/route.ts',
    'app/api/catalog/route.ts',
    'app/api/creators/route.ts',
    'app/api/analytics/route.ts',
    'app/api/webhooks/stripe/route.ts',
    'app/api/health/route.ts',
  ]

  for (const route of REQUIRED_ROUTES) {
    it(`${route} exists`, () => {
      expect(existsSync(join(ZONGA, route)), `Missing: ${route}`).toBe(true)
    })
  }
})

// ── ZONGA-002: Payout engine has state machine ──────────────────────────────

describe('ZONGA-002: Payout engine implements state machine', () => {
  it('payout-machine.ts exists and defines states', () => {
    const machinePath = join(ZONGA, 'lib', 'payout-machine.ts')
    expect(existsSync(machinePath), 'payout-machine.ts must exist').toBe(true)

    const src = readSafe(machinePath)
    const requiredStates = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']
    for (const state of requiredStates) {
      expect(src, `Missing payout state: ${state}`).toContain(state)
    }
  })

  it('payout settlement workflow exists', () => {
    const workflowPath = join(ZONGA, 'lib', 'workflows', 'payout-settlement.ts')
    expect(existsSync(workflowPath), 'payout-settlement.ts must exist').toBe(true)
  })

  it('execute-payout handler exists', () => {
    const handlerPath = join(ZONGA, 'lib', 'control', 'handlers', 'execute-payout.handler.ts')
    expect(existsSync(handlerPath), 'execute-payout.handler.ts must exist').toBe(true)
  })
})

// ── ZONGA-003: Revenue tracking has ledger backing ──────────────────────────

describe('ZONGA-003: Revenue tracking enforces ledger backing', () => {
  it('revenue route records audit log entries', () => {
    const revenuePath = join(ZONGA, 'app', 'api', 'revenue', 'route.ts')
    const src = readSafe(revenuePath)
    expect(src, 'revenue route must reference audit/span/org patterns').toMatch(/audit_log|auditLog|auditedAction|evidence|createSpan|withRequestContext|getAuditedDb|requireOrgAccess|withSpan|withOrgScope/)
  })

  it('control-plane-bridge enforces NO_REVENUE_WITHOUT_LEDGER', () => {
    const bridgePath = join(ZONGA, 'lib', 'control', 'control-plane-bridge.ts')
    expect(existsSync(bridgePath), 'control-plane-bridge.ts must exist').toBe(true)

    const src = readSafe(bridgePath)
    expect(src, 'must enforce ledger integrity').toMatch(/ledger|NO_REVENUE_WITHOUT_LEDGER|enforceEconomicIntegrity/)
  })
})

// ── ZONGA-004: Subscription tiers defined ───────────────────────────────────

describe('ZONGA-004: Subscription tiers with pricing', () => {
  it('plans.ts defines listener and creator tiers', () => {
    const plansPath = join(ZONGA, 'lib', 'plans.ts')
    expect(existsSync(plansPath), 'plans.ts must exist').toBe(true)

    const src = readSafe(plansPath)
    // Listener tiers
    expect(src, 'Must define Free tier').toContain('free')
    expect(src, 'Must define Premium tier').toMatch(/premium/i)

    // Creator tiers
    expect(src, 'Must define Starter tier').toMatch(/starter/i)
    expect(src, 'Must define Pro or Business tier').toMatch(/pro|business/i)
  })

  it('plans.ts includes commission rates', () => {
    const plansPath = join(ZONGA, 'lib', 'plans.ts')
    const src = readSafe(plansPath)
    expect(src, 'Must define commission rates').toMatch(/commission|platformFee|streamRate|ticketRate/)
  })
})

// ── ZONGA-005: Event ticketing has capacity control ─────────────────────────

describe('ZONGA-005: Event ticketing with capacity control', () => {
  it('ticket-sale workflow exists and handles capacity', () => {
    const ticketPath = join(ZONGA, 'lib', 'workflows', 'ticket-sale.ts')
    expect(existsSync(ticketPath), 'ticket-sale.ts must exist').toBe(true)

    const src = readSafe(ticketPath)
    expect(src, 'Must handle capacity/overselling').toMatch(/capacity|oversell|available|sold_out|quantity|remaining|payment_failed|cancelled/)
  })

  it('event-actions.ts defines ticket operations', () => {
    const actionsPath = join(ZONGA, 'lib', 'actions', 'event-actions.ts')
    expect(existsSync(actionsPath), 'event-actions.ts must exist').toBe(true)

    const src = readSafe(actionsPath)
    expect(src, 'Must handle ticket purchase').toMatch(/ticket|purchase|buy/)
  })
})

// ── ZONGA-006: Analytics API with org-scoped access ─────────────────────────

describe('ZONGA-006: Analytics API', () => {
  it('analytics route exists and is org-scoped', () => {
    const analyticsPath = join(ZONGA, 'app', 'api', 'analytics', 'route.ts')
    expect(existsSync(analyticsPath), 'analytics route must exist').toBe(true)

    const src = readSafe(analyticsPath)
    expect(src, 'Must enforce org access').toMatch(/orgId|requireOrgAccess|withOrgScope/)
    expect(src, 'Must return revenue metrics').toMatch(/revenue|metrics|analytics/)
  })
})

// ── ZONGA-007: Stripe webhooks cover critical events ────────────────────────

describe('ZONGA-007: Stripe webhook covers critical events', () => {
  it('webhook handler processes checkout, subscription, and invoice events', () => {
    const webhookPath = join(ZONGA, 'app', 'api', 'webhooks', 'stripe', 'route.ts')
    expect(existsSync(webhookPath), 'Stripe webhook route must exist').toBe(true)

    const src = readSafe(webhookPath)
    const requiredEvents = [
      'checkout.session.completed',
      'customer.subscription',
      'invoice.paid',
    ]

    for (const event of requiredEvents) {
      expect(src, `Must handle ${event}`).toContain(event)
    }
  })
})

// ── ZONGA-008: Evidence pipeline covers financial actions ───────────────────

describe('ZONGA-008: Evidence pipeline for financial actions', () => {
  it('evidence.ts exists with canonical exports', () => {
    const evidencePath = join(ZONGA, 'lib', 'evidence.ts')
    expect(existsSync(evidencePath), 'evidence.ts must exist').toBe(true)

    const src = readSafe(evidencePath)
    expect(src).toContain('buildEvidencePackFromAction')
    expect(src).toContain('processEvidencePack')
  })

  it('subscription-actions uses evidence pipeline', () => {
    const actionsPath = join(ZONGA, 'lib', 'actions', 'subscription-actions.ts')
    const src = readSafe(actionsPath)
    expect(src, 'Subscription actions must reference evidence').toMatch(/evidence|buildEvidencePack|processEvidencePack/)
  })

  it('payout-actions uses evidence pipeline', () => {
    const actionsPath = join(ZONGA, 'lib', 'actions', 'payout-actions.ts')
    const src = readSafe(actionsPath)
    expect(src, 'Payout actions must reference evidence').toMatch(/evidence|buildEvidencePack|processEvidencePack|audit/)
  })
})
