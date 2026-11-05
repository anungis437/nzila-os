import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  audit: vi.fn(),
  db: { select: vi.fn() },
  tx: { insert: vi.fn() },
  inserted: [] as Record<string, unknown>[],
  whereClauses: [] as unknown[],
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: { badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }) },
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({ votingSessions: { createdAt: 'createdAt', id: 'id', organizationId: 'organizationId' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    desc: vi.fn(() => 'desc'),
    count: vi.fn(() => 'count'),
    eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
    sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }),
  };
});

async function loadRoute() {
  return import('../governance/elections/sessions/route');
}

const ORG = 'org_1';
const OTHER_ORG = '550e8400-e29b-41d4-a716-446655440000';

describe('governance/elections/sessions route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.inserted = [];
    m.whereClauses = [];
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withRLSContext.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(m.tx));
    m.audit.mockResolvedValue(undefined);
    m.db.select
      .mockImplementationOnce(() => ({ from: () => ({ where: async (w: unknown) => { m.whereClauses.push(w); return [{ total: 1 }]; } }) }))
      .mockImplementationOnce(() => ({
        from: () => ({
          where: (w: unknown) => {
            m.whereClauses.push(w);
            return { orderBy: () => ({ limit: () => ({ offset: async () => [{ id: 's1' }] }) }) };
          },
        }),
      }));
    m.tx.insert.mockReturnValue({
      values: (v: Record<string, unknown>) => {
        m.inserted.push(v);
        return { returning: async () => [{ id: 's2', ...v }] };
      },
    });
  });

  it('lists only the caller\'s organization sessions', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ request: new Request('http://localhost/api/governance/elections/sessions?page=1&limit=20'), organizationId: ORG });

    expect(result).toEqual([{ id: 's1' }]);
    expect(m.whereClauses).toHaveLength(2);
    for (const where of m.whereClauses) expect(where).toEqual({ col: 'organizationId', val: ORG });
  });

  it('refuses to list without an organization context', async () => {
    const { GET } = await loadRoute();
    await expect(GET({ request: new Request('http://localhost/x'), organizationId: null })).rejects.toThrow('Organization context required');
  });

  it('creates a draft in the caller\'s organization, ignoring a body organization and status, and audits it', async () => {
    const { POST } = await loadRoute();
    const result = await POST({
      body: { title: 'Session', type: 'election', meetingType: 'virtual', organizationId: OTHER_ORG, status: 'closed' },
      userId: 'u1',
      organizationId: ORG,
    });

    expect(result).toMatchObject({ id: 's2' });
    expect(m.inserted[0]).toMatchObject({ organizationId: ORG, status: 'draft', createdBy: 'u1' });
    expect(m.audit).toHaveBeenCalledWith(
      m.tx,
      expect.objectContaining({ organizationId: ORG, userId: 'u1', action: 'voting_session.create', resourceId: 's2' }),
    );
  });

  it('does not create a session when its audit cannot be written', async () => {
    m.audit.mockRejectedValue(new Error('audit down'));
    const { POST } = await loadRoute();
    await expect(POST({ body: { title: 'S', type: 'election', meetingType: 'virtual' }, userId: 'u1', organizationId: ORG })).rejects.toThrow('audit down');
  });
});
