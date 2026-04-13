import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { requireApiAuth, ApiAuthError, handleAuthError } from './api-auth'

// We need to mock next/server for NextResponse.json
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: ResponseInit) => ({ body, status: init?.status ?? 200 })),
  },
}))

function makeRequest(headers: Record<string, string> = {}): Request {
  return {
    headers: {
      get: (name: string) => headers[name] ?? null,
    },
  } as unknown as Request
}

describe('requireApiAuth', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env.CONTROL_PLANE_API_KEY = originalEnv.CONTROL_PLANE_API_KEY
    process.env.NODE_ENV = originalEnv.NODE_ENV
  })

  it('allows in development when no key is configured', async () => {
    delete process.env.CONTROL_PLANE_API_KEY
    process.env.NODE_ENV = 'development'
    const result = await requireApiAuth(makeRequest())
    expect(result).toEqual({ authenticated: true })
  })

  it('throws 500 when key not set in non-development', async () => {
    delete process.env.CONTROL_PLANE_API_KEY
    process.env.NODE_ENV = 'production'
    await expect(requireApiAuth(makeRequest())).rejects.toThrow('Server misconfiguration')
    await expect(requireApiAuth(makeRequest())).rejects.toMatchObject({ status: 500 })
  })

  it('throws 401 when no api key header provided', async () => {
    process.env.CONTROL_PLANE_API_KEY = 'secret-key'
    process.env.NODE_ENV = 'production'
    await expect(requireApiAuth(makeRequest())).rejects.toThrow('Unauthorized')
    await expect(requireApiAuth(makeRequest())).rejects.toMatchObject({ status: 401 })
  })

  it('throws 401 when wrong api key provided', async () => {
    process.env.CONTROL_PLANE_API_KEY = 'secret-key'
    process.env.NODE_ENV = 'production'
    const req = makeRequest({ 'x-api-key': 'wrong-key' })
    await expect(requireApiAuth(req)).rejects.toThrow('Unauthorized')
  })

  it('allows access with correct api key', async () => {
    process.env.CONTROL_PLANE_API_KEY = 'my-key'
    process.env.NODE_ENV = 'production'
    const req = makeRequest({ 'x-api-key': 'my-key' })
    const result = await requireApiAuth(req)
    expect(result).toEqual({ authenticated: true })
  })

  it('works without request argument in dev mode', async () => {
    delete process.env.CONTROL_PLANE_API_KEY
    process.env.NODE_ENV = 'development'
    const result = await requireApiAuth(undefined)
    expect(result).toEqual({ authenticated: true })
  })
})

describe('ApiAuthError', () => {
  it('sets message and status', () => {
    const err = new ApiAuthError('Unauthorized', 401)
    expect(err.message).toBe('Unauthorized')
    expect(err.status).toBe(401)
    expect(err.name).toBe('ApiAuthError')
    expect(err).toBeInstanceOf(Error)
  })
})

describe('handleAuthError', () => {
  it('returns NextResponse.json for ApiAuthError', async () => {
    const { NextResponse } = await import('next/server')
    const err = new ApiAuthError('Unauthorized', 401)
    const response = handleAuthError(err)
    expect(NextResponse.json).toHaveBeenCalledWith(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    )
    expect(response).toBeDefined()
  })

  it('rethrows non-ApiAuthError errors', () => {
    const err = new Error('Something else')
    expect(() => handleAuthError(err)).toThrow('Something else')
  })
})
