import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  hasMinRole: vi.fn(),
  getOrgAuthPolicy: vi.fn(),
  updateOrgAuthPolicy: vi.fn(),
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@nzila/platform-auth/policy', () => ({ getOrgAuthPolicy: m.getOrgAuthPolicy }));
vi.mock('@nzila/platform-auth/policy/admin', () => ({ updateOrgAuthPolicy: m.updateOrgAuthPolicy }));

async function loadRoute() {
  return import('../auth/policy/route');
}

describe('auth/policy route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withOrganizationAuth.mockImplementation((handler: any) => (request: NextRequest, context: any = { organizationId: 'org_1', userId: 'u1' }) => handler(request, context));
    m.hasMinRole.mockResolvedValue(true);
    m.getOrgAuthPolicy.mockResolvedValue({ allowMagicLink: true });
    m.updateOrgAuthPolicy.mockResolvedValue({ success: true, policy: { allowMagicLink: false } });
  });

  it('GET returns 403 when caller is not admin', async () => {
    const { GET } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await GET(new NextRequest('http://localhost/api/auth/policy'));

    expect(response.status).toBe(403);
  });

  it('GET returns current auth policy for admins', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/auth/policy'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ allowMagicLink: true });
  });

  it('PUT returns 400 for invalid JSON', async () => {
    const { PUT } = await loadRoute();

    const response = await PUT(new NextRequest('http://localhost/api/auth/policy', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: '{not-json',
    }));

    expect(response.status).toBe(400);
  });

  it('PUT returns 400 when update operation fails', async () => {
    const { PUT } = await loadRoute();
    m.updateOrgAuthPolicy.mockResolvedValueOnce({ success: false, error: 'invalid_policy_state' });

    const response = await PUT(new NextRequest('http://localhost/api/auth/policy', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requireSso: true }),
    }));

    expect(response.status).toBe(400);
  });

  it('PUT updates and returns policy when payload is valid', async () => {
    const { PUT } = await loadRoute();

    const response = await PUT(new NextRequest('http://localhost/api/auth/policy', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ allowMagicLink: false, requireInvite: true }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ allowMagicLink: false });
    expect(m.updateOrgAuthPolicy).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org_1', actorUserId: 'u1' }));
  });
});