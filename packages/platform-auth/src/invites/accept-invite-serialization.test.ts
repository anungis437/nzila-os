import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[][],
  lock: vi.fn(async (_executor: unknown, _userId: string) => undefined),
  complete: vi.fn(async () => ({})),
  inserted: [] as unknown[],
}))

vi.mock('@nzila/db/auth-client', () => ({ lockInviterAuthority: state.lock }))
vi.mock('../complete-auth', () => ({ completeAuthFirstFactor: state.complete }))
vi.mock('../auth-db', () => {
  const builder = () => {
    const query: Record<string, unknown> = {
      from: () => query,
      where: () => query,
      limit: () => query,
      for: () => query,
      set: () => query,
      then: (resolve: (rows: unknown) => unknown, reject: (error: unknown) => unknown) =>
        Promise.resolve(state.rows.shift() ?? []).then(resolve, reject),
    }
    return query
  }
  return {
    authDb: {
      select: builder,
      insert: () => ({ values: async (value: unknown) => { state.inserted.push(value) } }),
      update: builder,
      execute: async () => [],
    },
    withAuthContext: async (_context: unknown, callback: () => Promise<unknown>) => callback(),
    withAuthSavepoint: async (callback: () => Promise<unknown>) => callback(),
    withTenantAuthContext: async () => { throw new Error('unused') },
    insertAuthRow: async () => { throw new Error('membership write is not allowed in this test') },
  }
})

import { acceptInvite } from './service'

const invite = {
  id: 'invite-1',
  email: 'person@example.invalid',
  organizationId: '11111111-1111-4111-8111-111111111111',
  role: 'member',
  invitedBy: 'inviter-1',
  createdAt: new Date('2026-10-26T00:00:00Z'),
}

describe('invitation redemption serialization', () => {
  beforeEach(() => {
    state.rows = []
    state.inserted = []
    state.lock.mockClear()
    state.complete.mockClear()
  })

  it('confers nothing when the inviter is no longer live at the locked re-read', async () => {
    state.rows = [[invite], []]
    const result = await acceptInvite({ token: 'raw-token' })
    expect(result).toEqual({ success: false, error: 'Invalid or expired invite' })
    expect(state.lock).toHaveBeenCalledTimes(1)
    expect(state.lock.mock.calls[0]?.[1]).toBe('inviter-1')
    expect(state.complete).not.toHaveBeenCalled()
    expect(state.inserted).toMatchObject([{ eventType: 'invite_accept_failed', metadata: { reason: 'inviter_authority_lost' } }])
  })

  it('does not lock or mint a session for a missing or non-assignable invite', async () => {
    state.rows = [[]]
    expect(await acceptInvite({ token: 'missing' })).toEqual({ success: false, error: 'Invalid or expired invite' })
    state.rows = [[{ ...invite, role: 'coo' }]]
    expect(await acceptInvite({ token: 'escalation' })).toEqual({ success: false, error: 'Invalid invite role' })
    expect(state.lock).not.toHaveBeenCalled()
    expect(state.complete).not.toHaveBeenCalled()
  })

  it('locks the inviter before minting a session when the re-read is still live', async () => {
    state.rows = [[invite], [invite], [{ userId: 'user-1' }], [{ id: 'membership-1' }]]
    state.complete.mockImplementation(async () => {
      expect(state.lock).toHaveBeenCalledWith(expect.anything(), 'inviter-1')
      return {}
    })
    const result = await acceptInvite({ token: 'raw-token' })
    expect(result.success).toBe(true)
    expect(result.user).toMatchObject({ id: 'user-1', organizationId: invite.organizationId, role: 'member' })
    expect(state.lock).toHaveBeenCalledTimes(1)
    expect(state.complete).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', organizationId: invite.organizationId }))
  })
})
