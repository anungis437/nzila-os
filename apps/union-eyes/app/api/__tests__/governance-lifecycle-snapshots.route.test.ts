import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { select: vi.fn(), insert: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
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
    m.db.select
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(() => ({ offset: vi.fn(async () => [{ id: 's1' }]) })) })) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ id: 'p1' }, { id: 'p2' }]) })) }));
    m.db.insert.mockReturnValue({ values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'snapshot_1' }]) })) });
  });

  it('lists snapshots', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ request: new Request('http://localhost/api/governance/lifecycle/snapshots?limit=10&offset=3') });

    expect(result).toEqual({ snapshots: [{ id: 's1' }], limit: 10, offset: 3 });
  });

  it('creates a governance snapshot', async () => {
    const { POST } = await loadRoute();
    const result = await POST({ request: new Request('http://localhost/api/governance/lifecycle/snapshots', { method: 'POST', body: '{}' }), user: { id: 'u1' } });

    expect(result).toEqual({ snapshot: { id: 'snapshot_1' } });
  });
});