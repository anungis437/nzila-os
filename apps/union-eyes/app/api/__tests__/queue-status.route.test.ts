import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAllQueueStats: vi.fn(),
  getFailedJobs: vi.fn(),
  requireApiAuth: vi.fn(),
  requireSystemAdmin: vi.fn(),
}))

vi.mock('@/lib/job-queue', () => ({
  getAllQueueStats: mocks.getAllQueueStats,
  getFailedJobs: mocks.getFailedJobs,
}))
vi.mock('@/lib/api-auth-guard', () => ({ requireApiAuth: mocks.requireApiAuth, requireSystemAdmin: mocks.requireSystemAdmin }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))

import { GET } from '../union-eyes/queue-status/route'

describe('queue status route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.DJANGO_API_URL
    delete process.env.NEXT_PUBLIC_DJANGO_API_URL
    mocks.requireApiAuth.mockResolvedValue({ userId: 'user-1' })
    mocks.requireSystemAdmin.mockResolvedValue(undefined)
  })

  afterEach(() => {
    delete process.env.DJANGO_API_URL
    delete process.env.NEXT_PUBLIC_DJANGO_API_URL
  })

  it('reports an unconfigured queue without fabricating zero depth', async () => {
    const response = await GET(new Request('http://localhost/api/union-eyes/queue-status'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.availability).toBe('not_configured')
    expect(body.queue).toBeNull()
    expect(mocks.getAllQueueStats).not.toHaveBeenCalled()
  })

  it('preserves real zero queue depth when telemetry is available', async () => {
    process.env.DJANGO_API_URL = 'https://django.local'
    mocks.getAllQueueStats.mockResolvedValue([])
    mocks.getFailedJobs.mockResolvedValue([])

    const response = await GET(new Request('http://localhost/api/union-eyes/queue-status'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.availability).toBe('available')
    expect(body.queue).toMatchObject({ pending: 0, active: 0, failed: 0, retry_count: 0 })
  })

  it('reports telemetry errors instead of fabricating zero depth', async () => {
    process.env.DJANGO_API_URL = 'https://django.local'
    mocks.getAllQueueStats.mockRejectedValue(new Error('sidecar unavailable'))
    mocks.getFailedJobs.mockResolvedValue([])

    const response = await GET(new Request('http://localhost/api/union-eyes/queue-status'))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.availability).toBe('error')
    expect(body.queue).toBeNull()
  })

  // DEF-0B12-PLT-QUEUE-STATUS-SERVICE-KEY-IS-THE-SHARED-AI-KEY-COMPARED-WITH-A-PLAIN-EQUALITY, issue #1118
  describe('machine path: QUEUE_STATUS_SERVICE_KEY only', () => {
    const QUEUE_KEY = 'queue-status-service-key-of-32-chars!!'
    const AI_KEY = 'ai-service-key-that-is-at-least-32-chars'
    const METRICS_KEY = 'ue-metrics-service-key-of-32-chars-long!'
    const withKey = (key: string) => GET(new Request('http://localhost/api/union-eyes/queue-status', { headers: { 'x-service-key': key } }))

    beforeEach(() => {
      process.env.DJANGO_API_URL = 'https://django.local'
      process.env.AI_SERVICE_KEY = AI_KEY
      process.env.UE_METRICS_SERVICE_KEY = METRICS_KEY
      mocks.getAllQueueStats.mockResolvedValue([])
      mocks.getFailedJobs.mockResolvedValue([])
      mocks.requireApiAuth.mockRejectedValue(new Error('no session'))
    })
    afterEach(() => {
      delete process.env.QUEUE_STATUS_SERVICE_KEY
      delete process.env.AI_SERVICE_KEY
      delete process.env.UE_METRICS_SERVICE_KEY
      vi.unstubAllEnvs()
    })

    it('accepts the dedicated key and refuses a wrong, different-length or empty key', async () => {
      process.env.QUEUE_STATUS_SERVICE_KEY = QUEUE_KEY
      expect((await withKey(QUEUE_KEY)).status).toBe(200)
      for (const wrong of [QUEUE_KEY.slice(0, -1) + 'X', 'short', '']) {
        expect((await withKey(wrong)).status).toBe(401)
      }
    })

    it('never accepts the AI or metrics key, in any environment, whether or not the dedicated key is set', async () => {
      for (const env of ['development', 'test', 'production']) {
        vi.stubEnv('NODE_ENV', env)
        delete process.env.QUEUE_STATUS_SERVICE_KEY
        expect((await withKey(AI_KEY)).status).toBe(401)
        expect((await withKey(METRICS_KEY)).status).toBe(401)
        process.env.QUEUE_STATUS_SERVICE_KEY = QUEUE_KEY
        expect((await withKey(AI_KEY)).status).toBe(401)
        expect((await withKey(METRICS_KEY)).status).toBe(401)
      }
      expect(mocks.getAllQueueStats).not.toHaveBeenCalled()
    })

    it.each([
      ['unset', undefined],
      ['shorter than 32 characters', 'short-queue-key'],
      ['the AI service key', AI_KEY],
      ['the metrics service key', METRICS_KEY],
    ])('answers 401 (not 503) and reads nothing when the configured key is %s, even to a caller presenting it', async (_label, value) => {
      if (value === undefined) delete process.env.QUEUE_STATUS_SERVICE_KEY
      else process.env.QUEUE_STATUS_SERVICE_KEY = value
      const response = await withKey(value ?? QUEUE_KEY)
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Unauthorized' })
      expect(mocks.getAllQueueStats).not.toHaveBeenCalled()
      expect(mocks.requireApiAuth).not.toHaveBeenCalled()
    })

    it('does not fall back to a platform administrator session when a key is presented and wrong', async () => {
      process.env.QUEUE_STATUS_SERVICE_KEY = QUEUE_KEY
      mocks.requireApiAuth.mockResolvedValue({ userId: 'admin' })
      expect((await withKey('not-the-key')).status).toBe(401)
      expect(mocks.requireSystemAdmin).not.toHaveBeenCalled()
    })

    it('returns infrastructure fields only: no job arguments, results or tracebacks reach the caller', async () => {
      process.env.QUEUE_STATUS_SERVICE_KEY = QUEUE_KEY
      mocks.getFailedJobs.mockResolvedValue([{
        task_id: 't1', task_name: 'notifications.send', status: 'FAILURE', date_done: '2026-11-05T00:00:00Z',
        args: ['member@example.org'], kwargs: { claimId: 'CANARY-CLAIM' }, result: 'CANARY-RESULT', traceback: 'CANARY-TRACE',
      }])
      const body = await (await withKey(QUEUE_KEY)).json()
      expect(body.queue.recent_failures).toEqual([{ task_id: 't1', task_name: 'notifications.send', status: 'FAILURE', date_done: '2026-11-05T00:00:00Z' }])
      expect(JSON.stringify(body)).not.toMatch(/CANARY|member@example\.org/)
    })
  })
})
