import { describe, expect, it, vi } from 'vitest'
import type { AuthenticatedOrgBinding } from '@nzila/platform-auth/org-binding'
import { UserRole } from '../roles'
import { withCanonicalRequestScope } from '../canonical-request-scope'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), bind: vi.fn() }))
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: mocks.auth }))
vi.mock('@nzila/platform-auth/org-binding', async original => ({
  ...(await original<typeof import('@nzila/platform-auth/org-binding')>()),
  withAuthenticatedOrgBinding: mocks.bind,
}))
import { withCanonicalOrganizationBinding } from '../canonical-organization-selection'

it('uses the identical verified bridge, refuses scope changes, and performs fresh authentication after return', async () => {
  const binding: AuthenticatedOrgBinding = {
    userId: 'synthetic-actor', organizationId: '11111111-1111-4111-8111-111111111111',
    role: 'officer', isSystemAdmin: false, sessionToken: 'synthetic-private-bearer',
    expiresAt: new Date(Date.now() + 30000), authority: 'pg-session',
  }
  const profile = {
    userId: binding.userId, organizationId: binding.organizationId, role: UserRole.OFFICER,
    isSystemAdmin: false, email: 'actor@example.invalid', firstName: null, lastName: null,
  }
  await withCanonicalRequestScope(binding, profile, async () => {
    await withCanonicalOrganizationBinding({ expectedActorUserId: binding.userId }, async actual => {
      expect(actual).toBe(binding)
    })
    const callback = vi.fn()
    await expect(withCanonicalOrganizationBinding({ expectedActorUserId: 'foreign' }, callback)).rejects.toThrow('ACTOR_MISMATCH')
    await expect(withCanonicalOrganizationBinding({ organizationId: '22222222-2222-4222-8222-222222222222' }, callback)).rejects.toThrow('MEMBERSHIP_REQUIRED')
    await expect(withCanonicalOrganizationBinding({ requiredRoles: ['admin'] }, callback)).rejects.toThrow('ROLE_REQUIRED')
    expect(callback).not.toHaveBeenCalled()
    expect(mocks.auth).not.toHaveBeenCalled()
    expect(mocks.bind).not.toHaveBeenCalled()
  })
  mocks.auth.mockRejectedValueOnce(new Error('fresh authentication required'))
  await expect(withCanonicalOrganizationBinding({}, async () => null)).rejects.toThrow('fresh authentication required')
  expect(mocks.auth).toHaveBeenCalledTimes(1)
})
