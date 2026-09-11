import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  hasMinRole: vi.fn(),
  getCurrentUser: vi.fn(),
  bindPilotOrganization: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-auth-guard')>();
  return {
    ...actual,
    hasMinRole: m.hasMinRole,
    getCurrentUser: m.getCurrentUser,
    withApiAuth: (
      handler: (req: NextRequest, ctx?: { params?: Promise<{ id: string }> | { id: string } }) => Promise<Response>,
    ) => handler,
  };
});
vi.mock('@/lib/pilot/pilot-ownership', () => ({ bindPilotOrganization: m.bindPilotOrganization }));

async function loadRoute() {
  return import('../pilot/apply/[id]/verify-organization/route');
}

const VALID_ORG_ID = '11111111-1111-1111-1111-111111111111';

describe('pilot/apply/[id]/verify-organization route (PR #752 round 20)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.hasMinRole.mockResolvedValue(true);
    m.getCurrentUser.mockResolvedValue({ id: 'u-sysadmin' });
    m.bindPilotOrganization.mockResolvedValue({ ok: true, organizationId: VALID_ORG_ID });
  });

  it('rejects a caller without system_admin BEFORE any body/DB access', async () => {
    m.hasMinRole.mockResolvedValue(false);
    const { POST } = await loadRoute();

    const response = await POST(
      new NextRequest('http://localhost/api/pilot/apply/p1/verify-organization', {
        method: 'POST',
        body: JSON.stringify({ organizationId: VALID_ORG_ID }),
      }),
      { params: { id: 'p1' } },
    );

    expect(response.status).toBe(403);
    expect(m.bindPilotOrganization).not.toHaveBeenCalled();
  });

  it('returns 400 for a missing/invalid organizationId', async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      new NextRequest('http://localhost/api/pilot/apply/p1/verify-organization', {
        method: 'POST',
        body: JSON.stringify({ organizationId: 'not-a-uuid' }),
      }),
      { params: { id: 'p1' } },
    );

    expect(response.status).toBe(400);
    expect(m.bindPilotOrganization).not.toHaveBeenCalled();
  });

  it('binds the pilot to the organization and returns the verified id', async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      new NextRequest('http://localhost/api/pilot/apply/p1/verify-organization', {
        method: 'POST',
        body: JSON.stringify({ organizationId: VALID_ORG_ID }),
      }),
      { params: { id: 'p1' } },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, verifiedOrganizationId: VALID_ORG_ID });
    expect(m.bindPilotOrganization).toHaveBeenCalledWith({
      pilotId: 'p1',
      organizationId: VALID_ORG_ID,
      verifiedBy: 'u-sysadmin',
    });
  });

  it('propagates a 404 when the target organization does not exist', async () => {
    m.bindPilotOrganization.mockResolvedValue({ ok: false, status: 404, error: 'Organization not found' });
    const { POST } = await loadRoute();

    const response = await POST(
      new NextRequest('http://localhost/api/pilot/apply/p1/verify-organization', {
        method: 'POST',
        body: JSON.stringify({ organizationId: VALID_ORG_ID }),
      }),
      { params: { id: 'p1' } },
    );

    expect(response.status).toBe(404);
  });
});
