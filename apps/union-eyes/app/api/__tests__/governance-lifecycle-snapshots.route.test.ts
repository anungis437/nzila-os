import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { select: vi.fn(), insert: vi.fn() },
  selectQueue: [] as unknown[][],
  insertedValues: [] as Record<string, unknown>[],
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
  },
}));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@nzila/db/schema', () => ({
  policyGovernanceSnapshots: { generatedAt: 'generatedAt' },
  governedPolicies: { id: 'id', semver: 'semver', domain: 'domain' },
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, desc: vi.fn(() => 'desc'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../governance/lifecycle/snapshots/route');
}

describe('governance/lifecycle/snapshots route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) =>
      (ctx: any) => handler(ctx));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.selectQueue = [[{ id: 's1' }]];
    m.insertedValues = [];
    m.db.select.mockImplementation(() => {
      const rows = (m.selectQueue.shift() ?? []) as unknown[];
      const chain: Record<string, unknown> = {};
      const finish = () => Promise.resolve(rows);
      chain.from = () => chain;
      chain.orderBy = () => chain;
      chain.limit = () => chain;
      chain.where = () => chain;
      chain.offset = finish;
      chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        finish().then(resolve, reject);
      return chain;
    });
    m.db.insert.mockReturnValue({
      values: vi.fn((values: Record<string, unknown>) => {
        m.insertedValues.push(values);
        return { returning: vi.fn(async () => [{ id: 'snapshot_1' }]) };
      }),
    });
  });

  it('lists snapshots', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ request: new Request('http://localhost/api/governance/lifecycle/snapshots?limit=10&offset=3') });

    expect(result).toEqual({ snapshots: [{ id: 's1' }], limit: 10, offset: 3 });
  });

  it('creates a governance snapshot', async () => {
    const { POST } = await loadRoute();
    m.selectQueue = [[{ id: 'p1' }, { id: 'p2' }]];
    const result = await POST({ request: new Request('http://localhost/api/governance/lifecycle/snapshots', { method: 'POST', body: '{}' }), user: { id: 'u1' } });

    expect(result).toEqual({ snapshot: { id: 'snapshot_1' } });
    expect(m.insertedValues[0]?.generatedByUserId).toBe('u1');
    expect(m.insertedValues[0]?.generatedByUserId).not.toBe('system');
  });

  it('POST rejects a missing user and does not stamp a system actor', async () => {
    const { POST } = await loadRoute();

    await expect(POST({
      request: new Request('http://localhost/api/governance/lifecycle/snapshots', { method: 'POST', body: '{}' }),
      user: null,
    })).rejects.toMatchObject({ status: 400 });

    expect(m.db.insert).not.toHaveBeenCalled();
    expect(m.withSystemContext).not.toHaveBeenCalled();
    expect(m.insertedValues).toHaveLength(0);
  });

  it('POST rejects a user without an id and does not write', async () => {
    const { POST } = await loadRoute();

    await expect(POST({
      request: new Request('http://localhost/api/governance/lifecycle/snapshots', { method: 'POST', body: '{}' }),
      user: { id: '' },
    })).rejects.toMatchObject({ status: 400 });

    expect(m.db.insert).not.toHaveBeenCalled();
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });
});