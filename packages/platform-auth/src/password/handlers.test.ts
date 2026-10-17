import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { login } from './auth-service'
import { handleLogin } from './handlers'

vi.mock('./auth-service', () => ({
  signup: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  getAuthUser: vi.fn(),
}))

describe('password login HTTP response', () => {
  beforeEach(() => vi.resetAllMocks())

  const request = () =>
    new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'synthetic@example.invalid', password: 'synthetic-password' }),
    })

  it('preserves the real MFA challenge without issuing a session cookie', async () => {
    const expiresAt = new Date('2030-01-01T00:05:00Z')
    vi.mocked(login).mockResolvedValue({
      success: true,
      user: {
        id: 'synthetic',
        email: 'synthetic@example.invalid',
        firstName: null,
        lastName: null,
      },
      requiresMfa: true,
      mfaChallengeToken: 'synthetic-opaque-challenge',
      mfaChallengeExpiresAt: expiresAt,
    })
    const response = await handleLogin(request())
    expect(response.status).toBe(200)
    expect(response.headers.has('set-cookie')).toBe(false)
    expect(await response.json()).toEqual({
      user: {
        id: 'synthetic',
        email: 'synthetic@example.invalid',
        firstName: null,
        lastName: null,
      },
      requiresMfa: true,
      mfaChallengeToken: 'synthetic-opaque-challenge',
      mfaChallengeExpiresAt: expiresAt.toISOString(),
    })
  })

  it('preserves the normal non-MFA response shape', async () => {
    const user = {
      id: 'synthetic',
      email: 'synthetic@example.invalid',
      firstName: null,
      lastName: null,
    }
    vi.mocked(login).mockResolvedValue({ success: true, user })
    const response = await handleLogin(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ user })
  })

  it('keeps denied authentication denied and does not disclose a challenge', async () => {
    vi.mocked(login).mockResolvedValue({ success: false, error: 'Invalid credentials' })
    const response = await handleLogin(request())
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Invalid credentials' })
    expect(response.headers.has('set-cookie')).toBe(false)
  })
})
