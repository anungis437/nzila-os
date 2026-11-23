import { beforeEach, describe, expect, it, vi } from 'vitest'

// Reproduce the observed two-pool cycle: while a case transaction owns its
// principal lock, a fresh bridge or queued identity lookup cannot complete.
const state = vi.hoisted(() => ({
  inTransaction: false,
  bridges: 0,
  profiles: 0,
  actor: 'aaaaaaaa-0000-4000-8000-000000000001',
  org: 'bbbbbbbb-0000-4000-8000-000000000001',
  tx: { execute: vi.fn(), transaction: vi.fn() },
  auth: vi.fn(),
}))
vi.mock('@/lib/api-auth-guard', () => ({ auth: state.auth, currentUser: vi.fn() }))
vi.mock('@/db/db', () => ({ db: {
  transaction: async (work: (tx: typeof state.tx) => Promise<unknown>) => {
    state.inTransaction = true
    try { return await work(state.tx) } finally { state.inTransaction = false }
  },
} }))
vi.mock('@/db/system-db', () => ({ systemDb: { transaction: vi.fn() } }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock('@nzila/platform-auth/auth-execution', () => ({
  authDb: { select: () => ({ from: () => ({ where: () => ({ limit: async () => [{
    email: 'controlled@example.invalid', firstName: 'Controlled', lastName: 'Officer', isSystemAdmin: false,
  }] }) }) }) },
  withAuthContext: async (_context: unknown, work: () => Promise<unknown>) => {
    if (state.inTransaction) throw new Error('Identity pool is behind a bridge waiting on this principal')
    state.profiles++
    return work()
  },
}))
vi.mock('@/lib/auth/canonical-organization-selection', async () => {
  const { currentCanonicalRequest } = await import('@/lib/auth/canonical-request-scope')
  const { AuthOrgBindingError } = await import('@nzila/platform-auth/org-binding')
  return { withCanonicalOrganizationBinding: async (
    options: { organizationId?: string; expectedActorUserId?: string },
    work: (binding: object) => Promise<unknown>,
  ) => {
    const existing = currentCanonicalRequest(options)
    if (existing) return work(existing.binding)
    if (state.inTransaction) throw new Error('Bridge INSERT waits on the case principal lock')
    if (options.expectedActorUserId && options.expectedActorUserId !== state.actor)
      throw new AuthOrgBindingError('ACTOR_MISMATCH')
    state.bridges++
    return work({
      userId: state.actor, organizationId: options.organizationId ?? state.org, role: 'officer',
      isSystemAdmin: false, sessionToken: 'synthetic-bridge-not-a-credential',
      expiresAt: new Date(Date.now() + 30000), authority: 'verified-provider-bridge',
    })
  } }
})

import { withRLSContext } from '../with-rls-context'
import { getCanonicalOrganizationContext } from '@/lib/auth/canonical-context'
import { currentCanonicalRequest } from '@/lib/auth/canonical-request-scope'

describe('evidence identity while a case transaction holds the principal lock', () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
    state.inTransaction = false; state.bridges = 0; state.profiles = 0
    state.auth.mockResolvedValue({ userId: state.actor, orgId: state.org })
    state.tx.execute.mockResolvedValue([])
    state.tx.transaction.mockImplementation(async (work: (tx: typeof state.tx) => Promise<unknown>) => work(state.tx))
  })

  it('seals through the existing identity without a fresh auth query or bridge under the case lock', async () => {
    await withRLSContext(async () => {
      expect(state.inTransaction).toBe(true)
      const profile = await getCanonicalOrganizationContext({ organizationId: state.org, expectedActorUserId: state.actor })
      expect(profile).toMatchObject({ userId: state.actor, organizationId: state.org, role: 'officer' })
      expect(profile).not.toHaveProperty('sessionToken')
      await withRLSContext({ organizationId: state.org }, async () => {
        expect((await getCanonicalOrganizationContext()).userId).toBe(state.actor)
      })
    })
    expect(state.bridges).toBe(1); expect(state.profiles).toBe(1)
    expect(state.auth).toHaveBeenCalledTimes(1)
    expect(currentCanonicalRequest()).toBeNull()
  })

  it('binds an explicit verified organization before opening its transaction', async () => {
    const other = 'bbbbbbbb-0000-4000-8000-000000000002'
    await withRLSContext({ organizationId: other }, async () => {
      expect((await getCanonicalOrganizationContext()).organizationId).toBe(other)
    })
    expect(state.bridges).toBe(1)
  })

  it('refuses actor and organization substitutions without opening another bridge', async () => {
    await withRLSContext(async () => {
      await expect(getCanonicalOrganizationContext({ expectedActorUserId: 'different-actor' }))
        .rejects.toMatchObject({ code: 'ACTOR_MISMATCH' })
      await expect(getCanonicalOrganizationContext({ organizationId: 'bbbbbbbb-0000-4000-8000-000000000002' }))
        .rejects.toMatchObject({ code: 'MEMBERSHIP_REQUIRED' })
      await expect(getCanonicalOrganizationContext({ requiredRoles: ['president'] }))
        .rejects.toMatchObject({ code: 'ROLE_REQUIRED' })
    })
    expect(state.bridges).toBe(1); expect(state.profiles).toBe(1)
  })

  it('clears request authority after failure and does not leak it to another request', async () => {
    await expect(withRLSContext(async () => { throw new Error('Evidence seal failed') }))
      .rejects.toThrow('Evidence seal failed')
    expect(currentCanonicalRequest()).toBeNull()
    await withRLSContext(async () => expect((await getCanonicalOrganizationContext()).userId).toBe(state.actor))
    expect(state.bridges).toBe(2)
  })

  it('refuses authority inherited by detached work after the transaction returns', async () => {
    let release!: () => void
    const afterReturn = new Promise<void>(resolve => { release = resolve })
    let detached!: Promise<unknown>
    await withRLSContext(async () => {
      detached = (async () => { await afterReturn; return getCanonicalOrganizationContext() })()
    })
    release()
    await expect(detached).rejects.toMatchObject({ code: 'SESSION_AUTHORITY_REQUIRED' })
    expect(state.bridges).toBe(1)
  })
})
