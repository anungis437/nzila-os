import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { select: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@nzila/db/schema', () => ({ policyConflicts: { policyIdA: 'policyIdA', policyIdB: 'policyIdB', isActive: 'isActive', severity: 'severity', detectedAt: 'detectedAt' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), or: vi.fn(() => 'or'), and: vi.fn(() => 'and'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../governance/lifecycle/policies/[id]/conflicts/route');
}

describe('governance/lifecycle/policies/[id]/conflicts route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.db.select.mockReturnValue({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(async () => [{ id: 'c1' }]) })) })) } as any);
  });

  it('returns conflicts for a policy', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ params: { id: 'p1' }, request: { url: 'http://localhost/api/governance/lifecycle/policies/p1/conflicts' } });

    expect(result).toEqual({ conflicts: [{ id: 'c1' }] });
  });
});