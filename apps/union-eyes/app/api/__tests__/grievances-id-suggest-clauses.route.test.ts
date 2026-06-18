import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  requireEntitlement: vi.fn(),
  hasMinRole: vi.fn(),
  db: { select: vi.fn() },
  selectQueue: [] as unknown[][],
  findRelevantClauses: vi.fn(),
  linkClauseToGrievance: vi.fn(),
  auditDataMutation: vi.fn(),
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/services/clause-intelligence', () => ({
  findRelevantClauses: m.findRelevantClauses,
  linkClauseToGrievance: m.linkClauseToGrievance,
}));
vi.mock('@/lib/audit-logger', () => ({ auditDataMutation: m.auditDataMutation }));

async function loadRoute() {
  return import('../grievances/[id]/suggest-clauses/route');
}

describe('grievances/[id]/suggest-clauses route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.withOrganizationAuth.mockImplementation((handler: any) => (request: Request, context: any = { organizationId: 'org_1', userId: 'u1' }, params: any = { id: 'g1' }) => handler(request, context, params));
    m.requireEntitlement.mockResolvedValue(undefined);
    m.hasMinRole.mockResolvedValue(true);
    m.findRelevantClauses.mockResolvedValue([{ id: 'c1', text: 'vacation clause' }, { id: 'c2', text: 'seniority clause' }]);
    m.linkClauseToGrievance.mockResolvedValue({ grievanceId: 'g1', clauseId: 'c1' });
    m.auditDataMutation.mockResolvedValue(undefined);

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

  it('returns validation error when id is missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/grievances/x/suggest-clauses'), { organizationId: 'org_1', userId: 'u1' }, {});

    expect(response.status).toBe(400);
  });

  it('returns forbidden for non-steward access', async () => {
    const { POST } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await POST(new Request('http://localhost/api/grievances/g1/suggest-clauses'));

    expect(response.status).toBe(403);
  });

  it('returns not found when grievance does not exist', async () => {
    const { POST } = await loadRoute();
    m.selectQueue = [[]];

    const response = await POST(new Request('http://localhost/api/grievances/g1/suggest-clauses'));

    expect(response.status).toBe(404);
  });

  it('suggests relevant clauses for a grievance', async () => {
    const { POST } = await loadRoute();
    m.selectQueue = [[{ id: 'g1', description: 'vacation dispute', organizationId: 'org_1' }]];

    const response = await POST(new Request('http://localhost/api/grievances/g1/suggest-clauses'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(2);
    expect(payload.data[0].id).toBe('c1');
    expect(m.findRelevantClauses).toHaveBeenCalledWith('org_1', 'vacation dispute');
  });

  it('links a clause to grievance when clauseId is provided', async () => {
    const { POST } = await loadRoute();
    m.selectQueue = [[{ id: 'g1', description: 'vacation dispute', organizationId: 'org_1' }]];

    const response = await POST(
      new Request('http://localhost/api/grievances/g1/suggest-clauses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clauseId: '11111111-1111-1111-1111-111111111111' }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({ grievanceId: 'g1', clauseId: 'c1' });
    expect(m.linkClauseToGrievance).toHaveBeenCalledWith('g1', '11111111-1111-1111-1111-111111111111');
    expect(m.auditDataMutation).toHaveBeenCalled();
  });

  it('handles invalid JSON gracefully', async () => {
    const { POST } = await loadRoute();
    m.selectQueue = [[{ id: 'g1', description: 'vacation dispute', organizationId: 'org_1' }]];

    const response = await POST(
      new Request('http://localhost/api/grievances/g1/suggest-clauses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{bad json',
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(2);
    expect(m.findRelevantClauses).toHaveBeenCalled();
  });

  it('returns internal error on database exception', async () => {
    const { POST } = await loadRoute();
    m.db.select.mockImplementationOnce(() => {
      throw new Error('db failure');
    });

    const response = await POST(new Request('http://localhost/api/grievances/g1/suggest-clauses'));

    expect(response.status).toBe(500);
  });
});
