/**
 * Tests — Time & Billing Engine
 */
import { describe, it, expect } from 'vitest'
import {
  calculateWip,
  generateInvoice,
  calculateRealization,
  calculateUtilization,
  calculateBudgetVariance,
  generateAgingReport,
  DEFAULT_BILLING_RATES,
  type TimeEntry,
  type Invoice,
} from '../lib/time-billing'

const makeEntry = (overrides: Partial<TimeEntry> = {}): TimeEntry => ({
  id: crypto.randomUUID(),
  orgId: 'org-1',
  staffId: 'staff-1',
  staffLevel: 'senior',
  clientId: 'client-1',
  engagementId: 'eng-1',
  activityCode: 'tax-prep',
  date: '2026-03-15',
  hours: 2,
  description: 'Tax return preparation',
  billingRate: 225,
  status: 'approved',
  nonBillable: false,
  ...overrides,
})

describe('WIP calculation', () => {
  it('should compute WIP for an engagement', () => {
    const entries = [
      makeEntry({ hours: 3, status: 'approved' }),
      makeEntry({ hours: 2, status: 'draft' }),
      makeEntry({ hours: 1, nonBillable: true }),
    ]

    const wip = calculateWip(entries, 'eng-1')
    expect(wip.totalHours).toBe(6)
    expect(wip.billableHours).toBe(5)
    expect(wip.nonBillableHours).toBe(1)
    expect(wip.statusCounts.approved).toBe(2)
    expect(wip.statusCounts.draft).toBe(1)
  })

  it('should exclude billed entries from WIP value', () => {
    const entries = [
      makeEntry({ hours: 3, status: 'billed' }),
      makeEntry({ hours: 2, status: 'approved' }),
    ]

    const wip = calculateWip(entries, 'eng-1')
    expect(wip.wipValue).toBe(2 * 225) // Only approved entry
    expect(wip.wipAtStandardRate).toBe(5 * 225) // Total billable
  })
})

describe('Invoice generation', () => {
  it('should generate invoice from approved entries', () => {
    const entries = [
      makeEntry({ hours: 5, staffLevel: 'senior', billingRate: 225 }),
      makeEntry({ hours: 3, staffLevel: 'manager', billingRate: 300 }),
    ]

    const invoice = generateInvoice({
      entries,
      engagementId: 'eng-1',
      orgId: 'org-1',
      clientId: 'client-1',
      invoiceNumber: 'INV-001',
      invoiceDate: '2026-03-31',
      paymentTermDays: 30,
      hstGstRate: 0.13,
    })

    expect(invoice.lines).toHaveLength(2)
    expect(invoice.subtotal).toBe(5 * 225 + 3 * 300)
    expect(invoice.hstGstAmount).toBeCloseTo(invoice.subtotal * 0.13, 2)
    expect(invoice.total).toBeCloseTo(invoice.subtotal + invoice.hstGstAmount, 2)
    expect(invoice.status).toBe('draft')
    expect(invoice.dueDate).toBe('2026-04-30')
  })

  it('should apply fixed-fee cap', () => {
    const entries = [
      makeEntry({ hours: 10, billingRate: 300 }), // $3,000 at standard
    ]

    const invoice = generateInvoice({
      entries,
      engagementId: 'eng-1',
      orgId: 'org-1',
      clientId: 'client-1',
      invoiceNumber: 'INV-002',
      invoiceDate: '2026-03-31',
      paymentTermDays: 30,
      hstGstRate: 0.13,
      fixedFee: 2_000,
    })

    expect(invoice.subtotal).toBe(2_000)
    expect(invoice.writeDown).toBe(1_000) // $3K − $2K
  })

  it('should exclude non-billable entries', () => {
    const entries = [
      makeEntry({ hours: 5, nonBillable: false }),
      makeEntry({ hours: 3, nonBillable: true }),
    ]

    const invoice = generateInvoice({
      entries,
      engagementId: 'eng-1',
      orgId: 'org-1',
      clientId: 'client-1',
      invoiceNumber: 'INV-003',
      invoiceDate: '2026-03-31',
      paymentTermDays: 30,
      hstGstRate: 0.05,
    })

    expect(invoice.lines).toHaveLength(1)
    expect(invoice.subtotal).toBe(5 * 225)
  })
})

describe('Realization metrics', () => {
  it('should calculate realization rate', () => {
    const entries = [
      makeEntry({ hours: 10, billingRate: 200 }),
    ]

    const metrics = calculateRealization(entries, 1_500)
    expect(metrics.standardBilling).toBe(2_000)
    expect(metrics.realizationRate).toBe(0.75) // 1500/2000
  })

  it('should calculate collection rate when data available', () => {
    const entries = [makeEntry({ hours: 5, billingRate: 200 })]
    const metrics = calculateRealization(entries, 1_000, 800)
    expect(metrics.collectionRate).toBe(0.8)
  })
})

describe('Utilization metrics', () => {
  it('should compute utilization for a 20-day period', () => {
    const entries = [
      makeEntry({ hours: 6, nonBillable: false }),
      makeEntry({ hours: 6, nonBillable: false }),
      makeEntry({ hours: 6, nonBillable: false }),
      makeEntry({ hours: 2, nonBillable: true }),
    ]

    const u = calculateUtilization(entries, 20)
    expect(u.totalHours).toBe(20)
    expect(u.billableHours).toBe(18)
    expect(u.utilizationRate).toBe(0.9) // 18/20
    expect(u.availableHours).toBe(160)
    expect(u.capacityUtilization).toBe(0.125) // 20/160
  })
})

describe('Budget variance', () => {
  it('should detect over-budget engagement', () => {
    const entries = [
      makeEntry({ hours: 30, billingRate: 225 }),
    ]

    const variance = calculateBudgetVariance(
      {
        engagementId: 'eng-1',
        budgetHours: 20,
        budgetFees: 4_500,
        isFixedFee: false,
      },
      entries,
      0.75,
    )

    expect(variance.isOverBudget).toBe(true)
    expect(variance.hoursVariance).toBe(10)
    expect(variance.hoursVariancePct).toBe(0.5) // 10/20
    expect(variance.completionPct).toBe(0.75)
  })
})

describe('Aging report', () => {
  it('should bucket outstanding invoices', () => {
    const invoices: Invoice[] = [
      {
        id: 'inv-1',
        orgId: 'org-1',
        clientId: 'c-1',
        engagementId: 'eng-1',
        invoiceNumber: 'INV-001',
        invoiceDate: '2026-02-01',
        dueDate: '2026-03-03',
        lines: [],
        subtotal: 5_000,
        hstGstRate: 0.13,
        hstGstAmount: 650,
        total: 5_650,
        status: 'sent',
        writeDown: 0,
      },
      {
        id: 'inv-2',
        orgId: 'org-1',
        clientId: 'c-2',
        engagementId: 'eng-2',
        invoiceNumber: 'INV-002',
        invoiceDate: '2025-11-01',
        dueDate: '2025-12-01',
        lines: [],
        subtotal: 3_000,
        hstGstRate: 0.13,
        hstGstAmount: 390,
        total: 3_390,
        status: 'overdue',
        writeDown: 0,
      },
    ]

    const report = generateAgingReport(invoices, '2026-03-15')
    expect(report.totalOutstanding).toBe(5_650 + 3_390)
    expect(report.buckets.length).toBe(5)

    // inv-1: 12 days past due → Current bucket
    const current = report.buckets.find((b) => b.label === 'Current')!
    expect(current.count).toBe(1)

    // inv-2: ~104 days past due → 91-120 bucket
    const aged = report.buckets.find((b) => b.label === '91–120 days')!
    expect(aged.count).toBe(1)
  })
})

describe('Default billing rates', () => {
  it('should have rates for all staff levels', () => {
    expect(DEFAULT_BILLING_RATES.partner).toBe(450)
    expect(DEFAULT_BILLING_RATES.junior).toBe(125)
    expect(DEFAULT_BILLING_RATES.admin).toBe(75)
  })

  it('rates should increase with seniority', () => {
    expect(DEFAULT_BILLING_RATES.partner).toBeGreaterThan(DEFAULT_BILLING_RATES.director)
    expect(DEFAULT_BILLING_RATES.director).toBeGreaterThan(DEFAULT_BILLING_RATES.manager)
    expect(DEFAULT_BILLING_RATES.manager).toBeGreaterThan(DEFAULT_BILLING_RATES.senior)
    expect(DEFAULT_BILLING_RATES.senior).toBeGreaterThan(DEFAULT_BILLING_RATES.intermediate)
  })
})
