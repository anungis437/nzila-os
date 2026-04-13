import { describe, it, expect } from 'vitest'
import {
  STANDARD_AGING_BUCKETS,
  STANDARD_DUNNING_SCHEDULE,
  generateAgingReport,
  allocateTransactionPrice,
  calculateRecognizedRevenue,
  getDueDunningActions,
  evaluateCustomerCredit,
  type AgingInvoice,
  type RevenueContract,
} from './aging-report'

describe('aging-report', () => {
  const invoices: AgingInvoice[] = [
    {
      id: 'inv-current',
      customerId: 'cust-1',
      customerName: 'Cust One',
      invoiceNumber: 'INV-001',
      issueDate: '2026-01-01',
      dueDate: '2026-01-31',
      amount: 100,
      amountPaid: 0,
      balance: 100,
      currency: 'CAD',
      status: 'issued',
    },
    {
      id: 'inv-overdue-10',
      customerId: 'cust-1',
      customerName: 'Cust One',
      invoiceNumber: 'INV-002',
      issueDate: '2025-12-01',
      dueDate: '2026-01-20',
      amount: 200,
      amountPaid: 0,
      balance: 200,
      currency: 'CAD',
      status: 'overdue',
    },
    {
      id: 'inv-overdue-95',
      customerId: 'cust-2',
      customerName: 'Cust Two',
      invoiceNumber: 'INV-003',
      issueDate: '2025-09-01',
      dueDate: '2025-10-27',
      amount: 300,
      amountPaid: 0,
      balance: 300,
      currency: 'CAD',
      status: 'overdue',
    },
    {
      id: 'inv-paid',
      customerId: 'cust-3',
      customerName: 'Cust Three',
      invoiceNumber: 'INV-004',
      issueDate: '2025-09-01',
      dueDate: '2025-10-01',
      amount: 500,
      amountPaid: 500,
      balance: 0,
      currency: 'CAD',
      status: 'partially_paid',
    },
  ]

  it('generates summary and assigns invoices into standard aging buckets', () => {
    const report = generateAgingReport(invoices, {
      type: 'ar',
      orgId: 'org-1',
      asOfDate: '2026-01-31',
    })

    expect(report.buckets).toHaveLength(STANDARD_AGING_BUCKETS.length)
    expect(report.summary.totalOutstanding).toBe(600)
    expect(report.summary.totalOverdue).toBe(500)
    expect(report.summary.invoiceCount).toBe(3)
    expect(report.summary.customerCount).toBe(2)
    expect(report.summary.oldestInvoiceDays).toBe(96)

    const current = report.buckets.find((b) => b.label === 'Current')
    const bucket1to30 = report.buckets.find((b) => b.label === '1–30')
    const bucket91to120 = report.buckets.find((b) => b.label === '91–120')

    expect(current?.invoiceCount).toBe(1)
    expect(bucket1to30?.invoiceCount).toBe(1)
    expect(bucket91to120?.invoiceCount).toBe(1)
  })

  it('supports custom buckets and empty unpaid set', () => {
    const report = generateAgingReport(
      invoices.map((i) => ({ ...i, balance: 0 })),
      {
        type: 'ap',
        orgId: 'org-2',
        asOfDate: '2026-01-31',
        buckets: [
          { label: '0-15', minDays: 0, maxDays: 15 },
          { label: '16+', minDays: 16, maxDays: null },
        ],
      },
    )

    expect(report.type).toBe('ap')
    expect(report.summary.totalOutstanding).toBe(0)
    expect(report.summary.averageDaysOutstanding).toBe(0)
    expect(report.summary.invoiceCount).toBe(0)
  })
})

describe('revenue recognition', () => {
  it('allocates by SSP ratios and rounds to cents', () => {
    const allocations = allocateTransactionPrice(1000, [
      {
        id: 'ob-1',
        description: 'License',
        standaloneSellingPrice: 600,
        recognitionPattern: 'point-in-time',
        satisfiedDate: '2026-01-05',
      },
      {
        id: 'ob-2',
        description: 'Support',
        standaloneSellingPrice: 400,
        recognitionPattern: 'over-time',
        startDate: '2026-01-01',
      },
    ])

    expect(allocations[0]?.allocatedAmount).toBe(600)
    expect(allocations[1]?.allocatedAmount).toBe(400)
  })

  it('falls back to equal split when SSP total is zero', () => {
    const allocations = allocateTransactionPrice(90, [
      {
        id: 'ob-1',
        description: 'A',
        standaloneSellingPrice: 0,
        recognitionPattern: 'point-in-time',
      },
      {
        id: 'ob-2',
        description: 'B',
        standaloneSellingPrice: 0,
        recognitionPattern: 'point-in-time',
      },
      {
        id: 'ob-3',
        description: 'C',
        standaloneSellingPrice: 0,
        recognitionPattern: 'point-in-time',
      },
    ])

    expect(allocations.map((a) => a.allocatedAmount)).toEqual([30, 30, 30])
  })

  it('calculates recognized and deferred amounts for mixed patterns', () => {
    const contract: RevenueContract = {
      id: 'contract-1',
      customerId: 'cust-1',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      totalValue: 1000,
      performanceObligations: [
        {
          id: 'pit',
          description: 'Hardware',
          standaloneSellingPrice: 500,
          recognitionPattern: 'point-in-time',
          satisfiedDate: '2026-01-10',
        },
        {
          id: 'ot',
          description: 'Managed service',
          standaloneSellingPrice: 500,
          recognitionPattern: 'over-time',
          startDate: '2026-01-01',
        },
      ],
    }

    const report = calculateRecognizedRevenue(contract, '2026-01-16')
    expect(report.totalContractValue).toBe(1000)
    expect(report.totalRecognized).toBeGreaterThan(700)
    expect(report.totalDeferred).toBeLessThan(300)

    const overTime = report.allocations.find((a) => a.obligationId === 'ot')
    expect(overTime?.percentComplete).toBeGreaterThan(0.4)
    expect(overTime?.percentComplete).toBeLessThanOrEqual(1)
  })

  it('caps over-time recognition at 100% when asOfDate exceeds contract end', () => {
    const contract: RevenueContract = {
      id: 'contract-2',
      customerId: 'cust-1',
      startDate: '2026-01-01',
      endDate: '2026-01-02',
      totalValue: 100,
      performanceObligations: [
        {
          id: 'ot',
          description: 'Service',
          standaloneSellingPrice: 100,
          recognitionPattern: 'over-time',
          startDate: '2026-01-01',
        },
      ],
    }

    const report = calculateRecognizedRevenue(contract, '2026-02-01')
    expect(report.totalRecognized).toBe(100)
    expect(report.totalDeferred).toBe(0)
  })
})

describe('collections and credit helpers', () => {
  it('returns due dunning steps excluding completed ones', () => {
    const due = getDueDunningActions(60, [7, 14])
    expect(due.map((d) => d.daysOverdue)).toEqual([30, 45, 60])
  })

  it('supports custom dunning schedule', () => {
    const custom = [
      { daysOverdue: 5, action: 'reminder', channel: 'email', template: 'r5', severity: 'low' },
      { daysOverdue: 10, action: 'warning', channel: 'email', template: 'w10', severity: 'medium' },
    ] as const

    const due = getDueDunningActions(11, [], custom as unknown as typeof STANDARD_DUNNING_SCHEDULE)
    expect(due).toHaveLength(2)
  })

  it('evaluates customer credit with utilization and over-limit flags', () => {
    const credit = evaluateCustomerCredit('cust-1', 1000, 1200, 50)
    expect(credit.currentBalance).toBe(1150)
    expect(credit.availableCredit).toBe(0)
    expect(credit.overCreditLimit).toBe(true)
    expect(credit.creditUtilization).toBe(1.15)
  })

  it('handles zero credit limit without division errors', () => {
    const credit = evaluateCustomerCredit('cust-2', 0, 10)
    expect(credit.creditUtilization).toBe(0)
    expect(credit.overCreditLimit).toBe(true)
  })
})

describe('barrel exports', () => {
  it('exposes package and saga public exports', async () => {
    const pkg = await import('./index')
    const sagas = await import('./sagas')

    expect(typeof pkg.generateAgingReport).toBe('function')
    expect(typeof pkg.createQuoteService).toBe('function')
    expect(typeof pkg.createOrderToInvoiceSaga).toBe('function')

    expect(typeof sagas.createQuoteToOrderSaga).toBe('function')
    expect(typeof sagas.createOrderToInvoiceSaga).toBe('function')
  })
})
