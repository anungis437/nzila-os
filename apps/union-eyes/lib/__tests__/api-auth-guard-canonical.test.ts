import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthOrgBindingError } from '@nzila/platform-auth/org-binding'

const mocks = vi.hoisted(() => ({
  passwordActor: vi.fn(),
  organization: vi.fn(),
  auth: vi.fn(),
  provider: vi.fn(),
  legacyOrganization: vi.fn(),
  warn: vi.fn(),
}))
vi.mock('@/lib/auth/canonical-context', () => ({
  getCanonicalPasswordActor: mocks.passwordActor,
  getCanonicalOrganizationContext: mocks.organization,
}))
vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: mocks.auth,
  currentUser: mocks.provider,
}))
vi.mock('@/db/db', () => ({ db: {} }))
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: vi.fn() }))
vi.mock('@/lib/organization-utils', () => ({
  getOrganizationIdForUser: mocks.legacyOrganization,
}))
vi.mock('@/lib/logger', () => ({
  logger: { warn: mocks.warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { isPlatformAdminUser, requireApiAuth } from '../api-auth-guard'
import { POST as clearCache } from '../../app/api/admin/system/cache/route'

describe('canonical imperative API authentication', () => {
  const actor = {
    userId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    organizationId: '33333333-3333-4333-8333-333333333333',
    email: 'synthetic-api@example.invalid',
    firstName: 'Synthetic',
    lastName: 'Actor',
    isSystemAdmin: false,
  }
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
    mocks.passwordActor.mockResolvedValue(actor)
    mocks.organization.mockResolvedValue({ ...actor, role: 'member' })
    mocks.auth.mockResolvedValue({ userId: actor.userId })
    mocks.provider.mockResolvedValue({ publicMetadata: { role: 'app_owner' } })
    mocks.legacyOrganization.mockResolvedValue('foreign-legacy-organization')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('validates canonical authority even when organization scope was not requested', async () => {
    expect(await requireApiAuth()).toEqual({
      userId: actor.userId,
      organizationId: null,
      role: null,
    })
    expect(mocks.organization).toHaveBeenCalledWith({
      expectedActorUserId: actor.userId,
      organizationId: actor.organizationId,
    })
    expect(mocks.provider).not.toHaveBeenCalled()
    expect(mocks.legacyOrganization).not.toHaveBeenCalled()
  })

  it('resolves canonical organization and exact role requirements', async () => {
    expect(await requireApiAuth({ orgScoped: true, roles: ['member'] })).toEqual({
      userId: actor.userId,
      organizationId: actor.organizationId,
      role: 'member',
    })
    await expect(requireApiAuth({ roles: ['app_owner'] })).rejects.toThrow('Forbidden:')
    expect(mocks.warn).toHaveBeenCalled()
  })

  it('retains authenticated private profiles without inventing organization authority', async () => {
    mocks.passwordActor.mockResolvedValue({ ...actor, organizationId: null })
    expect(await requireApiAuth()).toEqual({
      userId: actor.userId,
      organizationId: null,
      role: null,
    })
    expect(mocks.organization).not.toHaveBeenCalled()
    await expect(requireApiAuth({ orgScoped: true })).rejects.toThrow('Forbidden:')
    await expect(requireApiAuth({ roles: ['member'] })).rejects.toThrow('Forbidden:')
    expect(mocks.warn).toHaveBeenCalled()
  })

  it.each(['UNAUTHENTICATED', 'ACTOR_MISMATCH', 'SESSION_AUTHORITY_REQUIRED'] as const)(
    'rejects %s canonical authority despite provider identity',
    async (code) => {
      mocks.organization.mockRejectedValue(new AuthOrgBindingError(code))
      await expect(requireApiAuth()).rejects.toThrow('Unauthorized:')
      expect(mocks.warn).toHaveBeenCalledWith('[Auth] Canonical API authority denied', { code })
    },
  )

  it.each(['MEMBERSHIP_REQUIRED', 'INVALID_ORGANIZATION', 'ROLE_REQUIRED'] as const)(
    'reports %s as forbidden rather than granting fallback authority',
    async (code) => {
      mocks.organization.mockRejectedValue(new AuthOrgBindingError(code))
      await expect(requireApiAuth()).rejects.toThrow('Forbidden:')
      expect(mocks.legacyOrganization).not.toHaveBeenCalled()
    },
  )

  it('permits public access only when no canonical actor exists', async () => {
    mocks.passwordActor.mockResolvedValue(null)
    mocks.auth.mockResolvedValue({ userId: null })
    expect(await requireApiAuth({ allowPublic: true })).toEqual({
      userId: null,
      organizationId: null,
      role: null,
    })
    await expect(requireApiAuth()).rejects.toThrow('Unauthorized:')
    expect(mocks.warn).toHaveBeenCalled()
  })

  it('does not turn a database failure into an authentication denial', async () => {
    const failure = new Error('canonical profile storage unavailable')
    mocks.passwordActor.mockRejectedValue(failure)
    await expect(requireApiAuth()).rejects.toBe(failure)
  })

  it('ignores a forged environment administrator allowlist in V2', async () => {
    vi.stubEnv('PLATFORM_ADMIN_USER_IDS', actor.userId)
    expect(await isPlatformAdminUser(actor.userId)).toBe(false)
  })

  it('requires the canonical administrator flag and exact authenticated actor', async () => {
    mocks.organization.mockResolvedValue({ ...actor, role: 'app_owner', isSystemAdmin: true })
    expect(await isPlatformAdminUser(actor.userId)).toBe(true)
    expect(await isPlatformAdminUser('foreign-actor')).toBe(false)
  })

  it('logs known canonical administrator denials without granting access', async () => {
    mocks.organization.mockRejectedValue(new AuthOrgBindingError('MEMBERSHIP_REQUIRED'))
    expect(await isPlatformAdminUser(actor.userId)).toBe(false)
    expect(mocks.warn).toHaveBeenCalledWith('[Auth] Canonical platform authority denied', {
      code: 'MEMBERSHIP_REQUIRED',
    })
  })

  it('propagates administrator storage failures', async () => {
    const failure = new Error('canonical administrator storage unavailable')
    mocks.passwordActor.mockRejectedValue(failure)
    await expect(isPlatformAdminUser(actor.userId)).rejects.toBe(failure)
  })

  it('preserves the legacy environment administrator allowlist', async () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
    vi.stubEnv('PLATFORM_ADMIN_USER_IDS', `  ${actor.userId} , other-actor `)
    expect(await isPlatformAdminUser(actor.userId)).toBe(true)
    expect(await isPlatformAdminUser('foreign-actor')).toBe(false)
    expect(mocks.passwordActor).not.toHaveBeenCalled()
  })

  it('denies the actual direct admin handler despite a forged environment grant', async () => {
    vi.stubEnv('PLATFORM_ADMIN_USER_IDS', actor.userId)
    expect((await clearCache()).status).toBe(403)
  })

  it('permits the actual direct admin handler with canonical platform authority', async () => {
    mocks.organization.mockResolvedValue({ ...actor, role: 'app_owner', isSystemAdmin: true })
    expect((await clearCache()).status).toBe(501)
  })

  it('denies the actual direct admin handler when canonical authority was revoked', async () => {
    mocks.organization.mockRejectedValue(new AuthOrgBindingError('MEMBERSHIP_REQUIRED'))
    expect((await clearCache()).status).toBe(403)
    expect(mocks.warn).toHaveBeenCalled()
  })
})
