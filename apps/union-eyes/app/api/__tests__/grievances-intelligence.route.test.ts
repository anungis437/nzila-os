import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  db: { select: vi.fn() },
  getEffectiveCaseAccess: vi.fn(),
  getRelatedDocuments: vi.fn(),
  findSimilarCases: vi.fn(),
  findPrecedentDocuments: vi.fn(),
  buildCaseGraph: vi.fn(),
  auditDataAccess: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/services/case-access-service', () => ({ getEffectiveCaseAccess: m.getEffectiveCaseAccess }));
vi.mock('@/services/case-intelligence/related-documents-service', () => ({ getRelatedDocuments: m.getRelatedDocuments }));
vi.mock('@/services/case-intelligence/case-pattern-detection-service', () => ({ findSimilarCases: m.findSimilarCases }));
vi.mock('@/services/case-intelligence/precedent-matching-service', () => ({ findPrecedentDocuments: m.findPrecedentDocuments }));
vi.mock('@/services/case-intelligence/case-knowledge-graph-service', () => ({ buildCaseGraph: m.buildCaseGraph }));
vi.mock('@/lib/audit-logger', () => ({ auditDataAccess: m.auditDataAccess }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../grievances/[id]/intelligence/route');
}

const GRIEVANCE = '22222222-2222-4222-8222-222222222222';
const get = () => new Request(`http://localhost/api/grievances/${GRIEVANCE}/intelligence`);
const grievanceRow = (createdBy: string) => vi.fn(() => ({
  from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: GRIEVANCE, createdBy }]) })) })),
}));

describe('grievances/[id]/intelligence route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.params = { id: GRIEVANCE };
    m.getEffectiveCaseAccess.mockResolvedValue({ canViewCase: true });
    m.getRelatedDocuments.mockResolvedValue([{ id: 'd1' }]);
    m.findSimilarCases.mockResolvedValue([{ id: 'g2' }]);
    m.findPrecedentDocuments.mockResolvedValue([{ id: 'p1' }]);
    m.buildCaseGraph.mockResolvedValue({ nodes: [{ id: GRIEVANCE }], edges: [] });
    m.auditDataAccess.mockResolvedValue(undefined);
    m.db.select = grievanceRow('u1');
  });

  it('declares what it asks of the wrapper: a member, the case-suite entitlement and a tenant transaction', async () => {
    await loadRoute();
    const config = declared.find((entry) => entry.openapi?.summary === 'Case intelligence for a grievance');
    expect(config?.auth).toEqual({ required: true, minRole: 'member' });
    expect(config?.entitlement).toBe('grievance_case_suite');
    expect(config?.rlsOrgContext).toBe(true);
  });

  it('answers 400 for a grievance id that is not a uuid, reading nothing', async () => {
    caller.params = { id: 'g1' };
    const { GET } = await loadRoute();
    expect((await GET(get())).status).toBe(400);
    expect(m.db.select).not.toHaveBeenCalled();
  });

  it('answers 404 for a grievance of another organization and computes nothing', async () => {
    m.db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => []) })) })) }));
    const { GET } = await loadRoute();
    expect((await GET(get())).status).toBe(404);
    expect(m.getRelatedDocuments).not.toHaveBeenCalled();
  });

  it('returns the intelligence payload and audits the read', async () => {
    const { GET } = await loadRoute();
    const response = await GET(get());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual({
      graph: { nodes: [{ id: GRIEVANCE }], edges: [] },
      relatedDocuments: [{ id: 'd1' }],
      similarCases: [{ id: 'g2' }],
      precedentDocuments: [{ id: 'p1' }],
    });
    expect(m.auditDataAccess).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org_1', userId: 'u1', resource: 'case_intelligence', resourceId: GRIEVANCE }));
  });

  it('denies a steward-level user who has no case relationship and computes nothing', async () => {
    m.getEffectiveCaseAccess.mockResolvedValue({ canViewCase: false });
    m.db.select = grievanceRow('someone-else');
    const { GET } = await loadRoute();
    const response = await GET(get());
    expect(response.status).toBe(403);
    expect(m.getRelatedDocuments).not.toHaveBeenCalled();
    expect(m.findSimilarCases).not.toHaveBeenCalled();
    expect(m.buildCaseGraph).not.toHaveBeenCalled();
  });

  it('never passes role seniority to the intelligence services', async () => {
    m.db.select = grievanceRow('someone-else');
    m.getEffectiveCaseAccess.mockResolvedValue({ canViewCase: true });
    const { GET } = await loadRoute();
    await GET(get());
    for (const call of [...m.getRelatedDocuments.mock.calls, ...m.findSimilarCases.mock.calls, ...m.buildCaseGraph.mock.calls]) {
      expect(call[0].actor).toEqual({ userId: 'u1' });
    }
  });
});
