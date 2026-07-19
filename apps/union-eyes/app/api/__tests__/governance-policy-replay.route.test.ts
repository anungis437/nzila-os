import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { select: vi.fn(), insert: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@nzila/db/schema', () => ({ governedPolicies: { id: 'id', semver: 'semver', policyFamilyId: 'policyFamilyId', createdAt: 'createdAt' }, policyReplaySessions: { sourcePolicyId: 'sourcePolicyId', createdAt: 'createdAt' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), desc: vi.fn(() => 'desc'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../governance/lifecycle/policies/[id]/replay/route');
}

describe('governance/lifecycle/policies/[id]/replay route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.db.select
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 's1' }]) })) })) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'p1', semver: '1.0.0' }]) })) })) }));
    m.db.insert.mockReturnValue({ values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 's2' }]) })) });
  });

  it('lists replay sessions', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ params: { id: 'p1' }, request: { url: 'http://localhost/api/governance/lifecycle/policies/p1/replay?limit=10' } });

    expect(result).toEqual({ sessions: [{ id: 's1' }] });
  });

  it('creates a replay session', async () => {
    const { POST } = await loadRoute();
    const result = await POST({ params: { id: 'p1' }, request: { json: async () => ({ actorRole: 'admin' }) }, user: { id: 'u1' } });

    expect(result).toEqual({ session: { id: 's2' } });
  });
});