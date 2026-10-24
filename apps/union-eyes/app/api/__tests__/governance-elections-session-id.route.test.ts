import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  db: { select: vi.fn(), update: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
    notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }),
  },
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({ votingSessions: { id: 'id', organizationId: 'organizationId' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../governance/elections/sessions/[id]/route');
}

const ctx = { organizationId: 'org-1' };

describe('governance/elections/sessions/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withRLSContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.db.select.mockReturnValue({ from: vi.fn(() => ({ where: vi.fn(async () => [{ id: 's1', status: 'open' }]) })) } as any);
    m.db.update.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 's1', status: 'closed' }]) })) })) } as any);
  });

  it('returns a session by id', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ ...ctx, request: { url: 'http://localhost/api/governance/elections/sessions/s1' } });

    expect(result).toEqual({ id: 's1', status: 'open' });
  });

  it('updates a session', async () => {
    const { PATCH } = await loadRoute();
    const result = await PATCH({ ...ctx, request: { url: 'http://localhost/api/governance/elections/sessions/s1' }, body: { status: 'closed' } });

    expect(result).toEqual({ id: 's1', status: 'closed' });
  });

  it('cancels a session', async () => {
    const { DELETE } = await loadRoute();
    const result = await DELETE({ ...ctx, request: { url: 'http://localhost/api/governance/elections/sessions/s1' } });

    expect(result).toEqual({ id: 's1', status: 'closed' });
  });

  it('rejects every operation without an organization context (no cross-union access)', async () => {
    const { GET, PATCH, DELETE } = await loadRoute();
    const request = { url: 'http://localhost/api/governance/elections/sessions/s1' };
    await expect(GET({ request, organizationId: null })).rejects.toThrow('Organization context required');
    await expect(PATCH({ request, body: { status: 'closed' }, organizationId: null })).rejects.toThrow('Organization context required');
    await expect(DELETE({ request, organizationId: null })).rejects.toThrow('Organization context required');
    expect(m.db.update).not.toHaveBeenCalled();
  });
});