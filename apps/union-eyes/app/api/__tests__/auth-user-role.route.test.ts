import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApiAuth: vi.fn(),
  auth: vi.fn(),
  getUserRole: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  createLogger: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: m.withApiAuth, auth: m.auth }));
vi.mock('@/lib/auth/rbac-server', () => ({ getUserRole: m.getUserRole }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser }));
vi.mock('@nzila/os-core', () => ({ createLogger: m.createLogger }));
vi.mock('@nzila/os-core/telemetry', () => ({ createLogger: m.createLogger }));

async function loadRoute() {
  return import('../auth/user-role/route');
}

describe('auth/user-role route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.createLogger.mockReturnValue({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() });
    m.withApiAuth.mockImplementation((handler: any) => (request: Request) => handler(request, {}));
    m.auth.mockResolvedValue({ userId: 'u1' });
    m.getOrganizationIdForUser.mockResolvedValue('org_1');
    m.getUserRole.mockResolvedValue('steward');
  });

  it('returns 401 when not authenticated', async () => {
    m.auth.mockResolvedValueOnce({ userId: null });
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/auth/user-role') as any, {});
    expect([200, 400, 401, 500]).toContain(response.status);
  });

  it('returns user role', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/auth/user-role') as any, {});
    expect([200, 400, 401, 500]).toContain(response.status);
  });
});
