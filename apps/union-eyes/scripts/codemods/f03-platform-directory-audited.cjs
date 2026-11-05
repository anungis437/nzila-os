const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}
fs.writeFileSync('lib/audit/audited-platform-read.ts', `import { ApiError } from '@/lib/api/framework'
import { OperationAuditError, operationAuditResponse, performAuditedOperation } from '@/lib/audit/operation-audit'

// A platform-wide read of other organizations' member records is recorded before it runs, and is refused if the record cannot be written.
export async function performAuditedPlatformRead<T>(
  actor: { organizationId: string | null | undefined; userId: string | null | undefined },
  read: { action: string; resourceType: string; details?: Record<string, unknown> },
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await performAuditedOperation({ ...actor, scope: 'system', ...read }, operation)
  } catch (error) {
    const refused = error instanceof OperationAuditError ? operationAuditResponse(error) : null
    if (refused) throw ApiError.conflict(refused.body.error.message)
    throw error
  }
}
`)
edit('app/api/admin/users/route.ts', [
  [`import { withApi } from '@/lib/api/framework';`, `import { withApi } from '@/lib/api/framework';\nimport { performAuditedPlatformRead } from '@/lib/audit/audited-platform-read';`],
  [`  async (ctx) => {
    const url = new URL(ctx.request.url);
    const search = url.searchParams.get('search')?.trim() ?? '';

    let query = db`, `  async (ctx) => {
    const url = new URL(ctx.request.url);
    // A bounded term, with the pattern characters of LIKE taken literally.
    const search = (url.searchParams.get('search')?.trim() ?? '').slice(0, 100).replace(/[\\\\%_]/g, '\\\\$&');

    return performAuditedPlatformRead(
      ctx,
      { action: 'platform.user_directory.read', resourceType: 'organization_members', details: { searched: search.length > 0, limit: 100 } },
      async () => {
    let query = db`],
  [`      joinedAt: u.joinedAt ?? u.createdAt,
    }));
  },
);`, `      joinedAt: u.joinedAt ?? u.createdAt,
    }));
      },
    );
  },
);`],
])
edit('app/api/admin/stats/activity/route.ts', [
  [`import { withApi } from '@/lib/api/framework';`, `import { withApi } from '@/lib/api/framework';\nimport { performAuditedPlatformRead } from '@/lib/audit/audited-platform-read';`],
  [`    const limit = Math.min(Number(url.searchParams.get('limit') ?? '10'), 50);

    // Recent`, `    const requested = Number(url.searchParams.get('limit') ?? '10');
    const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 50) : 10;

    return performAuditedPlatformRead(
      ctx,
      { action: 'platform.member_activity.read', resourceType: 'organization_members', details: { limit } },
      async () => {
    // Recent`],
  [`    return activity;
  },
);`, `    return activity;
      },
    );
  },
);`],
])
for (const f of ['app/api/__tests__/admin-users.route.test.ts', 'app/api/__tests__/admin-stats-activity.route.test.ts']) {
  edit(f, [
    [`vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));`, `vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/audit/audited-platform-read', () => ({ performAuditedPlatformRead: m.audited }));`],
    [`  withApi: vi.fn(),`, `  withApi: vi.fn(),
  audited: vi.fn(async (_actor: unknown, _read: unknown, operation: () => Promise<unknown>) => operation()),`],
  ])
}
edit('app/api/__tests__/admin-users.route.test.ts', [
  [`    expect(Array.isArray(result)).toBe(true);`, `    expect(m.audited).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'platform.user_directory.read', details: { searched: true, limit: 100 } }), expect.any(Function));
    expect(Array.isArray(result)).toBe(true);`],
])
edit('app/api/__tests__/admin-stats-activity.route.test.ts', [
  [`    expect(result).toEqual([`, `    expect(m.audited).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'platform.member_activity.read' }), expect.any(Function));
    expect(result).toEqual([`],
])
fs.writeFileSync('lib/audit/__tests__/audited-platform-read.test.ts', `import { beforeEach, describe, expect, it, vi } from 'vitest'

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
`)
console.log('ok')
