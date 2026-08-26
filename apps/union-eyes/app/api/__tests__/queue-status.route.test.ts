import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAllQueueStats: vi.fn(),
  getFailedJobs: vi.fn(),
  requireApiAuth: vi.fn(),
}))

vi.mock('@/lib/job-queue', () => ({
  getAllQueueStats: mocks.getAllQueueStats,
  getFailedJobs: mocks.getFailedJobs,
}))
vi.mock('@/lib/api-auth-guard', () => ({ requireApiAuth: mocks.requireApiAuth }))

import { GET } from '../union-eyes/queue-status/route'

describe('queue status route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.DJANGO_API_URL
    delete process.env.NEXT_PUBLIC_DJANGO_API_URL
    mocks.requireApiAuth.mockResolvedValue({ userId: 'user-1' })
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
})