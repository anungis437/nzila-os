import { describe, expect, it } from 'vitest'
import type { AuthenticatedOrgBinding } from '@nzila/platform-auth/org-binding'
import { systemContextStorage } from '@/db/system-context-storage'
import type { RLSTx } from './with-rls-context'
import { canonicalTenantPrincipal, withCanonicalTenantScope } from './canonical-transaction-scope'

// Local scope isolation regression; these synthetic bindings are not staging credentials.
const tx = {} as RLSTx
const binding = (userId: string): AuthenticatedOrgBinding => ({
  userId, organizationId: '11111111-1111-4111-8111-111111111111', role: 'officer',
  isSystemAdmin: false, sessionToken: 'synthetic-private-bearer',
  expiresAt: new Date(Date.now() + 30000), authority: 'verified-provider-bridge',
})

describe('principal of the current canonical transaction', () => {
  it('returns no principal outside its callback and never exposes its bearer', async () => {
    expect(canonicalTenantPrincipal()).toBeNull()
    await withCanonicalTenantScope(tx, binding('actor'), async () => {
      expect(canonicalTenantPrincipal()).toEqual({
        userId: 'actor', organizationId: binding('actor').organizationId,
        role: 'officer', isSystemAdmin: false,
      })
      expect(JSON.stringify(canonicalTenantPrincipal())).not.toContain('synthetic-private-bearer')
    })
    expect(canonicalTenantPrincipal()).toBeNull()
  })

  it('isolates concurrent request actors and clears the scope after failure', async () => {
    await Promise.all(['first', 'second'].map(userId => withCanonicalTenantScope(tx, binding(userId), async () => {
      await new Promise(resolve => setTimeout(resolve, 5))
      expect(canonicalTenantPrincipal()?.userId).toBe(userId)
    })))
    await expect(withCanonicalTenantScope(tx, binding('failed'), async () => {
      throw new Error('callback failed')
    })).rejects.toThrow('callback failed')
    expect(canonicalTenantPrincipal()).toBeNull()
  })

  it.each([new Date(0), new Date(Number.NaN)])('refuses expired or malformed bridge expiry', async expiresAt => {
    await withCanonicalTenantScope(tx, { ...binding('actor'), expiresAt }, async () => {
      expect(() => canonicalTenantPrincipal()).toThrowError('SESSION_AUTHORITY_REQUIRED')
    })
  })

  it('does not borrow a tenant actor while executing on a system connection', async () => {
    await withCanonicalTenantScope(tx, binding('actor'), async () => {
      await systemContextStorage.run(tx, async () => {
        expect(() => canonicalTenantPrincipal()).toThrowError('ROLE_REQUIRED')
      })
      expect(canonicalTenantPrincipal()?.userId).toBe('actor')
    })
  })
})
