import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  db: { select: vi.fn() },
  selectQueue: [] as unknown[][],
  getEffectiveCaseAccess: vi.fn(),
  findRelevantClauses: vi.fn(),
  linkClauseToGrievance: vi.fn(),
  persistAtomicAudit: vi.fn(),
  withRLSContext: vi.fn(),
  tx: {},
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/services/clause-intelligence', () => ({
  findRelevantClauses: m.findRelevantClauses,
  linkClauseToGrievance: m.linkClauseToGrievance,
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/services/case-access-service', () => ({ getEffectiveCaseAccess: m.getEffectiveCaseAccess }));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../grievances/[id]/suggest-clauses/route');
}

const G = '22222222-2222-4222-8222-222222222222';
const CLAUSE = '11111111-1111-4111-8111-111111111111';
const post = (body?: BodyInit) => new Request(`http://localhost/api/grievances/${G}/suggest-clauses`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body }),
});

describe('grievances/[id]/suggest-clauses route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.role = 'steward';
    caller.params = { id: G };
    m.selectQueue = [];
    m.getEffectiveCaseAccess.mockResolvedValue({ canViewCase: true, isPrimaryOwner: true, canDraftActions: true });
    m.findRelevantClauses.mockResolvedValue([{ id: 'c1', text: 'vacation clause' }, { id: 'c2', text: 'seniority clause' }]);
    m.linkClauseToGrievance.mockResolvedValue({ grievanceId: G, clauseId: CLAUSE, linked: true });
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (_c: unknown, fn: (tx: unknown) => unknown) => fn(m.tx));

    const createSelectChain = () => {
      const chain: any = {
        from: () => chain,
        where: () => chain,
        then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve((m.selectQueue.shift() ?? []) as unknown[]).then(resolve, reject),
      };
      return chain;
    };

    m.db.select = vi.fn(() => createSelectChain());
  });

  it('declares what it asks of the wrapper: a steward, the case-suite entitlement and a tenant transaction', async () => {
    await loadRoute();
    const config = declared.find((entry) => entry.openapi?.summary === 'Suggest or link collective-agreement clauses for a grievance');
    expect(config?.auth).toEqual({ required: true, minRole: 'steward' });
    expect(config?.entitlement).toBe('grievance_case_suite');
    expect(config?.rlsOrgContext).toBe(true);
  });

  it('returns validation error when the id is not a uuid, without querying', async () => {
    caller.params = { id: 'x' };
    const { POST } = await loadRoute();
    expect((await POST(post())).status).toBe(400);
    expect(m.db.select).not.toHaveBeenCalled();
  });

  it('returns forbidden below the steward role', async () => {
    caller.role = 'member';
    const { POST } = await loadRoute();
    expect((await POST(post())).status).toBe(403);
    expect(m.db.select).not.toHaveBeenCalled();
  });

  it('returns not found when grievance does not exist', async () => {
    const { POST } = await loadRoute();
    m.selectQueue = [[]];
    expect((await POST(post())).status).toBe(404);
  });

  it('refuses a clause id that is not a uuid before linking anything', async () => {
    const { POST } = await loadRoute();
    m.selectQueue = [[{ id: G, description: 'matter', organizationId: 'org_1', createdBy: 'u1' }]];
    const response = await POST(post(JSON.stringify({ clauseId: 'not-a-uuid' })));
    expect(response.status).toBe(400);
    expect(m.linkClauseToGrievance).not.toHaveBeenCalled();
  });

  it('denies a steward-level user with no case relationship before analysing or linking', async () => {
    const { POST } = await loadRoute();
    m.selectQueue = [[{ id: G, description: 'private matter', organizationId: 'org_1', createdBy: 'other' }]];
    m.getEffectiveCaseAccess.mockResolvedValueOnce({ canViewCase: false, isPrimaryOwner: false, canDraftActions: false });

    const response = await POST(post(JSON.stringify({ clauseId: CLAUSE })));

    expect(response.status).toBe(403);
    expect(m.findRelevantClauses).not.toHaveBeenCalled();
    expect(m.linkClauseToGrievance).not.toHaveBeenCalled();
  });

  it('allows read-only collaborators to see suggestions but not link clauses', async () => {
    const { POST } = await loadRoute();
    m.selectQueue = [[{ id: G, description: 'matter', organizationId: 'org_1', createdBy: 'other' }]];
    m.getEffectiveCaseAccess.mockResolvedValueOnce({ canViewCase: true, isPrimaryOwner: false, canDraftActions: false });

    const response = await POST(post(JSON.stringify({ clauseId: CLAUSE })));

    expect(response.status).toBe(403);
    expect(m.linkClauseToGrievance).not.toHaveBeenCalled();
  });

  it('suggests relevant clauses for a grievance', async () => {
    const { POST } = await loadRoute();
    m.selectQueue = [[{ id: G, description: 'vacation dispute', organizationId: 'org_1' }]];

    const response = await POST(post());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(2);
    expect(payload.data[0].id).toBe('c1');
    expect(m.findRelevantClauses).toHaveBeenCalledWith('org_1', 'vacation dispute');
  });

  it('searches with the text the person typed, not the grievance description, when one is sent', async () => {
    const { POST } = await loadRoute();
    m.selectQueue = [[{ id: G, description: 'vacation dispute', organizationId: 'org_1' }]];

    const response = await POST(post(JSON.stringify({ description: '  overtime paid at straight time  ' })));

    expect(response.status).toBe(200);
    expect(m.findRelevantClauses).toHaveBeenCalledWith('org_1', 'overtime paid at straight time');
    expect(m.linkClauseToGrievance).not.toHaveBeenCalled();
  });

  it('refuses a search text that is empty or longer than the limit', async () => {
    const { POST } = await loadRoute();
    for (const description of ['   ', 'x'.repeat(4001)]) {
      m.selectQueue = [[{ id: G, description: 'vacation dispute', organizationId: 'org_1' }]];
      expect((await POST(post(JSON.stringify({ description })))).status).toBe(400);
    }
    expect(m.findRelevantClauses).not.toHaveBeenCalled();
  });

  it('links a clause to grievance when clauseId is provided, with its audit in the same transaction', async () => {
    const { POST } = await loadRoute();
    m.selectQueue = [[{ id: G, description: 'vacation dispute', organizationId: 'org_1' }]];

    const response = await POST(post(JSON.stringify({ clauseId: CLAUSE })));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({ grievanceId: G, clauseId: CLAUSE });
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
    expect(m.linkClauseToGrievance).toHaveBeenCalledWith(G, CLAUSE, 'org_1', m.tx);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.tx, expect.objectContaining({ action: 'grievance.link_clause', resourceId: G }));
  });

  it('reads a request with no usable body as a request for suggestions', async () => {
    const { POST } = await loadRoute();
    m.selectQueue = [[{ id: G, description: 'vacation dispute', organizationId: 'org_1' }]];

    const response = await POST(post('{bad json'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(2);
    expect(m.findRelevantClauses).toHaveBeenCalled();
    expect(m.linkClauseToGrievance).not.toHaveBeenCalled();
  });

  it('answers 404 when the clause to link is not in the organization', async () => {
    const { ApiError } = await import('@/lib/api/errors');
    const { POST } = await loadRoute();
    m.selectQueue = [[{ id: G, description: 'vacation dispute', organizationId: 'org_1' }]];
    m.linkClauseToGrievance.mockRejectedValueOnce(ApiError.notFound('Clause'));
    expect((await POST(post(JSON.stringify({ clauseId: CLAUSE })))).status).toBe(404);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('returns internal error on database exception', async () => {
    const { POST } = await loadRoute();
    m.db.select.mockImplementationOnce(() => {
      throw new Error('db failure');
    });

    expect((await POST(post())).status).toBe(500);
  });
});
