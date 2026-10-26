import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  queue: [] as unknown[],
  audit: vi.fn(),
  roles: [] as string[],
  createPrecedent: vi.fn(),
  executeResult: vi.fn(),
  compareInOrg: vi.fn(),
  saveComparison: vi.fn(),
  submitReview: vi.fn(),
  createJob: vi.fn(),
  getSource: vi.fn(),
  updateSource: vi.fn(),
  deactivateSource: vi.fn(),
}));

function chain(): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'from', 'where', 'limit', 'update', 'set', 'delete', 'returning', 'insert', 'values']) c[m] = () => c;
  c.execute = async () => h.executeResult();
  c.then = (resolve: (v: unknown) => void) => resolve(h.queue.shift());
  return c;
}
const tx = chain();

vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (ctx: unknown) => unknown) => (ctx: unknown) => handler(ctx),
  z: require('zod'),
  ApiError: {
    badRequest: (message: string) => Object.assign(new Error(message), { status: 400 }),
    notFound: (resource: string) => Object.assign(new Error(`${resource} not found`), { status: 404 }),
    unauthorized: (message: string) => Object.assign(new Error(message), { status: 401 }),
  },
}));
vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: (role: string, handler: (req: NextRequest, ctx: unknown) => Promise<Response>) => {
    h.roles.push(role);
    return (req: NextRequest, ctx: Record<string, unknown> = {}) =>
      handler(req, { userId: 'u1', organizationId: 'org-1', ...ctx });
  },
}));
vi.mock('@/db/db', () => ({ db: {} }));
vi.mock('@/db', () => ({ db: {} }));
vi.mock('@/db/schema/integration-schema', () => ({
  apiIntegrations: new Proxy({}, { get: (_t, p) => `api.${String(p)}` }),
}));
vi.mock('@/db/schema', () => ({
  tribunalTypeEnum: { enumValues: ['other'] },
  decisionTypeEnum: { enumValues: ['grievance'] },
  outcomeEnum: { enumValues: ['settled'] },
  precedentValueEnum: { enumValues: ['high'] },
}));
vi.mock('drizzle-orm', () => ({
  and: (...a: unknown[]) => a,
  eq: (...a: unknown[]) => a,
  sql: Object.assign((..._a: unknown[]) => 'sql', {}),
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_s: unknown, fn: (t: unknown) => Promise<unknown>) => fn(tx),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: h.audit }));
vi.mock('@/lib/services/precedent-audited-service', () => ({ createPrecedentAudited: h.createPrecedent }));
vi.mock('@/lib/services/precedent-service', () => ({
  listPrecedents: vi.fn(),
  getPrecedentStatistics: vi.fn(),
  getMostCitedPrecedents: vi.fn(),
  getPrecedentsByIssueType: vi.fn(),
}));
vi.mock('@/lib/services/clause-audited-service', () => ({
  compareClausesInOrganization: h.compareInOrg,
  saveClauseComparisonAudited: h.saveComparison,
}));
vi.mock('@/lib/services/cba-intelligence/review-service', () => ({
  submitReview: h.submitReview,
  getReviewQueue: vi.fn(),
  getReviewQueueCounts: vi.fn(),
}));
vi.mock('@/lib/services/cba-intelligence/ingestion-service', () => ({
  createIngestionJob: h.createJob,
  listIngestionJobs: vi.fn(),
}));
vi.mock('@/lib/services/cba-intelligence/source-registry-service', () => ({
  getSourceById: h.getSource,
  updateSource: h.updateSource,
  deactivateSource: h.deactivateSource,
}));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { FORBIDDEN: 'FORBIDDEN', VALIDATION_ERROR: 'VALIDATION_ERROR', RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND', INTERNAL_ERROR: 'INTERNAL_ERROR', AUTH_REQUIRED: 'AUTH_REQUIRED', MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD', ALREADY_EXISTS: 'ALREADY_EXISTS' },
  standardErrorResponse: (code: string, message: string) =>
    new Response(JSON.stringify({ code, message }), { status: ({ RESOURCE_NOT_FOUND: 404, FORBIDDEN: 403, VALIDATION_ERROR: 400 } as Record<string, number>)[code] ?? 500 }),
  standardSuccessResponse: (data: unknown) => new Response(JSON.stringify(data), { status: 200 }),
}));

vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: vi.fn(), RATE_LIMITS: {}, createRateLimitHeaders: vi.fn() }));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: vi.fn() }));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: {} }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: vi.fn() }));

const post = (body: unknown) =>
  new NextRequest('http://x/api', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  h.queue.length = 0;
  h.roles.length = 0;
  h.audit.mockReset().mockResolvedValue(undefined);
  h.createPrecedent.mockReset();
  h.compareInOrg.mockReset();
  h.saveComparison.mockReset();
  h.submitReview.mockReset();
  h.createJob.mockReset();
  h.getSource.mockReset();
  h.updateSource.mockReset();
  h.deactivateSource.mockReset();
});

describe('precedents POST', () => {
  const valid = {
    caseNumber: 'CN-1', caseTitle: 'T', tribunal: 'other', decisionType: 'grievance', decisionDate: '2025-01-01',
    arbitrator: 'A', union: 'U', employer: 'E', outcome: 'settled', precedentValue: 'high', fullText: 'text',
  };

  it('adds to the shared precedent library only for a platform content manager, attributing the audit to the acting organization', async () => {
    const { POST } = await import('../precedents/route');
    expect(h.roles).toContain('content_manager');
    h.createPrecedent.mockResolvedValue({ id: 'p1' });
    const response = await POST(post({ ...valid, isPublic: false, embedding: 'x', id: 'forced' }));
    expect(response.status).toBe(200);
    expect(h.createPrecedent).toHaveBeenCalledWith({ organizationId: 'org-1', userId: 'u1' }, expect.not.objectContaining({ id: 'forced', embedding: 'x', isPublic: false }));
  });

  it('rejects a malformed precedent instead of writing it', async () => {
    const { POST } = await import('../precedents/route');
    const response = await POST(post({ ...valid, tribunal: 'moon' }));
    expect(response.status).toBe(400);
    expect(h.createPrecedent).not.toHaveBeenCalled();
  });
});

describe('extensions/[id]', () => {
  it('PATCH and DELETE audit on the same transaction; a missing integration is 404 with no audit', async () => {
    const { PATCH, DELETE } = await import('../extensions/[id]/route');
    h.queue.push([{ id: 'i1' }]);
    await PATCH({ params: { id: 'i1' }, request: { json: async () => ({ enabled: false }) }, organizationId: 'org-1', userId: 'u1' });
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'integration.update', organizationId: 'org-1', userId: 'u1', resourceId: 'i1' }));

    h.queue.push([]);
    await expect(PATCH({ params: { id: 'i1' }, request: { json: async () => ({ enabled: true }) }, organizationId: 'org-1', userId: 'u1' })).rejects.toMatchObject({ status: 404 });

    h.audit.mockClear();
    h.queue.push([{ id: 'i1', name: 'N' }]);
    await DELETE({ params: { id: 'i1' }, organizationId: 'org-1', userId: 'u1' });
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'integration.delete', resourceId: 'i1' }));
    h.audit.mockClear();
    h.queue.push([]);
    await expect(DELETE({ params: { id: 'i1' }, organizationId: 'org-1', userId: 'u1' })).rejects.toMatchObject({ status: 404 });
    expect(h.audit).not.toHaveBeenCalled();
  });
});

describe('ml/monitoring/alerts POST', () => {
  const alertId = '11111111-1111-4111-8111-111111111111';

  it('requires a steward and never substitutes the user id for a missing organization', async () => {
    const { POST } = await import('../ml/monitoring/alerts/route');
    expect(h.roles).toContain('steward');
    const response = await POST(post({ alertId }), { organizationId: undefined } as never);
    expect(response.status).toBe(400);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('acknowledges in the caller\'s organization and audits on the same transaction', async () => {
    const { POST } = await import('../ml/monitoring/alerts/route');
    h.executeResult.mockResolvedValue([{ alert_id: alertId }]);
    const response = await POST(post({ alertId }));
    expect(response.status).toBe(200);
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'ml.alert.acknowledge', organizationId: 'org-1', userId: 'u1', resourceId: alertId }));
  });

  it('an acknowledgment held by another organization is not overwritten and not audited', async () => {
    const { POST } = await import('../ml/monitoring/alerts/route');
    h.executeResult.mockResolvedValue([]);
    const response = await POST(post({ alertId }));
    expect(response.status).toBe(500);
    expect(h.audit).not.toHaveBeenCalled();
  });
});

describe('cba-intelligence routes', () => {
  it('review POST records the decision and the audit on the same transaction', async () => {
    const { POST } = await import('../cba-intelligence/review/route');
    h.submitReview.mockResolvedValue({ id: 'd1' });
    await POST({ body: { targetType: 'finding', targetId: '22222222-2222-4222-8222-222222222222', decision: 'approved' }, userId: 'u1', organizationId: 'org-1' });
    expect(h.submitReview).toHaveBeenCalledWith(expect.objectContaining({ reviewerId: 'u1' }), tx);
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'cba_review.decide', userId: 'u1', details: expect.objectContaining({ decision: 'approved', reviewDecisionId: 'd1' }) }));
  });

  it('review POST does not keep a decision whose target changed concurrently', async () => {
    const { POST } = await import('../cba-intelligence/review/route');
    h.submitReview.mockRejectedValue(new Error('Review target changed concurrently'));
    await expect(POST({ body: { targetType: 'finding', targetId: 'x', decision: 'approved' }, userId: 'u1', organizationId: 'org-1' })).rejects.toThrow('changed concurrently');
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('ingestion POST creates the job and audits it on the same transaction; an unknown source writes nothing', async () => {
    const { POST } = await import('../cba-intelligence/ingestion/route');
    h.getSource.mockResolvedValue({ id: 's1', isActive: true });
    h.createJob.mockResolvedValue({ id: 'j1' });
    await POST({ body: { sourceId: '33333333-3333-4333-8333-333333333333', triggerType: 'manual' }, userId: 'u1', organizationId: 'org-1' });
    expect(h.createJob).toHaveBeenCalledWith(expect.objectContaining({ triggeredBy: 'u1' }), tx);
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'cba_ingestion.job.create', resourceId: 'j1' }));

    h.audit.mockClear();
    h.createJob.mockClear();
    h.getSource.mockResolvedValue(null);
    await expect(POST({ body: { sourceId: '33333333-3333-4333-8333-333333333333', triggerType: 'manual' }, userId: 'u1', organizationId: 'org-1' })).rejects.toMatchObject({ status: 404 });
    expect(h.createJob).not.toHaveBeenCalled();
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('source PATCH audits on the same transaction and a missing source is 404 with no audit', async () => {
    const { PATCH } = await import('../cba-intelligence/sources/[id]/route');
    h.updateSource.mockResolvedValue({ id: 's1' });
    await PATCH({ params: { id: 's1' }, body: { nameEn: 'N' }, userId: 'u1', organizationId: 'org-1' });
    expect(h.updateSource).toHaveBeenCalledWith('s1', { nameEn: 'N' }, tx);
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'cba_source.update', resourceId: 's1' }));

    h.audit.mockClear();
    h.updateSource.mockResolvedValue(null);
    await expect(PATCH({ params: { id: 's9' }, body: { nameEn: 'N' }, userId: 'u1', organizationId: 'org-1' })).rejects.toMatchObject({ status: 404 });
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('source deactivation of a missing source is 404 with no audit', async () => {
    const { PATCH } = await import('../cba-intelligence/sources/[id]/route');
    h.deactivateSource.mockResolvedValue(false);
    await expect(PATCH({ params: { id: 's9' }, body: { isActive: false }, userId: 'u1', organizationId: 'org-1' })).rejects.toMatchObject({ status: 404 });
    expect(h.audit).not.toHaveBeenCalled();
  });
});

describe('clauses/compare POST', () => {
  it('compares inside the caller\'s organization, 404s a foreign clause, and saves with an audited write', async () => {
    const { POST } = await import('../clauses/compare/route');
    h.compareInOrg.mockResolvedValue(null);
    const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
    const missing = await POST(post({ clauseIds: ids }));
    expect(missing.status).toBe(404);
    expect(h.compareInOrg).toHaveBeenCalledWith('org-1', expect.objectContaining({ clauseIds: ids }));

    h.compareInOrg.mockResolvedValue({ clauses: [{ clauseType: 'wages' }], similarities: [], differences: [], bestPractices: [], recommendations: [] });
    h.saveComparison.mockResolvedValue({ id: 'cmp1' });
    const saved = await POST(post({ clauseIds: ids, save: true, comparisonName: 'N' }));
    expect(saved.status).toBe(200);
    expect(h.saveComparison).toHaveBeenCalledWith({ organizationId: 'org-1', userId: 'u1' }, expect.objectContaining({ comparisonName: 'N', clauseIds: ids }));
  });

  it('refuses a body organization that is not the caller\'s', async () => {
    const { POST } = await import('../clauses/compare/route');
    const response = await POST(post({ clauseIds: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'], organizationId: '99999999-9999-4999-8999-999999999999' }));
    expect(response.status).toBe(403);
  });
});
