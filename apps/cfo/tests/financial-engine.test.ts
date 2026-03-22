/**
 * CFO — Financial Computation Engine Tests
 */
import { describe, it, expect } from 'vitest'
import {
  financialEngine,
  FINANCIAL_ENGINE_VERSION,
  type FinancialEntry,
  type BudgetLine,
} from '@nzila/cfo-core/engine'
import { verifyFinancialProof } from '@nzila/cfo-core/proof'

describe('Financial Computation Engine', () => {
  describe('computeProfitLoss', () => {
    const entries: FinancialEntry[] = [
      { account: 'Sales', amount: 50000, type: 'credit', date: '2026-01-15' },
      { account: 'Services', amount: 20000, type: 'credit', date: '2026-02-10' },
      { account: 'Rent', amount: 5000, type: 'debit', date: '2026-01-01' },
      { account: 'Salaries', amount: 30000, type: 'debit', date: '2026-01-31' },
    ]

    it('calculates total revenue from credit entries', () => {
      const { data } = financialEngine.computeProfitLoss({
        orgId: 'org-1',
        reportId: 'rpt-1',
        period: { start: '2026-01-01', end: '2026-03-31' },
        entries,
      })
      expect(data.totalRevenue).toBe(70000)
    })

    it('calculates total expenses from debit entries', () => {
      const { data } = financialEngine.computeProfitLoss({
        orgId: 'org-1',
        reportId: 'rpt-1',
        period: { start: '2026-01-01', end: '2026-03-31' },
        entries,
      })
      expect(data.totalExpenses).toBe(35000)
    })

    it('calculates net income = revenue - expenses', () => {
      const { data } = financialEngine.computeProfitLoss({
        orgId: 'org-1',
        reportId: 'rpt-1',
        period: { start: '2026-01-01', end: '2026-03-31' },
        entries,
      })
      expect(data.netIncome).toBe(35000)
    })

    it('attaches a valid proof to the result', () => {
      const { proof } = financialEngine.computeProfitLoss({
        orgId: 'org-1',
        reportId: 'rpt-1',
        period: { start: '2026-01-01', end: '2026-03-31' },
        entries,
      })
      expect(proof.hash).toMatch(/^[a-f0-9]{64}$/)
      expect(verifyFinancialProof(proof)).toBe(true)
    })

    it('handles zero entries', () => {
      const { data } = financialEngine.computeProfitLoss({
        orgId: 'org-1',
        reportId: 'rpt-2',
        period: { start: '2026-01-01', end: '2026-03-31' },
        entries: [],
      })
      expect(data.totalRevenue).toBe(0)
      expect(data.totalExpenses).toBe(0)
      expect(data.netIncome).toBe(0)
    })

    it('uses the engine version in proof', () => {
      const { proof } = financialEngine.computeProfitLoss({
        orgId: 'org-1',
        reportId: 'rpt-1',
        period: { start: '2026-01-01', end: '2026-03-31' },
        entries,
      })
      expect(proof.calculationVersion).toBe(FINANCIAL_ENGINE_VERSION)
    })
  })

  describe('computeBudget', () => {
    const lines: BudgetLine[] = [
      { category: 'Marketing', allocated: 50000, spent: 35000 },
      { category: 'Operations', allocated: 100000, spent: 80000 },
      { category: 'R&D', allocated: 75000, spent: 90000 },
    ]

    it('computes total allocated, spent, and remaining', () => {
      const { data } = financialEngine.computeBudget({
        orgId: 'org-1',
        reportId: 'budget-1',
        lines,
      })
      expect(data.totalAllocated).toBe(225000)
      expect(data.totalSpent).toBe(205000)
      expect(data.totalRemaining).toBe(20000)
    })

    it('computes per-line utilization', () => {
      const { data } = financialEngine.computeBudget({
        orgId: 'org-1',
        reportId: 'budget-1',
        lines,
      })
      expect(data.lineDetails[0].utilizationPct).toBe(70)
      expect(data.lineDetails[1].utilizationPct).toBe(80)
    })

    it('detects overrun lines', () => {
      const { data } = financialEngine.computeBudget({
        orgId: 'org-1',
        reportId: 'budget-1',
        lines,
      })
      expect(data.lineDetails[0].overrun).toBe(false)
      expect(data.lineDetails[2].overrun).toBe(true)
    })

    it('attaches a valid proof', () => {
      const { proof } = financialEngine.computeBudget({
        orgId: 'org-1',
        reportId: 'budget-1',
        lines,
      })
      expect(verifyFinancialProof(proof)).toBe(true)
    })
  })

  describe('computeMargins', () => {
    it('computes gross and operating margins', () => {
      const { data } = financialEngine.computeMargins({
        orgId: 'org-1',
        reportId: 'margin-1',
        revenue: 100000,
        costOfGoodsSold: 60000,
        operatingExpenses: 20000,
      })
      expect(data.grossProfit).toBe(40000)
      expect(data.grossMarginPct).toBe(40)
      expect(data.operatingProfit).toBe(20000)
      expect(data.operatingMarginPct).toBe(20)
    })

    it('handles zero revenue', () => {
      const { data } = financialEngine.computeMargins({
        orgId: 'org-1',
        reportId: 'margin-0',
        revenue: 0,
        costOfGoodsSold: 0,
        operatingExpenses: 0,
      })
      expect(data.grossMarginPct).toBe(0)
      expect(data.operatingMarginPct).toBe(0)
    })

    it('attaches a valid proof', () => {
      const { proof } = financialEngine.computeMargins({
        orgId: 'org-1',
        reportId: 'margin-1',
        revenue: 100000,
        costOfGoodsSold: 60000,
        operatingExpenses: 20000,
      })
      expect(verifyFinancialProof(proof)).toBe(true)
    })
  })

  describe('computeCashFlow', () => {
    it('computes net cash flow and closing balance', () => {
      const { data } = financialEngine.computeCashFlow({
        orgId: 'org-1',
        reportId: 'cf-1',
        period: { start: '2026-01-01', end: '2026-03-31' },
        operatingCashIn: 120000,
        operatingCashOut: 80000,
        investingCashIn: 5000,
        investingCashOut: 30000,
        financingCashIn: 50000,
        financingCashOut: 10000,
        openingBalance: 100000,
      })
      expect(data.operatingNet).toBe(40000)
      expect(data.investingNet).toBe(-25000)
      expect(data.financingNet).toBe(40000)
      expect(data.netCashFlow).toBe(55000)
      expect(data.closingBalance).toBe(155000)
    })

    it('attaches a valid proof', () => {
      const { proof } = financialEngine.computeCashFlow({
        orgId: 'org-1',
        reportId: 'cf-1',
        period: { start: '2026-01-01', end: '2026-03-31' },
        operatingCashIn: 120000,
        operatingCashOut: 80000,
        investingCashIn: 5000,
        investingCashOut: 30000,
        financingCashIn: 50000,
        financingCashOut: 10000,
        openingBalance: 100000,
      })
      expect(verifyFinancialProof(proof)).toBe(true)
    })
  })

  describe('computeBudgetUtilization', () => {
    it('returns percentage utilized', () => {
      expect(financialEngine.computeBudgetUtilization({ category: 'X', allocated: 50000, spent: 35000 })).toBe(70)
    })

    it('returns 0 for zero allocation', () => {
      expect(financialEngine.computeBudgetUtilization({ category: 'X', allocated: 0, spent: 0 })).toBe(0)
    })
  })

  describe('computeAnnualProjection', () => {
    it('projects annual spend from partial year', () => {
      const result = financialEngine.computeAnnualProjection(30000, 3)
      expect(result.projectedAnnualSpend).toBe(120000)
    })

    it('handles zero months', () => {
      const result = financialEngine.computeAnnualProjection(0, 0)
      expect(result.projectedAnnualSpend).toBe(0)
    })
  })

  describe('isBudgetOverrun', () => {
    it('returns true when spent > allocated', () => {
      expect(financialEngine.isBudgetOverrun({ category: 'X', allocated: 75000, spent: 90000 })).toBe(true)
    })

    it('returns false when spent ≤ allocated', () => {
      expect(financialEngine.isBudgetOverrun({ category: 'X', allocated: 50000, spent: 35000 })).toBe(false)
    })
  })
})
