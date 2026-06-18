import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { select: vi.fn(), update: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@nzila/db/schema', () => ({ governedPolicies: { id: 'id' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../governance/lifecycle/policies/[id]/route');
}

describe('governance/lifecycle/policies/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.db.select.mockReturnValue({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'p1', policyFamilyId: 'fam_1' }]) })) })) } as any);
    m.db.update.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'p1', lifecycleStatus: 'published' }]) })) })) } as any);
  });

  it('returns a governed policy', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ params: { id: 'p1' } });

    expect(result).toEqual({ policy: { id: 'p1', policyFamilyId: 'fam_1' } });
  });

  it('transitions a governed policy', async () => {
    const { PATCH } = await loadRoute();
    const result = await PATCH({ request: { json: async () => ({ targetState: 'published', actorRole: 'admin' }) }, params: { id: 'p1' }, user: { id: 'u1' } });

    expect(result).toEqual({ policy: { id: 'p1', lifecycleStatus: 'published' } });
  });
});