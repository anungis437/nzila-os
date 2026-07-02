/**
 * CourtLens Phase 2E referral status route tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireVerifiedOrgAccess: vi.fn(),
  requireVerifiedPermission: vi.fn(),
  withRequestContext: vi.fn(),
  updateReferralStatus: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock('@/lib/api-guards', () => ({
  requireVerifiedOrgAccess: mocks.requireVerifiedOrgAccess,
  requireVerifiedPermission: mocks.requireVerifiedPermission,
  withRequestContext: mocks.withRequestContext,
}));

vi.mock('@/lib/audit-log', () => ({ logAuditEvent: mocks.logAuditEvent }));

vi.mock('@/modules/incidents/matter-service', () => ({
  updateReferralStatus: mocks.updateReferralStatus,
}));

const verifiedContext = {
  userId: 'user_1',
  orgId: 'metro-university',
  orgSource: 'header' as const,
  role: 'investigator' as const,
  membershipSource: 'abr_users_lookup' as const,
};

function makePostRequest(url: string, body: Record<string, unknown>): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.withRequestContext.mockImplementation(
    (_req: Request, handler: () => Promise<NextResponse>) => handler(),
  );
});

describe('POST referral-status — mutation contract', () => {
  it('401 unauthenticated', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const { POST } = await import('../route');

    const res = await POST(
      makePostRequest('http://localhost/api/courtlens/matters/inc-1/referral-status', {
        from: 'none', to: 'suggested',
      }) as never,
      { params: Promise.resolve({ matterId: 'inc-1' }) },
    );

    expect(res.status).toBe(401);
  });

  it('400 on invalid referral status', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    const { POST } = await import('../route');

    const res = await POST(
      makePostRequest('http://localhost/api/courtlens/matters/inc-1/referral-status', {
        from: 'none', to: 'delivered_by_carrier_pigeon',
      }) as never,
      { params: Promise.resolve({ matterId: 'inc-1' }) },
    );

    expect(res.status).toBe(400);
    expect(mocks.updateReferralStatus).not.toHaveBeenCalled();
  });

  it('400 when service rejects suggested → sent (must pass through approved)', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    mocks.updateReferralStatus.mockResolvedValue({
      success: false,
      reason: 'Invalid referral_status transition: suggested → sent',
    });
    const { POST } = await import('../route');

    const res = await POST(
      makePostRequest('http://localhost/api/courtlens/matters/inc-1/referral-status', {
        from: 'suggested', to: 'sent',
      }) as never,
      { params: Promise.resolve({ matterId: 'inc-1' }) },
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('REFERRAL_TRANSITION_REJECTED');
    expect(body.error).toMatch(/suggested.*sent/);
  });

  it('200 on valid none → suggested transition + audit log written', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    mocks.updateReferralStatus.mockResolvedValue({ success: true, to: 'suggested' });
    const { POST } = await import('../route');

    const res = await POST(
      makePostRequest('http://localhost/api/courtlens/matters/inc-1/referral-status', {
        from: 'none', to: 'suggested',
      }) as never,
      { params: Promise.resolve({ matterId: 'inc-1' }) },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.to).toBe('suggested');
    expect(mocks.updateReferralStatus).toHaveBeenCalledWith(
      'metro-university', 'inc-1', 'user_1', 'none', 'suggested',
    );
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'courtlens.matter.referral_status.updated',
        details: expect.objectContaining({ matterId: 'inc-1', from: 'none', to: 'suggested' }),
      }),
    );
  });

  it('404 on matter-not-found', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    mocks.updateReferralStatus.mockResolvedValue({ success: false, reason: 'Matter not found' });
    const { POST } = await import('../route');

    const res = await POST(
      makePostRequest('http://localhost/api/courtlens/matters/missing/referral-status', {
        from: 'none', to: 'suggested',
      }) as never,
      { params: Promise.resolve({ matterId: 'missing' }) },
    );

    expect(res.status).toBe(404);
  });
});
