import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  db: { select: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({
  exitInterviews: {
    organizationId: 'organizationId',
    status: 'status',
    roleInUnion: 'roleInUnion',
    expertiseTags: 'expertiseTags',
    topics: 'topics',
    continuityRiskScore: 'continuityRiskScore',
  },
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: vi.fn(() => 'and'),
    eq: vi.fn(() => 'eq'),
  };
});

async function loadRoute() {
  return import('../exit-interviews/expertise-map/route');
}

describe('exit-interviews/expertise-map route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation(
      (_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx),
    );
    m.db.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(async () => [
          {
            id: 'i1',
            roleInUnion: 'steward',
            expertiseTags: ['policy'],
            topics: ['policy'],
            continuityRiskScore: 4,
          },
        ]),
      })),
    } as any);
  });

  it('returns an expertise map', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ organizationId: 'org_1' });

    expect(result.data.organizationId).toBe('org_1');
    expect(result.data.domains).toHaveLength(1);
  });
});
