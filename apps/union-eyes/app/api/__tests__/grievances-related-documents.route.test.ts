import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  db: { select: vi.fn() },
  getEffectiveCaseAccess: vi.fn(),
  getRelatedDocuments: vi.fn(),
  buildCaseGraph: vi.fn(),
  trackPilotEvent: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/services/case-access-service', () => ({ getEffectiveCaseAccess: m.getEffectiveCaseAccess }));
vi.mock('@/lib/services/case-related-documents-service', () => ({ getRelatedDocuments: m.getRelatedDocuments }));
vi.mock('@/lib/services/case-knowledge-graph-service', () => ({ buildCaseGraph: m.buildCaseGraph }));
vi.mock('@/lib/services/pilot-tracking', () => ({ trackPilotEvent: m.trackPilotEvent }));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../grievances/[id]/related-documents/route');
}

const GRIEVANCE = '22222222-2222-4222-8222-222222222222';
const get = (query = '') => new Request(`http://localhost/api/grievances/${GRIEVANCE}/related-documents${query}`);
const grievanceRow = (createdBy: string) => vi.fn(() => ({
  from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: GRIEVANCE, createdBy }]) })) })),
}));

describe('grievances/[id]/related-documents route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.params = { id: GRIEVANCE };
    m.db.select = grievanceRow('u1');
    m.getEffectiveCaseAccess.mockResolvedValue({ canViewCase: true });
    m.getRelatedDocuments.mockResolvedValue([
      { id: 'd1', privacyLabel: 'internal', documentType: 'pdf', reasons: ['case_link'] },
    ]);
    m.buildCaseGraph.mockResolvedValue({ nodes: [{ id: GRIEVANCE }], edges: [] });
    m.trackPilotEvent.mockResolvedValue(undefined);
  });

  it('declares what it asks of the wrapper: a member, the case-suite entitlement and a tenant transaction', async () => {
    await loadRoute();
    const config = declared.find((entry) => entry.openapi?.summary === 'Documents related to a grievance');
    expect(config?.auth).toEqual({ required: true, minRole: 'member' });
    expect(config?.entitlement).toBe('grievance_case_suite');
    expect(config?.rlsOrgContext).toBe(true);
  });

  it('answers 400 for a grievance id that is not a uuid and for a query that is not valid, looking up no documents', async () => {
    const { GET } = await loadRoute();
    caller.params = { id: 'g1' };
    expect((await GET(get())).status).toBe(400);
    caller.params = { id: GRIEVANCE };
    expect((await GET(get('?limit=1000'))).status).toBe(400);
    expect((await GET(get('?includeGraph=maybe'))).status).toBe(400);
    expect(m.getRelatedDocuments).not.toHaveBeenCalled();
  });

  it('answers 404 for a grievance of another organization', async () => {
    m.db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => []) })) })) }));
    const { GET } = await loadRoute();
    expect((await GET(get())).status).toBe(404);
    expect(m.getRelatedDocuments).not.toHaveBeenCalled();
  });

  it('returns related documents scoped to the caller organization and actor', async () => {
    const { GET } = await loadRoute();
    const response = await GET(get('?limit=10'));
    expect(response.status).toBe(200);
    expect(m.getRelatedDocuments).toHaveBeenCalledWith({ caseId: GRIEVANCE, orgId: 'org_1', actor: { userId: 'u1' }, limit: 10 });
    expect(m.buildCaseGraph).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.data).toMatchObject({ total: 1, documents: [{ id: 'd1' }] });
  });

  it('builds the graph only when asked, and reads includeGraph=false as false', async () => {
    const { GET } = await loadRoute();
    await GET(get('?includeGraph=false'));
    expect(m.buildCaseGraph).not.toHaveBeenCalled();
    await GET(get('?includeGraph=true'));
    expect(m.buildCaseGraph).toHaveBeenCalledWith({ caseId: GRIEVANCE, orgId: 'org_1', actor: { userId: 'u1' } });
  });

  it('denies a steward-level user with no case relationship before any document or graph lookup', async () => {
    m.getEffectiveCaseAccess.mockResolvedValue({ canViewCase: false });
    m.db.select = grievanceRow('someone-else');
    const { GET } = await loadRoute();
    const response = await GET(get('?includeGraph=true'));
    expect(response.status).toBe(403);
    expect(m.getRelatedDocuments).not.toHaveBeenCalled();
    expect(m.buildCaseGraph).not.toHaveBeenCalled();
  });
});
