import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { requireApiAuth, requireAuditReadAuth, ApiAuthError, handleAuthError } from './api-auth'
import { createAuditorAccessToken } from './auditor-token'

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
    ;(process.env as any).NODE_ENV = originalEnv.NODE_ENV
  })

  it('allows in development when no key is configured', async () => {
    delete process.env.CONTROL_PLANE_API_KEY
    ;(process.env as any).NODE_ENV = 'development'
    const result = await requireApiAuth(makeRequest())
    expect(result).toEqual({ authenticated: true, role: 'admin' })
  })

  it('throws 500 when key not set in non-development', async () => {
    delete process.env.CONTROL_PLANE_API_KEY
    ;(process.env as any).NODE_ENV = 'production'
    await expect(requireApiAuth(makeRequest())).rejects.toThrow('Server misconfiguration')
    await expect(requireApiAuth(makeRequest())).rejects.toMatchObject({ status: 500 })
  })

  it('throws 401 when no api key header provided', async () => {
    process.env.CONTROL_PLANE_API_KEY = 'secret-key'
    ;(process.env as any).NODE_ENV = 'production'
    await expect(requireApiAuth(makeRequest())).rejects.toThrow('Unauthorized')
    await expect(requireApiAuth(makeRequest())).rejects.toMatchObject({ status: 401 })
  })

  it('throws 401 when wrong api key provided', async () => {
    process.env.CONTROL_PLANE_API_KEY = 'secret-key'
    ;(process.env as any).NODE_ENV = 'production'
    const req = makeRequest({ 'x-api-key': 'wrong-key' })
    await expect(requireApiAuth(req)).rejects.toThrow('Unauthorized')
  })

  it('allows access with correct api key', async () => {
    process.env.CONTROL_PLANE_API_KEY = 'my-key'
    ;(process.env as any).NODE_ENV = 'production'
    const req = makeRequest({ 'x-api-key': 'my-key' })
    const result = await requireApiAuth(req)
    expect(result).toEqual({ authenticated: true, role: 'admin' })
  })

  it('works without request argument in dev mode', async () => {
    delete process.env.CONTROL_PLANE_API_KEY
    ;(process.env as any).NODE_ENV = 'development'
    const result = await requireApiAuth(undefined)
    expect(result).toEqual({ authenticated: true, role: 'admin' })
  })
})

describe('requireAuditReadAuth', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env.CONTROL_PLANE_API_KEY = originalEnv.CONTROL_PLANE_API_KEY
    process.env.AUDITOR_TOKEN_SECRET = originalEnv.AUDITOR_TOKEN_SECRET
    ;(process.env as any).NODE_ENV = originalEnv.NODE_ENV
  })

  it('accepts admin api key', async () => {
    process.env.CONTROL_PLANE_API_KEY = 'admin-key'
    ;(process.env as any).NODE_ENV = 'production'
    const result = await requireAuditReadAuth(makeRequest({ 'x-api-key': 'admin-key' }))
    expect(result).toEqual({ authenticated: true, role: 'admin' })
  })

  it('accepts valid auditor bearer token', async () => {
    process.env.AUDITOR_TOKEN_SECRET = 'auditor-secret'
    ;(process.env as any).NODE_ENV = 'production'

    const token = createAuditorAccessToken({
      organizationId: 'org-auditor',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      issuedBy: 'tester',
    })

    const result = await requireAuditReadAuth(makeRequest({ authorization: `Bearer ${token}` }))
    expect(result.role).toBe('auditor')
    if (result.role === 'auditor') {
      expect(result.organizationId).toBe('org-auditor')
    }
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

  it('returns sanitized 500 for non-ApiAuthError errors', async () => {
    const { NextResponse } = await import('next/server')
    const err = new Error('Something else')
    const response = handleAuthError(err)
    expect(NextResponse.json).toHaveBeenCalledWith(
      { ok: false, error: 'Internal server error' },
      { status: 500 },
    )
    expect(response).toEqual({ body: { ok: false, error: 'Internal server error' }, status: 500 })
  })
})
