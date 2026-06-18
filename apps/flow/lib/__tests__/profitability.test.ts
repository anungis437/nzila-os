import { describe, it, expect } from 'vitest'
import {
  calculateLineMargin,
  calculateQuoteProfitability,
  generateTieredProposals,
  calculateMandateProfitability,
  type CostLine,
} from '../profitability'

function makeLine(overrides?: Partial<CostLine>): CostLine {
  return {
    description: 'Web design',
    quantity: 1,
    unitSellPrice: 1000,
    unitCostPrice: 700,
    ...overrides,
  }
}

describe('calculateLineMargin', () => {
  it('calculates revenue and cost', () => {
    const result = calculateLineMargin(makeLine({ quantity: 2, unitSellPrice: 500, unitCostPrice: 300 }))
    expect(result.revenue).toBe(1000)
    expect(result.cost).toBe(600)
  })

  it('calculates margin dollars and percent', () => {
    const result = calculateLineMargin(makeLine({ unitSellPrice: 100, unitCostPrice: 60 }))
    expect(result.marginDollars).toBe(40)
    expect(result.marginPercent).toBeCloseTo(40, 2)
  })

  it('status is healthy for good margin', () => {
    const result = calculateLineMargin(makeLine({ unitSellPrice: 100, unitCostPrice: 60 }))
    expect(result.status).toBe('healthy')
  })

  it('status is warning when margin is between 15% and 25%', () => {
    const result = calculateLineMargin(makeLine({ unitSellPrice: 100, unitCostPrice: 80 }))
    expect(result.marginPercent).toBeCloseTo(20, 0)
    expect(result.status).toBe('warning')
  })

  it('status is critical when margin is below 15%', () => {
    const result = calculateLineMargin(makeLine({ unitSellPrice: 100, unitCostPrice: 90 }))
    expect(result.marginPercent).toBeCloseTo(10, 0)
    expect(result.status).toBe('critical')
  })

  it('status is loss when margin is negative', () => {
    const result = calculateLineMargin(makeLine({ unitSellPrice: 100, unitCostPrice: 110 }))
    expect(result.marginDollars).toBe(-10)
    expect(result.status).toBe('loss')
  })

  it('returns 0% margin when revenue is 0', () => {
    const result = calculateLineMargin(makeLine({ quantity: 0, unitSellPrice: 100, unitCostPrice: 50 }))
    expect(result.marginPercent).toBe(0)
  })
})

describe('calculateQuoteProfitability', () => {
  it('aggregates totals from all lines', () => {
    const lines: CostLine[] = [
      makeLine({ quantity: 2, unitSellPrice: 100, unitCostPrice: 60 }),
      makeLine({ description: 'Hosting', quantity: 1, unitSellPrice: 50, unitCostPrice: 30 }),
    ]
    const result = calculateQuoteProfitability(lines)
    expect(result.totalRevenue).toBe(250)
    expect(result.totalCost).toBe(150)
    expect(result.totalMarginDollars).toBe(100)
    expect(result.overallStatus).toBe('healthy')
  })

  it('overall status is loss when margin is negative', () => {
    const lines = [makeLine({ unitSellPrice: 50, unitCostPrice: 100 })]
    const result = calculateQuoteProfitability(lines)
    expect(result.overallStatus).toBe('loss')
  })

  it('generates negative_margin alert for loss', () => {
    const lines = [makeLine({ unitSellPrice: 50, unitCostPrice: 100 })]
    const result = calculateQuoteProfitability(lines)
    expect(result.alerts.some(a => a.type === 'negative_margin')).toBe(true)
  })

  it('generates thin_margin alert for margin below floor', () => {
    const lines = [makeLine({ unitSellPrice: 100, unitCostPrice: 78 })] // ~22% margin
    const result = calculateQuoteProfitability(lines)
    expect(result.alerts.some(a => a.type === 'thin_margin' || a.type === 'margin_below_floor')).toBe(true)
  })

  it('returns no alerts for healthy margin', () => {
    const lines = [makeLine({ unitSellPrice: 100, unitCostPrice: 60 })] // 40% margin
    const result = calculateQuoteProfitability(lines)
    expect(result.alerts).toHaveLength(0)
  })

  it('returns 0% margin when there are no lines', () => {
    const result = calculateQuoteProfitability([])
    expect(result.totalRevenue).toBe(0)
    expect(result.totalMarginPercent).toBe(0)
  })

  it('marks overall status critical for very low positive margin', () => {
    const lines = [makeLine({ unitSellPrice: 100, unitCostPrice: 88 })] // 12%
    const result = calculateQuoteProfitability(lines)
    expect(result.overallStatus).toBe('critical')
    expect(result.alerts.some(a => a.type === 'margin_below_floor' && a.severity === 'critical')).toBe(true)
  })

  it('adds per-line critical alert for critically low line', () => {
    const lines = [makeLine({ description: 'Low line', unitSellPrice: 100, unitCostPrice: 90 })]
    const result = calculateQuoteProfitability(lines)
    expect(result.alerts.some(a => a.lineDescription === 'Low line' && a.type === 'margin_below_floor')).toBe(true)
  })
})

describe('generateTieredProposals', () => {
  it('builds three tiers and computes taxes/margins', () => {
    const products = [
      { id: 'p1', sku: 'S1', name: 'Starter Box', description: 'starter', basePrice: 80, costPrice: 50, category: 'gift' },
      { id: 'p2', sku: 'S2', name: 'Classic Box', description: 'classic', basePrice: 120, costPrice: 75, category: 'gift' },
      { id: 'p3', sku: 'S3', name: 'Elite Box', description: 'elite', basePrice: 220, costPrice: 130, category: 'gift' },
      { id: 'p4', sku: 'S4', name: 'Mega Box', description: 'mega', basePrice: 300, costPrice: 180, category: 'gift' },
    ]

    const proposals = generateTieredProposals({ budget: 10000, volume: 60, category: 'gift' }, products)
    expect(proposals).toHaveLength(3)
    expect(proposals[0].tier).toBe('BUDGET')
    expect(proposals[1].tier).toBe('STANDARD')
    expect(proposals[2].tier).toBe('PREMIUM')
    expect(proposals.every(p => p.total > p.subtotal)).toBe(true)
    expect(proposals.every(p => p.marginDollars >= 0)).toBe(true)
  })

  it('falls back to all products when category has no matches', () => {
    const products = [
      { id: 'p1', sku: 'S1', name: 'Starter Box', description: null, basePrice: 100, costPrice: 70, category: 'office' },
      { id: 'p2', sku: 'S2', name: 'Classic Box', description: null, basePrice: 150, costPrice: 90, category: 'office' },
    ]

    const proposals = generateTieredProposals({ budget: 1000, volume: 5, category: 'gift' }, products)
    expect(proposals).toHaveLength(3)
    expect(proposals.every(p => p.lines.length > 0)).toBe(true)
  })

  it('enables premium visual mockup when subtotal crosses threshold', () => {
    const products = [
      { id: 'p1', sku: 'S1', name: 'Premium Box', description: 'premium', basePrice: 2000, costPrice: 1200, category: 'gift' },
      { id: 'p2', sku: 'S2', name: 'Premium Plus', description: 'plus', basePrice: 1800, costPrice: 1100, category: 'gift' },
      { id: 'p3', sku: 'S3', name: 'Premium Ultra', description: 'ultra', basePrice: 2200, costPrice: 1300, category: 'gift' },
    ]

    const proposals = generateTieredProposals({ budget: 30000, volume: 9, category: 'gift' }, products)
    const premium = proposals.find(p => p.tier === 'PREMIUM')
    expect(premium?.includesVisualMockup).toBe(true)
  })
})

describe('calculateMandateProfitability', () => {
  it('classifies profitable, break_even, and loss statuses', () => {
    const profitable = calculateMandateProfitability('ORD-1', 'ord-1', 1000, [
      { source: 'purchase_order', reference: 'PO-1', amount: 600, date: '2026-06-01' },
    ])
    expect(profitable.status).toBe('profitable')

    const breakEven = calculateMandateProfitability('ORD-2', 'ord-2', 1000, [
      { source: 'purchase_order', reference: 'PO-2', amount: 960, date: '2026-06-01' },
    ])
    expect(breakEven.status).toBe('break_even')

    const loss = calculateMandateProfitability('ORD-3', 'ord-3', 1000, [
      { source: 'purchase_order', reference: 'PO-3', amount: 1200, date: '2026-06-01' },
    ])
    expect(loss.status).toBe('loss')
    expect(loss.grossMarginDollars).toBe(-200)
  })
})
