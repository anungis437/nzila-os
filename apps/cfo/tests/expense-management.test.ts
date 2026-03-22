/**
 * Expense Management — pure-function tests
 *
 * Tests GL category mapping, policy validation, and journal entry generation.
 */
import { describe, it, expect } from 'vitest'
import {
  mapExpenseCategoryToGL,
  validateAgainstPolicy,
  toJournalEntries,
  type ExpenseReport,
  type ExpensePolicy,
  type ExpenseLineItem,
} from '@/lib/expense-management'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeLineItem(overrides: Partial<ExpenseLineItem> = {}): ExpenseLineItem {
  return {
    externalId: 'txn-1',
    date: '2025-06-01',
    merchant: 'Staples',
    category: 'Office Supplies',
    description: 'Printer paper',
    amount: 45.0,
    currency: 'CAD',
    receiptUrl: 'https://receipts.example.com/r1.jpg',
    isBillable: false,
    projectCode: null,
    accountCode: null,
    taxAmount: 5.85,
    tags: [],
    ...overrides,
  }
}

function makeReport(overrides: Partial<ExpenseReport> = {}): ExpenseReport {
  return {
    externalId: 'rpt-100',
    provider: 'manual',
    employeeId: 'emp-1',
    employeeName: 'Jane Doe',
    title: 'June Expenses',
    status: 'submitted',
    submittedAt: '2025-06-15',
    approvedAt: null,
    totalAmount: 45.0,
    currency: 'CAD',
    expenses: [makeLineItem()],
    policyViolations: [],
    ...overrides,
  }
}

function makePolicy(overrides: Partial<ExpensePolicy> = {}): ExpensePolicy {
  return {
    id: 'pol-1',
    name: 'Standard Policy',
    maxSingleExpense: 500,
    requireReceipt: true,
    receiptThreshold: 25,
    allowedCategories: [],
    approvalThresholds: [{ amount: 1000, approverLevel: 'manager' }],
    ...overrides,
  }
}

// ── GL Category Mapping ─────────────────────────────────────────────────────

describe('mapExpenseCategoryToGL', () => {
  it.each([
    ['Travel', '6200'],
    ['Meals', '6210'],
    ['Entertainment', '6220'],
    ['Office Supplies', '6300'],
    ['Software', '6310'],
    ['Professional Development', '6400'],
    ['Telephone', '6500'],
    ['Parking', '6210'],
    ['Mileage', '6200'],
    ['Accommodation', '6200'],
    ['Other', '6900'],
  ] as const)('maps "%s" → GL %s', (category, expectedGL) => {
    expect(mapExpenseCategoryToGL(category)).toBe(expectedGL)
  })

  it('defaults unknown categories to 6900', () => {
    expect(mapExpenseCategoryToGL('Unknown')).toBe('6900')
    expect(mapExpenseCategoryToGL('')).toBe('6900')
  })
})

// ── Policy Validation ───────────────────────────────────────────────────────

describe('validateAgainstPolicy', () => {
  it('returns valid for a conforming report', () => {
    const report = makeReport()
    const policy = makePolicy()
    const result = validateAgainstPolicy(report, policy)
    expect(result.valid).toBe(true)
    expect(result.violations).toEqual([])
  })

  it('flags expenses exceeding maxSingleExpense', () => {
    const report = makeReport({
      expenses: [makeLineItem({ merchant: 'AirCanada', amount: 750 })],
    })
    const policy = makePolicy({ maxSingleExpense: 500 })
    const result = validateAgainstPolicy(report, policy)
    expect(result.valid).toBe(false)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]).toContain('AirCanada')
    expect(result.violations[0]).toContain('750')
    expect(result.violations[0]).toContain('500')
  })

  it('flags missing receipt when above threshold', () => {
    const report = makeReport({
      expenses: [makeLineItem({ merchant: 'Uber', amount: 50, receiptUrl: null })],
    })
    const policy = makePolicy({ requireReceipt: true, receiptThreshold: 25 })
    const result = validateAgainstPolicy(report, policy)
    expect(result.valid).toBe(false)
    expect(result.violations[0]).toContain('receipt required')
  })

  it('allows missing receipt when below threshold', () => {
    const report = makeReport({
      expenses: [makeLineItem({ amount: 20, receiptUrl: null })],
    })
    const policy = makePolicy({ requireReceipt: true, receiptThreshold: 25 })
    const result = validateAgainstPolicy(report, policy)
    expect(result.valid).toBe(true)
  })

  it('flags disallowed categories', () => {
    const report = makeReport({
      expenses: [makeLineItem({ category: 'Entertainment' })],
    })
    const policy = makePolicy({ allowedCategories: ['Travel', 'Meals', 'Office Supplies'] })
    const result = validateAgainstPolicy(report, policy)
    expect(result.valid).toBe(false)
    expect(result.violations[0]).toContain('Entertainment')
    expect(result.violations[0]).toContain('not allowed')
  })

  it('skips category check when allowedCategories is empty', () => {
    const report = makeReport({
      expenses: [makeLineItem({ category: 'Entertainment' })],
    })
    const policy = makePolicy({ allowedCategories: [] })
    const result = validateAgainstPolicy(report, policy)
    expect(result.valid).toBe(true)
  })

  it('accumulates multiple violations across expenses', () => {
    const report = makeReport({
      expenses: [
        makeLineItem({ merchant: 'Big Purchase', amount: 600, receiptUrl: null }),
        makeLineItem({ merchant: 'Other', category: 'Gambling' }),
      ],
    })
    const policy = makePolicy({
      maxSingleExpense: 500,
      requireReceipt: true,
      receiptThreshold: 25,
      allowedCategories: ['Office Supplies'],
    })
    const result = validateAgainstPolicy(report, policy)
    expect(result.valid).toBe(false)
    // Big Purchase: over max + missing receipt + wrong category = 3
    // Other: wrong category (Gambling) = 1  ... but amount is 45 and has receipt
    // Actually "Other" has category "Gambling" which isn't in allowed
    expect(result.violations.length).toBeGreaterThanOrEqual(3)
  })
})

// ── Journal Entries ─────────────────────────────────────────────────────────

describe('toJournalEntries', () => {
  it('generates one journal entry per expense', () => {
    const report = makeReport({
      expenses: [makeLineItem(), makeLineItem({ externalId: 'txn-2' })],
    })
    const entries = toJournalEntries(report)
    expect(entries).toHaveLength(2)
  })

  it('uses EXP- reference format', () => {
    const report = makeReport({ externalId: 'RPT-42', expenses: [makeLineItem({ externalId: 'TXN-7' })] })
    const [entry] = toJournalEntries(report)
    expect(entry.reference).toBe('EXP-RPT-42-TXN-7')
  })

  it('includes description with merchant and category', () => {
    const report = makeReport({ expenses: [makeLineItem({ merchant: 'Staples', category: 'Office Supplies' })] })
    const [entry] = toJournalEntries(report)
    expect(entry.description).toContain('Staples')
    expect(entry.description).toContain('Office Supplies')
  })

  it('has balanced debit/credit lines (including tax)', () => {
    const report = makeReport({
      expenses: [makeLineItem({ amount: 100, taxAmount: 13 })],
    })
    const [entry] = toJournalEntries(report)
    const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0)
    expect(totalDebit).toBeCloseTo(totalCredit, 2) // debits = credits
  })

  it('splits tax into separate ITC line (account 2300)', () => {
    const report = makeReport({
      expenses: [makeLineItem({ amount: 100, taxAmount: 13 })],
    })
    const [entry] = toJournalEntries(report)
    // 3 lines: expense debit, tax debit, AP credit
    expect(entry.lines).toHaveLength(3)

    const taxLine = entry.lines.find((l) => l.accountCode === '2300')
    expect(taxLine).toBeDefined()
    expect(taxLine!.debit).toBe(13)
  })

  it('omits tax line when taxAmount is 0', () => {
    const report = makeReport({
      expenses: [makeLineItem({ amount: 50, taxAmount: 0 })],
    })
    const [entry] = toJournalEntries(report)
    // Only 2 lines: expense debit + AP credit
    expect(entry.lines).toHaveLength(2)
    expect(entry.lines.every((l) => l.accountCode !== '2300')).toBe(true)
  })

  it('posts AP credit to account 2100', () => {
    const report = makeReport({
      expenses: [makeLineItem({ amount: 75 })],
    })
    const [entry] = toJournalEntries(report)
    const apLine = entry.lines.find((l) => l.accountCode === '2100')
    expect(apLine).toBeDefined()
    expect(apLine!.credit).toBe(75)
    expect(apLine!.debit).toBe(0)
  })

  it('uses GL mapped account when accountCode is null', () => {
    const report = makeReport({
      expenses: [makeLineItem({ category: 'Software', accountCode: null })],
    })
    const [entry] = toJournalEntries(report)
    const expenseLine = entry.lines[0]
    expect(expenseLine.accountCode).toBe('6310') // Software GL
  })

  it('preserves date from expense line', () => {
    const report = makeReport({
      expenses: [makeLineItem({ date: '2025-11-30' })],
    })
    const [entry] = toJournalEntries(report)
    expect(entry.date).toBe('2025-11-30')
  })
})
