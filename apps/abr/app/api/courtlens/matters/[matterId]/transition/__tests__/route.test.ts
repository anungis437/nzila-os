/**
 * CourtLens Phase 2E matter transition route tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireVerifiedOrgAccess: vi.fn(),
  requireVerifiedPermission: vi.fn(),
  withRequestContext: vi.fn(),
  transitionMatterStatus: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock('@/lib/api-guards', () => ({
  requireVerifiedOrgAccess: mocks.requireVerifiedOrgAccess,
  requireVerifiedPermission: mocks.requireVerifiedPermission,
  withRequestContext: mocks.withRequestContext,
}));

vi.mock('@/lib/audit-log', () => ({ logAuditEvent: mocks.logAuditEvent }));

vi.mock('@/modules/incidents/matter-service', () => ({
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

describe('POST matter transition — mutation contract', () => {
  it('403 when role lacks incident.transition', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: { ...verifiedContext, role: 'auditor' } });
    mocks.requireVerifiedPermission.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Forbidden', code: 'INSUFFICIENT_PERMISSION' }, { status: 403 }),
    });
    const { POST } = await import('../route');

    const res = await POST(
      makePostRequest('http://localhost/api/courtlens/matters/inc-1/transition', {
        to: 'triage', reason: 'test',
      }) as never,
      { params: Promise.resolve({ matterId: 'inc-1' }) },
    );

    expect(res.status).toBe(403);
    expect(mocks.transitionMatterStatus).not.toHaveBeenCalled();
  });

  it('400 on invalid status value', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    const { POST } = await import('../route');

    const res = await POST(
      makePostRequest('http://localhost/api/courtlens/matters/inc-1/transition', {
        to: 'quantum_flux', reason: 'test',
      }) as never,
      { params: Promise.resolve({ matterId: 'inc-1' }) },
    );

    expect(res.status).toBe(400);
    expect(mocks.transitionMatterStatus).not.toHaveBeenCalled();
  });

  it('400 when reason is missing', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    const { POST } = await import('../route');

    const res = await POST(
      makePostRequest('http://localhost/api/courtlens/matters/inc-1/transition', {
        to: 'triage',
      }) as never,
      { params: Promise.resolve({ matterId: 'inc-1' }) },
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('REASON_REQUIRED');
    expect(mocks.transitionMatterStatus).not.toHaveBeenCalled();
  });

  it('400 when ABR FSM rejects invalid transition (thrown error)', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    mocks.transitionMatterStatus.mockRejectedValue(new Error('Invalid incident transition: new -> archived'));
    const { POST } = await import('../route');

    const res = await POST(
      makePostRequest('http://localhost/api/courtlens/matters/inc-1/transition', {
        to: 'archived', reason: 'test',
      }) as never,
      { params: Promise.resolve({ matterId: 'inc-1' }) },
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('INVALID_MATTER_TRANSITION');
    expect(body.error).toMatch(/Invalid incident transition/);
  });

  it('404 when matter not found', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    mocks.transitionMatterStatus.mockResolvedValue(null);
    const { POST } = await import('../route');

    const res = await POST(
      makePostRequest('http://localhost/api/courtlens/matters/missing/transition', {
        to: 'triage', reason: 'test',
      }) as never,
      { params: Promise.resolve({ matterId: 'missing' }) },
    );

    expect(res.status).toBe(404);
  });

  it('200 on valid transition + audit log', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    mocks.transitionMatterStatus.mockResolvedValue({ id: 'inc-1', status: 'triage' });
    const { POST } = await import('../route');

    const res = await POST(
      makePostRequest('http://localhost/api/courtlens/matters/inc-1/transition', {
        to: 'triage', reason: 'Advancing to triage',
      }) as never,
      { params: Promise.resolve({ matterId: 'inc-1' }) },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.to).toBe('triage');
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'courtlens.matter.transition',
        details: expect.objectContaining({ matterId: 'inc-1', to: 'triage' }),
      }),
    );
  });
});
