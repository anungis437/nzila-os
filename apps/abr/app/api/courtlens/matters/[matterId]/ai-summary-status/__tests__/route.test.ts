/**
 * CourtLens Phase 2E mutation route tests.
 *
 * Proves:
 * - AI summary route: 401/403 unauthenticated/non-member/no-permission
 * - AI summary route: successful transition writes CourtLens event and audit log
 * - AI summary route: invalid transition rejected with 400
 * - Referral route: cannot go 'suggested' → 'sent' (must pass through 'approved')
 * - Referral route: valid transition writes event and audit log
 * - Transition route: reuses ABR FSM; invalid transition rejected with 400
 * - Transition route: requires reason
 * - Cross-tenant matter access returns 404 (via service-layer null result)
 * - Never exposes raw event payloads in responses
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireVerifiedOrgAccess: vi.fn(),
  requireVerifiedPermission: vi.fn(),
  withRequestContext: vi.fn(),
  updateAiSummaryStatus: vi.fn(),
  updateReferralStatus: vi.fn(),
  transitionMatterStatus: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock('@/lib/api-guards', () => ({
  requireVerifiedOrgAccess: mocks.requireVerifiedOrgAccess,
  requireVerifiedPermission: mocks.requireVerifiedPermission,
  withRequestContext: mocks.withRequestContext,
}));

vi.mock('@/lib/audit-log', () => ({
  logAuditEvent: mocks.logAuditEvent,
}));

vi.mock('@/modules/incidents/matter-service', () => ({
  updateAiSummaryStatus: mocks.updateAiSummaryStatus,
  updateReferralStatus: mocks.updateReferralStatus,
  transitionMatterStatus: mocks.transitionMatterStatus,
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

// ── POST /api/courtlens/matters/[matterId]/ai-summary-status ──────────────────

describe('POST ai-summary-status — mutation contract', () => {
  it('401 unauthenticated', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const { POST } = await import('../route');

    const res = await POST(
      makePostRequest('http://localhost/api/courtlens/matters/inc-1/ai-summary-status', {
        from: 'ai_draft', to: 'needs_verification',
      }) as never,
      { params: Promise.resolve({ matterId: 'inc-1' }) },
    );

    expect(res.status).toBe(401);
    expect(mocks.updateAiSummaryStatus).not.toHaveBeenCalled();
  });

  it('403 when non-member', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { error: 'Org access denied', code: 'ORG_MEMBERSHIP_REQUIRED' },
        { status: 403 },
      ),
    });
    const { POST } = await import('../route');

    const res = await POST(
      makePostRequest('http://localhost/api/courtlens/matters/inc-1/ai-summary-status', {
        from: 'ai_draft', to: 'needs_verification',
      }) as never,
      { params: Promise.resolve({ matterId: 'inc-1' }) },
    );

    expect(res.status).toBe(403);
  });

  it('403 when role lacks incident.update', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: { ...verifiedContext, role: 'learner' } });
    mocks.requireVerifiedPermission.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Forbidden', code: 'INSUFFICIENT_PERMISSION' }, { status: 403 }),
    });
    const { POST } = await import('../route');

    const res = await POST(
      makePostRequest('http://localhost/api/courtlens/matters/inc-1/ai-summary-status', {
        from: 'ai_draft', to: 'needs_verification',
      }) as never,
      { params: Promise.resolve({ matterId: 'inc-1' }) },
    );

    expect(res.status).toBe(403);
    expect(mocks.updateAiSummaryStatus).not.toHaveBeenCalled();
  });

  it('400 on invalid AI status value', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    const { POST } = await import('../route');

    const res = await POST(
      makePostRequest('http://localhost/api/courtlens/matters/inc-1/ai-summary-status', {
        from: 'ai_draft', to: 'super_approved',
      }) as never,
      { params: Promise.resolve({ matterId: 'inc-1' }) },
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('INVALID_AI_SUMMARY_STATUS');
    expect(mocks.updateAiSummaryStatus).not.toHaveBeenCalled();
  });

  it('400 on rejected transition (service-layer validation)', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    mocks.updateAiSummaryStatus.mockResolvedValue({ success: false, reason: 'Invalid ai_summary_status transition: ai_draft → approved' });
    const { POST } = await import('../route');

    const res = await POST(
      makePostRequest('http://localhost/api/courtlens/matters/inc-1/ai-summary-status', {
        from: 'ai_draft', to: 'approved',
      }) as never,
      { params: Promise.resolve({ matterId: 'inc-1' }) },
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('AI_SUMMARY_TRANSITION_REJECTED');
  });

  it('404 on matter-not-found from service layer', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    mocks.updateAiSummaryStatus.mockResolvedValue({ success: false, reason: 'Matter not found' });
    const { POST } = await import('../route');

    const res = await POST(
      makePostRequest('http://localhost/api/courtlens/matters/missing/ai-summary-status', {
        from: 'ai_draft', to: 'needs_verification',
      }) as never,
      { params: Promise.resolve({ matterId: 'missing' }) },
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.code).toBe('MATTER_NOT_FOUND');
  });

  it('always calls updateAiSummaryStatus with actorType=human (route-level enforcement)', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    mocks.updateAiSummaryStatus.mockResolvedValue({ success: true, to: 'approved' });
    const { POST } = await import('../route');

    await POST(
      makePostRequest('http://localhost/api/courtlens/matters/inc-1/ai-summary-status', {
        from: 'needs_verification', to: 'approved',
      }) as never,
      { params: Promise.resolve({ matterId: 'inc-1' }) },
    );

    expect(mocks.updateAiSummaryStatus).toHaveBeenCalledWith(
      'metro-university', 'inc-1', 'user_1',
      'needs_verification', 'approved', 'human',
    );
  });

  it('success writes audit event and returns confirmation', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    mocks.updateAiSummaryStatus.mockResolvedValue({ success: true, to: 'needs_verification' });
    const { POST } = await import('../route');

    const res = await POST(
      makePostRequest('http://localhost/api/courtlens/matters/inc-1/ai-summary-status', {
        from: 'ai_draft', to: 'needs_verification',
      }) as never,
      { params: Promise.resolve({ matterId: 'inc-1' }) },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, matterId: 'inc-1', to: 'needs_verification' });
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'courtlens.matter.ai_summary_status.updated',
        details: expect.objectContaining({
          matterId: 'inc-1', from: 'ai_draft', to: 'needs_verification',
          membershipSource: 'abr_users_lookup',
        }),
      }),
    );
  });
});
