import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  seedOrganizationHierarchy: vi.fn(),
  seedChildOrganizations: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/role-middleware', () => ({ withRoleAuth: m.withRoleAuth }));
vi.mock('@/db/seeds/seed-org-hierarchy', () => ({ seedOrganizationHierarchy: m.seedOrganizationHierarchy }));
vi.mock('@/db/seeds/seed-child-orgs', () => ({ seedChildOrganizations: m.seedChildOrganizations }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

async function loadRoute() {
  return import('../admin/seed-test-data/route');
}

describe('admin/seed-test-data route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation(
      (_role: string, handler: (request: Request, context: any) => Promise<Response>) =>
        (_request: Request, context: any = {}) => handler(_request, context),
    );
    m.seedOrganizationHierarchy.mockResolvedValue({ federationsCreated: 2, affiliatesCreated: 3, skipped: [] });
    m.seedChildOrganizations.mockResolvedValue({ localsCreated: 4, districtsCreated: 1, skipped: [] });
  });

  it('seeds the hierarchy with GET', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/admin/seed-test-data'), { userId: 'u1' });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.hierarchy.federationsCreated).toBe(2);
  });

  it('seeds the hierarchy with POST', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/admin/seed-test-data', { method: 'POST' }), { userId: 'u1' });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(m.seedChildOrganizations).toHaveBeenCalled();
  });
});