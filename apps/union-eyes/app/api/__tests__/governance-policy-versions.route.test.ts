import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { select: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@nzila/db/schema', () => ({ governedPolicies: { id: 'id', policyFamilyId: 'policyFamilyId', createdAt: 'createdAt' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), asc: vi.fn(() => 'asc'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../governance/lifecycle/policies/[id]/versions/route');
}

describe('governance/lifecycle/policies/[id]/versions route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.db.select
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'p1', policyFamilyId: 'fam_1' }]) })) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(async () => [{ id: 'p1', semver: '1.0.0' }, { id: 'p2', semver: '1.1.0' }]) })) })) }));
  });

  it('returns versions for a policy family', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ params: { id: 'p1' } });

    expect(result).toEqual({ policyFamilyId: 'fam_1', versions: [{ id: 'p1', semver: '1.0.0' }, { id: 'p2', semver: '1.1.0' }] });
  });
});