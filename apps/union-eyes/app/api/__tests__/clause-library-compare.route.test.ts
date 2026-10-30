import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { select: vi.fn(), update: vi.fn() },
  canReadSharedClause: vi.fn(),
  audit: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: { badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }) } }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/db/schema/domains/agreements/shared-library', () => ({ sharedClauseLibrary: { id: 'id', clauseNumber: 'clauseNumber', clauseTitle: 'clauseTitle', clauseText: 'clauseText', clauseType: 'clauseType', sharingLevel: 'sharingLevel', sharedWithOrgIds: 'sharedWithOrgIds', sector: 'sector', province: 'province', effectiveDate: 'effectiveDate', expiryDate: 'expiryDate', sourceOrganizationId: 'sourceOrganizationId', comparisonCount: 'comparisonCount' }, clauseLibraryTags: { clauseId: 'clauseId', tagName: 'tagName' } }));
vi.mock('@/db/schema-organizations', () => ({ organizations: { id: 'id', name: 'name' } }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/lib/clause-library/sharing-authority', () => ({ canReadSharedClause: m.canReadSharedClause }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), inArray: vi.fn(() => 'inArray'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

const C1 = '11111111-1111-4111-8111-111111111111';
const C2 = '22222222-2222-4222-8222-222222222222';

async function loadRoute() {
  return import('../clause-library/compare/route');
}

describe('clause-library/compare route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withSystemContext.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(m.db));
    m.audit.mockResolvedValue(undefined);
    m.canReadSharedClause.mockResolvedValue(true);
    m.db.select
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ leftJoin: vi.fn(() => ({ where: vi.fn(async () => [{ id: C1, clauseType: 'policy', sector: 'finance', clauseText: 'The grievance procedure applies' }, { id: C2, clauseType: 'policy', sector: 'finance', clauseText: 'A grievance procedure is required' }]) })) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ clauseId: C1, tagName: 'tag-a' }, { clauseId: C2, tagName: 'tag-b' }]) })) }));
    m.db.update.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) });
  });

  it('compares multiple clauses', async () => {
    const { POST } = await loadRoute();
    const result = await POST({ request: { json: async () => ({ clauseIds: [C1, C2] }) }, organizationId: 'org-a', userId: 'u1' });

    expect(result.analysis.statistics.totalClauses).toBe(2);
    expect(result.clauses).toHaveLength(2);
    // DEF-0B4-CLAUSE-LIBRARY-COMPARE-GET-STUB-AND-EMPTY-KEYWORDS: the keywords are those the compared clauses share.
    expect(result.analysis.commonKeywords).toEqual(['grievance', 'procedure']);
    expect(m.audit).toHaveBeenCalledWith(
      m.db,
      expect.objectContaining({ organizationId: 'org-a', userId: 'u1', action: 'clause_library.compare', details: { clauseIds: [C1, C2] } }),
    );
  });

  it('fails the comparison when the audit record cannot be written', async () => {
    m.audit.mockRejectedValueOnce(new Error('audit down'));
    const { POST } = await loadRoute();
    await expect(
      POST({ request: { json: async () => ({ clauseIds: [C1, C2] }) }, organizationId: 'org-a', userId: 'u1' }),
    ).rejects.toThrow('audit down');
  });

  it('writes and audits nothing when no clause is readable by the caller', async () => {
    m.canReadSharedClause.mockResolvedValue(false);
    const { POST } = await loadRoute();
    const result = await POST({ request: { json: async () => ({ clauseIds: [C1, C2] }) }, organizationId: 'org-a', userId: 'u1' });
    expect(result.clauses).toEqual([]);
    expect(m.db.update).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('refuses a malformed clause id with 400 before reading anything, and has no GET stub', async () => {
    const mod = await loadRoute();
    await expect(mod.POST({ request: { json: async () => ({ clauseIds: [C1, 'not-an-id'] }) }, organizationId: 'org-a', userId: 'u1' })).rejects.toMatchObject({ status: 400 });
    await expect(mod.POST({ request: { json: async () => { throw new Error('bad json'); } }, organizationId: 'org-a', userId: 'u1' })).rejects.toMatchObject({ status: 400 });
    expect(m.withSystemContext).not.toHaveBeenCalled();
    expect((mod as Record<string, unknown>).GET).toBeUndefined();
  });
});
