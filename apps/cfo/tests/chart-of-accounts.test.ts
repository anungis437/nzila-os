/**
 * Tests — Chart of Accounts + GIFI module
 */
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CCPC_CHART,
  getGifiMapping,
  getGifiBySchedule,
  findAccount,
  getAccountsByType,
  validateChartStructure,
  mapTrialBalanceToGifi,
  AccountType,
} from '../lib/chart-of-accounts'

describe('GIFI codes', () => {
  it('should have codes for all major schedule 100 categories', () => {
    const s100 = getGifiBySchedule(100)
    expect(s100.length).toBeGreaterThan(20)
    // Must include cash, receivables, inventory, fixed assets, liabilities
    const codes = s100.map((g) => g.code)
    expect(codes).toContain(1001) // Cash
    expect(codes).toContain(1060) // Receivables
  })

  it('should have codes for schedule 125 (income statement)', () => {
    const s125 = getGifiBySchedule(125)
    expect(s125.length).toBeGreaterThan(15)
  })

  it('should look up GIFI by code number', () => {
    const cash = getGifiMapping(1001)
    expect(cash).toBeDefined()
    expect(cash!.description).toMatch(/cash/i)
    expect(cash!.schedule).toBe(100)
  })

  it('should return undefined for unknown GIFI', () => {
    expect(getGifiMapping(5555)).toBeUndefined()
  })
})

describe('Default CCPC chart', () => {
  it('should have at least 40 accounts', () => {
    expect(DEFAULT_CCPC_CHART.length).toBeGreaterThan(40)
  })

  it('should have accounts of every type', () => {
    const types = new Set(DEFAULT_CCPC_CHART.map((a) => a.type))
    expect(types.has(AccountType.ASSET)).toBe(true)
    expect(types.has(AccountType.LIABILITY)).toBe(true)
    expect(types.has(AccountType.EQUITY)).toBe(true)
    expect(types.has(AccountType.REVENUE)).toBe(true)
    expect(types.has(AccountType.EXPENSE)).toBe(true)
  })

  it('every account should have a GIFI mapping', () => {
    for (const acct of DEFAULT_CCPC_CHART) {
      expect(acct.gifi).toBeDefined()
      expect(acct.gifi.code).toBeGreaterThanOrEqual(1000)
      expect(acct.gifi.code).toBeLessThanOrEqual(9999)
    }
  })
})

describe('Chart helpers', () => {
  it('findAccount should locate by account number', () => {
    const acct = findAccount(DEFAULT_CCPC_CHART, '1000')
    expect(acct).toBeDefined()
    expect(acct!.name).toMatch(/cash/i)
  })

  it('getAccountsByType returns only matching type', () => {
    const assets = getAccountsByType(DEFAULT_CCPC_CHART, AccountType.ASSET)
    expect(assets.length).toBeGreaterThan(5)
    for (const a of assets) {
      expect(a.type).toBe(AccountType.ASSET)
    }
  })

  it('validateChartStructure should pass on default chart', () => {
    const result = validateChartStructure(DEFAULT_CCPC_CHART)
    expect(result.valid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('validateChartStructure should catch duplicate account numbers', () => {
    const duped = [
      ...DEFAULT_CCPC_CHART,
      { ...DEFAULT_CCPC_CHART[0] }, // duplicate
    ]
    const result = validateChartStructure(duped)
    expect(result.valid).toBe(false)
    expect(result.issues.length).toBeGreaterThan(0)
  })
})

describe('mapTrialBalanceToGifi', () => {
  it('should map trial balance entries to GIFI codes', () => {
    const trialBalance: Record<string, number> = {
      '1000': 50_000,
      '2000': -30_000,
    }
    const mapped = mapTrialBalanceToGifi(DEFAULT_CCPC_CHART, trialBalance)
    expect(mapped.length).toBeGreaterThan(0)
    // Cash account should map to GIFI 1001
    const cashEntry = mapped.find((m) => m.gifiCode === 1001)
    expect(cashEntry).toBeDefined()
  })
})
