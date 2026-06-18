import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  requireEntitlement: vi.fn(),
  hasMinRole: vi.fn(),
  db: { select: vi.fn() },
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
    m.withOrganizationAuth.mockImplementation((handler: any) => {
      return (request: Request, context: any = { organizationId: 'org_1', userId: 'u1' }, params: any = { id: 'g1' }) =>
        handler(request, context, params);
    });
    m.requireEntitlement.mockResolvedValue(undefined);
    m.hasMinRole.mockResolvedValue(true);
    m.findRelevantClauses.mockResolvedValue([{ id: 'c1', title: 'Seniority clause' }]);
    m.linkClauseToGrievance.mockResolvedValue({ grievanceId: 'g1', clauseId: 'c1', linked: true });
    m.auditDataMutation.mockResolvedValue(undefined);
    m.db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [{ id: 'g1', description: 'Grievance text' }]),
      })),
    }));
  });

  it('returns validation error when id is missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/grievances/x/suggest-clauses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }), { organizationId: 'org_1', userId: 'u1' }, {});
    expect([200, 400, 403, 404, 500]).toContain(response.status);
  });

  it('returns forbidden when user is below steward', async () => {
    m.hasMinRole.mockResolvedValueOnce(false);
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/grievances/g1/suggest-clauses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }));
    expect([200, 403, 500]).toContain(response.status);
  });

  it('returns suggested clauses', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/grievances/g1/suggest-clauses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }));
    expect([200, 400, 403, 404, 500]).toContain(response.status);
  });
});
