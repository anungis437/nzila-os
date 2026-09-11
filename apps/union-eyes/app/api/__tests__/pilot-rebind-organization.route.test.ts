import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  hasMinRole: vi.fn(),
  getCurrentUser: vi.fn(),
  rebindPilotOrganization: vi.fn(),
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
vi.mock('@/lib/pilot/pilot-ownership', () => ({ rebindPilotOrganization: m.rebindPilotOrganization }));

async function loadRoute() {
  return import('../pilot/apply/[id]/rebind-organization/route');
}

const VALID_ORG_ID = '11111111-1111-1111-1111-111111111111';
const PREVIOUS_ORG_ID = '22222222-2222-2222-2222-222222222222';
const VALID_REASON = 'Org A was a data-entry mistake; the real org is Org B.';

function postRequest(body: unknown) {
  return new NextRequest('http://localhost/api/pilot/apply/p1/rebind-organization', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('pilot/apply/[id]/rebind-organization route (PR #752 round 21)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.hasMinRole.mockResolvedValue(true);
    m.getCurrentUser.mockResolvedValue({ id: 'u-sysadmin' });
    m.rebindPilotOrganization.mockResolvedValue({
      ok: true,
      organizationId: VALID_ORG_ID,
      previousOrganizationId: PREVIOUS_ORG_ID,
    });
  });

  it('rejects a caller without system_admin BEFORE any body/DB access', async () => {
    m.hasMinRole.mockResolvedValue(false);
    const { POST } = await loadRoute();

    const response = await POST(
      postRequest({ organizationId: VALID_ORG_ID, reason: VALID_REASON }),
      { params: { id: 'p1' } },
    );

    expect(response.status).toBe(403);
    expect(m.rebindPilotOrganization).not.toHaveBeenCalled();
  });

  it('returns 400 for a missing/invalid organizationId', async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      postRequest({ organizationId: 'not-a-uuid', reason: VALID_REASON }),
      { params: { id: 'p1' } },
    );

    expect(response.status).toBe(400);
    expect(m.rebindPilotOrganization).not.toHaveBeenCalled();
  });

  it('returns 400 when reason is missing or too short — a rebind must be audited, not silent', async () => {
    const { POST } = await loadRoute();

    const tooShort = await POST(
      postRequest({ organizationId: VALID_ORG_ID, reason: 'short' }),
      { params: { id: 'p1' } },
    );
    expect(tooShort.status).toBe(400);

    const missing = await POST(
      postRequest({ organizationId: VALID_ORG_ID }),
      { params: { id: 'p1' } },
    );
    expect(missing.status).toBe(400);
    expect(m.rebindPilotOrganization).not.toHaveBeenCalled();
  });

  it('rebinds the pilot and returns both the new and previous organization ids', async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      postRequest({ organizationId: VALID_ORG_ID, reason: VALID_REASON }),
      { params: { id: 'p1' } },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true,
      organizationId: VALID_ORG_ID,
      previousOrganizationId: PREVIOUS_ORG_ID,
    });
    expect(m.rebindPilotOrganization).toHaveBeenCalledWith({
      pilotId: 'p1',
      organizationId: VALID_ORG_ID,
      verifiedBy: 'u-sysadmin',
      reason: VALID_REASON,
    });
  });

  it('ignores a client-supplied acknowledgeFinancialArtifacts (PR #752 round 27: the escape hatch was removed entirely)', async () => {
    const { POST } = await loadRoute();

    await POST(
      postRequest({ organizationId: VALID_ORG_ID, reason: VALID_REASON, acknowledgeFinancialArtifacts: true }),
      { params: { id: 'p1' } },
    );

    expect(m.rebindPilotOrganization).toHaveBeenCalledWith({
      pilotId: 'p1',
      organizationId: VALID_ORG_ID,
      verifiedBy: 'u-sysadmin',
      reason: VALID_REASON,
    });
  });

  it('propagates a 409 when financial artifacts already exist — no override is possible', async () => {
    m.rebindPilotOrganization.mockResolvedValue({
      ok: false,
      status: 409,
      error: 'This pilot already has financial artifacts (a commercial contract) under its current verified organization.',
    });
    const { POST } = await loadRoute();

    const response = await POST(
      postRequest({ organizationId: VALID_ORG_ID, reason: VALID_REASON }),
      { params: { id: 'p1' } },
    );

    expect(response.status).toBe(409);
  });

  it('propagates a 404 when the target organization does not exist', async () => {
    m.rebindPilotOrganization.mockResolvedValue({ ok: false, status: 404, error: 'Organization not found' });
    const { POST } = await loadRoute();

    const response = await POST(
      postRequest({ organizationId: VALID_ORG_ID, reason: VALID_REASON }),
      { params: { id: 'p1' } },
    );

    expect(response.status).toBe(404);
  });
});
