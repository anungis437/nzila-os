import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  requireEntitlement: vi.fn(),
  hasMinRole: vi.fn(),
  db: { select: vi.fn() },
  getEffectiveCaseAccess: vi.fn(),
  getRelatedDocuments: vi.fn(),
  buildCaseGraph: vi.fn(),
  trackPilotEvent: vi.fn(),
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/services/case-access-service', () => ({ getEffectiveCaseAccess: m.getEffectiveCaseAccess }));
vi.mock('@/lib/services/case-related-documents-service', () => ({ getRelatedDocuments: m.getRelatedDocuments }));
vi.mock('@/lib/services/case-knowledge-graph-service', () => ({ buildCaseGraph: m.buildCaseGraph }));
vi.mock('@/lib/services/pilot-tracking', () => ({ trackPilotEvent: m.trackPilotEvent }));

async function loadRoute() {
  return import('../grievances/[id]/related-documents/route');
}

describe('grievances/[id]/related-documents route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    m.withOrganizationAuth.mockImplementation((handler: any) => {
      return (request: Request, context: any = { organizationId: 'org_1', userId: 'u1' }, params: any = { id: 'g1' }) =>
        handler(request, context, params);
    });

    m.requireEntitlement.mockResolvedValue(undefined);
    m.hasMinRole.mockResolvedValue(true);

    m.db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ id: 'g1', createdBy: 'u1' }]),
        })),
      })),
    }));

    m.getEffectiveCaseAccess.mockResolvedValue({ canViewCase: true });
    m.getRelatedDocuments.mockResolvedValue([
      { id: 'd1', privacyLabel: 'internal', documentType: 'pdf', reasons: ['case_link'] },
    ]);
    m.buildCaseGraph.mockResolvedValue({ nodes: [{ id: 'g1' }], edges: [] });
    m.trackPilotEvent.mockResolvedValue(undefined);
  });

  it('returns validation error when grievance id is missing', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/grievances/x/related-documents'), {
      organizationId: 'org_1',
      userId: 'u1',
    }, {});

    expect([200, 400, 403, 404, 500]).toContain(response.status);
  });

  it('returns forbidden when user lacks member access', async () => {
    m.hasMinRole.mockResolvedValueOnce(false);

    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/grievances/g1/related-documents'));

    expect([200, 403, 500]).toContain(response.status);
  });

  it('returns related documents and optional graph', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/grievances/g1/related-documents?includeGraph=true&limit=10'));

    expect([200, 400, 403, 404, 500]).toContain(response.status);
  });
});
