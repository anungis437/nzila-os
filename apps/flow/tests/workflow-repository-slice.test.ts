import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockSelectLimit,
  mockSelectOrderBy,
  mockOnConflictDoNothing,
} = vi.hoisted(() => ({
  mockSelectLimit: vi.fn(),
  mockSelectOrderBy: vi.fn(),
  mockOnConflictDoNothing: vi.fn(),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
}))

vi.mock('@nzila/db', () => {
  const selectTail = {
    limit: mockSelectLimit,
    orderBy: mockSelectOrderBy,
  }
  const selectChain = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => selectTail),
  }
  const insertChain = {
    values: vi.fn(() => insertChain),
    onConflictDoNothing: mockOnConflictDoNothing,
  }
  const updateChain = {
    set: vi.fn(() => updateChain),
    where: vi.fn(() => updateChain),
  }
  return {
    db: {
      select: vi.fn(() => selectChain),
      insert: vi.fn(() => insertChain),
      update: vi.fn(() => updateChain),
    },
    commerceQuoteApprovals: { id: 'id', quoteId: 'quoteId', createdAt: 'createdAt' },
    commerceQuoteRevisions: { id: 'id', quoteId: 'quoteId', createdAt: 'createdAt' },
    commercePaymentRequirements: { quoteId: 'quoteId' },
    commercePaymentTracking: { id: 'id', quoteId: 'quoteId' },
    commercePaymentEvents: { quoteId: 'quoteId', createdAt: 'createdAt' },
    commerceTimelineEvents: { quoteId: 'quoteId', createdAt: 'createdAt' },
  }
})

describe('workflow repository slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('covers approval/revision/payment/timeline repositories and helper', async () => {
    const {
      approvalRepo,
      revisionRepo,
      paymentRequirementRepo,
      paymentStatusRepo,
      paymentEventRepo,
      timelineRepo,
      recordTimelineEvent,
    } = await import('@/lib/repositories/workflow-repository')

    await approvalRepo.save({
      id: 'a-1',
      quoteId: 'q-1',
      action: 'ACCEPT',
      customerName: 'Jane',
      customerEmail: 'jane@example.com',
      message: '',
      sourceIpHash: null,
      shareLinkId: 'sl-1',
      createdAt: new Date(),
    })

    mockSelectOrderBy.mockResolvedValueOnce([
      {
        id: 'a-1',
        quoteId: 'q-1',
        action: 'ACCEPT',
        customerName: 'Jane',
        customerEmail: 'jane@example.com',
        message: '',
        sourceIpHash: null,
        shareLinkId: 'sl-1',
        createdAt: new Date(),
      },
    ])
    expect((await approvalRepo.findByQuoteId('q-1')).length).toBe(1)

    mockSelectLimit.mockResolvedValueOnce([])
    expect(await approvalRepo.findById('missing')).toBeUndefined()

    mockSelectLimit.mockResolvedValueOnce([
      {
        id: 'a-1',
        quoteId: 'q-1',
        action: 'REQUEST_REVISION',
        customerName: 'Jane',
        customerEmail: 'jane@example.com',
        message: 'rev',
        sourceIpHash: null,
        shareLinkId: 'sl-1',
        createdAt: new Date(),
      },
    ])
    expect((await approvalRepo.findById('a-1'))?.action).toBe('REQUEST_REVISION')

    await revisionRepo.save({
      id: 'r-1',
      quoteId: 'q-1',
      requestedBy: 'Jane',
      requestMessage: 'Change',
      status: 'OPEN',
      resolvedAt: null,
      createdAt: new Date(),
    })

    mockSelectOrderBy.mockResolvedValueOnce([
      {
        id: 'r-1',
        quoteId: 'q-1',
        requestedBy: 'Jane',
        requestMessage: 'Change',
        status: 'OPEN',
        resolvedAt: null,
        createdAt: new Date(),
      },
      {
        id: 'r-2',
        quoteId: 'q-1',
        requestedBy: 'Jane',
        requestMessage: 'Done',
        status: 'CLOSED',
        resolvedAt: new Date(),
        createdAt: new Date(),
      },
    ])
    expect((await revisionRepo.findByQuoteId('q-1')).length).toBe(2)

    mockSelectOrderBy.mockResolvedValueOnce([
      {
        id: 'r-1',
        quoteId: 'q-1',
        requestedBy: 'Jane',
        requestMessage: 'Change',
        status: 'OPEN',
        resolvedAt: null,
        createdAt: new Date(),
      },
    ])
    expect((await revisionRepo.findOpenByQuoteId('q-1')).length).toBe(1)
    await revisionRepo.updateStatus('r-1', 'ADDRESSED')

    await paymentRequirementRepo.save({
      id: 'pr-1',
      quoteId: 'q-1',
      depositRequired: true,
      depositPercent: 20,
      depositAmount: 100,
      dueBeforeProduction: true,
      createdAt: new Date(),
    })

    mockSelectLimit.mockResolvedValueOnce([])
    expect(await paymentRequirementRepo.findByQuoteId('none')).toBeUndefined()
    mockSelectLimit.mockResolvedValueOnce([
      {
        id: 'pr-1',
        quoteId: 'q-1',
        depositRequired: true,
        depositPercent: '20',
        depositAmount: '100',
        dueBeforeProduction: true,
        createdAt: new Date(),
      },
    ])
    expect((await paymentRequirementRepo.findByQuoteId('q-1'))?.depositPercent).toBe(20)

    await paymentStatusRepo.save({
      id: 'ps-1',
      quoteId: 'q-1',
      status: 'PARTIALLY_PAID',
      amountDue: 500,
      amountPaid: 100,
      updatedAt: new Date(),
    })

    mockSelectLimit.mockResolvedValueOnce([
      {
        id: 'ps-1',
        quoteId: 'q-1',
        status: 'PARTIALLY_PAID',
        amountDue: '500',
        amountPaid: '100',
        updatedAt: new Date(),
      },
    ])
    expect((await paymentStatusRepo.findByQuoteId('q-1'))?.amountDue).toBe(500)

    mockSelectLimit.mockResolvedValueOnce([
      {
        id: 'ps-1',
        quoteId: 'q-1',
        status: 'PARTIALLY_PAID',
        amountDue: '500',
        amountPaid: '100',
        updatedAt: new Date(),
      },
    ])
    const updated = await paymentStatusRepo.upsertForQuote('q-1', { amountPaid: 400 })
    expect(updated.amountPaid).toBe(400)

    mockSelectLimit.mockResolvedValueOnce([])
    const inserted = await paymentStatusRepo.upsertForQuote('q-2', { status: 'NOT_REQUIRED', amountDue: 0 })
    expect(inserted.quoteId).toBe('q-2')

    await paymentEventRepo.save({
      id: 'pe-1',
      quoteId: 'q-1',
      eventType: 'DEPOSIT_REQUESTED',
      amount: 100,
      providerRef: null,
      metadataJson: null,
      createdAt: new Date(),
    })

    mockSelectOrderBy.mockResolvedValueOnce([
      {
        id: 'pe-1',
        quoteId: 'q-1',
        eventType: 'PAYMENT_CONFIRMED',
        amount: '100',
        providerRef: null,
        metadata: {},
        createdAt: new Date(),
      },
    ])
    expect((await paymentEventRepo.findByQuoteId('q-1'))[0]?.amount).toBe(100)

    await timelineRepo.add({
      id: 't-1',
      quoteId: 'q-1',
      event: 'created',
      description: 'Created',
      actor: 'u-1',
      timestamp: new Date(),
      metadata: {},
    })

    mockSelectOrderBy.mockResolvedValueOnce([
      {
        id: 't-1',
        quoteId: 'q-1',
        event: 'created',
        description: 'Created',
        actor: 'u-1',
        createdAt: new Date(),
        metadata: {},
      },
    ])
    expect((await timelineRepo.findByQuoteId('q-1')).length).toBe(1)

    await recordTimelineEvent({
      quoteId: 'q-1',
      event: 'updated',
      description: 'Updated',
      actor: 'u-2',
      metadata: { test: true },
    })
  })
})
