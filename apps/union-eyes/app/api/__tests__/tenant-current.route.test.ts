import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApiAuth: vi.fn(),
  resolveOrgIdFromContext: vi.fn(),
  standardErrorResponse: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: m.withApiAuth }));
vi.mock('@/lib/org-id-from-context', () => ({ resolveOrgIdFromContext: m.resolveOrgIdFromContext }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: {
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    NOT_FOUND: 'NOT_FOUND',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  standardErrorResponse: m.standardErrorResponse,
}));

async function loadRoute() {
  return import('../tenant/current/route');
}

describe('tenant/current route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApiAuth.mockImplementation((handler: any) => (request: NextRequest, context: any) => handler(request, context));
    m.resolveOrgIdFromContext.mockResolvedValue('org_1');
    m.standardErrorResponse.mockImplementation((code: string, message: string) => {
      const status = code === 'AUTH_REQUIRED' ? 401 : code === 'NOT_FOUND' ? 404 : 500;
      return new Response(JSON.stringify({ code, message }), { status });
    });
  });

  it('returns 401 when userId is missing', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/tenant/current'), { userId: null });

    expect(response.status).toBe(401);
  });

  it('returns 404 when no organization is resolved', async () => {
    const { GET } = await loadRoute();
    m.resolveOrgIdFromContext.mockResolvedValueOnce(null);

    const response = await GET(new NextRequest('http://localhost/api/tenant/current'), { userId: 'u1' });

    expect(response.status).toBe(404);
  });

  it('returns organization payload and deprecation header', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/tenant/current'), { userId: 'u1' });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Deprecated')).toContain('/api/org/current');
    expect(payload).toMatchObject({ org: { organizationId: 'org_1' }, availableOrgs: [{ organizationId: 'org_1' }] });
  });

  it('returns 500 on unexpected exception', async () => {
    const { GET } = await loadRoute();
    m.resolveOrgIdFromContext.mockRejectedValueOnce(new Error('boom'));

    const response = await GET(new NextRequest('http://localhost/api/tenant/current'), { userId: 'u1' });

    expect(response.status).toBe(500);
  });
});