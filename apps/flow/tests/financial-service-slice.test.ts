import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSelectWhere } = vi.hoisted(() => ({
  mockSelectWhere: vi.fn(),
}))

const queryQueue: unknown[] = []
const dequeue = () => Promise.resolve((queryQueue.shift() as unknown[]) ?? [])

vi.mock('drizzle-orm', () => ({
  and: vi.fn(() => ({})),
  eq: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
  inArray: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((text, segment, index) => text + segment + (values[index] ?? ''), ''),
  ),
}))

vi.mock('@nzila/db', () => {
  const queryResult = {
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => dequeue().then(resolve, reject),
    limit: vi.fn(() => dequeue()),
    orderBy: vi.fn(() => dequeue()),
  }

  mockSelectWhere.mockImplementation(() => queryResult)

  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: mockSelectWhere,
        })),
      })),
    },
    commerceInvoices: {
      id: 'id',
      orgId: 'orgId',
      status: 'status',
      amountDue: 'amountDue',
      customerId: 'customerId',
      createdAt: 'createdAt',
      issuedAt: 'issuedAt',
      dueDate: 'dueDate',
      ref: 'ref',
      total: 'total',
      amountPaid: 'amountPaid',
    },
    commercePayments: {
      amount: 'amount',
      orgId: 'orgId',
      invoiceId: 'invoiceId',
      paidAt: 'paidAt',
      method: 'method',
    },
    commerceCustomers: {
      id: 'id',
      name: 'name',
    },
  }
})

describe('financial service analytics slice', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-08T00:00:00.000Z'))
    queryQueue.length = 0
    vi.clearAllMocks()
  })

  it('computes financial summary with grouped metrics', async () => {
    const service = await import('@/lib/financial-service')

    queryQueue.push(
      [
        {
          id: 'inv-1',
          customerId: 'cust-1',
          createdAt: new Date('2026-05-01T00:00:00.000Z'),
          dueDate: new Date('2026-06-01T00:00:00.000Z'),
          total: '100.00',
          amountDue: '25.00',
          amountPaid: '75.00',
          status: 'partial_paid',
        },
        {
          id: 'inv-2',
          customerId: 'cust-2',
          createdAt: new Date('2026-05-15T00:00:00.000Z'),
          dueDate: new Date('2026-05-20T00:00:00.000Z'),
          total: '50.00',
          amountDue: '50.00',
          amountPaid: '0.00',
          status: 'sent',
        },
      ],
      [
        {
          invoiceId: 'inv-1',
          amount: '75.00',
          method: 'card',
          paidAt: new Date('2026-05-10T00:00:00.000Z'),
        },
      ],
      [
        { id: 'cust-1', name: 'Alpha Co' },
        { id: 'cust-2', name: 'Beta Co' },
      ],
    )

    const summary = await service.getFinancialSummary(
      'org-1',
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-06-30T00:00:00.000Z'),
    )

    expect(summary.revenue.totalInvoiced).toBe(150)
    expect(summary.revenue.totalPaid).toBe(75)
    expect(summary.revenue.totalOutstanding).toBe(75)
    expect(summary.revenue.totalOverdue).toBe(75)
    expect(summary.invoices.total).toBe(2)
    expect(summary.invoices.partialPaid).toBe(1)
    expect(summary.payments.total).toBe(1)
    expect(summary.customers.totalActive).toBe(2)
    expect(summary.customers.topByRevenue[0]).toMatchObject({ customerId: 'cust-1', revenue: 75 })
  })

  it('builds aging buckets and revenue recognition', async () => {
    const service = await import('@/lib/financial-service')

    queryQueue.push(
      [
        {
          id: 'inv-cur',
          ref: 'INV-CUR',
          customerId: 'cust-1',
          amountDue: '20.00',
          dueDate: new Date('2026-06-08T00:00:00.000Z'),
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
        },
        {
          id: 'inv-31',
          ref: 'INV-31',
          customerId: 'cust-2',
          amountDue: '30.00',
          dueDate: new Date('2026-05-08T00:00:00.000Z'),
          createdAt: new Date('2026-05-01T00:00:00.000Z'),
        },
      ],
      [
        { id: 'cust-1', name: 'Alpha Co' },
        { id: 'cust-2', name: 'Beta Co' },
      ],
      [
        {
          invoiceId: 'inv-cur',
          amount: '20.00',
          paidAt: new Date('2026-06-08T00:00:00.000Z'),
        },
      ],
      [
        {
          id: 'inv-cur',
          customerId: 'cust-1',
          amountDue: '0.00',
        },
      ],
      [{ id: 'cust-1', name: 'Alpha Co' }],
      [
        {
          id: 'inv-31',
          amountDue: '30.00',
          issuedAt: new Date('2026-05-01T00:00:00.000Z'),
          status: 'sent',
        },
      ],
    )

    const aging = await service.getAgingReport('org-1')
    expect(aging.current.count).toBe(1)
    expect(aging.days60.count).toBe(1)
    expect(aging.total.amount).toBe(50)

    const recognition = await service.getRevenueRecognition(
      'org-1',
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-06-30T00:00:00.000Z'),
    )

    expect(recognition.recognizedRevenue).toBe(20)
    expect(recognition.deferredRevenue).toBe(30)
    expect(recognition.byMonth).toHaveLength(1)
    expect(recognition.byCustomer[0]).toMatchObject({ customerId: 'cust-1', recognized: 20 })
  })
})
