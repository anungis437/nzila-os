import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  scopes: [] as unknown[],
  predicates: [] as unknown[],
  options: [] as Record<string, unknown>[],
  bareDb: vi.fn(() => { throw new Error('unscoped database access'); }),
}));

vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  return {
  withApi: (options: Record<string, unknown>, handler: unknown) => {
    m.options.push(options);
    return handler;
  },
  ApiError: {
    forbidden: (message: string) => Object.assign(new Error(message), { code: 'FORBIDDEN' }),
    badRequest: (message: string) => Object.assign(new Error(message), { code: 'VALIDATION_ERROR' }),
    notFound: (message: string) => Object.assign(new Error(message), { code: 'NOT_FOUND' }),
    conflict: (message: string) => Object.assign(new Error(message), { code: 'CONFLICT' }),
  },
  z,
  zUUID: z.string().uuid(),
  };
});
vi.mock('@/db/db', () => ({ db: { select: m.bareDb } }));
vi.mock('@/db/schema', () => ({
  bargainingNotes: {
    id: 'id', organizationId: 'organizationId', createdBy: 'createdBy',
    confidentialityLevel: 'confidentialityLevel',
  },
}));
vi.mock('drizzle-orm', () => ({
  eq: (column: unknown, value: unknown) => ({ column, value }),
  and: (...parts: unknown[]) => ({ and: parts }),
  or: (...parts: unknown[]) => ({ or: parts }),
  inArray: (column: unknown, values: unknown[]) => ({ column, values }),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn() }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (scope: unknown, callback: (tx: unknown) => Promise<unknown>) => {
    m.scopes.push(scope);
    return callback({
      select: () => ({
        from: () => ({
          where: (predicate: unknown) => {
            m.predicates.push(predicate);
            return { limit: async () => m.rows };
          },
        }),
      }),
    });
  },
}));

const organizationId = '11111111-1111-4111-8111-111111111111';
const noteId = '22222222-2222-4222-8222-222222222222';
const context = { organizationId, userId: 'member-1', params: { id: noteId } };
type Handler = (ctx: typeof context) => Promise<unknown>;

describe('bargaining note item read transaction and confidentiality boundary', () => {
  beforeEach(() => {
    m.rows = [{ id: noteId, organizationId, createdBy: 'member-1', title: 'Private note' }];
    m.scopes.length = 0;
    m.predicates.length = 0;
    m.options.length = 0;
    m.bareDb.mockClear();
  });

  it('uses the actual tenant transaction, with organization and visibility predicates', async () => {
    const { GET } = await import('../bargaining-notes/[id]/route');
    const result = await (GET as unknown as Handler)(context);
    expect(result).toEqual({ data: m.rows[0] });
    expect(m.options[0]).toMatchObject({ auth: { minRole: 'member' }, requireOrg: true });
    expect(m.scopes).toEqual([{ organizationId, userId: 'member-1' }]);
    expect(m.predicates[0]).toEqual({ and: [
      { column: 'id', value: noteId },
      { column: 'organizationId', value: organizationId },
      { or: [
        { column: 'confidentialityLevel', values: ['public', 'internal'] },
        { column: 'createdBy', value: 'member-1' },
      ] },
    ] });
    expect(m.bareDb).not.toHaveBeenCalled();
  });

  it('does not disclose a missing or invisible note', async () => {
    m.rows = [];
    const { GET } = await import('../bargaining-notes/[id]/route');
    await expect((GET as unknown as Handler)(context)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(m.bareDb).not.toHaveBeenCalled();
  });

  it('refuses malformed identifiers and missing tenant identity before any database query', async () => {
    const { GET } = await import('../bargaining-notes/[id]/route');
    await expect((GET as unknown as Handler)({ ...context, params: { id: 'bad' } }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect((GET as unknown as Handler)({ ...context, organizationId: '' }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(m.scopes).toHaveLength(0);
    expect(m.bareDb).not.toHaveBeenCalled();
  });
});
