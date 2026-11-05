import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const QUERY_ID = '11111111-1111-1111-1111-111111111111';

const m = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  createRateLimitHeaders: vi.fn(),
  guardAiFeature: vi.fn(),
  enforceAISafety: vi.fn(),
  db: { select: vi.fn(), insert: vi.fn(), execute: vi.fn() },
  insertValues: vi.fn(),
  withRLSContext: vi.fn(),
  selectQueue: [] as unknown[][],
  audit: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: { AI_COMPLETION: { limit: 10 } },
  createRateLimitHeaders: m.createRateLimitHeaders,
}));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { AI_FEEDBACK: 'AI_FEEDBACK' } }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../ai/feedback/route');
}

const post = (body: unknown) => new NextRequest('http://localhost/api/ai/feedback', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
const get = (query = '') => new NextRequest(`http://localhost/api/ai/feedback${query}`);

describe('ai/feedback route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.role = 'member';
    m.selectQueue = [];
    m.checkRateLimit.mockResolvedValue({ allowed: true });
    m.createRateLimitHeaders.mockReturnValue({});
    m.guardAiFeature.mockResolvedValue(null);
    m.enforceAISafety.mockReturnValue(undefined);

    const createSelectChain = () => {
      const chain: {
        from: () => unknown;
        where: () => unknown;
        orderBy: () => unknown;
        limit: () => unknown;
        then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) => Promise<unknown>;
      } = {
        from: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        then: (resolve, reject) => Promise.resolve((m.selectQueue.shift() ?? []) as unknown[]).then(resolve, reject),
      };
      return chain;
    };

    m.db.select = vi.fn(() => createSelectChain());
    m.insertValues.mockImplementation(() => ({ returning: vi.fn(async () => [{ id: 'f1' }]) }));
    m.db.insert = vi.fn(() => ({ values: m.insertValues }));
    m.withRLSContext.mockImplementation(async (_scope: unknown, run: (tx: typeof m.db) => unknown) => run(m.db));
    m.audit.mockResolvedValue(undefined);
  });

  it('declares what it asks of the wrapper: a member who may have no active organization (the handlers answer that themselves), and a validated body on the write', async () => {
    await loadRoute();
    const write = declared.find((entry) => entry.openapi?.summary === 'Submit feedback on an AI response');
    const read = declared.find((entry) => entry.openapi?.summary === 'The caller\'s current feedback on an AI response');

    expect(write?.auth).toEqual({ minRole: 'member' });
    expect(write?.requireOrg).toBe(false);
    expect(write?.body).toBeDefined();
    expect(read?.auth).toEqual({ minRole: 'member' });
    expect(read?.requireOrg).toBe(false);
  });

  it('returns 429 when rate-limited', async () => {
    const { POST } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false });
    const response = await POST(post({ query_id: QUERY_ID, rating: 'good' }));
    expect(response.status).toBe(429);
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('returns 400 when organization context is missing', async () => {
    caller.organizationId = null;
    const { POST } = await loadRoute();
    const response = await POST(post({ query_id: QUERY_ID, rating: 'good' }));

    expect(response.status).toBe(400);
    expect(m.guardAiFeature).not.toHaveBeenCalled();
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('returns blocked response when AI feature is disabled', async () => {
    const { POST } = await loadRoute();
    m.guardAiFeature.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));

    const response = await POST(post({ query_id: QUERY_ID, rating: 'good' }));

    expect(response.status).toBe(403);
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('returns validation error for malformed payload before any limit is touched', async () => {
    const { POST } = await loadRoute();

    const response = await POST(post({ query_id: 'not-a-uuid', rating: 'good' }));

    expect(response.status).toBe(400);
    expect(m.checkRateLimit).not.toHaveBeenCalled();
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('creates feedback when no prior feedback exists', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([]);

    const response = await POST(post({ query_id: QUERY_ID, rating: 'good', comment: 'helpful' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.created).toBe(true);
    expect(payload.id).toBe('f1');
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
    expect(m.insertValues).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org_1', userId: 'u1', requestId: QUERY_ID, operation: 'feedback', metadata: { rating: 'good', comment: 'helpful' } }));
    expect(m.audit).toHaveBeenCalledWith(m.db, expect.objectContaining({ organizationId: 'org_1', userId: 'u1', action: 'ai.feedback.create', resourceId: 'f1' }));
  });

  it('supersedes existing feedback for the same user and query with a newer row, keeping the earlier one as history', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'existing_feedback' }]);

    const response = await POST(post({ query_id: QUERY_ID, rating: 'bad', comment: 'not accurate' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.updated).toBe(true);
    expect(payload.id).toBe('f1');
    expect(m.insertValues).toHaveBeenCalledWith(expect.objectContaining({ requestId: QUERY_ID, metadata: { rating: 'bad', comment: 'not accurate' } }));
    expect(m.audit).toHaveBeenCalledWith(m.db, expect.objectContaining({
      action: 'ai.feedback.update',
      resourceId: 'f1',
      details: { queryId: QUERY_ID, rating: 'bad', supersedes: 'existing_feedback' },
    }));
  });

  it('fails the feedback write when its audit record cannot be written', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([]);
    m.audit.mockRejectedValueOnce(new Error('audit down'));

    const response = await POST(post({ query_id: QUERY_ID, rating: 'good' }));

    expect(response.status).toBe(500);
  });

  // The runtime role may select and insert on the metering ledger but never update (migration round58), so a changed rating cannot be an in-place
  // update that races a concurrent change: it is a new row, there is no conflict to answer, and no UPDATE statement is ever issued.
  it('never updates a row in place, so a changed rating is not a conflict', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'existing_feedback' }]);

    const response = await POST(post({ query_id: QUERY_ID, rating: 'bad' }));

    expect(response.status).toBe(200);
    expect(m.db.execute).not.toHaveBeenCalled();
    expect(m.insertValues).toHaveBeenCalledTimes(1);
    expect(m.audit).toHaveBeenCalledTimes(1);
  });

  it('validates query_id is required for GET', async () => {
    const { GET } = await loadRoute();
    const response = await GET(get());
    expect(response.status).toBe(400);
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  // ROUND 48 REGRESSION: GET previously had zero tenant scoping — any
  // authenticated member of ANY organization could read another
  // organization's feedback (rating/comment/userId) for a guessed query_id.
  // GET must reject requests with no organization context, and the select
  // query must be scoped by organizationId (see route implementation).
  it('returns 400 for GET when organization context is missing (cross-tenant IDOR regression)', async () => {
    caller.organizationId = null;
    const { GET } = await loadRoute();
    const response = await GET(get(`?query_id=${QUERY_ID}`));
    expect(response.status).toBe(400);
    expect(m.withRLSContext).not.toHaveBeenCalled();
    expect(m.db.select).not.toHaveBeenCalled();
  });

  it('returns feedback list for a query id', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([
      {
        id: 'fb_1',
        requestId: QUERY_ID,
        userId: 'u1',
        metadata: { rating: 'good', comment: 'solid answer' },
        createdAt: '2026-06-11T00:00:00.000Z',
      },
    ]);

    const response = await GET(get(`?query_id=${QUERY_ID}`));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.count).toBe(1);
    expect(payload.feedback[0]).toMatchObject({ id: 'fb_1', rating: 'good', comment: 'solid answer' });
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
  });
});
