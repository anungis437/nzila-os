/**
 * Unit tests — @nzila/fx/gain-loss
 *
 * Covers: realized/unrealized FX gain/loss, ITA s.39(1.1) exemption,
 *         receivable vs payable direction, batch revaluation
 */
import { describe, it, expect } from 'vitest'
import {
  calculateRealizedGainLoss,
  calculateUnrealizedGainLoss,
  revaluePositions,
  ITA_S39_PERSONAL_EXEMPTION,
} from '../gain-loss'
import type { FxTransaction, FxSettlement, OpenPosition } from '../gain-loss'

describe('ITA_S39_PERSONAL_EXEMPTION', () => {
  it('is $200', () => {
    expect(ITA_S39_PERSONAL_EXEMPTION).toBe(200)
  })
})

describe('calculateRealizedGainLoss', () => {
  const baseTx: FxTransaction = {
    foreignAmount: 1000,
    foreignCurrency: 'USD',
    functionalCurrency: 'CAD',
    bookRate: 1.30,
    bookDate: '2025-01-15',
  }

  describe('receivable direction (default)', () => {
    it('calculates gain when settlement rate > book rate', () => {
      const settlement: FxSettlement = {
        settlementRate: 1.35,
        settlementDate: '2025-02-15',
      }

      const result = calculateRealizedGainLoss(baseTx, settlement)

      // 1000 × 1.35 - 1000 × 1.30 = 1350 - 1300 = $50 gain
      expect(result.type).toBe('realized')
      expect(result.amount).toBe(50)
      expect(result.rawAmount).toBe(50)
      expect(result.originalAmount).toBe(1000)
      expect(result.originalCurrency).toBe('USD')
      expect(result.functionalCurrency).toBe('CAD')
      expect(result.bookRate).toBe(1.30)
      expect(result.currentRate).toBe(1.35)
      expect(result.personalExemptionApplies).toBe(false)
    })

    it('calculates loss when settlement rate < book rate', () => {
      const settlement: FxSettlement = {
        settlementRate: 1.25,
        settlementDate: '2025-02-15',
      }

      const result = calculateRealizedGainLoss(baseTx, settlement)

      // 1000 × 1.25 - 1000 × 1.30 = 1250 - 1300 = -$50 loss
      expect(result.amount).toBe(-50)
    })

    it('zero gain/loss when rates are equal', () => {
      const settlement: FxSettlement = {
        settlementRate: 1.30,
        settlementDate: '2025-02-15',
      }

      const result = calculateRealizedGainLoss(baseTx, settlement)
      expect(result.amount).toBe(0)
    })
  })

  describe('payable direction', () => {
    it('paying more functional = loss (negated)', () => {
      const settlement: FxSettlement = {
        settlementRate: 1.35,
        settlementDate: '2025-02-15',
      }

      const result = calculateRealizedGainLoss(baseTx, settlement, {
        direction: 'payable',
      })

      // Raw: 1350 - 1300 = 50, but payable negates → -50 (loss)
      expect(result.amount).toBe(-50)
    })

    it('paying less functional = gain (negated)', () => {
      const settlement: FxSettlement = {
        settlementRate: 1.25,
        settlementDate: '2025-02-15',
      }

      const result = calculateRealizedGainLoss(baseTx, settlement, {
        direction: 'payable',
      })

      // Raw: 1250 - 1300 = -50, payable negates → 50 (gain)
      expect(result.amount).toBe(50)
    })
  })

  describe('partial settlement', () => {
    it('calculates gain/loss on partial amount only', () => {
      const settlement: FxSettlement = {
        settlementRate: 1.35,
        settlementDate: '2025-02-15',
        settledForeignAmount: 500, // Only half settled
      }

      const result = calculateRealizedGainLoss(baseTx, settlement)

      // 500 × 1.35 - 500 × 1.30 = 675 - 650 = $25 gain
      expect(result.amount).toBe(25)
      expect(result.originalAmount).toBe(500)
    })
  })

  describe('ITA s.39(1.1) personal exemption', () => {
    it('exempts gain ≤ $200', () => {
      const smallTx: FxTransaction = {
        foreignAmount: 100,
        foreignCurrency: 'USD',
        functionalCurrency: 'CAD',
        bookRate: 1.30,
        bookDate: '2025-01-15',
      }

      const settlement: FxSettlement = {
        settlementRate: 1.40,
        settlementDate: '2025-02-15',
      }

      const result = calculateRealizedGainLoss(smallTx, settlement, {
        applyPersonalExemption: true,
      })

      // 100 × 1.40 - 100 × 1.30 = 140 - 130 = $10 gain → fully exempt
      expect(result.rawAmount).toBe(10)
      expect(result.amount).toBe(0) // Fully exempt
      expect(result.personalExemptionApplies).toBe(true)
      expect(result.personalExemptionAmount).toBe(10)
    })

    it('partially exempts gain > $200', () => {
      const settlement: FxSettlement = {
        settlementRate: 1.60,
        settlementDate: '2025-02-15',
      }

      const result = calculateRealizedGainLoss(baseTx, settlement, {
        applyPersonalExemption: true,
      })

      // 1000 × 1.60 - 1000 × 1.30 = 1600 - 1300 = $300 gain
      // After $200 exemption → $100 taxable
      expect(result.rawAmount).toBe(300)
      expect(result.amount).toBe(100)
      expect(result.personalExemptionApplies).toBe(true)
      expect(result.personalExemptionAmount).toBe(200)
    })

    it('partially exempts loss > $200', () => {
      const settlement: FxSettlement = {
        settlementRate: 1.00,
        settlementDate: '2025-02-15',
      }

      const result = calculateRealizedGainLoss(baseTx, settlement, {
        applyPersonalExemption: true,
      })

      // 1000 × 1.00 - 1000 × 1.30 = 1000 - 1300 = -$300 loss
      // After $200 exemption → -$100 deductible
      expect(result.rawAmount).toBe(-300)
      expect(result.amount).toBe(-100)
      expect(result.personalExemptionApplies).toBe(true)
      expect(result.personalExemptionAmount).toBe(200)
    })

    it('does not apply exemption when flag is false', () => {
      const settlement: FxSettlement = {
        settlementRate: 1.40,
        settlementDate: '2025-02-15',
      }

      const result = calculateRealizedGainLoss(baseTx, settlement, {
        applyPersonalExemption: false,
      })

      // 1000 × 1.40 - 1000 × 1.30 = 100
      expect(result.amount).toBe(100)
      expect(result.personalExemptionApplies).toBe(false)
    })
  })

  it('generates unique IDs', () => {
    const settlement: FxSettlement = { settlementRate: 1.35, settlementDate: '2025-02-15' }
    const r1 = calculateRealizedGainLoss(baseTx, settlement)
    const r2 = calculateRealizedGainLoss(baseTx, settlement)
    expect(r1.id).not.toBe(r2.id)
  })
})

describe('calculateUnrealizedGainLoss', () => {
  const position: OpenPosition = {
    foreignAmount: 5000,
    foreignCurrency: 'USD',
    functionalCurrency: 'CAD',
    bookRate: 1.30,
    bookDate: '2025-01-15',
    referenceId: 'INV-001',
  }

  it('calculates unrealized gain', () => {
    const result = calculateUnrealizedGainLoss(position, 1.35, '2025-12-31')

    // 5000 × 1.35 - 5000 × 1.30 = 6750 - 6500 = $250 gain
    expect(result.type).toBe('unrealized')
    expect(result.amount).toBe(250)
    expect(result.referenceId).toBe('INV-001')
    expect(result.currentDate).toBe('2025-12-31')
  })

  it('calculates unrealized loss', () => {
    const result = calculateUnrealizedGainLoss(position, 1.25, '2025-12-31')

    // 5000 × 1.25 - 5000 × 1.30 = 6250 - 6500 = -$250 loss
    expect(result.amount).toBe(-250)
  })

  it('no personal exemption on unrealized', () => {
    const result = calculateUnrealizedGainLoss(position, 1.35, '2025-12-31')
    expect(result.personalExemptionApplies).toBe(false)
    expect(result.personalExemptionAmount).toBe(0)
  })
})

describe('revaluePositions', () => {
  const positions: OpenPosition[] = [
    {
      foreignAmount: 5000,
      foreignCurrency: 'USD',
      functionalCurrency: 'CAD',
      bookRate: 1.30,
      bookDate: '2025-01-15',
    },
    {
      foreignAmount: 3000,
      foreignCurrency: 'EUR',
      functionalCurrency: 'CAD',
      bookRate: 1.45,
      bookDate: '2025-03-01',
    },
    {
      foreignAmount: 2000,
      foreignCurrency: 'USD',
      functionalCurrency: 'CAD',
      bookRate: 1.32,
      bookDate: '2025-06-01',
    },
  ]

  it('revalues all positions and aggregates', () => {
    const rates = new Map<any, number>([
      ['USD', 1.35],
      ['EUR', 1.50],
    ])

    const result = revaluePositions(positions, rates, '2025-12-31')

    // USD #1: 5000 × (1.35 - 1.30) = $250 gain
    // EUR:    3000 × (1.50 - 1.45) = $150 gain
    // USD #2: 2000 × (1.35 - 1.32) = $60 gain
    expect(result.positions).toHaveLength(3)
    expect(result.totalGain).toBe(460)
    expect(result.totalLoss).toBe(0)
    expect(result.net).toBe(460)
    expect(result.functionalCurrency).toBe('CAD')
    expect(result.revaluationDate).toBe('2025-12-31')
  })

  it('handles mixed gains and losses', () => {
    const rates = new Map<any, number>([
      ['USD', 1.25], // USD depreciated → loss
      ['EUR', 1.55], // EUR appreciated → gain
    ])

    const result = revaluePositions(positions, rates, '2025-12-31')

    // USD #1: 5000 × (1.25 - 1.30) = -$250 loss
    // EUR:    3000 × (1.55 - 1.45) = $300 gain
    // USD #2: 2000 × (1.25 - 1.32) = -$140 loss
    expect(result.totalGain).toBe(300)
    expect(result.totalLoss).toBe(-390)
    expect(result.net).toBe(-90)
  })

  it('throws for empty positions', () => {
    expect(() => revaluePositions([], new Map(), '2025-12-31')).toThrow('No positions to revalue')
  })

  it('throws for mixed functional currencies', () => {
    const mixedPositions = [
      { ...positions[0]! },
      { ...positions[1]!, functionalCurrency: 'USD' as const },
    ]

    expect(() =>
      revaluePositions(
        mixedPositions,
        new Map([['USD', 1.35], ['EUR', 1.50]] as any),
        '2025-12-31',
      ),
    ).toThrow('Mixed functional currencies')
  })

  it('throws for missing rate', () => {
    const rates = new Map<any, number>([['USD', 1.35]]) // Missing EUR
    expect(() => revaluePositions(positions, rates, '2025-12-31')).toThrow('No current rate')
  })
})
