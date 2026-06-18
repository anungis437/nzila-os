import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockLogger,
  mockHubSpotUpsert,
  mockHubSpotCreateDeal,
  mockQuoteRepo,
  mockPaymentRequirementRepo,
  mockPaymentStatusRepo,
  mockPaymentEventRepo,
  mockRecordTimelineEvent,
  mockEmitWorkflowAuditEvent,
} = vi.hoisted(() => ({
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  mockHubSpotUpsert: vi.fn(),
  mockHubSpotCreateDeal: vi.fn(),
  mockQuoteRepo: { findById: vi.fn() },
  mockPaymentRequirementRepo: { save: vi.fn(), findByQuoteId: vi.fn() },
  mockPaymentStatusRepo: { upsertForQuote: vi.fn(), findByQuoteId: vi.fn() },
  mockPaymentEventRepo: { save: vi.fn() },
  mockRecordTimelineEvent: vi.fn(),
  mockEmitWorkflowAuditEvent: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({ logger: mockLogger }))

vi.mock('@nzila/crm-hubspot', () => ({
  HubSpotClient: class {
    upsertContact = mockHubSpotUpsert
    createDeal = mockHubSpotCreateDeal
  },
}))

vi.mock('@/lib/db', () => ({ quoteRepo: mockQuoteRepo }))
vi.mock('@/lib/repositories/workflow-repository', () => ({
  paymentRequirementRepo: mockPaymentRequirementRepo,
  paymentStatusRepo: mockPaymentStatusRepo,
  paymentEventRepo: mockPaymentEventRepo,
  recordTimelineEvent: mockRecordTimelineEvent,
}))
vi.mock('@/lib/services/workflow-audit-service', () => ({
  emitWorkflowAuditEvent: mockEmitWorkflowAuditEvent,
}))

describe('crm/payment/audit service slices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    delete process.env.HUBSPOT_API_KEY
  })

  it('crm-service handles disabled, failed, and successful hubspot flows', async () => {
    const { upsertFlowLead, createFlowDeal } = await import('@/lib/services/crm-service')

    expect(await upsertFlowLead({ email: 'a@example.com' } as never)).toBeNull()
    expect(await createFlowDeal({ name: 'Deal A' } as never)).toBeNull()

    process.env.HUBSPOT_API_KEY = 'key'
    mockHubSpotUpsert.mockResolvedValueOnce({ ok: false, error: 'bad' })
    expect(await upsertFlowLead({ email: 'b@example.com' } as never)).toBeNull()

    mockHubSpotUpsert.mockResolvedValueOnce({ ok: true, id: 'c-1' })
    expect(await upsertFlowLead({ email: 'c@example.com' } as never)).toBe('c-1')

    mockHubSpotCreateDeal.mockResolvedValueOnce({ ok: false, error: 'bad' })
    expect(await createFlowDeal({ name: 'Deal B' } as never)).toBeNull()

    mockHubSpotCreateDeal.mockResolvedValueOnce({ ok: true, id: 'd-1' })
    expect(await createFlowDeal({ name: 'Deal C' } as never)).toBe('d-1')
  })

  it('payment-gating set/record/evaluate readiness paths', async () => {
    const {
      setPaymentRequirement,
      recordPayment,
      evaluatePOReadiness,
      evaluateProductionReadiness,
    } = await import('@/lib/services/payment-gating-service')

    mockQuoteRepo.findById.mockResolvedValueOnce(null)
    await expect(
      setPaymentRequirement(
        { quoteId: '11111111-1111-4111-8111-111111111111', depositRequired: true, dueBeforeProduction: true },
        'u-1',
        'org-1',
      ),
    ).rejects.toThrow('Quote not found')

    mockQuoteRepo.findById.mockResolvedValueOnce({ id: 'q-1', total: '200' })
    await setPaymentRequirement(
      {
        quoteId: '11111111-1111-4111-8111-111111111111',
        depositRequired: true,
        depositPercent: 50,
        dueBeforeProduction: true,
      },
      'u-1',
      'org-1',
    )
    expect(mockPaymentStatusRepo.upsertForQuote).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      expect.objectContaining({ status: 'PENDING_DEPOSIT' }),
    )

    mockQuoteRepo.findById.mockResolvedValueOnce({ id: 'q-1', total: '200' })
    await setPaymentRequirement(
      {
        quoteId: '11111111-1111-4111-8111-111111111111',
        depositRequired: false,
        dueBeforeProduction: false,
      },
      'u-1',
      'org-1',
    )
    expect(mockPaymentStatusRepo.upsertForQuote).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      expect.objectContaining({ status: 'NOT_REQUIRED' }),
    )

    mockPaymentRequirementRepo.findByQuoteId.mockResolvedValue({ depositRequired: true })
    mockPaymentStatusRepo.findByQuoteId.mockResolvedValue({ amountPaid: 0, amountDue: 100, status: 'PENDING_DEPOSIT' })
    expect(
      (await recordPayment(
        { quoteId: '11111111-1111-4111-8111-111111111111', eventType: 'PAYMENT_RECORDED', amount: 20 },
        'u-1',
        'org-1',
      )).newStatus,
    ).toBe('PARTIALLY_PAID')

    mockPaymentRequirementRepo.findByQuoteId.mockResolvedValue({ depositRequired: true })
    mockPaymentStatusRepo.findByQuoteId.mockResolvedValue({ amountPaid: 80, amountDue: 100, status: 'PARTIALLY_PAID' })
    expect(
      (await recordPayment(
        { quoteId: '11111111-1111-4111-8111-111111111111', eventType: 'PAYMENT_RECORDED', amount: 20 },
        'u-1',
        'org-1',
      )).newStatus,
    ).toBe('PAID')

    mockQuoteRepo.findById.mockResolvedValueOnce(null)
    const poMissing = await evaluatePOReadiness('q-missing')
    expect(poMissing.ready).toBe(false)

    mockQuoteRepo.findById.mockResolvedValueOnce({ status: 'READY_FOR_PO', title: 'T', customerId: 'c', total: '10' })
    mockPaymentRequirementRepo.findByQuoteId.mockResolvedValueOnce({ depositRequired: true })
    mockPaymentStatusRepo.findByQuoteId.mockResolvedValueOnce({ status: 'PAID' })
    const poReady = await evaluatePOReadiness('q-1')
    expect(poReady.ready).toBe(true)

    mockQuoteRepo.findById.mockResolvedValueOnce({ status: 'ACCEPTED', title: 'T', customerId: 'c' })
    mockPaymentRequirementRepo.findByQuoteId.mockResolvedValueOnce({ depositRequired: true, dueBeforeProduction: true })
    mockPaymentStatusRepo.findByQuoteId.mockResolvedValueOnce({ status: 'PENDING_DEPOSIT' })
    const prodBlocked = await evaluateProductionReadiness('q-1', 'o-1')
    expect(prodBlocked.ready).toBe(false)
  })

})
