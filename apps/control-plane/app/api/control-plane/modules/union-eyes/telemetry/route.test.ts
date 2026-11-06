import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ requireApiAuth: vi.fn(), http: vi.fn() }))
vi.mock('@/lib/api-auth', () => ({
  requireApiAuth: mocks.requireApiAuth,
  handleAuthError: () => new Response('Unauthorized', { status: 401 }),
}))

import { GET } from './route'

const METRICS = 'dedicated-metrics-key-of-at-least-32-characters'
const QUEUE = 'separate-queue-status-secret-of-32-chars'
const AI = 'not-the-metrics-key-ai-secret-of-32-chars'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', mocks.http)
  mocks.requireApiAuth.mockResolvedValue({ authenticated: true, role: 'admin' })
  process.env.UNION_EYES_URL = 'https://union-eyes.test'
  process.env.UE_METRICS_SERVICE_KEY = METRICS
  process.env.QUEUE_STATUS_SERVICE_KEY = QUEUE
  process.env.AI_SERVICE_KEY = AI
  mocks.http.mockImplementation(async (url: string) => {
    if (url.endsWith('/api/health')) return new Response(JSON.stringify({ status: 'ok', version: '1', checks: { db: 'ok', queue: 'ok' } }), { status: 200 })
    if (url.endsWith('/api/metrics/operational')) return new Response(JSON.stringify({ sla_violations: null, workflow_transition_rate: null, error_rate: null, queue_depth: 6 }), { status: 200 })
    if (url.endsWith('/api/union-eyes/queue-status')) return new Response(JSON.stringify({ queue: { pending: 2, active: 1, failed: 0, retry_count: 0 } }), { status: 200 })
    throw new Error('unexpected endpoint')
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.UNION_EYES_URL
  delete process.env.UE_METRICS_SERVICE_KEY
  delete process.env.QUEUE_STATUS_SERVICE_KEY
  delete process.env.AI_SERVICE_KEY
})

describe('Control Plane telemetry: bounded non-AI service identities', () => {
  it('routes the right dedicated credential only to its own endpoint', async () => {
    const res = await GET(new Request('https://control-plane.test/api/control-plane/modules/union-eyes/telemetry'))
    expect(res.status).toBe(200)
    const [health, metrics, queue] = mocks.http.mock.calls
    expect(health[0]).toBe('https://union-eyes.test/api/health')
    expect(health[1].headers).not.toHaveProperty('x-service-key')
    expect(metrics[1].headers['x-service-key']).toBe(METRICS)
    expect(queue[1].headers['x-service-key']).toBe(QUEUE)
    for (const [,opts] of mocks.http.mock.calls) expect(opts.headers['x-service-key']).not.toBe(AI)
    const body = await res.json()
    expect(body.data.sla.violations).toBeNull()
    expect(body.data.queue.active).toBe(1)
  })

  it('does not call privileged endpoints when credentials are absent, even if AI key exists', async () => {
    delete process.env.UE_METRICS_SERVICE_KEY
    delete process.env.QUEUE_STATUS_SERVICE_KEY
    const body = await (await GET(new Request('https://control-plane.test/telemetry'))).json()
    expect(mocks.http).toHaveBeenCalledTimes(1)
    expect(body.data.health.status).toBe('ok')
    expect(body.data.sla.violations).toBeNull()
    expect(body.data.queue.active).toBeNull()
  })

  it('refuses secret reuse rather than silently extending the AI service capability', async () => {
    process.env.UE_METRICS_SERVICE_KEY = AI
    process.env.QUEUE_STATUS_SERVICE_KEY = AI
    await GET(new Request('https://control-plane.test/telemetry'))
    expect(mocks.http).toHaveBeenCalledTimes(1)
  })

  it('returns an unauthorized response without fetching before Control Plane API authentication', async () => {
    mocks.requireApiAuth.mockRejectedValue(new Error('not authenticated'))
    expect((await GET(new Request('https://control-plane.test/telemetry'))).status).toBe(401)
    expect(mocks.http).not.toHaveBeenCalled()
  })
})
