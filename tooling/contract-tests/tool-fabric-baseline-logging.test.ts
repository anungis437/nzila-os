import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  getDb: vi.fn(), insert: vi.fn(), values: vi.fn(), select: vi.fn(), from: vi.fn(),
  orderBy: vi.fn(), limit: vi.fn(), on: vi.fn(), onAny: vi.fn(), emit: vi.fn(), event: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('../../packages/os-core/src/telemetry/index', async (original) => ({
  ...await original<typeof import('../../packages/os-core/src/telemetry/index')>(),
  createLogger: () => state.logger,
}))
vi.mock('../../apps/nzila-hq/server/db/client', () => ({ getHqDb: state.getDb }))
vi.mock('../../apps/nzila-hq/server/db/schema', () => ({ auditLog: { occurredAt: 'time' } }))
vi.mock('../../packages/agri-events/src/index', () => ({
  createAgriEventBus: () => ({ on: state.on, onAny: state.onAny, emit: state.emit }),
  createAgriEvent: state.event,
  AgriEventTypes: { LOT_CERTIFIED: 'lot', SHIPMENT_CLOSED: 'shipment', PAYMENT_EXECUTED: 'payment' },
}))
import { recordAudit, listRecentAudit } from '../../apps/nzila-hq/server/db/audit'
import { emitAgriEvent } from '../../apps/agrimo/lib/events/agri-event-emitter'

const subscriptions = [...state.on.mock.calls]
const allHandler = state.onAny.mock.calls[0][0]
beforeEach(() => {
  vi.clearAllMocks()
  state.getDb.mockReturnValue(state)
  state.insert.mockReturnValue(state)
  state.select.mockReturnValue(state)
  state.from.mockReturnValue(state)
  state.orderBy.mockReturnValue(state)
  state.values.mockResolvedValue(undefined)
  state.limit.mockResolvedValue([])
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('N21 audit failure contract', () => {
  const entry = { actorUserId: 'private-user', actorRole: 'admin', action: 'edit.task' as const, resourceKind: 'task', metadata: { unchanged: true } }
  it('keeps the unconfigured database no-op and exact insert mapping', async () => {
    state.getDb.mockReturnValueOnce(null).mockReturnValueOnce(null)
    await recordAudit(entry)
    expect(await listRecentAudit()).toEqual([])
    expect(state.insert).not.toHaveBeenCalled()
    await recordAudit(entry)
    expect(state.values).toHaveBeenCalledWith({ ...entry, resourceId: null, ipAddress: null, userAgent: null })
    await listRecentAudit(7)
    expect(state.orderBy).toHaveBeenCalledWith('time')
    expect(state.limit).toHaveBeenCalledWith(7)
  })
  it('keeps []/void fallbacks, emits fixed diagnostics, and survives logger failure without audit recursion', async () => {
    state.values.mockRejectedValueOnce(new Error('private database payload'))
    state.limit.mockRejectedValueOnce(new Error('private query payload'))
    state.logger.error.mockImplementation(() => { throw new Error('logger unavailable') })
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    await expect(recordAudit(entry)).resolves.toBeUndefined()
    await expect(listRecentAudit()).resolves.toEqual([])
    expect(state.insert).toHaveBeenCalledTimes(1)
    expect(state.logger.error.mock.calls.map(call => call[0])).toEqual(['Audit insert failed', 'Audit list failed'])
    expect(stderr).toHaveBeenCalledTimes(2)
    expect(stderr.mock.calls.every(call => call[0] === '{"level":"error","message":"Structured diagnostic sink failed"}\n')).toBe(true)
  })
})

describe('N17 event transport and diagnostics', () => {
  const event = { type: 'lot', createdAt: 'time', payload: { unchanged: true }, metadata: { orgId: 'private-org' } }
  it('retains three subscriptions, exact transport body, and nonpropagating failed transport', async () => {
    expect(subscriptions.map(([type]) => type)).toEqual(['lot', 'shipment', 'payment'])
    vi.stubEnv('AGRI_WEBHOOK_URL', 'https://example.invalid/webhook')
    const fetch = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('fetch', fetch)
    await subscriptions[0][1](event)
    expect(fetch).toHaveBeenCalledWith('https://example.invalid/webhook', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: event.type, payload: event.payload, metadata: event.metadata }),
    })
    fetch.mockRejectedValue(new Error('private transport details'))
    state.logger.error.mockImplementation(() => { throw new Error('logger failed') })
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    for (const [, handler] of subscriptions) await expect(handler(event)).resolves.toBeUndefined()
    expect(state.logger.error.mock.calls.every(call => call[0] === 'Webhook delivery failed')).toBe(true)
  })
  it('retains emitted event and removes identifiers/payload from observability metadata', async () => {
    state.event.mockReturnValueOnce(event)
    expect(emitAgriEvent('lot' as never, 'org', 'actor', event.payload)).toBe(event)
    expect(state.event).toHaveBeenCalledWith('lot', event.payload, { orgId: 'org', actorId: 'actor', correlationId: expect.any(String) })
    expect(state.emit).toHaveBeenCalledExactlyOnceWith(event)
    await allHandler(event)
    expect(state.logger.info).toHaveBeenCalledWith('Agri event emitted', {
      type: 'lot', createdAt: 'time', orgId: '[REDACTED]', userId: '[REDACTED]',
    })
  })
})
