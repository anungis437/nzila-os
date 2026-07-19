import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockResolveOrgContext,
  mockExecuteCommand,
  mockQuoteFindById,
  mockCreateShareLink,
  mockFindShareLinksForQuote,
  mockSetPaymentRequirement,
  mockRecordPayment,
  mockEvaluatePOReadiness,
  mockEvaluateProductionReadiness,
  mockGetOrgPaymentPolicy,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockResolveOrgContext: vi.fn(),
  mockExecuteCommand: vi.fn(),
  mockQuoteFindById: vi.fn(),
  mockCreateShareLink: vi.fn(),
  mockFindShareLinksForQuote: vi.fn(),
  mockSetPaymentRequirement: vi.fn(),
  mockRecordPayment: vi.fn(),
  mockEvaluatePOReadiness: vi.fn(),
  mockEvaluateProductionReadiness: vi.fn(),
  mockGetOrgPaymentPolicy: vi.fn(),
  mockLoggerError: vi.fn(),
}))

vi.mock('@/lib/resolve-org', () => ({
  resolveOrgContext: mockResolveOrgContext,
}))

vi.mock('@/lib/control/control-adapter', () => ({
  executeCommand: mockExecuteCommand,
}))

vi.mock('@/lib/db', () => ({
  quoteRepo: { findById: mockQuoteFindById },
}))

vi.mock('@/lib/services/share-link-service', () => ({
  createShareLink: mockCreateShareLink,
  findShareLinksForQuote: mockFindShareLinksForQuote,
}))

vi.mock('@/lib/services/payment-gating-service', () => ({
  setPaymentRequirement: mockSetPaymentRequirement,
  recordPayment: mockRecordPayment,
  evaluatePOReadiness: mockEvaluatePOReadiness,
  evaluateProductionReadiness: mockEvaluateProductionReadiness,
}))

vi.mock('@nzila/platform-commerce-org/defaults', () => ({
  SHOPMOICA_SETTINGS: { shareLinkExpiryDays: 14 },
}))

vi.mock('@nzila/platform-commerce-org/service', () => ({
  getOrgPaymentPolicy: mockGetOrgPaymentPolicy,
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: mockLoggerError },
}))

describe('send-quote and payment actions slices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveOrgContext.mockResolvedValue({ orgId: 'org-1', actorId: 'user-1' })
    mockExecuteCommand.mockResolvedValue({ ok: true })
    mockQuoteFindById.mockResolvedValue({ id: 'q-1', total: 1000 })
    mockCreateShareLink.mockResolvedValue({ rawToken: 'token-1' })
    mockFindShareLinksForQuote.mockResolvedValue([{ id: 'link-1' }])
    mockSetPaymentRequirement.mockResolvedValue({ id: 'req-1' })
    mockRecordPayment.mockResolvedValue({ newStatus: 'PAYMENT_COMPLETE' })
    mockEvaluatePOReadiness.mockResolvedValue({ ready: true, blockers: [] })
    mockEvaluateProductionReadiness.mockResolvedValue({ ready: false, blockers: ['missing vendor'] })
    mockGetOrgPaymentPolicy.mockResolvedValue({
      depositRequired: true,
      defaultDepositPercent: 50,
      depositRequiredBeforeProduction: true,
    })
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'
  })

  it('submitForReview/sendQuote/getShareLinks actions handle success and failure paths', async () => {
    const mod = await import('@/lib/send-quote-actions')

    expect(await mod.submitForReviewAction('q-1')).toEqual({ ok: true, data: { status: 'INTERNAL_REVIEW' } })

    const sent = await mod.sendQuoteToClientAction({
      quoteId: '00000000-0000-0000-0000-000000000001',
      expiresInDays: 7,
    })
    expect(sent.ok).toBe(true)
    expect(sent.data?.shareLinkUrl).toContain('/quote/token-1')

    const links = await mod.getQuoteShareLinksAction('q-1')
    expect(links).toEqual({ ok: true, data: { links: [{ id: 'link-1' }] } })

    mockExecuteCommand.mockResolvedValueOnce({ ok: false, error: 'blocked' })
    expect(await mod.submitForReviewAction('q-2')).toEqual({ ok: false, error: 'blocked' })

    mockQuoteFindById.mockResolvedValueOnce(null)
    expect(
      await mod.sendQuoteToClientAction({
        quoteId: '00000000-0000-0000-0000-000000000002',
        expiresInDays: 7,
      }),
    ).toEqual({ ok: false, error: 'Quote not found' })
  })

  it('sendQuoteToClient catches zod parse/runtime errors', async () => {
    const mod = await import('@/lib/send-quote-actions')

    const invalid = await mod.sendQuoteToClientAction({ quoteId: 'bad', expiresInDays: 7 } as never)
    expect(invalid.ok).toBe(false)
  })

  it('payment actions cover command failure, readiness checks, and policy auto-apply', async () => {
    const mod = await import('@/lib/payment-actions')

    expect(
      await mod.setDepositRequirementAction({
        quoteId: 'q-1',
        depositRequired: true,
        depositPercent: 50,
      } as never),
    ).toEqual({ ok: true, data: { requirementId: 'req-1' } })

    expect(
      await mod.recordPaymentAction({ quoteId: 'q-1', amount: 100, providerRef: 'ref-1' } as never),
    ).toEqual({ ok: true, data: { newStatus: 'PAYMENT_COMPLETE' } })

    expect(await mod.checkPOReadinessAction('q-1')).toEqual({ ok: true, data: { ready: true, blockers: [] } })
    expect(await mod.checkProductionReadinessAction('q-1', 'o-1')).toEqual({
      ok: true,
      data: { ready: false, blockers: ['missing vendor'] },
    })

    const auto = await mod.autoApplyOrgDepositPolicyAction('q-1')
    expect(auto).toEqual({ ok: true, data: { requirementId: 'req-1', depositRequired: true } })

    mockExecuteCommand.mockResolvedValueOnce({ ok: false, error: 'denied' })
    expect(
      await mod.setDepositRequirementAction({ quoteId: 'q-2', depositRequired: true } as never),
    ).toEqual({ ok: false, error: 'denied' })

    mockExecuteCommand.mockResolvedValueOnce({ ok: false, error: 'denied' })
    expect(
      await mod.recordPaymentAction({ quoteId: 'q-2', amount: 1, providerRef: 'x' } as never),
    ).toEqual({ ok: false, error: 'denied' })

    mockQuoteFindById.mockResolvedValueOnce(null)
    expect(await mod.autoApplyOrgDepositPolicyAction('q-missing')).toEqual({ ok: false, error: 'Quote not found' })
  })

  it('payment actions return catch-path errors and log failures', async () => {
    const mod = await import('@/lib/payment-actions')

    mockSetPaymentRequirement.mockRejectedValueOnce(new Error('set failed'))
    const setRes = await mod.setDepositRequirementAction({ quoteId: 'q-1', depositRequired: true } as never)
    expect(setRes.ok).toBe(false)

    mockRecordPayment.mockRejectedValueOnce(new Error('record failed'))
    const recordRes = await mod.recordPaymentAction({ quoteId: 'q-1', amount: 10, providerRef: 'r' } as never)
    expect(recordRes.ok).toBe(false)

    mockEvaluatePOReadiness.mockRejectedValueOnce(new Error('po failed'))
    const poRes = await mod.checkPOReadinessAction('q-1')
    expect(poRes.ok).toBe(false)

    mockEvaluateProductionReadiness.mockRejectedValueOnce(new Error('prod failed'))
    const prodRes = await mod.checkProductionReadinessAction('q-1', 'o-1')
    expect(prodRes.ok).toBe(false)

    mockGetOrgPaymentPolicy.mockRejectedValueOnce(new Error('policy failed'))
    const autoRes = await mod.autoApplyOrgDepositPolicyAction('q-1')
    expect(autoRes.ok).toBe(false)

    expect(mockLoggerError).toHaveBeenCalled()
  })
})
