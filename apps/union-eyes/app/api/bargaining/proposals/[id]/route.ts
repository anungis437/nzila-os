import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  rawDelete: vi.fn(),
  select: vi.fn(),
  context: { request: null as NextRequest | null, params: { id: 'proposal-other' }, organizationId: 'org-a', userId: 'admin-a' },
}));

vi.mock('@/lib/api/crud-factory', () => ({
  crudRoutes: () => ({ GET: vi.fn(), PATCH: vi.fn(), DELETE: m.rawDelete }),
}));
vi.mock('@/lib/api/with-api', () => ({
  withApi: (_config: unknown, handler: (context: typeof m.context) => Promise<unknown>) =>
    (request: NextRequest, params: { params: Promise<{id:string}> }) =>
      params.params.then(resolved => handler({ ...m.context, request, params: resolved })),
}));
vi.mock('@/lib/api/errors', () => ({
  ApiError: { forbidden: () => new Error('forbidden'), notFound: () => new Error('not-found') },
}));
vi.mock('@/db/schema', () => ({
  bargainingProposals: { id: 'proposal-id', negotiationId: 'negotiation-id' },
  negotiations: { id: 'negotiation-id', organizationId: 'negotiation-org' },
}));
vi.mock('drizzle-orm', () => ({
  and: (...parts: unknown[]) => ({ and: parts }),
  eq: (col: unknown, value: unknown) => ({ eq: [col, value] }),
  inArray: (col: unknown, values: unknown) => ({ inArray: [col, values] }),
}));
vi.mock('@/db/db', () => ({
  db: {
    select: m.select,
  },
}));

const request = () => new NextRequest('http://localhost/api/bargaining/proposals/proposal-other', { method: 'DELETE' });
const params = { params: Promise.resolve({ id: 'proposal-other' }) };

beforeEach(() => {
  vi.clearAllMocks();
  m.context.organizationId = 'org-a';
  m.context.userId = 'admin-a';
  m.select.mockImplementation(() => ({
    from: () => ({
      where: () => ({
        limit: async () => [],
      }),
    }),
  }));
});

describe('bargaining proposal DELETE — parent ownership', () => {
  it('returns not-found before invoking a mutator for a foreign-tenant proposal', async () => {
    const { DELETE } = await import('../bargaining/proposals/[id]/route');
    await expect(DELETE(request(), params)).rejects.toThrow('not-found');
    expect(m.rawDelete).not.toHaveBeenCalled();
    expect(m.select).toHaveBeenCalledTimes(2);
  });
  it('refuses a request with no active organization without reading or deleting', async () => {
    m.context.organizationId = '';
    const { DELETE } = await import('../bargaining/proposals/[id]/route');
    await expect(DELETE(request(), params)).rejects.toThrow('forbidden');
    expect(m.select).not.toHaveBeenCalled();
    expect(m.rawDelete).not.toHaveBeenCalled();
  });
  it('delegates an owned proposal to the audited, scoped factory for an actual write', async () => {
    m.select.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ id: 'proposal-other' }],
        }),
      }),
    }));
    m.rawDelete.mockResolvedValue(new Response(JSON.stringify({ data: { id: 'proposal-other' } }), {
      status: 200, headers: { 'Content-Type': 'application/json', 'X-Audit-Proxy': 'present' },
    }));
    const { DELETE } = await import('../bargaining/proposals/[id]/route');
    const result = await DELETE(request(), params);
    expect(result.status).toBe(200);
    expect(result.headers.get('x-audit-proxy')).toBe('present');
    expect(await result.json()).toEqual({ data: { id: 'proposal-other' } });
    expect(m.rawDelete).toHaveBeenCalledTimes(1);
  });
});
