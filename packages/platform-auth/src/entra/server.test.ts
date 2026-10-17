import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  token: 'ue-seed-session-ue-qa-member-primary',
  select: vi.fn(),
  password: vi.fn(),
  provider: vi.fn(),
  nextAuth: vi.fn(),
  authSelect: vi.fn(),
  write: vi.fn(),
  where: vi.fn(),
}))
vi.mock('./config', () => ({ auth: mocks.nextAuth }))
vi.mock('./adapter', () => ({ resolveIdentityFromEntra: vi.fn() }))
vi.mock('../provider-identity', () => ({ resolveExternalAuthIdentity: mocks.provider }))
vi.mock('../acceptance-auth', () => ({
  ACCEPTANCE_AUTH_COOKIE: 'ue_acceptance_auth',
  ACCEPTANCE_AUTH_HEADER: 'x-unioneyes-acceptance-auth',
  resolveAcceptanceAuthUser: vi.fn(async () => null),
}))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === 'nzila_session' ? { value: mocks.token } : undefined),
  }),
  headers: async () => ({ get: () => null }),
}))
vi.mock('../password/auth-service', () => ({ getAuthUser: mocks.password }))
vi.mock('../auth-db', () => ({
  authDb: { select: mocks.authSelect },
  withAuthContext: (_context: unknown, callback: () => Promise<unknown>) => callback(),
}))
vi.mock('@nzila/db/client', () => ({
  db: {
    select: mocks.select,
    insert: mocks.write,
    update: mocks.write,
    delete: mocks.write,
    execute: mocks.write,
    transaction: mocks.write,
  },
}))
vi.mock('@nzila/db/schema', () => ({
  authUsers: {
    userId: 'user.id',
    email: 'email',
    firstName: 'first',
    lastName: 'last',
    isActive: 'user.active',
  },
  authOrganizationUsers: {
    userId: 'membership.user',
    organizationId: 'organization',
    role: 'role',
    isActive: 'membership.active',
  },
}))
vi.mock('drizzle-orm', () => ({
  eq: (column: unknown, value: unknown) => ({ column, value }),
  and: (...conditions: unknown[]) => conditions,
}))

import { auth, currentUser } from './server'

const user = {
  id: 'ue-qa-member-primary',
  email: 'member@nzila.test',
  firstName: 'QA',
  lastName: 'Member',
}
const membership = { organizationId: 'existing-org', role: 'member' }
const environmentVariables = [
  'PLAYWRIGHT_TEST_AUTH',
  'AUTH_DATABASE_URL',
  'AUTH_SYSTEM_DATABASE_URL',
  'QA_TEST_ENV',
  'UE_ENVIRONMENT',
  'UE_CANONICAL_BOOTSTRAP_V2',
  'NEXT_PUBLIC_APP_ENV',
  'NZILA_MODE',
  'UE_DEPLOYMENT_TYPE',
  'NZILA_DEPLOYMENT_TYPE',
  'DEPLOYMENT_ENVIRONMENT',
  'NZILA_AUTH_ENABLE_PG_FALLBACK',
  'NEXT_PUBLIC_NZILA_AUTH_ENABLE_PG_FALLBACK',
] as const

function results(rows: unknown[][]) {
  const pending = [...rows]
  const chain = {
    from: vi.fn(() => chain),
    where: mocks.where.mockImplementation(() => chain),
    limit: vi.fn(async () => pending.shift() ?? []),
  }
  mocks.select.mockImplementation(() => chain)
}

beforeEach(() => {
  vi.resetAllMocks()
  for (const variable of environmentVariables) vi.stubEnv(variable, '')
  vi.stubEnv('NODE_ENV', 'production') // Same build mode as the real E2E server.
  vi.stubEnv('PLAYWRIGHT_TEST_AUTH', 'true')
  vi.stubEnv('QA_TEST_ENV', 'true')
  vi.stubEnv('UE_ENVIRONMENT', 'local')
  vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
  mocks.token = 'ue-seed-session-ue-qa-member-primary'
  mocks.nextAuth.mockResolvedValue(null)
  mocks.password.mockResolvedValue(null)
  results([[user], [membership]])
})
afterEach(() => vi.unstubAllEnvs())

for (const subject of [
  { name: 'auth', resolve: async () => (await auth()).userId },
  { name: 'currentUser', resolve: async () => (await currentUser())?.id ?? null },
]) {
  describe(`${subject.name} E2E seed-session boundary`, () => {
    it('resolves only an existing active fixture user and active membership, without persistence', async () => {
      expect(await subject.resolve()).toBe(user.id)
      expect(mocks.select).toHaveBeenCalledTimes(2)
      expect(mocks.where.mock.calls).toEqual([
        [
          [
            { column: 'user.id', value: user.id },
            { column: 'user.active', value: true },
          ],
        ],
        [
          [
            { column: 'membership.user', value: user.id },
            { column: 'membership.active', value: true },
          ],
        ],
      ])
      expect(mocks.password).not.toHaveBeenCalled()
      expect(mocks.authSelect).not.toHaveBeenCalled()
      expect(mocks.provider).not.toHaveBeenCalled()
      expect(mocks.write).not.toHaveBeenCalled()
    })

    it.each([
      ['UE_ENVIRONMENT', 'production'],
      ['UE_ENVIRONMENT', 'staging'],
      ['UE_ENVIRONMENT', ''],
      ['NEXT_PUBLIC_APP_ENV', 'production'],
      ['NZILA_MODE', 'prod'],
      ['UE_DEPLOYMENT_TYPE', 'prod'],
      ['NZILA_DEPLOYMENT_TYPE', 'production'],
      ['DEPLOYMENT_ENVIRONMENT', 'production'],
      ['UE_CANONICAL_BOOTSTRAP_V2', '1'],
      ['AUTH_DATABASE_URL', 'postgresql://canonical.invalid/auth'],
      ['AUTH_SYSTEM_DATABASE_URL', 'postgresql://canonical.invalid/system'],
      ['UE_CANONICAL_BOOTSTRAP_V2', ''],
      ['UE_CANONICAL_BOOTSTRAP_V2', 'invalid'],
      ['PLAYWRIGHT_TEST_AUTH', 'false'],
      ['PLAYWRIGHT_TEST_AUTH', ''],
      ['QA_TEST_ENV', 'false'],
      ['NZILA_AUTH_ENABLE_PG_FALLBACK', 'false'],
    ])('denies the same cookie with %s=%s before database access', async (variable, value) => {
      vi.stubEnv(variable, value)
      expect(await subject.resolve()).toBeNull()
      expect(mocks.select).not.toHaveBeenCalled()
      expect(mocks.password).not.toHaveBeenCalled()
      expect(mocks.write).not.toHaveBeenCalled()
    })

    it.each([
      'ue-seed-session-',
      'ue-seed-session-ordinary-user',
      'ue-seed-session-ue-qa-member primary',
      'ue-seed-session-ue-qa-member/primary',
      'ue-seed-session-ue-qa-member%2Dprimary',
      'ue-seed-session-ue-qa-member-primary\n',
      `ue-seed-session-ue-qa-${'a'.repeat(161)}`,
    ])('rejects malformed seed cookies before database access: %j', async (token) => {
      mocks.token = token
      expect(await subject.resolve()).toBeNull()
      expect(mocks.select).not.toHaveBeenCalled()
      expect(mocks.password).not.toHaveBeenCalled()
    })

    it('rejects a missing or inactive user without provisioning one', async () => {
      results([[]])
      expect(await subject.resolve()).toBeNull()
      expect(mocks.select).toHaveBeenCalledTimes(1)
      expect(mocks.write).not.toHaveBeenCalled()
    })
  })
}

it('preserves the existing membership role and grants no other role or permission', async () => {
  const session = await auth()
  expect(session.orgId).toBe(membership.organizationId)
  expect(session.orgRole).toBe('member')
  expect(session.has({ role: 'member' })).toBe(true)
  expect(session.has({ role: 'admin' })).toBe(false)
  expect(session.has({ permission: 'tenant:admin' })).toBe(false)
  expect(session.sessionClaims?.authMethod).toBe('password')
})

it('does not manufacture a tenant or role for an existing user without active membership', async () => {
  results([[user], []])
  const session = await auth()
  expect(session.userId).toBe(user.id)
  expect(session.orgId).toBeNull()
  expect(session.orgRole).toBeNull()
  expect(session.has({ role: 'admin' })).toBe(false)
  expect(mocks.write).not.toHaveBeenCalled()
})

it('keeps ordinary opaque password sessions on the existing credential resolver', async () => {
  mocks.token = 'opaque-real-session-token'
  mocks.password.mockResolvedValue({ ...user, organizationId: null, sessionId: mocks.token })
  expect((await auth()).userId).toBe(user.id)
  expect(mocks.password).toHaveBeenCalledOnce()
  expect(mocks.select).not.toHaveBeenCalled()
})
