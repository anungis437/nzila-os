import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { select: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@nzila/db/schema', () => ({
  governedPolicies: {
    lifecycleStatus: 'lifecycleStatus',
    createdAt: 'createdAt',
    lastReviewedBy: 'lastReviewedBy',
    activatedAt: 'activatedAt',
  },
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: vi.fn(() => 'eq'),
    lt: vi.fn(() => 'lt'),
    and: vi.fn(() => 'and'),
    or: vi.fn(() => 'or'),
    isNull: vi.fn(() => 'isNull'),
    sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }),
  };
});

async function loadRoute() {
  return import('../governance/lifecycle/deprecation-watch/route');
}

describe('governance/lifecycle/deprecation-watch route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: () => Promise<unknown>) =>
      () => handler());
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.db.select
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ id: 'draft_1' }]) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ id: 'deprecated_1' }]) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ id: 'owned_1' }]) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ id: 'overdue_1' }]) })) }));
  });

  it('returns deprecation watch candidates', async () => {
    const { GET } = await loadRoute();
    const result = await GET();

    expect(result.candidates).toEqual([{ policy: { id: 'draft_1' }, reason: 'stale_draft' }]);
    expect(result.deprecated).toEqual([{ policy: { id: 'deprecated_1' }, reason: 'deprecated' }]);
    expect(result.staleOwnership).toEqual([{ policy: { id: 'owned_1' }, reason: 'no_owner' }]);
    expect(result.overdueReviews).toEqual([{ policy: { id: 'overdue_1' }, reason: 'overdue_review' }]);
  });
});