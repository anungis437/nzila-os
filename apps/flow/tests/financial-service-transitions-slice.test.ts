import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { qSelect, qLimit, qInsertReturning, qUpdateReturning, mockLoggerInfo } = vi.hoisted(() => ({
  qSelect: [] as unknown[][],
  qLimit: [] as unknown[][],
  qInsertReturning: [] as unknown[][],
  qUpdateReturning: [] as unknown[][],
  mockLoggerInfo: vi.fn(),
}))

const shiftQueue = (queue: unknown[][]) => Promise.resolve((queue.shift() ?? []) as never)

vi.mock('drizzle-orm', () => ({
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  eq: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
  inArray: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
  or: vi.fn(() => ({})),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((text, segment, index) => text + segment + (values[index] ?? ''), ''),
  ),
}))

vi.mock('@nzila/db', () => {
  const selectChain = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => selectChain),
    orderBy: vi.fn(() => selectChain),
    limit: vi.fn(() => shiftQueue(qLimit)),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      shiftQueue(qSelect).then(resolve, reject),
  }

  const insertAfterValues = {
    returning: vi.fn(() => shiftQueue(qInsertReturning)),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(undefined).then(resolve, reject),
  }

  const insertChain = {
    values: vi.fn(() => insertAfterValues),
  }

  const updateAfterWhere = {
    returning: vi.fn(() => shiftQueue(qUpdateReturning)),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(undefined).then(resolve, reject),
  }

  const updateChain = {
    set: vi.fn(() => updateChain),
    where: vi.fn(() => updateAfterWhere),
  }

  return {
    db: {
      select: vi.fn(() => selectChain),
      insert: vi.fn(() => insertChain),
      update: vi.fn(() => updateChain),
    },
    commerceOrders: {
      id: 'id',
      customerId: 'customerId',
      currency: 'currency',
      subtotal: 'subtotal',
      taxTotal: 'taxTotal',
      total: 'total',
    },
    commerceOrderLines: {
      id: 'id',
      orderId: 'orderId',
      description: 'description',
      quantity: 'quantity',
      unitPrice: 'unitPrice',
      lineTotal: 'lineTotal',
    },
    commerceCustomers: {
      id: 'id',
      name: 'name',
      email: 'email',
    },
    commerceInvoices: {
      id: 'id',
      orgId: 'orgId',
      customerId: 'customerId',
      orderId: 'orderId',
      ref: 'ref',
      status: 'status',
      total: 'total',
      amountPaid: 'amountPaid',
      amountDue: 'amountDue',
      issuedAt: 'issuedAt',
      metadata: 'metadata',
      createdAt: 'createdAt',
      dueDate: 'dueDate',
    },
    commerceInvoiceLines: {
      id: 'id',
      invoiceId: 'invoiceId',
      orderLineId: 'orderLineId',
      description: 'description',
      quantity: 'quantity',
      unitPrice: 'unitPrice',
      lineTotal: 'lineTotal',
      sortOrder: 'sortOrder',
    },
    commercePayments: {
      id: 'id',
      invoiceId: 'invoiceId',
      orgId: 'orgId',
      amount: 'amount',
      method: 'method',
      reference: 'reference',
      paidAt: 'paidAt',
    },
  }
})

vi.mock('@/lib/logger', () => ({
  logger: {
    info: mockLoggerInfo,
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@nzila/platform-commerce-org/defaults', () => ({
  SHOPMOICA_SETTINGS: {
    invoicePrefix: 'MOCA',
  },
  SHOPMOICA_PAYMENT_POLICY: {
    defaultPaymentTermsDays: 14,
  },
}))

describe('financial service transitions slice', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-08T00:00:00.000Z'))
    qSelect.length = 0
    qLimit.length = 0
    qInsertReturning.length = 0
    qUpdateReturning.length = 0
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('covers invoice creation and lifecycle transitions', async () => {
    const service = await import('@/lib/financial-service')

    qLimit.push(
      [{ ref: 'MOCA-2026-0007' }],
      [{ id: 'ord-1', customerId: 'cust-1', currency: 'CAD', subtotal: '10.00', taxTotal: '1.50', total: '11.50' }],
      [{ id: 'cust-1', name: 'Acme', email: 'billing@acme.test' }],
      [{ id: 'inv-1', ref: 'MOCA-2026-0008', status: 'draft', amountPaid: '0', amountDue: '11.50', total: '11.50', metadata: {}, issuedAt: null }],
      [{ id: 'inv-2', ref: 'MOCA-2026-0009', status: 'issued', amountPaid: '0', amountDue: '11.50', total: '11.50', metadata: {}, issuedAt: new Date('2026-06-08T00:00:00.000Z') }],
      [{ id: 'inv-3', ref: 'MOCA-2026-0010', status: 'draft', amountPaid: '0', amountDue: '11.50', total: '11.50', metadata: {}, issuedAt: null }],
      [{ id: 'inv-void', ref: 'MOCA-2026-0012', status: 'sent', amountPaid: '0', amountDue: '11.50', total: '11.50', metadata: {}, issuedAt: new Date('2026-06-08T00:00:00.000Z') }],
    )

    qSelect.push([{ id: 'ol-1', description: 'Line 1', quantity: 1, unitPrice: '10.00', lineTotal: '10.00' }])

    qInsertReturning.push(
      [{ id: 'inv-new', ref: 'MOCA-2026-0008', customerId: 'cust-1', orderId: 'ord-1' }],
      [{ id: 'il-1' }],
    )

    qUpdateReturning.push(
      [{ id: 'inv-1', status: 'issued' }],
      [{ id: 'inv-2', status: 'sent' }],
      [{ id: 'inv-void', status: 'refunded' }],
    )

    const created = await service.createInvoiceFromOrder({ orgId: 'org-1', orderId: 'ord-1', userId: 'user-1' })
    expect(created.invoice.ref).toBe('MOCA-2026-0008')
    expect(created.lines).toHaveLength(1)

    await expect(service.issueInvoice('inv-1')).resolves.toMatchObject({ status: 'issued' })
    await expect(service.sendInvoice('inv-2')).resolves.toMatchObject({ status: 'sent' })
    await expect(service.voidInvoice('inv-void', 'duplicate')).resolves.toMatchObject({ status: 'refunded' })
  })

  it('blocks void when invoice has payments', async () => {
    const service = await import('@/lib/financial-service')

    qLimit.push([
      {
        id: 'inv-paid',
        ref: 'MOCA-2026-0999',
        status: 'sent',
        amountPaid: '5',
        amountDue: '6.50',
        total: '11.50',
        metadata: {},
        issuedAt: new Date('2026-06-08T00:00:00.000Z'),
      },
    ])

    await expect(service.voidInvoice('inv-paid', 'should fail')).rejects.toThrow('Cannot void invoice with payments')
  })

  it('covers payment recording success and guard rails', async () => {
    const service = await import('@/lib/financial-service')

    qLimit.push(
      [{ id: 'inv-pay', orgId: 'org-1', amountDue: '10.00', amountPaid: '2.00', total: '12.00' }],
      [{ id: 'inv-over', orgId: 'org-1', amountDue: '3.00', amountPaid: '0.00', total: '3.00' }],
      [],
    )

    qInsertReturning.push([{ id: 'pay-1' }])

    await expect(
      service.recordPayment({ invoiceId: 'inv-pay', amount: 5, method: 'card', reference: 'txn-1' }),
    ).resolves.toMatchObject({ id: 'pay-1' })

    await expect(
      service.recordPayment({ invoiceId: 'inv-over', amount: 5, method: 'card' }),
    ).rejects.toThrow('exceeds amount due')

    await expect(service.recordPayment({ invoiceId: 'missing', amount: 1, method: 'cash' })).rejects.toThrow('not found')
  })

  it('covers list/get payment and lifecycle edge branches', async () => {
    const service = await import('@/lib/financial-service')

    qSelect.push([])
    await expect(service.listInvoices({ orgId: 'org-1' })).resolves.toEqual([])

    qSelect.push(
      [
        {
          id: 'inv-list-1',
          orgId: 'org-1',
          customerId: 'cust-1',
          orderId: 'ord-1',
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
          status: 'sent',
          amountDue: '10.00',
          amountPaid: '0.00',
          total: '10.00',
          dueDate: new Date('2026-06-20T00:00:00.000Z'),
        },
      ],
      [{ id: 'line-1', invoiceId: 'inv-list-1', description: 'Line', quantity: 1, unitPrice: '10.00', lineTotal: '10.00', sortOrder: 0 }],
      [{ id: 'pay-1', invoiceId: 'inv-list-1', amount: '3.00', method: 'card', paidAt: new Date('2026-06-02T00:00:00.000Z') }],
      [{ id: 'cust-1', name: 'Acme Corp' }],
      [{ id: 'ord-1', customerId: 'cust-1', total: '10.00' }],
    )

    const listed = await service.listInvoices({
      orgId: 'org-1',
      status: ['sent', 'issued'],
      customerId: 'cust-1',
      dateFrom: new Date('2026-06-01T00:00:00.000Z'),
      dateTo: new Date('2026-06-30T00:00:00.000Z'),
      overdue: true,
    })
    expect(listed).toHaveLength(1)
    expect(listed[0]).toMatchObject({
      invoice: { id: 'inv-list-1' },
      customer: { id: 'cust-1' },
      order: { id: 'ord-1' },
    })
    expect(listed[0].lines).toHaveLength(1)
    expect(listed[0].payments).toHaveLength(1)

    qLimit.push([])
    await expect(service.getInvoice('missing-invoice')).resolves.toBeNull()

    qLimit.push(
      [{ id: 'inv-get-1', customerId: 'cust-9', orderId: 'ord-9' }],
      [{ id: 'cust-9', name: 'Northwind' }],
      [{ id: 'ord-9', customerId: 'cust-9' }],
    )
    qSelect.push([{ id: 'line-9', invoiceId: 'inv-get-1' }], [{ id: 'pay-9', invoiceId: 'inv-get-1' }])
    await expect(service.getInvoice('inv-get-1')).resolves.toMatchObject({
      invoice: { id: 'inv-get-1' },
      customer: { id: 'cust-9' },
      order: { id: 'ord-9' },
    })

    qSelect.push([
      { id: 'p1', invoiceId: 'inv-get-1', amount: '2.00', paidAt: new Date('2026-06-02T00:00:00.000Z') },
      { id: 'p2', invoiceId: 'inv-get-1', amount: '3.00', paidAt: new Date('2026-06-03T00:00:00.000Z') },
    ])
    await expect(service.getPaymentsByInvoice('inv-get-1')).resolves.toHaveLength(2)

    qLimit.push([])
    await expect(service.issueInvoice('inv-none')).rejects.toThrow('Invoice not found or already issued')

    qLimit.push([{ id: 'inv-draft', ref: 'MOCA-2026-1010', status: 'draft', issuedAt: null, amountPaid: '0', amountDue: '10.00', total: '10.00', metadata: {} }])
    qUpdateReturning.push([{ id: 'inv-draft', status: 'sent', issuedAt: new Date('2026-06-08T00:00:00.000Z') }])
    await expect(service.sendInvoice('inv-draft')).resolves.toMatchObject({ status: 'sent' })

    qLimit.push([])
    await expect(service.sendInvoice('inv-no-send')).rejects.toThrow('Invoice not found or cannot be sent')

    qLimit.push([])
    await expect(service.voidInvoice('inv-no-void')).rejects.toThrow('Invoice not found')

    qLimit.push([{ id: 'inv-pay-full', orgId: 'org-1', amountDue: '5.00', amountPaid: '0.00', total: '5.00' }])
    qInsertReturning.push([{ id: 'pay-full' }])
    await expect(
      service.recordPayment({ invoiceId: 'inv-pay-full', amount: 5, method: 'wire', reference: 'full-settle' }),
    ).resolves.toMatchObject({ id: 'pay-full' })

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      'Payment recorded',
      expect.objectContaining({ invoiceId: 'inv-pay-full', newStatus: 'paid' }),
    )
  })

  it('covers financial summary, aging buckets, and revenue recognition branches', async () => {
    const service = await import('@/lib/financial-service')

    qSelect.push(
      [
        {
          id: 'inv-a',
          customerId: 'cust-a',
          total: '100.00',
          amountDue: '20.00',
          amountPaid: '80.00',
          status: 'partial_paid',
          dueDate: new Date('2026-05-20T00:00:00.000Z'),
          createdAt: new Date('2026-05-01T00:00:00.000Z'),
        },
        {
          id: 'inv-b',
          customerId: 'cust-b',
          total: '40.00',
          amountDue: '0.00',
          amountPaid: '40.00',
          status: 'paid',
          dueDate: new Date('2026-06-20T00:00:00.000Z'),
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
        },
      ],
      [
        { id: 'pay-a', amount: '25.00', method: 'card', paidAt: new Date('2026-06-01T00:00:00.000Z') },
        { id: 'pay-b', amount: '15.00', method: 'wire', paidAt: new Date('2026-06-02T00:00:00.000Z') },
      ],
      [
        { id: 'cust-a', name: 'Alpha Co' },
        { id: 'cust-b', name: 'Beta Co' },
      ],
      [
        {
          id: 'age-current',
          ref: 'MOCA-2026-2001',
          customerId: 'cust-a',
          amountDue: '10.00',
          dueDate: new Date('2026-06-20T00:00:00.000Z'),
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
        },
        {
          id: 'age-30',
          ref: 'MOCA-2026-2002',
          customerId: 'cust-missing',
          amountDue: '11.00',
          dueDate: new Date('2026-06-01T00:00:00.000Z'),
          createdAt: new Date('2026-05-01T00:00:00.000Z'),
        },
        {
          id: 'age-90plus',
          ref: 'MOCA-2026-2003',
          customerId: 'cust-a',
          amountDue: '12.00',
          dueDate: new Date('2026-01-01T00:00:00.000Z'),
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      [{ id: 'cust-a', name: 'Alpha Co' }],
      [
        { invoiceId: 'inv-rr-1', amount: '30.00', paidAt: new Date('2026-06-01T00:00:00.000Z') },
        { invoiceId: 'inv-rr-2', amount: '20.00', paidAt: new Date('2026-06-10T00:00:00.000Z') },
      ],
      [
        { id: 'inv-rr-1', customerId: 'cust-a' },
        { id: 'inv-rr-2', customerId: 'cust-missing' },
      ],
      [{ id: 'cust-a', name: 'Alpha Co' }],
      [
        { id: 'out-1', amountDue: '9.00' },
        { id: 'out-2', amountDue: '1.00' },
      ],
    )

    const summary = await service.getFinancialSummary(
      'org-1',
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-06-30T00:00:00.000Z'),
    )
    expect(summary.revenue.totalInvoiced).toBe(140)
    expect(summary.revenue.totalPaid).toBe(40)
    expect(summary.payments.byMethod).toHaveLength(2)

    const aging = await service.getAgingReport('org-1')
    expect(aging.current.count).toBe(1)
    expect(aging.days30.count).toBe(1)
    expect(aging.days90Plus.count).toBe(1)

    const recognition = await service.getRevenueRecognition(
      'org-1',
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-06-30T00:00:00.000Z'),
    )
    expect(recognition.recognizedRevenue).toBe(50)
    expect(recognition.deferredRevenue).toBe(10)
    expect(recognition.byCustomer).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ customerId: 'cust-a', name: 'Alpha Co' }),
        expect.objectContaining({ customerId: 'cust-missing', name: 'Unknown' }),
      ]),
    )
  })

  it('covers financial delta branches for ref parsing, strict guards, fallback mappings, and empty recognition paths', async () => {
    const service = await import('@/lib/financial-service')

    qLimit.push([])
    await expect(service.createInvoiceFromOrder({ orgId: 'org-1', orderId: 'ord-missing', userId: 'u-1' })).rejects.toThrow(
      'Order ord-missing not found',
    )

    qLimit.push(
      [{ id: 'ord-no-cust', customerId: 'cust-missing', currency: 'CAD', subtotal: '10.00', taxTotal: '1.00', total: '11.00' }],
      [],
    )
    qSelect.push([{ id: 'ol-no-cust', description: 'Line', quantity: 1, unitPrice: '10.00', lineTotal: '10.00' }])
    await expect(service.createInvoiceFromOrder({ orgId: 'org-1', orderId: 'ord-no-cust', userId: 'u-1' })).rejects.toThrow(
      'Customer cust-missing not found',
    )

    qLimit.push(
      [{ ref: 'BROKEN-REF' }],
      [{ id: 'ord-parse', customerId: 'cust-parse', currency: 'CAD', subtotal: '5.00', taxTotal: '0.50', total: '5.50' }],
      [{ id: 'cust-parse', name: 'Parse Customer' }],
    )
    qSelect.push([{ id: 'ol-parse', description: 'Parse Line', quantity: 1, unitPrice: '5.00', lineTotal: '5.00' }])
    qInsertReturning.push([{ id: 'inv-parse', ref: 'MOCA-2026-0001', customerId: 'cust-parse', orderId: 'ord-parse' }], [{ id: 'il-parse' }])
    await expect(service.createInvoiceFromOrder({ orgId: 'org-1', orderId: 'ord-parse', userId: 'u-1' })).resolves.toMatchObject({
      invoice: { ref: 'MOCA-2026-0001' },
    })

    qLimit.push([{ id: 'inv-no-ref', orgId: 'org-1', amountDue: '4.00', amountPaid: '0.00', total: '4.00' }])
    qInsertReturning.push([{ id: 'pay-no-ref' }])
    await expect(service.recordPayment({ invoiceId: 'inv-no-ref', amount: 2, method: 'cash' })).resolves.toMatchObject({
      id: 'pay-no-ref',
    })

    qSelect.push(
      [
        {
          id: 'inv-fallback',
          orgId: 'org-1',
          customerId: 'cust-unknown',
          orderId: 'ord-unknown',
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
          status: 'sent',
          amountDue: '4.00',
          amountPaid: '0.00',
          total: '4.00',
          dueDate: new Date('2026-06-20T00:00:00.000Z'),
        },
      ],
      [],
      [],
      [],
      [],
    )
    await expect(service.listInvoices({ orgId: 'org-1', status: 'sent' })).resolves.toEqual([
      expect.objectContaining({ lines: [], payments: [], customer: undefined, order: undefined }),
    ])

    qSelect.push([
      {
        id: 'age-60',
        ref: 'MOCA-2026-3001',
        customerId: 'cust-age',
        amountDue: '6.00',
        dueDate: null,
        createdAt: new Date('2026-04-20T00:00:00.000Z'),
      },
      {
        id: 'age-90',
        ref: 'MOCA-2026-3002',
        customerId: 'cust-age-missing',
        amountDue: '7.00',
        dueDate: new Date('2026-03-25T00:00:00.000Z'),
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      },
    ], [{ id: 'cust-age', name: 'Aging Customer' }])
    const aging = await service.getAgingReport('org-1')
    expect(aging.days60.count).toBe(1)
    expect(aging.days90.count).toBe(1)

    qSelect.push([], [])
    await expect(
      service.getRevenueRecognition(
        'org-1',
        new Date('2026-05-01T00:00:00.000Z'),
        new Date('2026-06-30T00:00:00.000Z'),
      ),
    ).resolves.toMatchObject({ recognizedRevenue: 0, byMonth: [], byCustomer: [] })
  })

  it('covers residual financial branches for matched ref increment and existing-month aggregation', async () => {
    const service = await import('@/lib/financial-service')

    qLimit.push(
      [{ ref: 'MOCA-2026-0099' }],
      [{ id: 'ord-inc', customerId: 'cust-inc', currency: 'CAD', subtotal: '10.00', taxTotal: '0.00', total: '10.00' }],
      [{ id: 'cust-inc', name: 'Increment Customer' }],
    )
    qSelect.push([{ id: 'ol-inc', description: 'Line', quantity: 1, unitPrice: '10.00', lineTotal: '10.00' }])
    qInsertReturning.push([{ id: 'inv-inc', ref: 'MOCA-2026-0100', customerId: 'cust-inc', orderId: 'ord-inc' }], [{ id: 'il-inc' }])

    await expect(service.createInvoiceFromOrder({ orgId: 'org-1', orderId: 'ord-inc', userId: 'u-1' })).resolves.toMatchObject({
      invoice: { ref: 'MOCA-2026-0100' },
    })

    qSelect.push(
      [
        {
          id: 'inv-month',
          customerId: 'cust-month',
          total: '30.00',
          amountPaid: '5.00',
          amountDue: '25.00',
          status: 'partial_paid',
          dueDate: new Date('2026-06-20T00:00:00.000Z'),
          createdAt: new Date('2026-06-05T00:00:00.000Z'),
        },
      ],
      [{ id: 'pay-month', amount: '7.00', method: 'card', paidAt: new Date('2026-06-10T00:00:00.000Z') }],
      [{ id: 'cust-month', name: 'Month Customer' }],
      [],
      [],
      [
        { invoiceId: 'inv-rc', amount: '7.00', paidAt: new Date('2026-06-10T00:00:00.000Z') },
      ],
      [{ id: 'inv-rc', customerId: 'cust-month' }],
      [{ id: 'cust-month', name: 'Month Customer' }],
      [{ id: 'out-rc', amountDue: '3.00' }],
    )

    const summary = await service.getFinancialSummary(
      'org-1',
      new Date('2026-06-01T00:00:00.000Z'),
      new Date('2026-06-30T00:00:00.000Z'),
    )
    expect(summary.trends.monthlyRevenue).toEqual([
      expect.objectContaining({ month: '2026-06', invoiced: 30, paid: 7 }),
    ])

    await expect(service.getAgingReport('org-empty')).resolves.toMatchObject({
      total: { count: 0, amount: 0 },
    })

    const recognition = await service.getRevenueRecognition(
      'org-1',
      new Date('2026-06-01T00:00:00.000Z'),
      new Date('2026-06-30T00:00:00.000Z'),
    )
    expect(recognition.recognizedRevenue).toBeGreaterThanOrEqual(0)
  })

  it('covers remaining financial ref, summary, and recognition fallback branches', async () => {
    const service = await import('@/lib/financial-service')

    qLimit.push(
      [{ id: 'ord-no-latest', customerId: 'cust-no-latest', currency: 'CAD', subtotal: '10.00', taxTotal: '0.00', total: '10.00' }],
      [{ id: 'cust-no-latest', name: 'No Latest Customer' }],
      [],
    )
    qSelect.push([{ id: 'ol-no-latest', description: 'Line', quantity: 1, unitPrice: '10.00', lineTotal: '10.00' }])
    qInsertReturning.push(
      [{ id: 'inv-no-latest', ref: 'MOCA-2026-0001', customerId: 'cust-no-latest', orderId: 'ord-no-latest' }],
      [{ id: 'il-no-latest' }],
    )
    await expect(service.createInvoiceFromOrder({ orgId: 'org-1', orderId: 'ord-no-latest', userId: 'u-1' })).resolves.toMatchObject({
      invoice: { ref: 'MOCA-2026-0001' },
    })

    qLimit.push(
      [{ id: 'ord-bad-latest', customerId: 'cust-bad-latest', currency: 'CAD', subtotal: '10.00', taxTotal: '0.00', total: '10.00' }],
      [{ id: 'cust-bad-latest', name: 'Bad Latest Customer' }],
      [{ ref: 'MOCA-2026-0099' }],
    )
    qSelect.push([{ id: 'ol-bad-latest', description: 'Line', quantity: 1, unitPrice: '10.00', lineTotal: '10.00' }])
    qInsertReturning.push(
      [{ id: 'inv-bad-latest', ref: 'MOCA-2026-0001', customerId: 'cust-bad-latest', orderId: 'ord-bad-latest' }],
      [{ id: 'il-bad-latest' }],
    )
    await expect(
      service.createInvoiceFromOrder(
        { orgId: 'org-1', orderId: 'ord-bad-latest', userId: 'u-1' },
        { invoicePrefix: 'ZZZ' } as never,
      ),
    ).resolves.toMatchObject({
      invoice: { ref: 'MOCA-2026-0001' },
    })

    qSelect.push([], [])
    await expect(
      service.getFinancialSummary('org-empty', new Date('2026-06-01T00:00:00.000Z'), new Date('2026-06-30T00:00:00.000Z')),
    ).resolves.toMatchObject({
      revenue: { totalInvoiced: 0, totalPaid: 0 },
      customers: { totalActive: 0 },
    })

    qSelect.push(
      [
        {
          id: 'inv-unknown',
          customerId: 'cust-unknown',
          total: '10.00',
          amountPaid: '5.00',
          amountDue: '5.00',
          status: 'partial_paid',
          dueDate: new Date('2026-06-20T00:00:00.000Z'),
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
        },
      ],
      [],
      [],
    )
    const summary = await service.getFinancialSummary(
      'org-1',
      new Date('2026-06-01T00:00:00.000Z'),
      new Date('2026-06-30T00:00:00.000Z'),
    )
    expect(summary.customers.topByRevenue[0]).toMatchObject({ customerId: 'cust-unknown', name: 'Unknown' })

    qSelect.push(
      [
        {
          id: 'inv-month-fallback',
          customerId: 'cust-month-fallback',
          total: '10.00',
          amountPaid: '0.00',
          amountDue: '10.00',
          status: 'sent',
          dueDate: new Date('2026-06-20T00:00:00.000Z'),
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
        },
      ],
      [{ id: 'pay-month-fallback', amount: '7.00', method: 'card', paidAt: new Date('2026-07-10T00:00:00.000Z') }],
      [{ id: 'cust-month-fallback', name: 'Month Fallback' }],
    )
    const monthlySummary = await service.getFinancialSummary(
      'org-1',
      new Date('2026-06-01T00:00:00.000Z'),
      new Date('2026-07-31T00:00:00.000Z'),
    )
    expect(monthlySummary.trends.monthlyRevenue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ month: '2026-06', invoiced: 10, paid: 0 }),
        expect.objectContaining({ month: '2026-07', invoiced: 0, paid: 7 }),
      ]),
    )

    qSelect.push(
      [{ invoiceId: 'missing-invoice', amount: '4.00', paidAt: new Date('2026-06-15T00:00:00.000Z') }],
      [],
      [],
      [],
    )
    const recognition = await service.getRevenueRecognition(
      'org-1',
      new Date('2026-06-01T00:00:00.000Z'),
      new Date('2026-06-30T00:00:00.000Z'),
    )
    expect(recognition.recognizedRevenue).toBe(4)
    expect(recognition.byCustomer).toEqual([])
  })

  it('covers isolated invoice ref generation fallbacks', async () => {
    const service = await import('@/lib/financial-service')

    qLimit.push(
      [{ id: 'ord-ref-a', customerId: 'cust-ref-a', currency: 'CAD', subtotal: '10.00', taxTotal: '0.00', total: '10.00' }],
      [{ id: 'cust-ref-a', name: 'Ref A' }],
      [],
    )
    qSelect.push([{ id: 'ol-ref-a', description: 'Line', quantity: 1, unitPrice: '10.00', lineTotal: '10.00' }])
    qInsertReturning.push(
      [{ id: 'inv-ref-a', ref: 'MOCA-2026-0001', customerId: 'cust-ref-a', orderId: 'ord-ref-a' }],
      [{ id: 'il-ref-a' }],
    )
    await expect(service.createInvoiceFromOrder({ orgId: 'org-1', orderId: 'ord-ref-a', userId: 'u-1' })).resolves.toMatchObject({
      invoice: { ref: 'MOCA-2026-0001' },
    })

    qLimit.push(
      [{ id: 'ord-ref-b', customerId: 'cust-ref-b', currency: 'CAD', subtotal: '10.00', taxTotal: '0.00', total: '10.00' }],
      [{ id: 'cust-ref-b', name: 'Ref B' }],
      [{ ref: 'MOCA-2026-0099' }],
    )
    qSelect.push([{ id: 'ol-ref-b', description: 'Line', quantity: 1, unitPrice: '10.00', lineTotal: '10.00' }])
    qInsertReturning.push(
      [{ id: 'inv-ref-b', ref: 'ZZZ-2026-0001', customerId: 'cust-ref-b', orderId: 'ord-ref-b' }],
      [{ id: 'il-ref-b' }],
    )
    await expect(
      service.createInvoiceFromOrder(
        { orgId: 'org-1', orderId: 'ord-ref-b', userId: 'u-1' },
        { invoicePrefix: 'ZZZ' } as never,
      ),
    ).resolves.toMatchObject({ invoice: { ref: 'ZZZ-2026-0001' } })

    qLimit.push(
      [{ id: 'ord-ref-c', customerId: 'cust-ref-c', currency: 'CAD', subtotal: '10.00', taxTotal: '0.00', total: '10.00' }],
      [{ id: 'cust-ref-c', name: 'Ref C' }],
      [{ ref: 'MOCA-2026-0099' }],
    )
    qSelect.push([{ id: 'ol-ref-c', description: 'Line', quantity: 1, unitPrice: '10.00', lineTotal: '10.00' }])
    qInsertReturning.push(
      [{ id: 'inv-ref-c', ref: 'MOCA-2026-0100', customerId: 'cust-ref-c', orderId: 'ord-ref-c' }],
      [{ id: 'il-ref-c' }],
    )
    await expect(service.createInvoiceFromOrder({ orgId: 'org-1', orderId: 'ord-ref-c', userId: 'u-1' })).resolves.toMatchObject({
      invoice: { ref: 'MOCA-2026-0100' },
    })
  })
})
