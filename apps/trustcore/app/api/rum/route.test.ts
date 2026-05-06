import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  handleRUMBeacon: vi.fn(),
}))

vi.mock('@nzila/platform-rum', () => ({
  handleRUMBeacon: mocks.handleRUMBeacon,
}))

describe('POST /api/rum', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleRUMBeacon.mockResolvedValue(new Response('ok', { status: 200 }))
  })

  it('delegates to handleRUMBeacon and returns its response', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/rum', {
      method: 'POST',
      body: JSON.stringify({ events: [] }),
    })
    const res = await POST(req)
    expect(mocks.handleRUMBeacon).toHaveBeenCalledOnce()
    expect(mocks.handleRUMBeacon).toHaveBeenCalledWith(req)
    expect(res.status).toBe(200)
  })

  it('passes through non-200 responses from handleRUMBeacon', async () => {
    mocks.handleRUMBeacon.mockResolvedValue(new Response('Too Large', { status: 413 }))
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/rum', { method: 'POST', body: 'x'.repeat(1000) })
    const res = await POST(req)
    expect(res.status).toBe(413)
  })
})
