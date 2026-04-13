import { describe, it, expect } from 'vitest'
import {
  matchPayoutsToDeposits,
  generateExceptions,
  computeCloseReadiness,
  DEFAULT_RECON_CONFIG,
  type StripePayout,
  type QboDeposit,
  type ReconciliationConfig,
  type ReconciliationException,
  type MatchResult,
} from '../reconciliation'

// ── Helpers ─────────────────────────────────────────────────────────────────

function payout(overrides: Partial<StripePayout> = {}): StripePayout {
  return {
    id: 'po_1',
    amountCents: 10000,
    currency: 'CAD',
    arrivalDate: '2025-03-15',
    status: 'paid',
    ...overrides,
  }
}

function deposit(overrides: Partial<QboDeposit> = {}): QboDeposit {
  return {
    id: 'dep_1',
    amountCents: 10000,
    currency: 'CAD',
    txnDate: '2025-03-15',
    ...overrides,
  }
}

// ── DEFAULT_RECON_CONFIG ────────────────────────────────────────────────────

describe('DEFAULT_RECON_CONFIG', () => {
  it('has sensible defaults', () => {
    expect(DEFAULT_RECON_CONFIG.toleranceCents).toBe(100)
    expect(DEFAULT_RECON_CONFIG.maxUnreconciledDays).toBe(7)
    expect(DEFAULT_RECON_CONFIG.minCloseReadinessScore).toBe(95)
  })
})

// ── matchPayoutsToDeposits ──────────────────────────────────────────────────

describe('matchPayoutsToDeposits', () => {
  it('matches exact amounts on the same date', () => {
    const result = matchPayoutsToDeposits([payout()], [deposit()])

    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].stripePayout.id).toBe('po_1')
    expect(result.matched[0].qboDeposit.id).toBe('dep_1')
    expect(result.matched[0].deltaCents).toBe(0)
    expect(result.matched[0].withinTolerance).toBe(true)
    expect(result.unmatchedStripe).toHaveLength(0)
    expect(result.unmatchedQbo).toHaveLength(0)
  })

  it('matches within tolerance window', () => {
    const result = matchPayoutsToDeposits(
      [payout({ amountCents: 10050 })],
      [deposit({ amountCents: 10000 })],
    )

    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].deltaCents).toBe(50)
    expect(result.matched[0].withinTolerance).toBe(true)
  })

  it('matches but flags outside tolerance', () => {
    const result = matchPayoutsToDeposits(
      [payout({ amountCents: 10200 })],
      [deposit({ amountCents: 10000 })],
    )

    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].deltaCents).toBe(200)
    expect(result.matched[0].withinTolerance).toBe(false)
  })

  it('leaves unmatched payouts when no deposit exists', () => {
    const result = matchPayoutsToDeposits(
      [payout({ id: 'po_orphan' })],
      [],
    )

    expect(result.matched).toHaveLength(0)
    expect(result.unmatchedStripe).toHaveLength(1)
    expect(result.unmatchedStripe[0].id).toBe('po_orphan')
    expect(result.unmatchedQbo).toHaveLength(0)
  })

  it('leaves unmatched deposits when no payout exists', () => {
    const result = matchPayoutsToDeposits(
      [],
      [deposit({ id: 'dep_orphan' })],
    )

    expect(result.matched).toHaveLength(0)
    expect(result.unmatchedStripe).toHaveLength(0)
    expect(result.unmatchedQbo).toHaveLength(1)
    expect(result.unmatchedQbo[0].id).toBe('dep_orphan')
  })

  it('does not match different currencies', () => {
    const result = matchPayoutsToDeposits(
      [payout({ currency: 'USD' })],
      [deposit({ currency: 'CAD' })],
    )

    expect(result.matched).toHaveLength(0)
    expect(result.unmatchedStripe).toHaveLength(1)
    expect(result.unmatchedQbo).toHaveLength(1)
  })

  it('does not match dates >3 days apart', () => {
    const result = matchPayoutsToDeposits(
      [payout({ arrivalDate: '2025-03-01' })],
      [deposit({ txnDate: '2025-03-10' })],
    )

    expect(result.matched).toHaveLength(0)
    expect(result.unmatchedStripe).toHaveLength(1)
    expect(result.unmatchedQbo).toHaveLength(1)
  })

  it('matches within 3 days date window', () => {
    const result = matchPayoutsToDeposits(
      [payout({ arrivalDate: '2025-03-15' })],
      [deposit({ txnDate: '2025-03-17' })],
    )

    expect(result.matched).toHaveLength(1)
  })

  it('handles multiple payouts and deposits (greedy match)', () => {
    const payouts = [
      payout({ id: 'po_1', amountCents: 5000, arrivalDate: '2025-03-10' }),
      payout({ id: 'po_2', amountCents: 8000, arrivalDate: '2025-03-12' }),
      payout({ id: 'po_3', amountCents: 3000, arrivalDate: '2025-03-20' }),
    ]
    const deposits = [
      deposit({ id: 'dep_1', amountCents: 5000, txnDate: '2025-03-10' }),
      deposit({ id: 'dep_2', amountCents: 8050, txnDate: '2025-03-13' }),
    ]

    const result = matchPayoutsToDeposits(payouts, deposits)

    expect(result.matched).toHaveLength(2)
    expect(result.unmatchedStripe).toHaveLength(1)
    expect(result.unmatchedStripe[0].id).toBe('po_3')
    expect(result.unmatchedQbo).toHaveLength(0)
  })

  it('prefers closest amount match among candidates', () => {
    const payouts = [payout({ id: 'po_1', amountCents: 10000, arrivalDate: '2025-03-15' })]
    const deposits = [
      deposit({ id: 'dep_far', amountCents: 10500, txnDate: '2025-03-15' }),
      deposit({ id: 'dep_close', amountCents: 10010, txnDate: '2025-03-15' }),
    ]

    const result = matchPayoutsToDeposits(payouts, deposits)

    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].qboDeposit.id).toBe('dep_close')
    expect(result.unmatchedQbo).toHaveLength(1)
  })

  it('uses custom config tolerance', () => {
    const config: ReconciliationConfig = { ...DEFAULT_RECON_CONFIG, toleranceCents: 10 }
    const result = matchPayoutsToDeposits(
      [payout({ amountCents: 10050 })],
      [deposit({ amountCents: 10000 })],
      config,
    )

    // Still matched (greedy by amount) but outside custom tolerance
    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].withinTolerance).toBe(false)
  })

  it('does not double-match a deposit', () => {
    const payouts = [
      payout({ id: 'po_1', amountCents: 10000, arrivalDate: '2025-03-15' }),
      payout({ id: 'po_2', amountCents: 10000, arrivalDate: '2025-03-15' }),
    ]
    const deposits = [deposit({ id: 'dep_1', amountCents: 10000, txnDate: '2025-03-15' })]

    const result = matchPayoutsToDeposits(payouts, deposits)

    expect(result.matched).toHaveLength(1)
    expect(result.unmatchedStripe).toHaveLength(1)
  })

  it('returns empty results for empty inputs', () => {
    const result = matchPayoutsToDeposits([], [])
    expect(result.matched).toHaveLength(0)
    expect(result.unmatchedStripe).toHaveLength(0)
    expect(result.unmatchedQbo).toHaveLength(0)
  })
})

// ── generateExceptions ──────────────────────────────────────────────────────

describe('generateExceptions', () => {
  const orgId = 'org_test'
  const period = '2025-03'

  it('creates payout-deposit-mismatch exceptions for out-of-tolerance matches', () => {
    const matchResult: MatchResult = {
      matched: [
        {
          stripePayout: payout({ id: 'po_1', amountCents: 10200 }),
          qboDeposit: deposit({ id: 'dep_1', amountCents: 10000 }),
          deltaCents: 200,
          withinTolerance: false,
        },
      ],
      unmatchedStripe: [],
      unmatchedQbo: [],
    }

    const exceptions = generateExceptions(orgId, period, matchResult)

    expect(exceptions).toHaveLength(1)
    expect(exceptions[0].type).toBe('payout-deposit-mismatch')
    expect(exceptions[0].severity).toBe('warning')
    expect(exceptions[0].status).toBe('open')
    expect(exceptions[0].orgId).toBe(orgId)
    expect(exceptions[0].periodLabel).toBe(period)
    expect(exceptions[0].deltaCents).toBe(200)
    expect(exceptions[0].stripeRef).toBe('po_1')
    expect(exceptions[0].qboRef).toBe('dep_1')
    expect(exceptions[0].stripeAmountCents).toBe(10200)
    expect(exceptions[0].qboAmountCents).toBe(10000)
  })

  it('marks delta >10x tolerance as critical', () => {
    const config: ReconciliationConfig = { ...DEFAULT_RECON_CONFIG, toleranceCents: 100 }
    const matchResult: MatchResult = {
      matched: [
        {
          stripePayout: payout({ amountCents: 12000 }),
          qboDeposit: deposit({ amountCents: 10000 }),
          deltaCents: 2000,
          withinTolerance: false,
        },
      ],
      unmatchedStripe: [],
      unmatchedQbo: [],
    }

    const exceptions = generateExceptions(orgId, period, matchResult, config)

    expect(exceptions[0].severity).toBe('critical')
  })

  it('creates missing-qbo-deposit exceptions for unmatched Stripe payouts', () => {
    const matchResult: MatchResult = {
      matched: [],
      unmatchedStripe: [payout({ id: 'po_orphan', amountCents: 5000 })],
      unmatchedQbo: [],
    }

    const exceptions = generateExceptions(orgId, period, matchResult)

    expect(exceptions).toHaveLength(1)
    expect(exceptions[0].type).toBe('missing-qbo-deposit')
    expect(exceptions[0].severity).toBe('critical')
    expect(exceptions[0].stripeAmountCents).toBe(5000)
    expect(exceptions[0].qboAmountCents).toBe(0)
    expect(exceptions[0].stripeRef).toBe('po_orphan')
  })

  it('creates missing-stripe-payout exceptions for unmatched QBO deposits', () => {
    const matchResult: MatchResult = {
      matched: [],
      unmatchedStripe: [],
      unmatchedQbo: [deposit({ id: 'dep_orphan', amountCents: 7000 })],
    }

    const exceptions = generateExceptions(orgId, period, matchResult)

    expect(exceptions).toHaveLength(1)
    expect(exceptions[0].type).toBe('missing-stripe-payout')
    expect(exceptions[0].severity).toBe('warning')
    expect(exceptions[0].qboAmountCents).toBe(7000)
    expect(exceptions[0].stripeAmountCents).toBe(0)
    expect(exceptions[0].qboRef).toBe('dep_orphan')
  })

  it('assigns sequential IDs per period', () => {
    const matchResult: MatchResult = {
      matched: [],
      unmatchedStripe: [
        payout({ id: 'po_1' }),
        payout({ id: 'po_2' }),
      ],
      unmatchedQbo: [deposit({ id: 'dep_1' })],
    }

    const exceptions = generateExceptions(orgId, period, matchResult)

    expect(exceptions).toHaveLength(3)
    expect(exceptions[0].id).toBe('RECON-2025-03-001')
    expect(exceptions[1].id).toBe('RECON-2025-03-002')
    expect(exceptions[2].id).toBe('RECON-2025-03-003')
  })

  it('returns empty for all within-tolerance matches', () => {
    const matchResult: MatchResult = {
      matched: [
        {
          stripePayout: payout(),
          qboDeposit: deposit(),
          deltaCents: 0,
          withinTolerance: true,
        },
      ],
      unmatchedStripe: [],
      unmatchedQbo: [],
    }

    const exceptions = generateExceptions(orgId, period, matchResult)
    expect(exceptions).toHaveLength(0)
  })

  it('returns empty for empty match result', () => {
    const matchResult: MatchResult = { matched: [], unmatchedStripe: [], unmatchedQbo: [] }
    const exceptions = generateExceptions(orgId, period, matchResult)
    expect(exceptions).toHaveLength(0)
  })
})

// ── computeCloseReadiness ───────────────────────────────────────────────────

describe('computeCloseReadiness', () => {
  const orgId = 'org_test'
  const period = '2025-03'
  const perfectMatch: MatchResult = {
    matched: [
      {
        stripePayout: payout(),
        qboDeposit: deposit(),
        deltaCents: 0,
        withinTolerance: true,
      },
    ],
    unmatchedStripe: [],
    unmatchedQbo: [],
  }

  it('returns 100% for perfect reconciliation with reports', () => {
    const report = computeCloseReadiness(orgId, period, perfectMatch, [], DEFAULT_RECON_CONFIG, {
      stripeReportsGenerated: true,
    })

    expect(report.percentage).toBe(100)
    expect(report.ready).toBe(true)
    expect(report.score).toBe(100)
    expect(report.maxScore).toBe(100)
    expect(report.orgId).toBe(orgId)
    expect(report.periodLabel).toBe(period)
    expect(report.factors).toHaveLength(5)
    expect(report.factors.every((f) => f.status === 'pass')).toBe(true)
  })

  it('deducts 15 pts when reports are not generated', () => {
    const report = computeCloseReadiness(orgId, period, perfectMatch, [], DEFAULT_RECON_CONFIG, {
      stripeReportsGenerated: false,
    })

    expect(report.percentage).toBe(85)
    const reportFactor = report.factors.find((f) => f.name === 'stripe-reports')!
    expect(reportFactor.score).toBe(0)
    expect(reportFactor.status).toBe('fail')
  })

  it('deducts for unmatched payouts', () => {
    const partial: MatchResult = {
      matched: [
        { stripePayout: payout(), qboDeposit: deposit(), deltaCents: 0, withinTolerance: true },
      ],
      unmatchedStripe: [payout({ id: 'po_unmatched' })],
      unmatchedQbo: [],
    }

    const report = computeCloseReadiness(orgId, period, partial, [], DEFAULT_RECON_CONFIG, {
      stripeReportsGenerated: true,
    })

    // 1/2 matched = 50% of 30 pts = 15
    const matchFactor = report.factors.find((f) => f.name === 'payout-matching')!
    expect(matchFactor.score).toBe(15)
    expect(matchFactor.status).toBe('fail')
    expect(report.percentage).toBeLessThan(100)
  })

  it('deducts for out-of-tolerance matches', () => {
    const match: MatchResult = {
      matched: [
        { stripePayout: payout(), qboDeposit: deposit(), deltaCents: 200, withinTolerance: false },
      ],
      unmatchedStripe: [],
      unmatchedQbo: [],
    }

    const report = computeCloseReadiness(orgId, period, match, [], DEFAULT_RECON_CONFIG, {
      stripeReportsGenerated: true,
    })

    const tolFactor = report.factors.find((f) => f.name === 'tolerance-compliance')!
    expect(tolFactor.score).toBe(0)
    expect(tolFactor.status).toBe('fail')
  })

  it('tolerance-compliance shows warn when score is between 14 and 17', () => {
    // 3 out of 4 within tolerance = 75% of 20 = 15 pts → 'warn'
    const match: MatchResult = {
      matched: [
        { stripePayout: payout({ id: 'po_1' }), qboDeposit: deposit({ id: 'dep_1' }), deltaCents: 0, withinTolerance: true },
        { stripePayout: payout({ id: 'po_2' }), qboDeposit: deposit({ id: 'dep_2' }), deltaCents: 0, withinTolerance: true },
        { stripePayout: payout({ id: 'po_3' }), qboDeposit: deposit({ id: 'dep_3' }), deltaCents: 0, withinTolerance: true },
        { stripePayout: payout({ id: 'po_4' }), qboDeposit: deposit({ id: 'dep_4' }), deltaCents: 500, withinTolerance: false },
      ],
      unmatchedStripe: [],
      unmatchedQbo: [],
    }

    const report = computeCloseReadiness(orgId, period, match, [], DEFAULT_RECON_CONFIG, {
      stripeReportsGenerated: true,
    })

    const tolFactor = report.factors.find((f) => f.name === 'tolerance-compliance')!
    expect(tolFactor.score).toBe(15) // 3/4 * 20 = 15
    expect(tolFactor.status).toBe('warn')
  })

  it('no-critical-exceptions shows warn when critScore is between 10 and 19', () => {
    // 2 critical open: 20 - 2*5 = 10 → 'warn'
    const exceptions: ReconciliationException[] = [
      {
        id: 'RECON-001',
        orgId,
        type: 'missing-qbo-deposit',
        severity: 'critical',
        status: 'open',
        stripeAmountCents: 5000,
        qboAmountCents: 0,
        deltaCents: 5000,
        description: 'test1',
        periodLabel: period,
        detectedAt: new Date().toISOString(),
      },
      {
        id: 'RECON-002',
        orgId,
        type: 'missing-qbo-deposit',
        severity: 'critical',
        status: 'open',
        stripeAmountCents: 3000,
        qboAmountCents: 0,
        deltaCents: 3000,
        description: 'test2',
        periodLabel: period,
        detectedAt: new Date().toISOString(),
      },
    ]

    const report = computeCloseReadiness(orgId, period, perfectMatch, exceptions, DEFAULT_RECON_CONFIG, {
      stripeReportsGenerated: true,
    })

    const critFactor = report.factors.find((f) => f.name === 'no-critical-exceptions')!
    expect(critFactor.score).toBe(10) // 20 - 2*5 = 10
    expect(critFactor.status).toBe('warn')
  })

  it('payout-matching shows warn when matchScore is between 20 and 26', () => {
    // 3 out of 4 payouts matched = 75% of 30 = 22.5 → round to 23 → 'warn'
    const match: MatchResult = {
      matched: [
        { stripePayout: payout({ id: 'po_m1' }), qboDeposit: deposit({ id: 'dep_m1' }), deltaCents: 0, withinTolerance: true },
        { stripePayout: payout({ id: 'po_m2' }), qboDeposit: deposit({ id: 'dep_m2' }), deltaCents: 0, withinTolerance: true },
        { stripePayout: payout({ id: 'po_m3' }), qboDeposit: deposit({ id: 'dep_m3' }), deltaCents: 0, withinTolerance: true },
      ],
      unmatchedStripe: [payout({ id: 'po_unmatched' })],
      unmatchedQbo: [],
    }

    const report = computeCloseReadiness(orgId, period, match, [], DEFAULT_RECON_CONFIG, {
      stripeReportsGenerated: true,
    })

    const matchFactor = report.factors.find((f) => f.name === 'payout-matching')!
    expect(matchFactor.score).toBe(23) // 3/4 * 30 = 22.5 → round to 23
    expect(matchFactor.status).toBe('warn')
  })

  it('deducts for open critical exceptions', () => {
    const exceptions: ReconciliationException[] = [
      {
        id: 'RECON-001',
        orgId,
        type: 'missing-qbo-deposit',
        severity: 'critical',
        status: 'open',
        stripeAmountCents: 5000,
        qboAmountCents: 0,
        deltaCents: 5000,
        description: 'test',
        periodLabel: period,
        detectedAt: new Date().toISOString(),
      },
    ]

    const report = computeCloseReadiness(orgId, period, perfectMatch, exceptions, DEFAULT_RECON_CONFIG, {
      stripeReportsGenerated: true,
    })

    const critFactor = report.factors.find((f) => f.name === 'no-critical-exceptions')!
    expect(critFactor.score).toBe(15) // 20 - 5 = 15
    expect(critFactor.status).toBe('warn')
  })

  it('deducts for 4+ critical exceptions (bottoms at 0)', () => {
    const exceptions: ReconciliationException[] = Array.from({ length: 5 }, (_, i) => ({
      id: `RECON-${i}`,
      orgId,
      type: 'missing-qbo-deposit' as const,
      severity: 'critical' as const,
      status: 'open' as const,
      stripeAmountCents: 5000,
      qboAmountCents: 0,
      deltaCents: 5000,
      description: 'test',
      periodLabel: period,
      detectedAt: new Date().toISOString(),
    }))

    const report = computeCloseReadiness(orgId, period, perfectMatch, exceptions, DEFAULT_RECON_CONFIG, {
      stripeReportsGenerated: true,
    })

    const critFactor = report.factors.find((f) => f.name === 'no-critical-exceptions')!
    expect(critFactor.score).toBe(0)
    expect(critFactor.status).toBe('fail')
  })

  it('deducts for stale unreconciled items', () => {
    const staleException: ReconciliationException = {
      id: 'RECON-001',
      orgId,
      type: 'missing-qbo-deposit',
      severity: 'warning',
      status: 'open',
      stripeAmountCents: 5000,
      qboAmountCents: 0,
      deltaCents: 5000,
      description: 'stale',
      periodLabel: period,
      // 30 days ago
      detectedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    }

    const report = computeCloseReadiness(orgId, period, perfectMatch, [staleException], DEFAULT_RECON_CONFIG, {
      stripeReportsGenerated: true,
    })

    const staleFactor = report.factors.find((f) => f.name === 'no-stale-items')!
    expect(staleFactor.score).toBe(0)
    expect(staleFactor.status).toBe('fail')
  })

  it('resolved exceptions do not count as stale', () => {
    const resolvedException: ReconciliationException = {
      id: 'RECON-001',
      orgId,
      type: 'missing-qbo-deposit',
      severity: 'warning',
      status: 'resolved',
      stripeAmountCents: 5000,
      qboAmountCents: 0,
      deltaCents: 5000,
      description: 'resolved',
      periodLabel: period,
      detectedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    }

    const report = computeCloseReadiness(orgId, period, perfectMatch, [resolvedException], DEFAULT_RECON_CONFIG, {
      stripeReportsGenerated: true,
    })

    const staleFactor = report.factors.find((f) => f.name === 'no-stale-items')!
    expect(staleFactor.score).toBe(15)
    expect(staleFactor.status).toBe('pass')
  })

  it('not ready when below minimum close readiness score', () => {
    const match: MatchResult = {
      matched: [],
      unmatchedStripe: [payout()],
      unmatchedQbo: [deposit()],
    }

    const report = computeCloseReadiness(orgId, period, match, [], DEFAULT_RECON_CONFIG, {
      stripeReportsGenerated: false,
    })

    expect(report.ready).toBe(false)
    expect(report.percentage).toBeLessThan(95)
  })

  it('handles zero payouts gracefully (100% match rate)', () => {
    const empty: MatchResult = { matched: [], unmatchedStripe: [], unmatchedQbo: [] }

    const report = computeCloseReadiness(orgId, period, empty, [], DEFAULT_RECON_CONFIG, {
      stripeReportsGenerated: true,
    })

    // 0/0 payouts = 100% match → 30 pts, 0/0 tolerance = 100% → 20 pts
    const matchFactor = report.factors.find((f) => f.name === 'payout-matching')!
    expect(matchFactor.score).toBe(30)
    const tolFactor = report.factors.find((f) => f.name === 'tolerance-compliance')!
    expect(tolFactor.score).toBe(20)
  })

  it('includes generatedAt timestamp', () => {
    const report = computeCloseReadiness(orgId, period, perfectMatch, [])
    expect(report.generatedAt).toBeDefined()
    expect(new Date(report.generatedAt).getTime()).not.toBeNaN()
  })
})
