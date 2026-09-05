import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  hasMinRole: vi.fn(),
  getCurrentUser: vi.fn(),
  approveCommercialTerms: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', async (orig) => {
  const actual = await orig<typeof import('@/lib/api-auth-guard')>();
  return {
    ...actual,
    hasMinRole: m.hasMinRole,
    getCurrentUser: m.getCurrentUser,
    withApiAuth: vi.fn(
      (handler: (req: NextRequest, ctx?: { params?: { id: string } }) => Promise<Response>) =>
        (req: NextRequest, ctx?: { params?: { id: string } }) => handler(req, ctx),
    ),
  };
});
vi.mock('@/lib/pilot/commercial-terms-authority', () => ({
  approveCommercialTerms: m.approveCommercialTerms,
}));

async function loadRoute() {
  return import('../apply/[id]/approve-commercial-terms/route');
}

describe('pilot/apply/[id]/approve-commercial-terms route (PR #752 round 25)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.hasMinRole.mockResolvedValue(true);
    m.getCurrentUser.mockResolvedValue({ id: 'admin-1' });
  });

  it('returns 403 without touching approveCommercialTerms when caller lacks system_admin role', async () => {
    const { POST } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await POST(
      new NextRequest('http://localhost/api/pilot/apply/p1/approve-commercial-terms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ memberCount: 250 }),
      }),
      { params: { id: 'p1' } },
    );

    expect(response.status).toBe(403);
    expect(m.approveCommercialTerms).not.toHaveBeenCalled();
  });

  it('returns 400 when the pilot id is missing', async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      new NextRequest('http://localhost/api/pilot/apply/approve-commercial-terms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ memberCount: 250 }),
      }),
      {},
    );

    expect(response.status).toBe(400);
  });

  it('returns 400 when memberCount is missing or invalid', async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      new NextRequest('http://localhost/api/pilot/apply/p1/approve-commercial-terms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ memberCount: -5 }),
      }),
      { params: { id: 'p1' } },
    );

    expect(response.status).toBe(400);
    expect(m.approveCommercialTerms).not.toHaveBeenCalled();
  });

  it('returns 401 when no authenticated user is present', async () => {
    const { POST } = await loadRoute();
    m.getCurrentUser.mockResolvedValueOnce(null);

    const response = await POST(
      new NextRequest('http://localhost/api/pilot/apply/p1/approve-commercial-terms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ memberCount: 250 }),
      }),
      { params: { id: 'p1' } },
    );

    expect(response.status).toBe(401);
  });

  it('forwards the approver id and passes through the underlying rejection status/error', async () => {
    const { POST } = await loadRoute();
    m.approveCommercialTerms.mockResolvedValueOnce({ ok: false, status: 409, error: 'already bound' });

    const response = await POST(
      new NextRequest('http://localhost/api/pilot/apply/p1/approve-commercial-terms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ memberCount: 250 }),
      }),
      { params: { id: 'p1' } },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'already bound' });
    expect(m.approveCommercialTerms).toHaveBeenCalledWith({
      pilotId: 'p1',
      approvedBy: 'admin-1',
      memberCount: 250,
      subscriptionPlanId: null,
      pilotAmount: null,
    });
  });

  it('returns the verified terms on success', async () => {
    const { POST } = await loadRoute();
    m.approveCommercialTerms.mockResolvedValueOnce({
      ok: true,
      verifiedMemberCount: 250,
      verifiedPilotAmount: '5000.00',
      verifiedSubscriptionPlanId: 'plan-x',
    });

    const response = await POST(
      new NextRequest('http://localhost/api/pilot/apply/p1/approve-commercial-terms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ memberCount: 250, subscriptionPlanId: '11111111-1111-1111-1111-111111111111' }),
      }),
      { params: { id: 'p1' } },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      verifiedMemberCount: 250,
      verifiedPilotAmount: '5000.00',
      verifiedSubscriptionPlanId: 'plan-x',
    });
  });
});
