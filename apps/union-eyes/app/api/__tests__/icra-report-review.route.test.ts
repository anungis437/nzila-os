import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  logger: { info: vi.fn(), error: vi.fn() },
  extractPersistedAdaptiveReportAISlot: vi.fn(),
  resolveAdaptiveReportAISlot: vi.fn(),
  applyAdaptiveReportReviewDecision: vi.fn(),
  embedPersistedAdaptiveReportAISlot: vi.fn(),
  selectQueue: [] as unknown[][],
  updateThrow: false,
  persistAtomicAudit: vi.fn(),
  userId: 'reviewer-1' as string | null,
  requireSystemAdmin: vi.fn(),
  actingOrg: vi.fn(),
}));

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
  };
  return chain;
}

const mockDb: any = {
  select: vi.fn(() => makeSelectChain((m.selectQueue.shift() ?? []) as unknown[])),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(async () => {
        if (m.updateThrow) throw new Error('db fail');
      }),
    })),
  })),
};

vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: (fn: (tx: any) => Promise<unknown>) => fn(mockDb) }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: async () => ({ userId: m.userId }) }));
vi.mock('@/lib/api-auth-guard', () => ({ requireSystemAdmin: m.requireSystemAdmin }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
// Disclosed addition (F06 A2): an unclaimed assessment is audited against the reviewer's acting organization.
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.actingOrg }));
vi.mock('@/lib/icra/questions', () => ({ ALL_QUESTIONS: [] }));
vi.mock('@/lib/icra/adaptation', () => ({
  extractPersistedAdaptiveReportAISlot: m.extractPersistedAdaptiveReportAISlot,
  resolveAdaptiveReportAISlot: m.resolveAdaptiveReportAISlot,
  applyAdaptiveReportReviewDecision: m.applyAdaptiveReportReviewDecision,
  embedPersistedAdaptiveReportAISlot: m.embedPersistedAdaptiveReportAISlot,
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq') };
});

async function loadRoute() {
  return import('../icra/report/[assessmentId]/review/route');
}

describe('icra/report/[assessmentId]/review route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.updateThrow = false;
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.userId = 'reviewer-1';
    m.actingOrg.mockResolvedValue('org_acting');
    m.requireSystemAdmin.mockResolvedValue(undefined);
    m.extractPersistedAdaptiveReportAISlot.mockReturnValue(null);
    m.resolveAdaptiveReportAISlot.mockReturnValue({ reviewWorkflow: { status: 'pending' } });
    m.applyAdaptiveReportReviewDecision.mockReturnValue({ reviewWorkflow: { status: 'approved' } });
    m.embedPersistedAdaptiveReportAISlot.mockReturnValue({ ai: 'slot' });
  });

  it('returns 400 for invalid assessment id', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/icra/report/bad/review', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'approve', summary: 'ok' }),
    }), { params: Promise.resolve({ assessmentId: 'bad' }) });

    expect(response.status).toBe(400);
  });

  const plain = (extra: Record<string, unknown> = {}) => new NextRequest('http://localhost/api/icra/report/a/review', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'approve', summary: 'ok', ...extra }),
  });
  const ok = { params: Promise.resolve({ assessmentId: '11111111-1111-1111-1111-111111111111' }) };

  it('returns 401 for a caller who is not signed in, whatever secret they hold', async () => {
    const { POST } = await loadRoute();
    m.userId = null;
    const response = await POST(new NextRequest('http://localhost/api/icra/report/a/review', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-cron-secret': 'the-shared-secret', authorization: 'Bearer the-shared-secret' }, body: JSON.stringify({ action: 'approve', summary: 'ok' }),
    }), ok);
    expect(response.status).toBe(401);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('returns 403 for a signed-in caller without platform governance authority, and writes nothing', async () => {
    const { POST } = await loadRoute();
    m.requireSystemAdmin.mockRejectedValue(new Error('System administrator privileges required'));
    const response = await POST(plain(), ok);
    expect(response.status).toBe(403);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('refuses a reviewer role the body asserts, instead of recording it', async () => {
    const { POST } = await loadRoute();
    const response = await POST(plain({ reviewerRole: 'exec_sponsor' }), ok);
    expect(response.status).toBe(403);
    expect(m.applyAdaptiveReportReviewDecision).not.toHaveBeenCalled();
  });

  it('records the decision under the verified governance reviewer role', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'a1', organizationContext: {}, locale: 'en-CA' }], [{ profilePayload: { generatedAt: '2026-01-01' } }]);
    await POST(plain({ reviewerRole: 'governance_reviewer' }), ok);
    expect(m.applyAdaptiveReportReviewDecision).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ reviewerRole: 'governance_reviewer' }));
  });

  describe('every decision is audited (DEF-0B8-ICRA-REVIEW-AUDIT-ONLY-WHEN-A-CLAIMED-ORGANIZATION-EXISTS)', () => {
    const decide = async (assessment: Record<string, unknown>) => {
      const { POST } = await loadRoute();
      m.selectQueue.push([{ id: 'a1', organizationContext: {}, locale: 'en-CA', ...assessment }], [{ profilePayload: { generatedAt: '2026-01-01' } }]);
      return POST(plain(), ok);
    };

    it('audits an unclaimed assessment against the reviewer\'s acting organization, in the same transaction as the decision', async () => {
      const response = await decide({ claimedOrgId: null });
      expect(response.status).toBe(200);
      expect(m.persistAtomicAudit).toHaveBeenCalledWith(mockDb, expect.objectContaining({
        organizationId: 'org_acting', userId: 'reviewer-1', action: 'icra.report.review', resourceId: '11111111-1111-1111-1111-111111111111',
        details: expect.objectContaining({ decision: 'approve', assessmentClaimed: false }),
      }));
    });

    it('audits a claimed assessment against the claiming organization', async () => {
      await decide({ claimedOrgId: 'org_claimed' });
      expect(m.persistAtomicAudit).toHaveBeenCalledWith(mockDb, expect.objectContaining({ organizationId: 'org_claimed', details: expect.objectContaining({ assessmentClaimed: true }) }));
    });

    it('records no decision at all when the reviewer acts in no organization', async () => {
      m.actingOrg.mockRejectedValue(new Error('no organization'));
      const response = await decide({ claimedOrgId: null });
      expect(response.status).toBe(409);
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('fails the decision when its audit record cannot be written, and never copies the summary text into the record', async () => {
      m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit down'));
      const response = await decide({ claimedOrgId: null });
      expect(response.status).toBe(500);
      await decide({ claimedOrgId: null });
      expect(JSON.stringify(m.persistAtomicAudit.mock.calls.at(-1))).not.toContain('"summary"');
    });
  });

  it('returns 400 for invalid action', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/icra/report/a/review', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'noop', summary: 'ok' }),
    }), { params: Promise.resolve({ assessmentId: '11111111-1111-1111-1111-111111111111' }) });

    expect(response.status).toBe(400);
  });

  it('returns 404 when assessment is missing', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([]);

    const response = await POST(new NextRequest('http://localhost/api/icra/report/a/review', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'approve', summary: 'ok' }),
    }), { params: Promise.resolve({ assessmentId: '11111111-1111-1111-1111-111111111111' }) });

    expect(response.status).toBe(404);
  });

  it('returns 422 when AI slot cannot be resolved', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'a1', organizationContext: {}, locale: 'en-CA' }], [{ profilePayload: { generatedAt: '2026-01-01' } }]);
    m.resolveAdaptiveReportAISlot.mockReturnValueOnce(null);

    const response = await POST(new NextRequest('http://localhost/api/icra/report/a/review', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'approve', summary: 'ok' }),
    }), { params: Promise.resolve({ assessmentId: '11111111-1111-1111-1111-111111111111' }) });

    expect(response.status).toBe(422);
  });

  it('records review decision successfully', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'a1', organizationContext: {}, locale: 'en-CA' }], [{ profilePayload: { generatedAt: '2026-01-01' } }]);

    const response = await POST(new NextRequest('http://localhost/api/icra/report/a/review', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'approve', summary: 'approved by governance' }),
    }), { params: Promise.resolve({ assessmentId: '11111111-1111-1111-1111-111111111111' }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.reviewStatus).toBe('approved');
    // Disclosed adaptation (F06 A2): this test asserted that an unclaimed assessment is NOT audited. That was the defect; it is now audited
    // against the reviewer's acting organization (see the describe block above).
    expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1);
  });

  const ORG = '22222222-2222-4222-8222-222222222222';
  const review = (summary = 'approved by governance') =>
    new NextRequest('http://localhost/api/icra/report/a/review', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'approve', summary, reviewerRole: 'governance_reviewer' }),
    });
  const context = { params: Promise.resolve({ assessmentId: '11111111-1111-1111-1111-111111111111' }) };

  it('audits the decision of a claimed assessment in the same transaction, without the summary text', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'a1', organizationContext: {}, locale: 'en-CA', claimedOrgId: ORG }], [{ profilePayload: { generatedAt: '2026-01-01' } }]);

    const response = await POST(review('PRIVATE REVIEW SUMMARY'), context);

    expect(response.status).toBe(200);
    expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(mockDb, expect.objectContaining({
      organizationId: ORG,
      userId: 'reviewer-1',
      action: 'icra.report.review',
      resourceId: '11111111-1111-1111-1111-111111111111',
      details: expect.objectContaining({ decision: 'approve', reviewerRole: 'governance_reviewer', reviewStatus: 'approved' }),
    }));
    expect(JSON.stringify(m.persistAtomicAudit.mock.calls)).not.toContain('PRIVATE REVIEW SUMMARY');
  });

  it('fails the request, and reports no success, when the audit cannot be written', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'a1', organizationContext: {}, locale: 'en-CA', claimedOrgId: ORG }], [{ profilePayload: { generatedAt: '2026-01-01' } }]);
    m.persistAtomicAudit.mockRejectedValue(new Error('audit sink unavailable'));

    const response = await POST(review(), context);

    expect(response.status).toBe(500);
    expect((await response.json()).success).toBeUndefined();
  });
});
