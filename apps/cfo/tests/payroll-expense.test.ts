/**
 * CFO — Payroll Provider & Expense Management Tests
 *
 * Tests for the expense management adapter — policy validation,
 * GL category mapping, and journal entry conversion.
 * Payroll normalizers are private; we test the exported API types.
 */
import { describe, it, expect } from 'vitest'
import type {
  PayrollEmployee,
  PayrollPayRun,
  PayrollProvider,
} from '../lib/payroll-provider'
import {
  validateAgainstPolicy,
  mapExpenseCategoryToGL,
  toJournalEntries,
  type ExpenseReport,
  type ExpenseLineItem,
  type ExpensePolicy,
} from '../lib/expense-management'

// ── Payroll Types ───────────────────────────────────────────────────────────

describe('Payroll Provider Types', () => {
  it('PayrollEmployee has required fields', () => {
    const emp: PayrollEmployee = {
      externalId: 'EMP001',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@company.com',
      department: 'Finance',
      jobTitle: 'Controller',
      hireDate: '2023-06-15',
      terminationDate: null,
      status: 'active',
      annualSalary: 85_000,
      payFrequency: 'biweekly',
      currency: 'CAD',
    }
    expect(emp.externalId).toBe('EMP001')
    expect(emp.status).toBe('active')
  })

  it('PayrollPayRun has required fields', () => {
    const run: PayrollPayRun = {
      externalId: 'RUN001',
      payDate: '2025-06-15',
      periodStart: '2025-06-01',
      periodEnd: '2025-06-14',
      status: 'complete',
      totalGross: 50_000,
      totalNet: 38_000,
      totalDeductions: 12_000,
      totalEmployerCost: 5_000,
      currency: 'CAD',
      entries: [],
    }
    expect(run.totalGross - run.totalDeductions).toBe(run.totalNet)
  })

  it('accepts valid provider types', () => {
    const providers: PayrollProvider[] = ['adp', 'ceridian', 'gusto', 'manual']
    expect(providers).toHaveLength(4)
  })
})

// ── Expense Policy Validation ───────────────────────────────────────────────

describe('Expense Policy Validation', () => {
  const policy: ExpensePolicy = {
    id: 'pol_001',
    name: 'Standard Travel Policy',
    maxSingleExpense: 500,
    requireReceipt: true,
    receiptThreshold: 25,
    allowedCategories: ['Meals', 'Travel', 'Office Supplies', 'Software'],
    approvalThresholds: [
      { amount: 200, approverLevel: 'manager' },
      { amount: 1000, approverLevel: 'director' },
    ],
  }

  const validExpense: ExpenseLineItem = {
    externalId: 'exp_1',
    date: '2025-06-01',
    merchant: 'Restaurant ABC',
    category: 'Meals',
    description: 'Team lunch',
    amount: 45.50,
    currency: 'USD',
    receiptUrl: 'https://storage.example.com/receipt.jpg',
    isBillable: false,
    projectCode: null,
    accountCode: null,
    taxAmount: 5.92,
    tags: [],
  }

  const validReport: ExpenseReport = {
    externalId: 'rpt_001',
    provider: 'expensify',
    employeeId: 'emp_001',
    employeeName: 'Jane Smith',
    title: 'June Travel',
    status: 'approved',
    submittedAt: '2025-06-15T10:00:00Z',
    approvedAt: '2025-06-16T14:00:00Z',
    totalAmount: 45.50,
    currency: 'USD',
    expenses: [validExpense],
    policyViolations: [],
  }

  it('passes valid expense report', () => {
    const result = validateAgainstPolicy(validReport, policy)
    expect(result.valid).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('flags amount exceeding max', () => {
    const report = {
      ...validReport,
      expenses: [{ ...validExpense, amount: 600 }],
    }
    const result = validateAgainstPolicy(report, policy)
    expect(result.valid).toBe(false)
    expect(result.violations.some((v) => v.includes('exceed'))).toBe(true)
  })

  it('flags disallowed category', () => {
    const report = {
      ...validReport,
      expenses: [{ ...validExpense, category: 'Personal Shopping' }],
    }
    const result = validateAgainstPolicy(report, policy)
    expect(result.valid).toBe(false)
    expect(result.violations.some((v) => v.includes('not allowed'))).toBe(true)
  })

  it('flags missing receipt above threshold', () => {
    const report = {
      ...validReport,
      expenses: [{ ...validExpense, amount: 30, receiptUrl: null }],
    }
    const result = validateAgainstPolicy(report, policy)
    expect(result.valid).toBe(false)
    expect(result.violations.some((v) => v.includes('receipt'))).toBe(true)
  })
})

// ── GL Category Mapping ─────────────────────────────────────────────────────

describe('Expense GL Category Mapping', () => {
  it('maps known categories to GL account codes', () => {
    expect(mapExpenseCategoryToGL('Travel')).toBe('6200')
    expect(mapExpenseCategoryToGL('Meals')).toBe('6210')
    expect(mapExpenseCategoryToGL('Office Supplies')).toBe('6300')
  })

  it('falls back to Other for unknown categories', () => {
    expect(mapExpenseCategoryToGL('Unknown Category')).toBe('6900')
  })
})

// ── Journal Entry Conversion ────────────────────────────────────────────────

describe('Expense Journal Entries', () => {
  const report: ExpenseReport = {
    externalId: 'rpt_001',
    provider: 'expensify',
    employeeId: 'emp_001',
    employeeName: 'Jane Smith',
    title: 'June Travel',
    status: 'approved',
    submittedAt: '2025-06-15T10:00:00Z',
    approvedAt: '2025-06-16T14:00:00Z',
    totalAmount: 120,
    currency: 'USD',
    expenses: [
      {
        externalId: 'exp_1',
        date: '2025-06-14',
        merchant: 'Client Dinner',
        category: 'Meals',
        description: 'Client dinner meeting',
        amount: 70,
        currency: 'USD',
        receiptUrl: 'https://example.com/r1.jpg',
        isBillable: true,
        projectCode: 'PRJ-100',
        accountCode: null,
        taxAmount: 9.10,
        tags: [],
      },
      {
        externalId: 'exp_2',
        date: '2025-06-14',
        merchant: 'City Taxi',
        category: 'Travel',
        description: 'Taxi to client',
        amount: 50,
        currency: 'USD',
        receiptUrl: 'https://example.com/r2.jpg',
        isBillable: false,
        projectCode: null,
        accountCode: null,
        taxAmount: 6.50,
        tags: [],
      },
    ],
    policyViolations: [],
  }

  it('produces balanced journal entries', () => {
    const entries = toJournalEntries(report)
    expect(entries.length).toBe(2) // one per line item

    for (const entry of entries) {
      const totalDebits = entry.lines
        .reduce((s, l) => s + l.debit, 0)
      const totalCredits = entry.lines
        .reduce((s, l) => s + l.credit, 0)
      expect(Math.abs(totalDebits - totalCredits)).toBeLessThan(0.01)
    }
  })

  it('references expense report in reference field', () => {
    const entries = toJournalEntries(report)
    expect(entries[0].reference).toContain('rpt_001')
  })

  it('uses correct GL accounts for Meals category', () => {
    const entries = toJournalEntries(report)
    // First expense is Meals → GL 6210
    const mealsEntry = entries[0]
    expect(mealsEntry.lines.some((l) => l.accountCode === '6210')).toBe(true)
  })

  it('includes ITC line for tax amounts', () => {
    const entries = toJournalEntries(report)
    // First expense has taxAmount 9.10 → should have a debit to 2300 (ITC)
    const mealsEntry = entries[0]
    const itcLine = mealsEntry.lines.find((l) => l.accountCode === '2300')
    expect(itcLine).toBeDefined()
    expect(itcLine!.debit).toBeCloseTo(9.10)
  })
})
