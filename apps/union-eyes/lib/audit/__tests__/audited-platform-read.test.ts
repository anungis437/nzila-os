import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ perform: vi.fn() }))

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
  }
})

import { performAuditedPlatformRead } from '../audited-platform-read'
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
