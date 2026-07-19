import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { select: vi.fn(), update: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: { badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }) } }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema/domains/agreements/shared-library', () => ({ sharedClauseLibrary: { id: 'id', clauseNumber: 'clauseNumber', clauseTitle: 'clauseTitle', clauseText: 'clauseText', clauseType: 'clauseType', sharingLevel: 'sharingLevel', sector: 'sector', province: 'province', effectiveDate: 'effectiveDate', expiryDate: 'expiryDate', sourceOrganizationId: 'sourceOrganizationId', comparisonCount: 'comparisonCount' }, clauseLibraryTags: { clauseId: 'clauseId', tagName: 'tagName' } }));
vi.mock('@/db/schema-organizations', () => ({ organizations: { id: 'id', name: 'name' } }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), inArray: vi.fn(() => 'inArray'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../clause-library/compare/route');
}

describe('clause-library/compare route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.db.select
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ leftJoin: vi.fn(() => ({ where: vi.fn(async () => [{ id: 'c1', clauseType: 'policy', sector: 'finance', clauseText: 'A' }, { id: 'c2', clauseType: 'policy', sector: 'finance', clauseText: 'B' }]) })) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ clauseId: 'c1', tagName: 'tag-a' }, { clauseId: 'c2', tagName: 'tag-b' }]) })) }));
    m.db.update.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) });
  });

  it('compares multiple clauses', async () => {
    const { POST } = await loadRoute();
    const result = await POST({ request: { json: async () => ({ clauseIds: ['c1', 'c2'] }) } });

    expect(result.analysis.statistics.totalClauses).toBe(2);
    expect(result.clauses).toHaveLength(2);
  });
});