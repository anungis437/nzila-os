import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockSelect,
  mockValidateEnv,
  mockDefineRouting,
  mockCreateGovernedQuoteMachine,
  mockAttemptTransition,
  mockGetAvailableTransitions,
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockValidateEnv: vi.fn(() => ({ APP: 'flow' })),
  mockDefineRouting: vi.fn((cfg: unknown) => cfg),
  mockCreateGovernedQuoteMachine: vi.fn(() => ({ machine: true })),
  mockAttemptTransition: vi.fn(() => ({ ok: true, state: 'accepted', events: [] })),
  mockGetAvailableTransitions: vi.fn(() => ['approve', 'decline']),
}))

vi.mock('@nzila/db', () => ({
  db: {
    select: mockSelect,
  },
  commerceQuoteLines: { sku: 'sku', quantity: 'quantity', lineTotal: 'lineTotal', quoteId: 'quoteId' },
  commerceQuotes: { id: 'id', orgId: 'orgId', status: 'status' },
}))

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((arg: unknown) => arg),
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  inArray: vi.fn((a: unknown, b: unknown[]) => [a, b]),
  sql: vi.fn((s: TemplateStringsArray) => s.join('')),
}))

vi.mock('@nzila/os-core/config', () => ({
  validateEnv: mockValidateEnv,
}))

vi.mock('next-intl/routing', () => ({
  defineRouting: mockDefineRouting,
}))

vi.mock('@nzila/platform-commerce-org/defaults', () => ({
  SHOPMOICA_SETTINGS: { locale: 'en-CA' },
  SHOPMOICA_QUOTE_POLICY: {
    approvalThreshold: 1000,
    minMarginPercent: 20,
    maxDiscountWithoutApproval: 10,
    requireEvidenceForInvoice: true,
  },
}))

vi.mock('@nzila/commerce-governance', () => ({
  createGovernedQuoteMachine: mockCreateGovernedQuoteMachine,
  createApprovalRequiredGate: vi.fn(),
  createMarginFloorGate: vi.fn(),
  createDiscountCapGate: vi.fn(),
  createQuoteCompletenessGate: vi.fn(),
  createEvidenceRequiredGate: vi.fn(),
  evaluateGates: vi.fn(),
}))

vi.mock('@nzila/commerce-state', () => ({
  quoteMachine: { id: 'quoteMachine' },
  attemptTransition: mockAttemptTransition,
  getAvailableTransitions: mockGetAvailableTransitions,
}))

describe('small lib slices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('dashboard aggregates map quote outcomes and top won skus', async () => {
    const countChainWon = {
      from: vi.fn(() => countChainWon),
      where: vi.fn().mockResolvedValue([{ count: '4' }]),
    }
    const countChainLost = {
      from: vi.fn(() => countChainLost),
      where: vi.fn().mockResolvedValue([{ count: '3' }]),
    }
    const topSkusChain = {
      from: vi.fn(() => topSkusChain),
      innerJoin: vi.fn(() => topSkusChain),
      where: vi.fn(() => topSkusChain),
      groupBy: vi.fn(() => topSkusChain),
      orderBy: vi.fn(() => topSkusChain),
      limit: vi.fn().mockResolvedValue([{ sku: 'SKU-1', units: 9, lineValue: 1200 }]),
    }

    mockSelect
      .mockReturnValueOnce(countChainWon)
      .mockReturnValueOnce(countChainLost)
      .mockReturnValueOnce(topSkusChain)

    const aggregates = await import('@/lib/dashboard-aggregates')

    expect(await aggregates.getQuoteOutcomeCounts('org-1')).toEqual({ won: 4, lost: 3 })
    expect(await aggregates.getTopWonSkus('org-1', 1)).toEqual([{ sku: 'SKU-1', units: 9, lineValue: 1200 }])
  })

  it('dashboard aggregates use zero defaults and default top-sku limit', async () => {
    const countChainWon = {
      from: vi.fn(() => countChainWon),
      where: vi.fn().mockResolvedValue([]),
    }
    const countChainLost = {
      from: vi.fn(() => countChainLost),
      where: vi.fn().mockResolvedValue([{ count: undefined }]),
    }
    const topSkusChain = {
      from: vi.fn(() => topSkusChain),
      innerJoin: vi.fn(() => topSkusChain),
      where: vi.fn(() => topSkusChain),
      groupBy: vi.fn(() => topSkusChain),
      orderBy: vi.fn(() => topSkusChain),
      limit: vi.fn().mockResolvedValue([]),
    }

    mockSelect
      .mockReturnValueOnce(countChainWon)
      .mockReturnValueOnce(countChainLost)
      .mockReturnValueOnce(topSkusChain)

    const aggregates = await import('@/lib/dashboard-aggregates')

    expect(await aggregates.getQuoteOutcomeCounts('org-2')).toEqual({ won: 0, lost: 0 })
    expect(await aggregates.getTopWonSkus('org-2')).toEqual([])
    expect(topSkusChain.limit).toHaveBeenCalledWith(5)
  })

  it('env and locales modules expose validated values', async () => {
    const envModule = await import('@/lib/env')
    const localesModule = await import('@/lib/locales')

    expect(mockValidateEnv).toHaveBeenCalledWith('flow')
    expect(envModule.env).toEqual({ APP: 'flow' })
    expect(localesModule.locales).toEqual(['en-CA', 'fr-CA'])
    expect(mockDefineRouting).toHaveBeenCalledTimes(1)
    expect(localesModule.routing).toBeTruthy()
  })

  it('governed quote machine wrapper applies default and overridden policy values', async () => {
    const governedQuote = await import('@/lib/governed-quote')

    governedQuote.buildGovernedQuoteMachine()
    governedQuote.buildGovernedQuoteMachine(
      { approvalThreshold: 5000 },
      {
        approvalThreshold: 2000,
        minMarginPercent: 25,
        maxDiscountWithoutApproval: 5,
        requireEvidenceForInvoice: false,
      } as never,
    )

    expect(mockCreateGovernedQuoteMachine).toHaveBeenCalledTimes(2)
  })

  it('quote-machine wrapper delegates transitions and action lookup', async () => {
    const quoteMachine = await import('@/lib/quote-machine')

    const transition = quoteMachine.transitionQuote('draft' as never, 'submitted', { actorId: 'u1' } as never, 'quote-1')
    const actions = quoteMachine.availableQuoteActions('draft' as never, { actorId: 'u1' } as never, 'quote-1')

    expect(mockAttemptTransition).toHaveBeenCalledTimes(1)
    expect(mockGetAvailableTransitions).toHaveBeenCalledTimes(1)
    expect(transition).toEqual({ ok: true, state: 'accepted', events: [] })
    expect(actions).toEqual(['approve', 'decline'])
  })
})
