import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  createRequestContext: vi.fn(),
  runWithContext: vi.fn(),
}))

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: mocks.auth,
}))

vi.mock('@nzila/os-core/telemetry', () => ({
  createRequestContext: mocks.createRequestContext,
  runWithContext: mocks.runWithContext,
}))

import { authenticateUser, withRequestContext } from './api-guards'

describe('api-guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'user_1' })
    mocks.createRequestContext.mockReturnValue({ requestId: 'req-1' })
    mocks.runWithContext.mockImplementation((_ctx, handler) => handler())
  })

  it('authenticateUser returns ok when user exists', async () => {
    const result = await authenticateUser()
    expect(result).toEqual({ ok: true, userId: 'user_1' })
  })

  it('authenticateUser returns 401 when user is missing', async () => {
    mocks.auth.mockResolvedValue({ userId: null })

    const result = await authenticateUser()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
      await expect(result.response.json()).resolves.toEqual({ error: 'Unauthorized' })
    }
  })

  it('withRequestContext creates context and runs handler in context', async () => {
    const req = new NextRequest('http://localhost/api/sessions')
    const handler = vi.fn().mockResolvedValue({ ok: true })

    const result = await withRequestContext(req, handler)

    expect(mocks.createRequestContext).toHaveBeenCalledWith(req, { appName: 'nacp-exams' })
    expect(mocks.runWithContext).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ ok: true })
  })
})
