/**
 * @nzila/cfo-core — Single Financial Computation Engine
 *
 * ALL financial math in the CFO domain MUST flow through this engine.
 * No ad-hoc revenue/expense/profit calculations scattered across
 * services, API routes, or dashboard components.
 *
 * Every computation returns its result together with a FinancialProof,
 * making the output auditable and tamper-evident.
 *
 * @module @nzila/cfo-core/engine
 */

import { generateFinancialProof, type FinancialProof } from './financial-proof'

// ── Canonical version — bump on logic changes ───────────────────────────────

export const FINANCIAL_ENGINE_VERSION = '1.0.0'

// ── Input types ─────────────────────────────────────────────────────────────

export interface FinancialEntry {
  account: string
  amount: number
  type: 'debit' | 'credit'
  date: string
}

export interface BudgetLine {
  category: string
  allocated: number
  spent: number
}

export interface ProfitLossInput {
  orgId: string
  reportId: string
  period: { start: string; end: string }
  entries: FinancialEntry[]
}

export interface BudgetInput {
  orgId: string
  reportId: string
  lines: BudgetLine[]
}

export interface MarginInput {
  orgId: string
  reportId: string
  revenue: number
  costOfGoodsSold: number
  operatingExpenses: number
}

export interface CashFlowInput {
  orgId: string
  reportId: string
  period: { start: string; end: string }
  operatingCashIn: number
  operatingCashOut: number
  investingCashIn: number
  investingCashOut: number
  financingCashIn: number
  financingCashOut: number
  openingBalance: number
}

// ── Output types ────────────────────────────────────────────────────────────

export interface ProvenResult<T> {
  data: T
  proof: FinancialProof
}

export interface ProfitLossResult {
  orgId: string
  period: { start: string; end: string }
  totalRevenue: number
  totalExpenses: number
  netIncome: number
  entryCount: number
}

export interface BudgetResult {
  totalAllocated: number
  totalSpent: number
  totalRemaining: number
  utilizationPct: number
  lineDetails: {
    category: string
    allocated: number
    spent: number
    remaining: number
    utilizationPct: number
    overrun: boolean
  }[]
}

export interface MarginResult {
  grossProfit: number
  grossMarginPct: number
  operatingProfit: number
  operatingMarginPct: number
}

export interface CashFlowResult {
  operatingNet: number
  investingNet: number
  financingNet: number
  netCashFlow: number
  closingBalance: number
}

export interface AnnualProjection {
  projectedAnnualSpend: number
  monthlyRate: number
  monthsElapsed: number
}

// ── Engine ───────────────────────────────────────────────────────────────────

export const financialEngine = {
  /**
   * Compute a Profit & Loss statement from ledger entries.
   */
  computeProfitLoss(input: ProfitLossInput): ProvenResult<ProfitLossResult> {
    const totalRevenue = input.entries
      .filter((e) => e.type === 'credit')
      .reduce((s, e) => s + e.amount, 0)

    const totalExpenses = input.entries
      .filter((e) => e.type === 'debit')
      .reduce((s, e) => s + e.amount, 0)

    const netIncome = round2(totalRevenue - totalExpenses)
    const data: ProfitLossResult = {
      orgId: input.orgId,
      period: input.period,
      totalRevenue: round2(totalRevenue),
      totalExpenses: round2(totalExpenses),
      netIncome,
      entryCount: input.entries.length,
    }

    const proof = generateFinancialProof({
      reportId: input.reportId,
      orgId: input.orgId,
      inputSources: [`ledger:${input.orgId}`, `period:${input.period.start}..${input.period.end}`],
      calculationVersion: FINANCIAL_ENGINE_VERSION,
      outputValues: {
        totalRevenue: data.totalRevenue,
        totalExpenses: data.totalExpenses,
        netIncome: data.netIncome,
      },
    })

    return { data, proof }
  },

  /**
   * Compute budget summary with per-line utilization.
   */
  computeBudget(input: BudgetInput): ProvenResult<BudgetResult> {
    const lineDetails = input.lines.map((line) => {
      const remaining = round2(line.allocated - line.spent)
      const utilizationPct = line.allocated > 0
        ? round2((line.spent / line.allocated) * 100)
        : 0
      return {
        category: line.category,
        allocated: line.allocated,
        spent: line.spent,
        remaining,
        utilizationPct,
        overrun: line.spent > line.allocated,
      }
    })

    const totalAllocated = round2(input.lines.reduce((s, l) => s + l.allocated, 0))
    const totalSpent = round2(input.lines.reduce((s, l) => s + l.spent, 0))
    const totalRemaining = round2(totalAllocated - totalSpent)
    const utilizationPct = totalAllocated > 0
      ? round2((totalSpent / totalAllocated) * 100)
      : 0

    const data: BudgetResult = {
      totalAllocated,
      totalSpent,
      totalRemaining,
      utilizationPct,
      lineDetails,
    }

    const proof = generateFinancialProof({
      reportId: input.reportId,
      orgId: input.orgId,
      inputSources: [`budget:${input.orgId}`, ...input.lines.map((l) => `line:${l.category}`)],
      calculationVersion: FINANCIAL_ENGINE_VERSION,
      outputValues: { totalAllocated, totalSpent, totalRemaining, utilizationPct },
    })

    return { data, proof }
  },

  /**
   * Compute gross and operating margins.
   */
  computeMargins(input: MarginInput): ProvenResult<MarginResult> {
    const grossProfit = round2(input.revenue - input.costOfGoodsSold)
    const grossMarginPct = input.revenue > 0
      ? round2((grossProfit / input.revenue) * 100)
      : 0
    const operatingProfit = round2(grossProfit - input.operatingExpenses)
    const operatingMarginPct = input.revenue > 0
      ? round2((operatingProfit / input.revenue) * 100)
      : 0

    const data: MarginResult = { grossProfit, grossMarginPct, operatingProfit, operatingMarginPct }

    const proof = generateFinancialProof({
      reportId: input.reportId,
      orgId: input.orgId,
      inputSources: [`margins:${input.orgId}`],
      calculationVersion: FINANCIAL_ENGINE_VERSION,
      outputValues: { grossProfit, grossMarginPct, operatingProfit, operatingMarginPct },
    })

    return { data, proof }
  },

  /**
   * Compute cash flow statement (3-activity method).
   */
  computeCashFlow(input: CashFlowInput): ProvenResult<CashFlowResult> {
    const operatingNet = round2(input.operatingCashIn - input.operatingCashOut)
    const investingNet = round2(input.investingCashIn - input.investingCashOut)
    const financingNet = round2(input.financingCashIn - input.financingCashOut)
    const netCashFlow = round2(operatingNet + investingNet + financingNet)
    const closingBalance = round2(input.openingBalance + netCashFlow)

    const data: CashFlowResult = { operatingNet, investingNet, financingNet, netCashFlow, closingBalance }

    const proof = generateFinancialProof({
      reportId: input.reportId,
      orgId: input.orgId,
      inputSources: [`cashflow:${input.orgId}`, `period:${input.period.start}..${input.period.end}`],
      calculationVersion: FINANCIAL_ENGINE_VERSION,
      outputValues: { operatingNet, investingNet, financingNet, netCashFlow, closingBalance },
    })

    return { data, proof }
  },

  /**
   * Compute budget utilization for a single line.
   */
  computeBudgetUtilization(line: BudgetLine): number {
    if (line.allocated === 0) return 0
    return round2((line.spent / line.allocated) * 100)
  },

  /**
   * Project annual spend from partial-year data.
   */
  computeAnnualProjection(monthlySpend: number, monthsElapsed: number): AnnualProjection {
    if (monthsElapsed === 0) {
      return { projectedAnnualSpend: 0, monthlyRate: 0, monthsElapsed: 0 }
    }
    const monthlyRate = round2(monthlySpend / monthsElapsed)
    return {
      projectedAnnualSpend: round2(monthlyRate * 12),
      monthlyRate,
      monthsElapsed,
    }
  },

  /**
   * Check if a budget line is over budget.
   */
  isBudgetOverrun(line: BudgetLine): boolean {
    return line.spent > line.allocated
  },
} as const

// ── Utility ─────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
