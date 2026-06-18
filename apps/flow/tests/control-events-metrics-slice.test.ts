import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockExecute,
  mockResolveOrgContext,
  mockSelectWhere,
  mockSelectLimit,
  mockSelectGroupBy,
} = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockResolveOrgContext: vi.fn(),
  mockSelectWhere: vi.fn(),
  mockSelectLimit: vi.fn(),
  mockSelectGroupBy: vi.fn(),
}))

vi.mock('@/lib/control/command-bus', () => ({ execute: mockExecute }))
vi.mock('@/lib/resolve-org', () => ({ resolveOrgContext: mockResolveOrgContext }))

vi.mock('@nzila/flow-engine', () => ({
  canGeneratePO: vi.fn(),
  canShipOrder: vi.fn(),
  canStartProduction: vi.fn(),
  explainBlock: vi.fn(),
  getPaymentGateState: vi.fn(),
  outstandingBalance: vi.fn(),
  requiresDeposit: vi.fn(),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
  count: vi.fn(() => 1),
  sum: vi.fn(() => 0),
}))

vi.mock('@nzila/db', () => {
  const selectChain = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => mockSelectWhere()),
    limit: mockSelectLimit,
    groupBy: mockSelectGroupBy,
  }
  return {
    db: { select: vi.fn(() => selectChain) },
    flowDomainEvents: { orgId: 'orgId', entityType: 'entityType', entityId: 'entityId', eventType: 'eventType', createdAt: 'createdAt' },
    commerceOrders: { orgId: 'orgId', status: 'status', paymentStatus: 'paymentStatus', total: 'total' },
  }
})

describe('control adapter + query slices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveOrgContext.mockResolvedValue({ orgId: 'org-1', actorId: 'u-1' })
  })

  it('control adapter handles success/failure and context construction', async () => {
    const { executeCommand, executeCommandV2, buildContext } = await import('@/lib/control/control-adapter')

    mockExecute.mockResolvedValueOnce({ success: false, errors: [{ message: 'A' }, { message: 'B' }] })
    const fail = await executeCommand({ type: 'x' })
    expect(fail.ok).toBe(false)
    expect(fail.error).toContain('A; B')

    mockExecute.mockResolvedValueOnce({ success: true, events: [] })
    const ok = await executeCommand({ type: 'x' })
    expect(ok.ok).toBe(true)

    mockExecute.mockResolvedValueOnce({ success: false, errors: [] })
    const failV2 = await executeCommandV2({ type: 'x' })
    expect(failV2.success).toBe(false)

    mockExecute.mockResolvedValueOnce({ success: true, events: [] })
    const okV2 = await executeCommandV2({ type: 'x' })
    expect(okV2.success).toBe(true)

    const ctx = await buildContext({ actor_id: 'override' })
    expect(ctx.org_id).toBe('org-1')
    expect(ctx.actor_id).toBe('override')
  })

  it('event queries and order metrics build expected results', async () => {
    const { queryFlowEvents, getEntityTimeline } = await import('@/lib/events/event-queries')
    const { getOrderStatusDistribution, getOrderPipelineSummary, getRecentEventActivity } = await import('@/queries/order-metrics')

    mockSelectWhere.mockReturnValueOnce({ orderBy: () => ({ limit: mockSelectLimit }) })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'e-1' }])
    expect((await queryFlowEvents({ orgId: 'org-1' })).length).toBe(1)

    mockSelectWhere.mockReturnValueOnce({ orderBy: () => ({ limit: mockSelectLimit }) })
    mockSelectLimit.mockResolvedValueOnce([{ id: 'e-2' }])
    expect((await getEntityTimeline('org-1', 'quote', 'q-1')).length).toBe(1)

    mockSelectWhere.mockReturnValueOnce({ groupBy: mockSelectGroupBy })
    mockSelectGroupBy.mockResolvedValueOnce([{ status: 'confirmed', count: 2 }])
    expect((await getOrderStatusDistribution('org-1'))[0]?.status).toBe('confirmed')

    mockSelectWhere.mockResolvedValueOnce([{ totalOrders: 4, totalValue: '120.5' }])
    mockSelectWhere.mockReturnValueOnce({ groupBy: mockSelectGroupBy })
    mockSelectGroupBy.mockResolvedValueOnce([{ status: 'draft', count: 1 }])
    mockSelectWhere.mockResolvedValueOnce([{ count: 1 }])
    const summary = await getOrderPipelineSummary('org-1')
    expect(summary.totalOrders).toBe(4)
    expect(summary.totalValue).toBe(120.5)

    mockSelectWhere.mockReturnValueOnce({ groupBy: mockSelectGroupBy })
    mockSelectGroupBy.mockResolvedValueOnce([{ eventType: 'quote_created', count: 3 }])
    expect((await getRecentEventActivity('org-1'))[0]?.eventType).toBe('quote_created')
  })

  it('covers payment-gating compatibility exports', async () => {
    const mod = await import('@/lib/services/order-payment-gating')
    expect(mod.canGeneratePO).toBeTruthy()
    expect(mod.canShipOrder).toBeTruthy()
    expect(mod.canStartProduction).toBeTruthy()
    expect(mod.explainBlock).toBeTruthy()
    expect(mod.getPaymentGateState).toBeTruthy()
    expect(mod.outstandingBalance).toBeTruthy()
    expect(mod.requiresDeposit).toBeTruthy()
  })
})
