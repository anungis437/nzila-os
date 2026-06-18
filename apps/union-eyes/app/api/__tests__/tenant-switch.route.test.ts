import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApiAuth: vi.fn(),
  validateOrganizationExists: vi.fn(),
  standardErrorResponse: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: m.withApiAuth }));
vi.mock('@/lib/organization-utils', () => ({ validateOrganizationExists: m.validateOrganizationExists }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  standardErrorResponse: m.standardErrorResponse,
}));

async function loadRoute() {
  return import('../tenant/switch/route');
}

describe('tenant/switch route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApiAuth.mockImplementation((handler: any) => (request: NextRequest, context: any) => handler(request, context));
    m.validateOrganizationExists.mockResolvedValue(true);
    m.standardErrorResponse.mockImplementation((code: string, message: string) => {
      const status = code === 'VALIDATION_ERROR' ? 400 : code === 'NOT_FOUND' ? 404 : 500;
      return new Response(JSON.stringify({ code, message }), { status });
    });
  });

  it('returns 400 when organizationId is missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/tenant/switch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }), { userId: 'u1' });

    expect(response.status).toBe(400);
  });

  it('returns 404 when organization does not exist', async () => {
    const { POST } = await loadRoute();
    m.validateOrganizationExists.mockResolvedValueOnce(false);

    const response = await POST(new NextRequest('http://localhost/api/tenant/switch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org_missing' }),
    }), { userId: 'u1' });

    expect(response.status).toBe(404);
  });

  it('returns success payload with deprecation header', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/tenant/switch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org_1' }),
    }), { userId: 'u1' });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Deprecated')).toContain('/api/org/switch');
    expect(payload).toEqual({ success: true, org: { organizationId: 'org_1', name: null, slug: null } });
  });

  it('returns 500 when request json parsing fails', async () => {
    const { POST } = await loadRoute();
    const badRequest = { json: vi.fn().mockRejectedValue(new Error('bad-json')) } as unknown as NextRequest;

    const response = await POST(badRequest, { userId: 'u1' });

    expect(response.status).toBe(500);
  });
});