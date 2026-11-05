import { describe, expect, it, vi } from 'vitest'
import type { AuthExecutionContext } from './auth-storage-authority/execution-boundary'
import { inviterAuthorityLockKey, inviterAuthorityLockUserId, lockInviterAuthority } from './auth-inviter-lock'

const lifecycle = (operation: 'suspend' | 'reactivate' | 'deprovision'): AuthExecutionContext => ({
  phase: 'lifecycle', actorUserId: 'actor', targetUserId: 'inviter-1', operation, reason: 'offboarding',
})

describe('inviter authority lock', () => {
  it('uses one key for redemption and the writes that end inviter authority', () => {
    expect(inviterAuthorityLockKey('inviter-1')).toBe('auth-inviter:inviter-1')
    expect(inviterAuthorityLockUserId(lifecycle('suspend'))).toBe('inviter-1')
    expect(inviterAuthorityLockUserId(lifecycle('deprovision'))).toBe('inviter-1')
    expect(inviterAuthorityLockUserId(lifecycle('reactivate'))).toBe('inviter-1')
    expect(inviterAuthorityLockUserId({
      phase: 'system', actorUserId: 'actor', targetUserId: 'inviter-1',
      operation: 'membership-state', organizationId: '11111111-1111-4111-8111-111111111111',
      reason: 'membership removal',
    })).toBe('inviter-1')
  })

  it('does not lock session revocation, redemption, or identity reads', () => {
    expect(inviterAuthorityLockUserId({
      phase: 'system', actorUserId: 'actor', targetUserId: 'inviter-1',
      operation: 'revoke-sessions', reason: 'sessions',
    })).toBeNull()
    expect(inviterAuthorityLockUserId({
      phase: 'redemption', selector: { kind: 'invite', tokenHash: 'a'.repeat(64) },
    })).toBeNull()
    expect(inviterAuthorityLockUserId({ phase: 'identity', userId: 'inviter-1' })).toBeNull()
  })

  it('takes a transaction advisory lock and refuses a blank inviter', async () => {
    const execute = vi.fn(async (_query: unknown) => [])
    await lockInviterAuthority({ execute }, 'inviter-1')
    expect(execute).toHaveBeenCalledTimes(1)
    const query = execute.mock.calls[0]?.[0]
    expect(JSON.stringify(query)).toContain('pg_advisory_xact_lock')
    expect(JSON.stringify(query)).toContain('auth-inviter:inviter-1')
    await expect(lockInviterAuthority({ execute }, '  ')).rejects.toThrow('Inviter authority lock requires a user id')
  })
})
