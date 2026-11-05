import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[][],
  createSession: vi.fn(),
  setSessionCookie: vi.fn(),
  issueMfaChallenge: vi.fn(),
}))

vi.mock('./password/session', () => ({ createSession: state.createSession, setSessionCookie: state.setSessionCookie }))
vi.mock('./mfa/service', () => ({ issueMfaChallenge: state.issueMfaChallenge }))
vi.mock('./policy/service', () => ({ getOrgAuthPolicy: async () => ({ mfaRequiredForRoles: [] }) }))
vi.mock('./auth-db', () => {
  const builder = () => {
    const query: Record<string, unknown> = {
      from: () => query,
      where: () => query,
      limit: () => query,
      then: (resolve: (rows: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(state.rows.shift() ?? []).then(resolve, reject),
    }
    return query
  }
  return { authDb: { select: builder } }
})

import { completeAuthFirstFactor } from './complete-auth'

describe('first-factor completion (magic link, invite acceptance) issues a session only to a live account', () => {
  beforeEach(() => {
    state.rows = []
    state.createSession.mockReset().mockResolvedValue({ token: 'raw', session: { expiresAt: new Date(Date.now() + 1000) } })
    state.setSessionCookie.mockReset()
    state.issueMfaChallenge.mockReset()
  })

  it.each([
    ['suspended', { active: false, lifecycle: 'suspended', mfa: false }],
    ['deprovisioned', { active: false, lifecycle: 'deprovisioned', mfa: false }],
    ['lifecycle not active', { active: true, lifecycle: 'suspended', mfa: false }],
    ['deactivated', { active: false, lifecycle: 'active', mfa: false }],
    ['deleted', undefined],
  ])('refuses a %s account and mints no session or MFA challenge', async (_name, user) => {
    state.rows = [user ? [user] : []]
    await expect(completeAuthFirstFactor({ userId: 'user-1', organizationId: '11111111-1111-4111-8111-111111111111' })).rejects.toThrow('User account is not active')
    expect(state.createSession).not.toHaveBeenCalled()
    expect(state.setSessionCookie).not.toHaveBeenCalled()
    expect(state.issueMfaChallenge).not.toHaveBeenCalled()
  })

  it('positive control: an active account gets its session', async () => {
    state.rows = [[{ active: true, lifecycle: 'active', mfa: false }], [{ organizationId: '11111111-1111-4111-8111-111111111111', role: 'member' }]]
    await expect(completeAuthFirstFactor({ userId: 'user-1' })).resolves.toEqual({})
    expect(state.createSession).toHaveBeenCalledTimes(1)
  })
})
