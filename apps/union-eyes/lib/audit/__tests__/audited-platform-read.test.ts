import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ perform: vi.fn(), atomic: vi.fn() }))

vi.mock('@/lib/api/framework', () => ({
  ApiError: { conflict: (message: string) => Object.assign(new Error(message), { code: 'CONFLICT' }) },
}))
vi.mock('@/lib/audit/operation-audit', () => {
  class OperationAuditError extends Error {
    readonly code = 'OPERATION_AUDIT_UNAVAILABLE'
  }
  return {
    OperationAuditError,
    operationAuditResponse: (error: unknown) =>
      error instanceof OperationAuditError ? { status: 409, body: { error: { code: 'OPERATION_AUDIT_UNAVAILABLE', message: error.message } } } : null,
    performAuditedOperation: m.perform,
    performAtomicAuditedOperation: m.atomic,
  }
})

import { performAtomicPlatformRead, performAuditedPlatformRead } from '../audited-platform-read'
import { OperationAuditError } from '@/lib/audit/operation-audit'

// DEF-0B2-PLATFORM-DIRECTORY-UNSCOPED-READ
describe('performAuditedPlatformRead', () => {
  beforeEach(() => vi.clearAllMocks())

  it('records the read under the system scope before running it', async () => {
    m.perform.mockImplementation(async (_op: unknown, operation: () => Promise<unknown>) => operation())
    const result = await performAuditedPlatformRead(
      { organizationId: 'org_1', userId: 'user_1' },
      { action: 'platform.user_directory.read', resourceType: 'organization_members' },
      async () => 'rows',
    )
    expect(result).toBe('rows')
    expect(m.perform).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org_1', userId: 'user_1', scope: 'system', action: 'platform.user_directory.read' }),
      expect.any(Function),
    )
  })

  it('refuses with a conflict, and reads nothing, when the audit record cannot be written', async () => {
    const operation = vi.fn(async () => 'rows')
    m.perform.mockRejectedValue(new OperationAuditError('audit unavailable'))
    await expect(
      performAuditedPlatformRead({ organizationId: 'org_1', userId: 'user_1' }, { action: 'a', resourceType: 'r' }, operation),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(operation).not.toHaveBeenCalled()
  })

  it('passes any other failure through unchanged', async () => {
    m.perform.mockRejectedValue(new Error('database down'))
    await expect(
      performAuditedPlatformRead({ organizationId: 'org_1', userId: 'user_1' }, { action: 'a', resourceType: 'r' }, async () => 1),
    ).rejects.toThrow('database down')
  })
})

// DEF-0B2-PLATFORM-DIRECTORY-UNSCOPED-READ, DEF-0B10-OPL-14: the read and its record in one system transaction.
describe('performAtomicPlatformRead', () => {
  beforeEach(() => vi.clearAllMocks())

  it('runs the read and its record as one system-scope operation, giving the work the transaction', async () => {
    m.atomic.mockImplementation(async (_op: unknown, work: (tx: unknown) => Promise<unknown>) => work('system-tx'))
    const work = vi.fn(async (tx: unknown) => ({ tx }))
    const resultDetails = (value: { tx: unknown }) => ({ got: String(value.tx) })

    const result = await performAtomicPlatformRead(
      { organizationId: 'org_1', userId: 'user_1' },
      { action: 'platform.stats.read', resourceType: 'platform_stats', details: { a: 1 }, resultDetails },
      work,
    )

    expect(result).toEqual({ tx: 'system-tx' })
    expect(m.atomic).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org_1', userId: 'user_1', scope: 'system', action: 'platform.stats.read', resourceType: 'platform_stats', details: { a: 1 }, resultDetails }),
      work,
    )
    expect(m.perform).not.toHaveBeenCalled()
  })

  it('refuses with a conflict, and returns nothing, when the audit record cannot be written', async () => {
    m.atomic.mockRejectedValue(new OperationAuditError('audit unavailable'))
    await expect(
      performAtomicPlatformRead({ organizationId: 'org_1', userId: 'user_1' }, { action: 'a', resourceType: 'r' }, async () => 'rows'),
    ).rejects.toMatchObject({ code: 'CONFLICT', message: 'audit unavailable' })
  })

  it('passes any other failure through unchanged', async () => {
    m.atomic.mockRejectedValue(new Error('database down'))
    await expect(
      performAtomicPlatformRead({ organizationId: 'org_1', userId: 'user_1' }, { action: 'a', resourceType: 'r' }, async () => 1),
    ).rejects.toThrow('database down')
  })
})