import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  binding: vi.fn(),
  passwordActor: vi.fn(),
  limit: vi.fn(),
  context: vi.fn(),
}))

vi.mock('@nzila/platform-auth/org-binding', async (original) => ({
  ...(await original<typeof import('@nzila/platform-auth/org-binding')>()),
  withAuthenticatedOrgBinding: mocks.binding,
}))
vi.mock('@nzila/platform-auth/password', () => ({ getAuthUser: mocks.passwordActor }))
vi.mock('../canonical-organization-selection', () => ({
  withCanonicalOrganizationBinding: mocks.binding,
}))
vi.mock('@nzila/platform-auth/auth-execution', () => ({
  authDb: {
    select: () => ({ from: () => ({ where: () => ({ limit: mocks.limit }) }) }),
  },
  withAuthContext: mocks.context,
}))

import { AuthOrgBindingError } from '@nzila/platform-auth/org-binding'
import { getCanonicalOrganizationContext, getCanonicalPasswordActor } from '../canonical-context'
import { UserRole } from '../roles'

describe('canonical current organization authority', () => {
  const binding = {
    userId: 'canonical-user',
    organizationId: '11111111-1111-4111-8111-111111111111',
    role: 'admin',
    sessionToken: 'synthetic-server-held-only',
  }
  const profile = {
    email: 'canonical@example.invalid',
    firstName: 'Synthetic',
    lastName: 'Actor',
    isSystemAdmin: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.binding.mockImplementation(async (_options, callback) => callback(binding))
    mocks.context.mockImplementation(async (_options, callback) => callback())
    mocks.limit.mockResolvedValue([profile])
    mocks.passwordActor.mockResolvedValue(null)
  })

  it('uses live canonical membership and identity without returning the bearer', async () => {
    const context = await getCanonicalOrganizationContext({ expectedActorUserId: binding.userId })
    expect(context).toEqual({
      ...profile,
      userId: binding.userId,
      organizationId: binding.organizationId,
      role: UserRole.ADMIN,
    })
    expect(context).not.toHaveProperty('sessionToken')
    expect(mocks.context).toHaveBeenCalledWith(
      { phase: 'identity', userId: binding.userId },
      expect.any(Function),
    )
  })

  it('derives platform administration only from the canonical profile', async () => {
    mocks.limit.mockResolvedValueOnce([{ ...profile, isSystemAdmin: true }])
    expect((await getCanonicalOrganizationContext()).role).toBe(UserRole.APP_OWNER)
  })

  it('reuses the current platform membership role aliases', async () => {
    mocks.binding.mockImplementationOnce(async (_options, callback) =>
      callback({ ...binding, role: 'executive' }),
    )
    expect((await getCanonicalOrganizationContext()).role).toBe(UserRole.PRESIDENT)
  })

  it('does not elevate a nullable canonical administrator flag', async () => {
    mocks.limit.mockResolvedValueOnce([{ ...profile, isSystemAdmin: null }])
    expect((await getCanonicalOrganizationContext()).isSystemAdmin).toBe(false)
  })

  it('rejects unknown membership roles instead of defaulting to member', async () => {
    mocks.binding.mockImplementationOnce(async (_options, callback) =>
      callback({ ...binding, role: 'unrecognized-source-role' }),
    )
    await expect(getCanonicalOrganizationContext()).rejects.toMatchObject({ code: 'ROLE_REQUIRED' })
  })

  it('does not turn an organization membership role into platform authority', async () => {
    mocks.binding.mockImplementationOnce(async (_options, callback) =>
      callback({ ...binding, role: 'app_owner' }),
    )
    await expect(getCanonicalOrganizationContext()).rejects.toMatchObject({ code: 'ROLE_REQUIRED' })
  })

  it('rejects missing or inactive canonical profiles', async () => {
    mocks.limit.mockResolvedValueOnce([])
    await expect(getCanonicalOrganizationContext()).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
  })

  it('preserves session or membership denial without attempting profile reads', async () => {
    mocks.binding.mockRejectedValueOnce(new AuthOrgBindingError('MEMBERSHIP_REQUIRED'))
    await expect(getCanonicalOrganizationContext()).rejects.toMatchObject({
      code: 'MEMBERSHIP_REQUIRED',
    })
    expect(mocks.context).not.toHaveBeenCalled()
  })

  it('surfaces database failures without metadata or environment fallbacks', async () => {
    const failure = new Error('synthetic private profile query failure')
    mocks.limit.mockRejectedValueOnce(failure)
    await expect(getCanonicalOrganizationContext()).rejects.toBe(failure)
  })

  it('preserves authenticated password profile access without inventing organization membership', async () => {
    mocks.passwordActor.mockResolvedValueOnce({ id: binding.userId, organizationId: null })
    expect(await getCanonicalPasswordActor()).toEqual({
      ...profile,
      userId: binding.userId,
      organizationId: null,
    })
  })

  it('does not access canonical profiles for an unauthenticated password request', async () => {
    expect(await getCanonicalPasswordActor()).toBeNull()
    expect(mocks.context).not.toHaveBeenCalled()
  })
})
