import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  list: vi.fn(),
  cba: vi.fn(),
  scopes: [] as unknown[],
  roles: [] as string[],
}));

vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: (role: string, handler: unknown) => { m.roles.push(role); return handler; },
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (scope: unknown, callback: (tx: unknown) => Promise<unknown>) => {
    m.scopes.push(scope);
    return callback({});
  },
}));
vi.mock('@/lib/services/bargaining-notes-service', () => ({
  listBargainingNotes: m.list,
}));
vi.mock('@/lib/services/bargaining-notes-audited-service', () => ({
  createBargainingNoteAudited: vi.fn(),
  ForeignAgreementError: class ForeignAgreementError extends Error {},
}));
vi.mock('@/lib/services/cba-audited-service', () => ({
  getCbaForOrganization: m.cba,
}));
vi.mock('@/db/schema', () => ({
  bargainingNotes: {
    organizationId: 'organizationId', confidentialityLevel: 'confidentialityLevel',
    createdBy: 'createdBy', cbaId: 'cbaId', sessionDate: 'sessionDate',
  },
}));
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ and: args }),
  or: (...args: unknown[]) => ({ or: args }),
  eq: (col: unknown, value: unknown) => ({ col, value }),
  inArray: (col: unknown, values: unknown[]) => ({ col, values }),
  asc: (col: unknown) => ({ asc: col }),
  desc: (col: unknown) => ({ desc: col }),
  count: () => 'count',
}));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: {
    FORBIDDEN: 'FORBIDDEN', RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    VALIDATION_ERROR: 'VALIDATION_ERROR', INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  standardErrorResponse: (code: string, message: string) =>
    Response.json({ code, message }, { status: code === 'VALIDATION_ERROR' ? 400 : code === 'FORBIDDEN' ? 403 : code === 'RESOURCE_NOT_FOUND' ? 404 : 500 }),
  standardSuccessResponse: (value: unknown) => Response.json(value),
}));

const organizationId = '11111111-1111-4111-8111-111111111111';
const userId = 'member-1';
const cbaId = '22222222-2222-4222-8222-222222222222';
const context = { organizationId, userId };

describe('bargaining notes collection query security and semantics', () => {
  beforeEach(() => {
    m.list.mockReset().mockResolvedValue({ notes: [{ id: 'note-1' }], total: 8, page: 2, limit: 5 });
    m.cba.mockReset().mockResolvedValue({ id: cbaId, organizationId });
    m.scopes.length = 0;
    m.roles.length = 0;
  });

  it('applies tag, agreement, author visibility, date, session and pagination in one tenant-scoped list', async () => {
    const { GET } = await import('../bargaining-notes/route');
    const query = new URLSearchParams({
      tags: 'wages,health', cbaId, sessionType: 'bargaining',
      dateFrom: '2026-10-01', dateTo: '2026-10-31', page: '2', limit: '5',
      sortBy: 'createdAt', sortOrder: 'asc',
    });
    const response = await (GET as unknown as (request: Request, ctx: typeof context) => Promise<Response>)(
      new Request('https://example.test/api/bargaining-notes?' + query), context,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ notes: [{ id: 'note-1' }], count: 1, total: 8, page: 2, limit: 5 });
    expect(m.cba).toHaveBeenCalledWith(organizationId, cbaId);
    expect(m.scopes).toEqual([{ organizationId, userId }]);
    expect(m.list).toHaveBeenCalledTimes(1);
    expect(m.list.mock.calls[0][0]).toMatchObject({
      organizationId, visibleToUserId: userId, cbaId,
      tags: ['wages', 'health'], sessionType: ['bargaining'],
      dateFrom: new Date('2026-10-01'), dateTo: new Date('2026-10-31'),
    });
    expect(m.list.mock.calls[0][1]).toEqual({ page: 2, limit: 5, sortBy: 'createdAt', sortOrder: 'asc' });
    expect(m.roles).toContain('member');
  });

  it.each(['page=0', 'tags=' + Array(21).fill('x').join(','), 'dateFrom=2026-02-30', 'sortBy=organizationId'])(
    'refuses invalid query before agreement lookup or tenant reads: %s', async (query) => {
      const { GET } = await import('../bargaining-notes/route');
      const response = await (GET as unknown as (request: Request, ctx: typeof context) => Promise<Response>)(
        new Request('https://example.test/api/bargaining-notes?' + query + '&cbaId=' + cbaId), context,
      );
      expect(response.status).toBe(400);
      expect(m.cba).not.toHaveBeenCalled();
      expect(m.scopes).toHaveLength(0);
      expect(m.list).not.toHaveBeenCalled();
    },
  );

  it('does not disclose a foreign agreement on tag search', async () => {
    m.cba.mockResolvedValue(null);
    const { GET } = await import('../bargaining-notes/route');
    const response = await (GET as unknown as (request: Request, ctx: typeof context) => Promise<Response>)(
      new Request('https://example.test/api/bargaining-notes?tags=wages&cbaId=' + cbaId), context,
    );
    expect(response.status).toBe(404);
    expect(m.scopes).toHaveLength(0);
    expect(m.list).not.toHaveBeenCalled();
  });
});
