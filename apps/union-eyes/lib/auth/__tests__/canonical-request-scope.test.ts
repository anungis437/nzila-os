import { describe, expect, it } from 'vitest'
import type { AuthenticatedOrgBinding } from '@nzila/platform-auth/org-binding'
import { systemContextStorage } from '@/db/system-context-storage'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { UserRole } from '../roles'
import { currentCanonicalRequest, withCanonicalRequestScope, type CanonicalRequestProfile } from '../canonical-request-scope'

const org = '11111111-1111-4111-8111-111111111111'
const binding = (userId: string): AuthenticatedOrgBinding => ({
  userId, organizationId: org, role: 'officer', isSystemAdmin: false,
  sessionToken: 'synthetic-test-bearer', expiresAt: new Date(Date.now() + 30000),
  authority: 'pg-session',
})
const profile = (userId: string): CanonicalRequestProfile => ({
  userId, organizationId: org, role: UserRole.OFFICER, isSystemAdmin: false,
  email: `${userId}@example.invalid`, firstName: null, lastName: null,
})

describe('one canonical bridge per bounded request', () => {
  it('isolates concurrent actors and releases authority on success and failure', async () => {
    expect(currentCanonicalRequest()).toBeNull()
    await Promise.all(['first', 'second'].map(userId =>
      withCanonicalRequestScope(binding(userId), profile(userId), async () => {
        await Promise.resolve()
        expect(currentCanonicalRequest()?.profile.userId).toBe(userId)
        expect(currentCanonicalRequest()?.profile).not.toHaveProperty('sessionToken')
      }),
    ))
    await expect(withCanonicalRequestScope(binding('failed'), profile('failed'), async () => {
      throw new Error('request failed')
    })).rejects.toThrow('request failed')
    expect(currentCanonicalRequest()).toBeNull()
  })

  it('refuses actor, organization and role changes inside an established request', async () => {
    await withCanonicalRequestScope(binding('actor'), profile('actor'), async () => {
      expect(() => currentCanonicalRequest({ expectedActorUserId: 'foreign' })).toThrow('ACTOR_MISMATCH')
      expect(() => currentCanonicalRequest({ organizationId: '22222222-2222-4222-8222-222222222222' })).toThrow('MEMBERSHIP_REQUIRED')
      expect(() => currentCanonicalRequest({ requiredRoles: ['admin'] })).toThrow('ROLE_REQUIRED')
      expect(currentCanonicalRequest({ expectedActorUserId: 'actor', organizationId: org.toUpperCase(), requiredRoles: ['officer'] })?.profile.userId).toBe('actor')
      await expect(withCanonicalRequestScope(binding('foreign'), profile('foreign'), async () => null)).rejects.toThrow('ACTOR_MISMATCH')
    })
    await expect(withCanonicalRequestScope(binding('actor'), profile('foreign'), async () => null)).rejects.toThrow('ACTOR_MISMATCH')
  })

  it.each([new Date(0), new Date(Number.NaN)])('rejects expired or malformed bridge expiry', async expiresAt => {
    await withCanonicalRequestScope({ ...binding('actor'), expiresAt }, profile('actor'), async () => {
      expect(() => currentCanonicalRequest()).toThrow('SESSION_AUTHORITY_REQUIRED')
    })
  })

  it('refuses borrowing tenant authority on a system connection', async () => {
    await withCanonicalRequestScope(binding('actor'), profile('actor'), async () => {
      await systemContextStorage.run({} as RLSTx, async () => {
        expect(() => currentCanonicalRequest()).toThrow('ROLE_REQUIRED')
      })
      expect(currentCanonicalRequest()?.profile.userId).toBe('actor')
    })
  })

  it('invalidates inherited detached work immediately after request completion', async () => {
    let resume!: () => void
    const gate = new Promise<void>(resolve => { resume = resolve })
    let detached!: Promise<unknown>
    await withCanonicalRequestScope(binding('actor'), profile('actor'), async () => {
      detached = gate.then(() => currentCanonicalRequest())
    })
    const refused = expect(detached).rejects.toThrow('SESSION_AUTHORITY_REQUIRED')
    resume()
    await refused
  })
})
