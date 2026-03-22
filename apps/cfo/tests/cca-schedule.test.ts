/**
 * Tests — CCA Depreciation Schedule Engine
 */
import { describe, it, expect } from 'vitest'
import {
  CCA_CLASSES,
  getCcaClass,
  getCommonClasses,
  calculateCcaPool,
  calculateSchedule8,
  ccaTaxShield,
} from '../lib/cca-schedule'

describe('CCA class lookup', () => {
  it('should find Class 8 (furniture/equipment)', () => {
    const c = getCcaClass(8)
    expect(c).toBeDefined()
    expect(c!.rate).toBe(0.20)
    expect(c!.decliningBalance).toBe(true)
  })

  it('should find Class 50 (computer equipment)', () => {
    const c = getCcaClass(50)
    expect(c).toBeDefined()
    expect(c!.rate).toBe(0.55)
  })

  it('should find Class 10.1 (luxury vehicles)', () => {
    const c = getCcaClass(10.1)
    expect(c).toBeDefined()
    expect(c!.rate).toBe(0.30)
  })

  it('should return undefined for invalid class', () => {
    expect(getCcaClass(999)).toBeUndefined()
  })

  it('getCommonClasses should return a curated subset', () => {
    const common = getCommonClasses()
    expect(common.length).toBeGreaterThan(5)
    expect(common.length).toBeLessThan(CCA_CLASSES.length)
  })
})

describe('CCA pool calculation', () => {
  it('should apply half-year rule on new additions (non-AIIP)', () => {
    const result = calculateCcaPool({
      classNumber: 8,
      uccOpeningBalance: 0,
      additions: [{
        id: 'desk-1',
        classNumber: 8,
        description: 'Office furniture',
        capitalCost: 10_000,
        dateAcquired: '2026-03-15',
        isAiip: false,
      }],
      dispositions: [],
    })

    // Class 8: 20% rate, half-year rule = 10K × 20% × 50% = $1,000
    expect(result.ccaOnAdditions).toBe(1_000)
    expect(result.totalCca).toBe(1_000)
    expect(result.uccClosing).toBe(9_000)
  })

  it('should apply AIIP (1.5× rate) on eligible additions', () => {
    const result = calculateCcaPool({
      classNumber: 8,
      uccOpeningBalance: 0,
      additions: [{
        id: 'desk-2',
        classNumber: 8,
        description: 'Office furniture (AIIP)',
        capitalCost: 10_000,
        dateAcquired: '2026-03-15',
        isAiip: true,
      }],
      dispositions: [],
    })

    // AIIP: 10K × 20% × 1.5 = $3,000
    expect(result.ccaOnAdditions).toBe(3_000)
    expect(result.totalCca).toBe(3_000)
    expect(result.uccClosing).toBe(7_000)
  })

  it('should compute CCA on existing pool + additions', () => {
    const result = calculateCcaPool({
      classNumber: 10,
      uccOpeningBalance: 20_000,
      additions: [{
        id: 'van-1',
        classNumber: 10,
        description: 'Delivery van',
        capitalCost: 40_000,
        dateAcquired: '2026-06-01',
        isAiip: true,
      }],
      dispositions: [],
    })

    // Pool CCA: 20K × 30% = 6K
    // Addition CCA (AIIP): 40K × 30% × 1.5 = 18K
    // Total: 24K
    expect(result.ccaOnPool).toBe(6_000)
    expect(result.ccaOnAdditions).toBe(18_000)
    expect(result.totalCca).toBe(24_000)
  })

  it('should handle disposition (lesser of proceeds and cost)', () => {
    const result = calculateCcaPool({
      classNumber: 10,
      uccOpeningBalance: 30_000,
      additions: [],
      dispositions: [{
        id: 'car-1',
        classNumber: 10,
        description: 'Company car',
        capitalCost: 25_000,
        dateAcquired: '2023-01-01',
        dateDisposed: '2026-09-01',
        proceedsOfDisposition: 15_000,
        isAiip: false,
      }],
    })

    // Disposition: lesser of 15K (proceeds) and 25K (cost) = 15K
    // UCC before CCA: 30K − 15K = 15K
    // CCA: 15K × 30% = 4.5K
    expect(result.dispositionsLesser).toBe(15_000)
    expect(result.uccBeforeCca).toBe(15_000)
    expect(result.recapture).toBe(0)
  })

  it('should compute recapture when UCC goes negative', () => {
    const result = calculateCcaPool({
      classNumber: 8,
      uccOpeningBalance: 5_000,
      additions: [],
      dispositions: [{
        id: 'equip-1',
        classNumber: 8,
        description: 'Equipment',
        capitalCost: 20_000,
        dateAcquired: '2022-01-01',
        dateDisposed: '2026-06-01',
        proceedsOfDisposition: 12_000,
        isAiip: false,
      }],
    })

    // UCC before CCA: 5K − 12K = −7K → recapture
    expect(result.recapture).toBe(7_000)
    expect(result.totalCca).toBe(0)
    expect(result.uccClosing).toBe(0)
  })

  it('should compute terminal loss when all assets disposed with remaining UCC', () => {
    const result = calculateCcaPool({
      classNumber: 8,
      uccOpeningBalance: 8_000,
      additions: [],
      dispositions: [{
        id: 'equip-2',
        classNumber: 8,
        description: 'Equipment',
        capitalCost: 10_000,
        dateAcquired: '2022-01-01',
        dateDisposed: '2026-06-01',
        proceedsOfDisposition: 3_000,
        isAiip: false,
      }],
    })

    // UCC before CCA: 8K − 3K = 5K, all assets gone → terminal loss
    expect(result.terminalLoss).toBe(5_000)
    expect(result.totalCca).toBe(0)
    expect(result.uccClosing).toBe(0)
  })

  it('should prorate for short fiscal year', () => {
    const result = calculateCcaPool({
      classNumber: 8,
      uccOpeningBalance: 100_000,
      additions: [],
      dispositions: [],
      fiscalYearDays: 182, // ~half year
    })

    // CCA: 100K × 20% × (182/365) ≈ $9,972.60
    const expected = 100_000 * 0.20 * (182 / 365)
    expect(result.totalCca).toBeCloseTo(expected, 2)
    expect(result.prorationFactor).toBeCloseTo(182 / 365, 4)
  })
})

describe('Schedule 8 (multi-class)', () => {
  it('should aggregate CCA across multiple classes', () => {
    const result = calculateSchedule8({
      pools: [
        {
          classNumber: 8,
          uccOpeningBalance: 50_000,
          additions: [],
          dispositions: [],
        },
        {
          classNumber: 10,
          uccOpeningBalance: 30_000,
          additions: [],
          dispositions: [],
        },
        {
          classNumber: 50,
          uccOpeningBalance: 20_000,
          additions: [],
          dispositions: [],
        },
      ],
    })

    // Class 8: 50K × 20% = 10K
    // Class 10: 30K × 30% = 9K
    // Class 50: 20K × 55% = 11K
    expect(result.pools).toHaveLength(3)
    expect(result.totalCca).toBe(30_000)
    expect(result.netCcaDeduction).toBe(30_000)
  })

  it('should respect maxClaimOverride', () => {
    const result = calculateSchedule8({
      pools: [
        {
          classNumber: 8,
          uccOpeningBalance: 100_000,
          additions: [],
          dispositions: [],
        },
      ],
      maxClaimOverride: 5_000,
    })

    expect(result.totalCca).toBe(5_000)
  })
})

describe('CCA tax shield', () => {
  it('should calculate PV of tax shield for AIIP asset', () => {
    const shield = ccaTaxShield({
      capitalCost: 100_000,
      ccaRate: 0.20,
      taxRate: 0.265,
      discountRate: 0.10,
      isAiip: true,
    })

    // Rough: (100K × 0.20 × 0.265) / (0.20 + 0.10) × (1 + 0.15) / 1.10
    expect(shield).toBeGreaterThan(15_000)
    expect(shield).toBeLessThan(20_000)
  })

  it('should calculate PV with half-year rule for non-AIIP', () => {
    const shield = ccaTaxShield({
      capitalCost: 100_000,
      ccaRate: 0.20,
      taxRate: 0.265,
      discountRate: 0.10,
      isAiip: false,
    })

    // Should be slightly less than AIIP due to timing
    const aiipShield = ccaTaxShield({
      capitalCost: 100_000,
      ccaRate: 0.20,
      taxRate: 0.265,
      discountRate: 0.10,
      isAiip: true,
    })

    expect(shield).toBeLessThan(aiipShield)
  })
})
