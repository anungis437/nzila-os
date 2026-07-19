import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  logInfo: vi.fn(),
}))

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: mocks.auth,
}))

vi.mock('@nzila/os-core/telemetry', () => ({
  createLogger: () => ({
    info: mocks.logInfo,
  }),
}))

import { POST } from './route'

describe('POST /api/onboarding/activation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'user_1' })
  })

  it('returns 401 when user is unauthenticated', async () => {
    mocks.auth.mockResolvedValue({ userId: null })
    const req = new Request('http://localhost/api/onboarding/activation', {
      method: 'POST',
      body: JSON.stringify({ action: 'complete' }),
    })

    const response = await POST(req as never)
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' })
  })

  it('returns 400 for invalid payload', async () => {
    const req = new Request('http://localhost/api/onboarding/activation', {
      method: 'POST',
      body: JSON.stringify({ action: 'invalid' }),
    })

    const response = await POST(req as never)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBeDefined()
  })

  it('returns success payload and logs activation event', async () => {
    const req = new Request('http://localhost/api/onboarding/activation', {
      method: 'POST',
      body: JSON.stringify({
        action: 'complete',
        step: 'tool_connect',
        timestamp: '2026-01-01T00:00:00.000Z',
        data: {
          companyType: 'clinic',
        },
      }),
    })

    const response = await POST(req as never)
    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.ok).toBe(true)
    expect(body.data).toEqual({
      userId: 'user_1',
      action: 'complete',
      step: 'tool_connect',
      timestamp: '2026-01-01T00:00:00.000Z',
      hasProfileData: true,
    })
    expect(mocks.logInfo).toHaveBeenCalledTimes(1)
  })

  it('uses defaults when optional fields are omitted', async () => {
    const req = new Request('http://localhost/api/onboarding/activation', {
      method: 'POST',
      body: JSON.stringify({
        action: 'skip',
      }),
    })

    const response = await POST(req as never)
    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.ok).toBe(true)
    expect(body.data.step).toBe('tool_connect')
    expect(body.data.hasProfileData).toBe(false)
    expect(typeof body.data.timestamp).toBe('string')
    expect(body.data.timestamp.length).toBeGreaterThan(0)
  })

  it('marks profile data true when revenue stage is provided', async () => {
    const req = new Request('http://localhost/api/onboarding/activation', {
      method: 'POST',
      body: JSON.stringify({
        action: 'complete',
        data: { revenueStage: 'growth' },
      }),
    })

    const response = await POST(req as never)
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.data.hasProfileData).toBe(true)
  })

  it('marks profile data true when team size is provided', async () => {
    const req = new Request('http://localhost/api/onboarding/activation', {
      method: 'POST',
      body: JSON.stringify({
        action: 'complete',
        data: { teamSize: '11-25' },
      }),
    })

    const response = await POST(req as never)
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.data.hasProfileData).toBe(true)
  })

  it('marks profile data true when main pain is provided', async () => {
    const req = new Request('http://localhost/api/onboarding/activation', {
      method: 'POST',
      body: JSON.stringify({
        action: 'complete',
        data: { mainPain: 'visibility' },
      }),
    })

    const response = await POST(req as never)
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.data.hasProfileData).toBe(true)
  })

  it('returns 500 when request parsing throws', async () => {
    const req = {
      json: vi.fn().mockRejectedValue(new Error('invalid json')),
    }

    const response = await POST(req as never)
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'invalid json' })
  })

  it('returns unknown error when non-Error value is thrown', async () => {
    const req = {
      json: vi.fn().mockRejectedValue('bad payload'),
    }

    const response = await POST(req as never)
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Unknown error' })
  })
})
