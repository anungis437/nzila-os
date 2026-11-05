import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[][],
  createSession: vi.fn(),
  setSessionCookie: vi.fn(),
  inserted: [] as unknown[],
}))

vi.mock('../password/session', () => ({ createSession: state.createSession, setSessionCookie: state.setSessionCookie }))
vi.mock('../auth-db', () => {
  const builder = () => {
    const query: Record<string, unknown> = {
      from: () => query,
      where: () => query,
      limit: () => query,
      for: () => query,
      then: (resolve: (rows: unknown) => unknown, reject: (error: unknown) => unknown) =>
        Promise.resolve(state.rows.shift() ?? []).then(resolve, reject),
    }
    return query
  }
  const authDb = {
    select: builder,
    insert: () => ({ values: async (value: unknown) => { state.inserted.push(value) } }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  }
  return {
    authDb,
    withAuthContext: async (_context: unknown, callback: () => Promise<unknown>) => callback(),
    withAuthenticatedAuthContext: async (_user: string, callback: () => Promise<unknown>) => callback(),
    withAuthSavepoint: async (callback: () => Promise<unknown>) => callback(),
  }
})

import { consumeMfaChallenge } from './service'

const challenge = { id: 'challenge-1', userId: 'user-1', attempts: 0, pendingIp: null, pendingUserAgent: null }

describe('MFA challenge redemption re-checks the account (a challenge outlives the state it was issued under)', () => {
  beforeEach(() => {
    state.rows = []
    state.inserted = []
    state.createSession.mockReset()
    state.setSessionCookie.mockReset()
  })

  it.each([
    ['suspended', { active: false, lifecycle: 'suspended' }],
    ['deprovisioned', { active: false, lifecycle: 'deprovisioned' }],
    ['lifecycle not active', { active: true, lifecycle: 'suspended' }],
    ['deactivated', { active: false, lifecycle: 'active' }],
    ['deleted (no row)', undefined],
  ])('no session is minted for an account that is %s', async (_name, account) => {
    state.rows = [[challenge], account ? [account] : []]
    const result = await consumeMfaChallenge({ challengeToken: 'token', code: '123456' })
    expect(result).toEqual({ success: false, error: 'Invalid or expired challenge' })
    expect(state.createSession).not.toHaveBeenCalled()
    expect(state.setSessionCookie).not.toHaveBeenCalled()
    expect(state.inserted).toMatchObject([{ eventType: 'mfa_challenge_failed', metadata: { reason: 'account_not_active' } }])
  })

  it('an active account proceeds past the lifecycle gate (positive control: the next refusal is about MFA enrolment)', async () => {
    state.rows = [[challenge], [{ active: true, lifecycle: 'active' }], []]
    const result = await consumeMfaChallenge({ challengeToken: 'token', code: '123456' })
    expect(result).toEqual({ success: false, error: 'MFA not enabled for this account' })
  })
})
