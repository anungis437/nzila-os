import { describe, it, expect } from 'vitest'
import {
  calculateLineMargin,
  calculateQuoteProfitability,
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
})
