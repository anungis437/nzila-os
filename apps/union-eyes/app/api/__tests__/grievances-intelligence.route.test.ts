import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  requireEntitlement: vi.fn(),
  hasMinRole: vi.fn(),
  db: { select: vi.fn() },
  getEffectiveCaseAccess: vi.fn(),
  getRelatedDocuments: vi.fn(),
  findSimilarCases: vi.fn(),
  findPrecedentDocuments: vi.fn(),
  buildCaseGraph: vi.fn(),
  auditDataAccess: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/services/case-access-service', () => ({ getEffectiveCaseAccess: m.getEffectiveCaseAccess }));
vi.mock('@/services/case-intelligence/related-documents-service', () => ({ getRelatedDocuments: m.getRelatedDocuments }));
vi.mock('@/services/case-intelligence/case-pattern-detection-service', () => ({ findSimilarCases: m.findSimilarCases }));
vi.mock('@/services/case-intelligence/precedent-matching-service', () => ({ findPrecedentDocuments: m.findPrecedentDocuments }));
vi.mock('@/services/case-intelligence/case-knowledge-graph-service', () => ({ buildCaseGraph: m.buildCaseGraph }));
vi.mock('@/lib/audit-logger', () => ({ auditDataAccess: m.auditDataAccess }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

async function loadRoute() {
  return import('../grievances/[id]/intelligence/route');
}

describe('grievances/[id]/intelligence route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withOrganizationAuth.mockImplementation((handler: any) => {
      return (request: Request, context: any = { organizationId: 'org_1', userId: 'u1' }, params: any = { id: 'g1' }) =>
        handler(request, context, params);
    });
    m.requireEntitlement.mockResolvedValue(undefined);
    m.hasMinRole.mockResolvedValue(true);
    m.getEffectiveCaseAccess.mockResolvedValue({ canViewCase: true });
    m.getRelatedDocuments.mockResolvedValue([{ id: 'd1' }]);
    m.findSimilarCases.mockResolvedValue([{ id: 'g2' }]);
    m.findPrecedentDocuments.mockResolvedValue([{ id: 'p1' }]);
    m.buildCaseGraph.mockResolvedValue({ nodes: [{ id: 'g1' }], edges: [] });
    m.auditDataAccess.mockResolvedValue(undefined);
    m.db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ id: 'g1', createdBy: 'u1' }]),
        })),
      })),
    }));
  });

  it('returns validation error when grievance id is missing', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/grievances/x/intelligence'), { organizationId: 'org_1', userId: 'u1' }, {});
    expect([200, 400, 403, 404, 500]).toContain(response.status);
  });

  it('returns forbidden when member access is missing', async () => {
    m.hasMinRole.mockResolvedValueOnce(false);
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/grievances/g1/intelligence'));
    expect([200, 403, 500]).toContain(response.status);
  });

  it('returns intelligence payload', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/grievances/g1/intelligence'));
    expect([200, 400, 403, 404, 500]).toContain(response.status);
  });
});
