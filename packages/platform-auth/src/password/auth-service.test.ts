import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const tables = {
    authUsers: { __table: 'authUsers', userId: 'userId', email: 'email', firstName: 'firstName', lastName: 'lastName', passwordHash: 'passwordHash', isActive: 'isActive', failedLoginAttempts: 'failedLoginAttempts', accountLockedUntil: 'accountLockedUntil', lifecycleState: 'lifecycleState', lastLoginAt: 'lastLoginAt', lastLoginIp: 'lastLoginIp', passwordChangedAt: 'passwordChangedAt' },
    authOrganizationUsers: { __table: 'authOrganizationUsers', organizationId: 'organizationId', userId: 'userId', role: 'role', isActive: 'isActive', isPrimary: 'isPrimary' },
    authAuditLog: { __table: 'authAuditLog' },
    authMfaTotp: { __table: 'authMfaTotp', userId: 'userId', enabledAt: 'enabledAt', disabledAt: 'disabledAt' },
    authOrgPolicies: { __table: 'authOrgPolicies', organizationId: 'organizationId', mfaRequiredForRoles: 'mfaRequiredForRoles' },
  }

  const state = {
    userRow: null as null | Record<string, unknown>,
    membershipRow: null as null | Record<string, unknown>,
    mfaRow: null as null | Record<string, unknown>,
    policyRow: null as null | Record<string, unknown>,
    authSelectTables: [] as string[],
    authUpdates: [] as string[],
    ordinarySelect: vi.fn(() => {
      throw new Error('ordinary tenant db must not be used for pre-auth credential lookup')
    }),
    verifyPassword: vi.fn(),
    hashPassword: vi.fn(),
    createSession: vi.fn(),
    setSessionCookie: vi.fn(),
    assessRisk: vi.fn(),
    issueMfaChallenge: vi.fn(),
  }

  function selectBuilder() {
    let table = ''
    const builder = {
      from(input: { __table?: string }) {
        table = input.__table ?? 'unknown'
        state.authSelectTables.push(table)
        return builder
      },
      where() { return builder },
      orderBy() { return builder },
      async limit() {
        if (table === 'authUsers') return state.userRow ? [state.userRow] : []
        if (table === 'authOrganizationUsers') return state.membershipRow ? [state.membershipRow] : []
        if (table === 'authMfaTotp') return state.mfaRow ? [state.mfaRow] : []
        if (table === 'authOrgPolicies') return state.policyRow ? [state.policyRow] : []
        return []
      },
    }
    return builder
  }

  const authDb = {
    select: vi.fn(() => selectBuilder()),
    update: vi.fn((table: { __table?: string }) => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => {
          state.authUpdates.push(table.__table ?? 'unknown')
          return []
        }),
      })),
    })),
  }

  const ordinaryDb = {
    select: state.ordinarySelect,
    insert: vi.fn(() => ({ values: vi.fn(async () => []) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => []) })) })),
  }

  return { tables, state, authDb, ordinaryDb }
})

vi.mock('@nzila/db/schema', () => mocks.tables)
vi.mock('@nzila/db/client', () => ({ db: mocks.ordinaryDb }))
vi.mock('../auth-db', () => ({
  authDb: mocks.authDb,
  withAuthContext: (_context: unknown, callback: () => Promise<unknown>) => callback(),
  withAuthSavepoint: (callback: () => Promise<unknown>) => callback(),
}))
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ op: 'and', args }),
  eq: (...args: unknown[]) => ({ op: 'eq', args }),
  gt: (...args: unknown[]) => ({ op: 'gt', args }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
}))
vi.mock('./password', () => ({
  hashPassword: mocks.state.hashPassword,
  verifyPassword: mocks.state.verifyPassword,
  validatePassword: () => ({ valid: true, errors: [] }),
  needsRehash: () => false,
}))
vi.mock('./session', () => ({
  createSession: mocks.state.createSession,
  setSessionCookie: mocks.state.setSessionCookie,
  revokeSession: vi.fn(),
  revokeAllUserSessions: vi.fn(),
  clearSessionCookie: vi.fn(),
  getSessionFromCookie: vi.fn(),
}))
vi.mock('../risk/assess', () => ({ assessRisk: mocks.state.assessRisk }))
vi.mock('../mfa/service', () => ({ issueMfaChallenge: mocks.state.issueMfaChallenge }))

import { isPlaywrightE2EAuthRequest, login } from './auth-service'

describe('password login auth bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.state.userRow = {
      userId: 'user-1',
      email: 'person@example.test',
      firstName: 'Person',
      lastName: 'Example',
      passwordHash: 'hash',
      isActive: true,
      failedLoginAttempts: 0,
      accountLockedUntil: null,
      lifecycleState: 'active',
    }
    mocks.state.membershipRow = { organizationId: '11111111-1111-4111-8111-111111111111', role: 'member' }
    mocks.state.mfaRow = null
    mocks.state.policyRow = null
    mocks.state.authSelectTables.length = 0
    mocks.state.authUpdates.length = 0
    mocks.state.verifyPassword.mockResolvedValue(true)
    mocks.state.hashPassword.mockResolvedValue('dummy-hash')
    mocks.state.assessRisk.mockResolvedValue({ score: 0, tier: 'low', reasons: [], recommendedAction: 'allow' })
    mocks.state.createSession.mockResolvedValue({
      token: 'opaque-session-token',
      session: { sessionId: 'session-1', userId: 'user-1', organizationId: '11111111-1111-4111-8111-111111111111', expiresAt: new Date('2026-09-16T00:00:00Z') },
    })
    mocks.state.setSessionCookie.mockResolvedValue(undefined)
  })

  it('resolves valid password credentials through the auth bootstrap executor before any user context exists', async () => {
    const result = await login({ email: 'person@example.test', password: 'Correct123', ipAddress: '203.0.113.10', userAgent: 'test-agent/1.0' })

    expect(result.success).toBe(true)
    expect(mocks.ordinaryDb.select).not.toHaveBeenCalled()
    expect(mocks.authDb.select).toHaveBeenCalled()
    expect(mocks.state.authSelectTables).toContain('authUsers')
    expect(mocks.state.createSession).toHaveBeenCalledWith({
      userId: 'user-1',
      organizationId: '11111111-1111-4111-8111-111111111111',
      ipAddress: '203.0.113.10',
      userAgent: 'test-agent/1.0',
    })
  })

  it('keeps unknown email indistinguishable from wrong password', async () => {
    mocks.state.userRow = null

    const result = await login({ email: 'missing@example.test', password: 'Wrong123' })

    expect(result).toEqual({ success: false, error: 'Invalid email or password' })
    expect(mocks.state.hashPassword).toHaveBeenCalledWith('Wrong123')
    expect(mocks.state.createSession).not.toHaveBeenCalled()
  })

  it('denies inactive users before session creation', async () => {
    mocks.state.userRow = { ...mocks.state.userRow!, isActive: false }

    const result = await login({ email: 'person@example.test', password: 'Correct123' })

    expect(result).toEqual({ success: false, error: 'Account is deactivated. Contact support.' })
    expect(mocks.state.createSession).not.toHaveBeenCalled()
  })
})

describe('the Playwright login shortcut', () => {
  const names = ['PLAYWRIGHT_TEST_AUTH', 'QA_TEST_ENV', 'UE_ENVIRONMENT', 'NODE_ENV', 'NEXT_PUBLIC_APP_ENV', 'NZILA_MODE']
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]))
  const agent = 'Mozilla/5.0 playwright-e2e-auth'

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.state.userRow = { userId: 'user-1', email: 'person@example.test', firstName: 'Person', lastName: 'Example', passwordHash: 'hash', isActive: true, failedLoginAttempts: 0, accountLockedUntil: null, lifecycleState: 'active' }
    mocks.state.membershipRow = { organizationId: '11111111-1111-4111-8111-111111111111', role: 'member' }
    mocks.state.mfaRow = { userId: 'user-1', enabledAt: new Date('2026-01-01T00:00:00Z'), disabledAt: null }
    mocks.state.policyRow = null
    mocks.state.verifyPassword.mockResolvedValue(true)
    mocks.state.assessRisk.mockResolvedValue({ score: 0, tier: 'low', reasons: [], recommendedAction: 'allow' })
  })

  afterEach(() => {
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name]
      else process.env[name] = saved[name]
    }
  })

  function configure(env: Record<string, string>) {
    for (const name of names) delete process.env[name]
    Object.assign(process.env, env)
  }

  it('is recognised only on a local QA machine, by the test flag, the QA flag and the agent together', () => {
    configure({ PLAYWRIGHT_TEST_AUTH: 'true', QA_TEST_ENV: 'true', UE_ENVIRONMENT: 'local' })
    expect(isPlaywrightE2EAuthRequest({ userAgent: agent })).toBe(true)
    expect(isPlaywrightE2EAuthRequest({ userAgent: 'Mozilla/5.0' })).toBe(false)
  })

  it.each([
    ['production', { PLAYWRIGHT_TEST_AUTH: 'true', QA_TEST_ENV: 'true', UE_ENVIRONMENT: 'production' }],
    ['staging', { PLAYWRIGHT_TEST_AUTH: 'true', QA_TEST_ENV: 'true', UE_ENVIRONMENT: 'staging' }],
    ['an unlabelled container', { PLAYWRIGHT_TEST_AUTH: 'true', QA_TEST_ENV: 'true' }],
    ['the test flag alone', { PLAYWRIGHT_TEST_AUTH: 'true' }],
    ['a local identity without the QA flag', { PLAYWRIGHT_TEST_AUTH: 'true', UE_ENVIRONMENT: 'local' }],
  ])('is ignored on %s, whatever the User-Agent says', (_label, env) => {
    configure(env)
    expect(isPlaywrightE2EAuthRequest({ userAgent: agent })).toBe(false)
  })

  it('does not let a production request skip MFA by sending the test User-Agent', async () => {
    configure({ PLAYWRIGHT_TEST_AUTH: 'true', QA_TEST_ENV: 'true', UE_ENVIRONMENT: 'production', NODE_ENV: 'production' })
    mocks.state.issueMfaChallenge.mockResolvedValue({ challengeToken: 'challenge-1', expiresAt: new Date('2026-09-16T00:00:00Z') })

    const result = await login({ email: 'person@example.test', password: 'Correct123', userAgent: agent })

    expect(result).toMatchObject({ success: true, requiresMfa: true })
    expect(mocks.state.issueMfaChallenge).toHaveBeenCalled()
    expect(mocks.state.createSession).not.toHaveBeenCalled()
  })

  it('skips MFA for the harness on a local QA machine, which is what the shortcut is for', async () => {
    configure({ PLAYWRIGHT_TEST_AUTH: 'true', QA_TEST_ENV: 'true', UE_ENVIRONMENT: 'local' })
    mocks.state.createSession.mockResolvedValue({
      token: 'opaque-session-token',
      session: { sessionId: 'session-1', userId: 'user-1', organizationId: '11111111-1111-4111-8111-111111111111', expiresAt: new Date('2026-09-16T00:00:00Z') },
    })
    mocks.state.setSessionCookie.mockResolvedValue(undefined)

    const result = await login({ email: 'person@example.test', password: 'Correct123', userAgent: agent })

    expect(result.success).toBe(true)
    expect(mocks.state.issueMfaChallenge).not.toHaveBeenCalled()
    expect(mocks.state.createSession).toHaveBeenCalled()
  })
})
