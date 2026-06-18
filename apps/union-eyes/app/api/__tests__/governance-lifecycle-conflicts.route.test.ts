import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { select: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@nzila/db/schema', () => ({ policyConflicts: { isActive: 'isActive', severity: 'severity', detectedAt: 'detectedAt' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: vi.fn(() => 'eq'),
    desc: vi.fn(() => 'desc'),
    and: vi.fn(() => 'and'),
    sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }),
  };
});

async function loadRoute() {
  return import('../governance/lifecycle/conflicts/route');
}

describe('governance/lifecycle/conflicts route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) =>
      (ctx: any) => handler(ctx));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.db.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(async () => [{ id: 'c1' }, { id: 'c2' }]),
          })),
        })),
      })),
    } as any);
  });

  it('lists active conflicts', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ request: new Request('http://localhost/api/governance/lifecycle/conflicts?severity=high') });

    expect(result).toEqual({ conflicts: [{ id: 'c1' }, { id: 'c2' }], count: 2 });
  });
});