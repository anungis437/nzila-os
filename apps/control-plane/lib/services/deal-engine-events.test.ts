import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  persist: vi.fn(),
  query: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  followUp: vi.fn(),
  audit: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/db/adapters/events', () => ({
  createDbEventStore: () => ({ persist: m.persist, query: m.query }),
}))
vi.mock('@/db/adapters/automated-follow-ups', () => ({ createAutomatedFollowUp: m.followUp }))
vi.mock('./deal-engine-audit', () => ({ recordDealAudit: m.audit }))
vi.mock('@/lib/telemetry', () => ({ logger: { info: m.info, error: m.error } }))

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-17T12:00:00Z'))
  m.persist.mockResolvedValue(undefined)
  m.followUp.mockResolvedValue(undefined)
})
afterEach(() => vi.useRealTimers())

describe('moved event coordination with the real platform event bus', () => {
  it('persists before dispatch, suppresses the original correlation duplicate, and admits it after the existing TTL', async () => {
    const { emitDealEvent, onDealEvent, DEAL_ENGINE_EVENTS } = await import('./deal-engine-events')
    const dispatched = vi.fn(async () => {
      expect(m.persist).toHaveBeenCalled()
    })
    const unsubscribe = onDealEvent(DEAL_ENGINE_EVENTS.DEMO_COMPLETED, dispatched)
    const opts = { actorId: 'operator', tenantId: 'org', correlationId: 'correlation' }
    await emitDealEvent(DEAL_ENGINE_EVENTS.DEMO_COMPLETED, { dealId: 'deal' }, opts)
    await emitDealEvent(DEAL_ENGINE_EVENTS.DEMO_COMPLETED, { dealId: 'deal' }, opts)
    expect(m.persist).toHaveBeenCalledTimes(1)
    expect(dispatched).toHaveBeenCalledTimes(1)
    expect(m.persist).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { dealId: 'deal' },
        metadata: expect.objectContaining({
          tenantId: 'org',
          actorId: 'operator',
          source: 'control-plane:deal-engine',
        }),
      }),
    )
    vi.advanceTimersByTime(60_000)
    unsubscribe()
    await emitDealEvent(DEAL_ENGINE_EVENTS.DEMO_COMPLETED, { dealId: 'deal' }, opts)
    expect(m.persist).toHaveBeenCalledTimes(2)
    expect(dispatched).toHaveBeenCalledTimes(1)
  })
  it('retains the existing best-effort publish failure without dispatching an unpersisted event', async () => {
    const { emitDealEvent, onDealEvent, DEAL_ENGINE_EVENTS } = await import('./deal-engine-events')
    const dispatched = vi.fn()
    onDealEvent(DEAL_ENGINE_EVENTS.DEMO_COMPLETED, dispatched)
    m.persist.mockRejectedValueOnce(new Error('owned fixture event store unavailable'))
    await expect(
      emitDealEvent(
        DEAL_ENGINE_EVENTS.DEMO_COMPLETED,
        {},
        { actorId: 'operator', tenantId: 'org' },
      ),
    ).resolves.toBeUndefined()
    expect(dispatched).not.toHaveBeenCalled()
    expect(m.error).toHaveBeenCalledTimes(1)
  })
  it('registers automations once and retains actual payload/actor and follow-up timing', async () => {
    const { registerDealEngineAutomations } = await import('./deal-engine-automations')
    const { emitDealEvent, DEAL_ENGINE_EVENTS } = await import('./deal-engine-events')
    registerDealEngineAutomations()
    registerDealEngineAutomations()
    await emitDealEvent(
      DEAL_ENGINE_EVENTS.DEMO_COMPLETED,
      { dealId: 'deal', accountName: 'Synthetic account', actor: 'operator' },
      { actorId: 'operator', tenantId: 'org' },
    )
    expect(m.followUp).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        dealId: 'deal',
        accountName: 'Synthetic account',
        owner: 'operator',
        daysUntilDue: 3,
        trigger: 'automation:demo_completed',
      }),
    )
    expect(m.audit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        actor: 'operator',
        orgId: 'system',
        details: expect.objectContaining({ automation: 'demo_completed', dealId: 'deal' }),
      }),
    )
  })
})
