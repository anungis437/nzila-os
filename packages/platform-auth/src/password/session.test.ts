/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 13: revokeAllUserSessions() now accepts an optional db
 * executor override, so that a cross-user platform-admin caller (e.g.
 * apps/union-eyes's offboarding route) can pass a SYSTEM-privileged
 * client instead of the ordinary DATABASE_URL-bound one. These tests
 * prove:
 *   - the default (no override) uses the auth bootstrap executor;
 *   - passing an explicit executor routes the mutation through it instead.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { authUpdate, overrideUpdate } = vi.hoisted(() => ({
  authUpdate: vi.fn(),
  overrideUpdate: vi.fn(),
}))

vi.mock('@nzila/db/client', () => ({
  db: {},
}))

vi.mock('../auth-db', () => ({
  authDb: {
    update: () => ({ set: () => ({ where: authUpdate }) }),
  },
}))

vi.mock('@nzila/db/schema', () => ({
  authUserSessions: {
    sessionId: 'sessionId',
    userId: 'userId',
    isActive: 'isActive',
    sessionTokenHash: 'sessionTokenHash',
  },
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

import { revokeAllUserSessions, sessionCookieSecure } from './session'

describe('revokeAllUserSessions — db executor override', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authUpdate.mockResolvedValue(undefined)
    overrideUpdate.mockResolvedValue(undefined)
  })

  it('uses the auth bootstrap executor by default', async () => {
    await revokeAllUserSessions('user-1')

    expect(authUpdate).toHaveBeenCalledTimes(1)
    expect(overrideUpdate).not.toHaveBeenCalled()
  })

  it('routes the mutation through an explicitly-passed db executor instead of the ordinary client', async () => {
    const systemExecutor = {
      update: () => ({ set: () => ({ where: overrideUpdate }) }),
    } as unknown as Parameters<typeof revokeAllUserSessions>[1]

    await revokeAllUserSessions('user-1', systemExecutor)

    expect(overrideUpdate).toHaveBeenCalledTimes(1)
    expect(authUpdate).not.toHaveBeenCalled()
  })
})

describe('sessionCookieSecure', () => {
  it('is Secure in every deployed production build and relaxed only in the owned local QA runtime', () => {
    expect(sessionCookieSecure({ NODE_ENV: 'production' })).toBe(true)
    for (const identity of ['production', 'staging', 'pilot', 'demo'])
      expect(sessionCookieSecure({ NODE_ENV: 'production', QA_TEST_ENV: 'true', UE_ENVIRONMENT: identity })).toBe(true)
    // A local identity alone, or QA alone, is not the owned QA runtime.
    expect(sessionCookieSecure({ NODE_ENV: 'production', UE_ENVIRONMENT: 'local' })).toBe(true)
    expect(sessionCookieSecure({ NODE_ENV: 'production', QA_TEST_ENV: 'true' })).toBe(true)
    // Any deployment signal alongside the local QA markers keeps Secure.
    expect(sessionCookieSecure({ NODE_ENV: 'production', QA_TEST_ENV: 'true', UE_ENVIRONMENT: 'local', TARGET_ENVIRONMENT: 'staging' })).toBe(true)
    expect(sessionCookieSecure({ NODE_ENV: 'production', QA_TEST_ENV: 'true', UE_ENVIRONMENT: 'local' })).toBe(false)
    expect(sessionCookieSecure({ NODE_ENV: 'development' })).toBe(false)
  })
})
