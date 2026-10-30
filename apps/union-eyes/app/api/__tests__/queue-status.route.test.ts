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

  // DEF-0B12-PLT-QUEUE-STATUS-SERVICE-KEY-IS-THE-SHARED-AI-KEY-COMPARED-WITH-A-PLAIN-EQUALITY
  it('accepts the control-plane service key, and refuses a wrong or different-length key without the admin path', async () => {
    process.env.AI_SERVICE_KEY = 'service-key-value'
    process.env.DJANGO_API_URL = 'https://django.local'
    mocks.getAllQueueStats.mockResolvedValue([])
    mocks.getFailedJobs.mockResolvedValue([])
    mocks.requireApiAuth.mockRejectedValue(new Error('no session'))

    const ok = await GET(new Request('http://localhost/api/union-eyes/queue-status', { headers: { 'x-service-key': 'service-key-value' } }))
    expect(ok.status).toBe(200)
    for (const wrong of ['service-key-valuX', 'short', '']) {
      const refused = await GET(new Request('http://localhost/api/union-eyes/queue-status', { headers: { 'x-service-key': wrong } }))
      expect(refused.status).toBe(401)
    }
    delete process.env.AI_SERVICE_KEY
  })
})