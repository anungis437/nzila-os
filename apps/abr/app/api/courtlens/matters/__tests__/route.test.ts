/**
 * CourtLens Phase 2C.5 route-level auth contract tests.
 *
 * Exercises the actual GET route handlers with mocked api-guards to prove
 * the auth/org/permission contract at the route boundary:
 * - Unauthenticated queue/detail requests are rejected with 401.
 * - Missing org context returns 400.
 * - Missing permission returns 403.
 * - Cross-tenant matter detail returns 404 (not the matter — safe error).
 * - Successful queue includes safe payload shape.
 * - Successful detail includes legal boundary notice and role-gated fields.
 * - Raw event payloads are never returned.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireOrgAccess: vi.fn(),
  requirePermission: vi.fn(),
  withRequestContext: vi.fn(),
  listMatterQueueForOrg: vi.fn(),
  getMatterDetail: vi.fn(),
  buildMatterDetailView: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock('@/lib/api-guards', () => ({
  requireOrgAccess: mocks.requireOrgAccess,
  requirePermission: mocks.requirePermission,
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

// ── Test setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mocks.withRequestContext.mockImplementation(
    (_req: Request, handler: () => Promise<NextResponse>) => handler(),
  );
});

// ── GET /api/courtlens/matters ────────────────────────────────────────────────

describe('GET /api/courtlens/matters — auth contract', () => {
  it('returns 401 when unauthenticated', async () => {
    mocks.requireOrgAccess.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const { GET } = await import('../route');

    const req = new Request('http://localhost/api/courtlens/matters');
    const res = await GET(req as never);

    expect(res.status).toBe(401);
    expect(mocks.listMatterQueueForOrg).not.toHaveBeenCalled();
  });

  it('returns 400 when org context is missing', async () => {
    mocks.requireOrgAccess.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { error: 'Missing organization context', code: 'ORG_CONTEXT_REQUIRED' },
        { status: 400 },
      ),
    });
    const { GET } = await import('../route');

    const req = new Request('http://localhost/api/courtlens/matters');
    const res = await GET(req as never);

    expect(res.status).toBe(400);
    expect(mocks.listMatterQueueForOrg).not.toHaveBeenCalled();
  });

  it('returns 403 when incident.read permission is missing', async () => {
    mocks.requireOrgAccess.mockResolvedValue({
      ok: true, userId: 'user_1', orgId: 'org_1', orgSource: 'header',
    });
    mocks.requirePermission.mockReturnValue({
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden', code: 'INSUFFICIENT_PERMISSION', permission: 'incident.read', role: 'learner' },
        { status: 403 },
      ),
    });
    const { GET } = await import('../route');

    const req = new Request('http://localhost/api/courtlens/matters');
    const res = await GET(req as never);

    expect(res.status).toBe(403);
    expect(mocks.listMatterQueueForOrg).not.toHaveBeenCalled();
  });

  it('returns queue items scoped to the authenticated org', async () => {
    mocks.requireOrgAccess.mockResolvedValue({
      ok: true, userId: 'user_1', orgId: 'metro-university', orgSource: 'header',
    });
    mocks.requirePermission.mockReturnValue({ ok: true, role: 'investigator' });
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
      }),
    );
  });

  it('queue payload does not expose client profile, notes, or raw events', async () => {
    mocks.requireOrgAccess.mockResolvedValue({
      ok: true, userId: 'user_1', orgId: 'org_1', orgSource: 'header',
    });
    mocks.requirePermission.mockReturnValue({ ok: true, role: 'investigator' });
    mocks.listMatterQueueForOrg.mockResolvedValue([
      {
        id: 'inc-1', orgId: 'org_1', title: 'test',
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

describe('GET /api/courtlens/matters/[matterId] — auth contract', () => {
  it('returns 401 when unauthenticated', async () => {
    mocks.requireOrgAccess.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const { GET } = await import('../[matterId]/route');

    const req = new Request('http://localhost/api/courtlens/matters/inc-1');
    const res = await GET(req as never, { params: Promise.resolve({ matterId: 'inc-1' }) });

    expect(res.status).toBe(401);
    expect(mocks.getMatterDetail).not.toHaveBeenCalled();
  });

  it('returns 403 when incident.read permission is missing', async () => {
    mocks.requireOrgAccess.mockResolvedValue({
      ok: true, userId: 'user_1', orgId: 'org_1', orgSource: 'header',
    });
    mocks.requirePermission.mockReturnValue({
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden', code: 'INSUFFICIENT_PERMISSION' },
        { status: 403 },
      ),
    });
    const { GET } = await import('../[matterId]/route');

    const req = new Request('http://localhost/api/courtlens/matters/inc-1');
    const res = await GET(req as never, { params: Promise.resolve({ matterId: 'inc-1' }) });

    expect(res.status).toBe(403);
    expect(mocks.getMatterDetail).not.toHaveBeenCalled();
  });

  it('returns 404 when matter does not belong to authenticated org', async () => {
    mocks.requireOrgAccess.mockResolvedValue({
      ok: true, userId: 'user_1', orgId: 'org_a', orgSource: 'header',
    });
    mocks.requirePermission.mockReturnValue({ ok: true, role: 'investigator' });
    // Simulate cross-tenant lookup — getMatterDetail returns null for org_a/matter_of_org_b
    mocks.getMatterDetail.mockResolvedValue(null);
    const { GET } = await import('../[matterId]/route');

    const req = new Request('http://localhost/api/courtlens/matters/matter-of-org-b');
    const res = await GET(req as never, { params: Promise.resolve({ matterId: 'matter-of-org-b' }) });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.code).toBe('MATTER_NOT_FOUND');
    // Must not leak whether the matter exists in another org
    expect(body.error).not.toContain('another org');
    expect(mocks.buildMatterDetailView).not.toHaveBeenCalled();
  });

  it('calls getMatterDetail with correct org and matter id', async () => {
    mocks.requireOrgAccess.mockResolvedValue({
      ok: true, userId: 'user_1', orgId: 'org_1', orgSource: 'header',
    });
    mocks.requirePermission.mockReturnValue({ ok: true, role: 'investigator' });
    const fakeMatter = {
      id: 'inc-1', orgId: 'org_1', title: 'test', status: 'new',
      practiceArea: 'housing', subIssue: 'eviction',
      severity: 'high', aiSummaryStatus: 'ai_draft', referralStatus: 'none',
    };
    mocks.getMatterDetail.mockResolvedValue({
      matter: fakeMatter,
      detail: { incident: fakeMatter, events: [], actions: [], notes: [], timeline: [] },
    });
    mocks.buildMatterDetailView.mockReturnValue({
      id: 'inc-1', orgId: 'org_1', title: 'test',
      statusLabel: 'New Intake', practiceArea: 'housing', subIssue: 'eviction',
      urgencyLabel: 'high', aiSummaryStatus: 'ai_draft', referralStatus: 'none',
      isPacketExternalizable: false, assignedTo: null,
      clientGoal: null, hearingDate: null, deadlineDate: null,
      riskFlags: null, clientProfile: null, notes: [], timeline: [],
      openedAt: '', dueAt: null,
      legalBoundaryNotice: 'AI-generated content in this record is draft-only and requires human reviewer approval before external use. This platform does not provide legal advice.',
    });
    const { GET } = await import('../[matterId]/route');

    const req = new Request('http://localhost/api/courtlens/matters/inc-1');
    const res = await GET(req as never, { params: Promise.resolve({ matterId: 'inc-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.orgId).toBe('org_1');
    expect(mocks.getMatterDetail).toHaveBeenCalledWith('org_1', 'inc-1', expect.objectContaining({ role: 'investigator' }));
    expect(mocks.buildMatterDetailView).toHaveBeenCalled();
    expect(body.matter.legalBoundaryNotice).toContain('does not provide legal advice');
    expect(body.matter).not.toHaveProperty('events');
  });

  it('audit log records viewing action', async () => {
    mocks.requireOrgAccess.mockResolvedValue({
      ok: true, userId: 'user_1', orgId: 'org_1', orgSource: 'header',
    });
    mocks.requirePermission.mockReturnValue({ ok: true, role: 'organization_admin' });
    mocks.getMatterDetail.mockResolvedValue({
      matter: { id: 'inc-1', orgId: 'org_1' },
      detail: { incident: {}, events: [], actions: [], notes: [], timeline: [] },
    });
    mocks.buildMatterDetailView.mockReturnValue({
      id: 'inc-1', orgId: 'org_1', notes: [], timeline: [],
      legalBoundaryNotice: 'notice',
    });
    const { GET } = await import('../[matterId]/route');

    const req = new Request('http://localhost/api/courtlens/matters/inc-1');
    await GET(req as never, { params: Promise.resolve({ matterId: 'inc-1' }) });

    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'courtlens.matter.viewed',
        orgId: 'org_1',
        details: expect.objectContaining({ matterId: 'inc-1', role: 'organization_admin' }),
      }),
    );
  });
});
