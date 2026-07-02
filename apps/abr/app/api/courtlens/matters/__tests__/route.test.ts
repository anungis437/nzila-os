/**
 * CourtLens Phase 2C.6 route-level auth contract tests.
 *
 * Exercises route handlers with the trusted verified guards.
 * Proves:
 * - Unauthenticated (guard fail) → 401
 * - Non-member of requested org (guard fail) → 403 ORG_MEMBERSHIP_REQUIRED
 * - Missing incident.read permission → 403 INSUFFICIENT_PERMISSION
 * - Cross-tenant matter lookup → 404 (no existence leak)
 * - Queue payload does not expose client profile, notes, or raw events
 * - Detail response includes legal boundary notice
 * - Audit log captures membershipSource (trust provenance)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireVerifiedOrgAccess: vi.fn(),
  requireVerifiedPermission: vi.fn(),
  withRequestContext: vi.fn(),
  listMatterQueueForOrg: vi.fn(),
  getMatterDetail: vi.fn(),
  buildMatterDetailView: vi.fn(),
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
  listMatterQueueForOrg: mocks.listMatterQueueForOrg,
  getMatterDetail: mocks.getMatterDetail,
  buildMatterDetailView: mocks.buildMatterDetailView,
}));

const verifiedContext = {
  userId: 'user_1',
  orgId: 'metro-university',
  orgSource: 'header' as const,
  role: 'investigator' as const,
  membershipSource: 'abr_users_lookup' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.withRequestContext.mockImplementation(
    (_req: Request, handler: () => Promise<NextResponse>) => handler(),
  );
});

// ── GET /api/courtlens/matters ────────────────────────────────────────────────

describe('GET /api/courtlens/matters — trusted guards', () => {
  it('returns 401 when unauthenticated', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const { GET } = await import('../route');

    const req = new Request('http://localhost/api/courtlens/matters');
    const res = await GET(req as never);

    expect(res.status).toBe(401);
    expect(mocks.listMatterQueueForOrg).not.toHaveBeenCalled();
  });

  it('returns 403 ORG_MEMBERSHIP_REQUIRED for non-member of requested org', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { error: 'Org access denied', code: 'ORG_MEMBERSHIP_REQUIRED', reason: 'no_membership' },
        { status: 403 },
      ),
    });
    const { GET } = await import('../route');

    const req = new Request('http://localhost/api/courtlens/matters', {
      headers: { 'x-org-id': 'metro-university' },
    });
    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe('ORG_MEMBERSHIP_REQUIRED');
    expect(mocks.listMatterQueueForOrg).not.toHaveBeenCalled();
  });

  it('returns 403 INSUFFICIENT_PERMISSION when role lacks incident.read', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: { ...verifiedContext, role: 'learner' } });
    mocks.requireVerifiedPermission.mockReturnValue({
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden', code: 'INSUFFICIENT_PERMISSION', permission: 'incident.read', role: 'learner' },
        { status: 403 },
      ),
    });
    const { GET } = await import('../route');

    const req = new Request('http://localhost/api/courtlens/matters');
    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe('INSUFFICIENT_PERMISSION');
    expect(mocks.listMatterQueueForOrg).not.toHaveBeenCalled();
  });

  it('returns queue items scoped to the verified org', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    mocks.listMatterQueueForOrg.mockResolvedValue([
      {
        id: 'inc-1', orgId: 'metro-university', title: 'Housing intake',
        practiceArea: 'housing', subIssue: 'eviction',
        statusLabel: 'New Intake', urgencyLabel: 'high',
        aiSummaryStatus: 'ai_draft', referralStatus: 'none',
        isPacketExternalizable: false, assignedTo: null,
        openedAt: '2026-07-02T00:00:00Z', dueAt: null, deadlineDate: null,
      },
    ]);
    const { GET } = await import('../route');

    const req = new Request('http://localhost/api/courtlens/matters');
    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.orgId).toBe('metro-university');
    expect(body.items).toHaveLength(1);
    expect(mocks.listMatterQueueForOrg).toHaveBeenCalledWith('metro-university');
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'courtlens.matter_queue.listed',
        orgId: 'metro-university',
        details: expect.objectContaining({ membershipSource: 'abr_users_lookup' }),
      }),
    );
  });

  it('queue payload does not expose client profile, notes, or raw events', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    mocks.listMatterQueueForOrg.mockResolvedValue([
      {
        id: 'inc-1', orgId: 'metro-university', title: 'test',
        practiceArea: 'housing', subIssue: null,
        statusLabel: 'New Intake', urgencyLabel: 'low',
        aiSummaryStatus: 'ai_draft', referralStatus: 'none',
        isPacketExternalizable: false, assignedTo: null,
        openedAt: '2026-07-02T00:00:00Z', dueAt: null, deadlineDate: null,
      },
    ]);
    const { GET } = await import('../route');

    const req = new Request('http://localhost/api/courtlens/matters');
    const body = await (await GET(req as never)).json();

    for (const item of body.items) {
      expect(item).not.toHaveProperty('clientProfile');
      expect(item).not.toHaveProperty('riskFlags');
      expect(item).not.toHaveProperty('notes');
      expect(item).not.toHaveProperty('events');
    }
  });
});

// ── GET /api/courtlens/matters/[matterId] ─────────────────────────────────────

describe('GET /api/courtlens/matters/[matterId] — trusted guards', () => {
  it('returns 401 when unauthenticated', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const { GET } = await import('../[matterId]/route');

    const req = new Request('http://localhost/api/courtlens/matters/inc-1');
    const res = await GET(req as never, { params: Promise.resolve({ matterId: 'inc-1' }) });

    expect(res.status).toBe(401);
    expect(mocks.getMatterDetail).not.toHaveBeenCalled();
  });

  it('returns 403 ORG_MEMBERSHIP_REQUIRED for non-member', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { error: 'Org access denied', code: 'ORG_MEMBERSHIP_REQUIRED', reason: 'no_membership' },
        { status: 403 },
      ),
    });
    const { GET } = await import('../[matterId]/route');

    const req = new Request('http://localhost/api/courtlens/matters/inc-1');
    const res = await GET(req as never, { params: Promise.resolve({ matterId: 'inc-1' }) });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe('ORG_MEMBERSHIP_REQUIRED');
    expect(mocks.getMatterDetail).not.toHaveBeenCalled();
  });

  it('returns 403 INSUFFICIENT_PERMISSION when role lacks incident.read', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: { ...verifiedContext, role: 'learner' } });
    mocks.requireVerifiedPermission.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Forbidden', code: 'INSUFFICIENT_PERMISSION' }, { status: 403 }),
    });
    const { GET } = await import('../[matterId]/route');

    const req = new Request('http://localhost/api/courtlens/matters/inc-1');
    const res = await GET(req as never, { params: Promise.resolve({ matterId: 'inc-1' }) });

    expect(res.status).toBe(403);
    expect(mocks.getMatterDetail).not.toHaveBeenCalled();
  });

  it('returns 404 for cross-tenant matter lookup (no existence leak)', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: { ...verifiedContext, orgId: 'org_a' } });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    mocks.getMatterDetail.mockResolvedValue(null);
    const { GET } = await import('../[matterId]/route');

    const req = new Request('http://localhost/api/courtlens/matters/matter-of-org-b');
    const res = await GET(req as never, { params: Promise.resolve({ matterId: 'matter-of-org-b' }) });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.code).toBe('MATTER_NOT_FOUND');
    expect(body.error).not.toContain('another org');
    expect(mocks.buildMatterDetailView).not.toHaveBeenCalled();
  });

  it('calls getMatterDetail with verified org and passes trusted role to view builder', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    const fakeMatter = { id: 'inc-1', orgId: 'metro-university', status: 'new' };
    mocks.getMatterDetail.mockResolvedValue({
      matter: fakeMatter,
      detail: { incident: fakeMatter, events: [], actions: [], notes: [], timeline: [] },
    });
    mocks.buildMatterDetailView.mockReturnValue({
      id: 'inc-1', orgId: 'metro-university',
      notes: [], timeline: [],
      legalBoundaryNotice: 'AI-generated content in this record is draft-only and requires human reviewer approval before external use. This platform does not provide legal advice.',
    });
    const { GET } = await import('../[matterId]/route');

    const req = new Request('http://localhost/api/courtlens/matters/inc-1');
    const res = await GET(req as never, { params: Promise.resolve({ matterId: 'inc-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.getMatterDetail).toHaveBeenCalledWith(
      'metro-university', 'inc-1',
      expect.objectContaining({ role: 'investigator' }),
    );
    expect(mocks.buildMatterDetailView).toHaveBeenCalledWith(fakeMatter, expect.any(Object), 'investigator');
    expect(body.matter.legalBoundaryNotice).toContain('does not provide legal advice');
    expect(body.matter).not.toHaveProperty('events');
  });

  it('audit log records verified role and membershipSource', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({
      ok: true,
      context: { ...verifiedContext, role: 'organization_admin', membershipSource: 'session_org_match' },
    });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    mocks.getMatterDetail.mockResolvedValue({
      matter: { id: 'inc-1', orgId: 'metro-university' },
      detail: { incident: {}, events: [], actions: [], notes: [], timeline: [] },
    });
    mocks.buildMatterDetailView.mockReturnValue({
      id: 'inc-1', notes: [], timeline: [], legalBoundaryNotice: 'notice',
    });
    const { GET } = await import('../[matterId]/route');

    const req = new Request('http://localhost/api/courtlens/matters/inc-1');
    await GET(req as never, { params: Promise.resolve({ matterId: 'inc-1' }) });

    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'courtlens.matter.viewed',
        orgId: 'metro-university',
        details: expect.objectContaining({
          matterId: 'inc-1',
          role: 'organization_admin',
          membershipSource: 'session_org_match',
        }),
      }),
    );
  });
});
