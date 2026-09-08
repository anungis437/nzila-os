import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const TEST_USER = {
  id: 'user_test_001',
  organizationId: '00000000-0000-0000-0000-000000000001',
};

const m = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  checkRateLimit: vi.fn(),
  createRateLimitHeaders: vi.fn(),
  enforceAISafety: vi.fn(),
  auditAIInvocation: vi.fn(),
  dbExecute: vi.fn(),
  predictChurnRisk: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/api-auth-guard', async (orig) => {
  const actual = await orig<typeof import('@/lib/api-auth-guard')>();
  return {
    ...actual,
    getCurrentUser: m.getCurrentUser,
    withRoleAuth: vi.fn(
      (_role: string, handler: (req: NextRequest, ctx: unknown) => Promise<Response>) =>
        (req: NextRequest, ctx: unknown = {}) => handler(req, ctx)
    ),
  };
});

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  createRateLimitHeaders: m.createRateLimitHeaders,
  RATE_LIMITS: {
    ML_PREDICTIONS: { requests: 20, window: 60 },
  },
}));

vi.mock('@nzila/policies', () => ({
  enforceAISafety: m.enforceAISafety,
}));

vi.mock('@/lib/audit-logger', () => ({
  auditAIInvocation: m.auditAIInvocation,
}));

vi.mock('@/db', () => ({
  db: {
    execute: m.dbExecute,
  },
}));

vi.mock('@/lib/ml/models/churn-prediction-model', () => ({
  predictChurnRisk: m.predictChurnRisk,
}));

vi.mock('@/lib/logger', () => ({ logger: m.logger }));

async function loadRoute() {
  return import('../ml/predictions/churn-risk/route');
}

describe('ml/predictions/churn-risk route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.getCurrentUser.mockResolvedValue(TEST_USER);
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0, remaining: 99 });
    m.createRateLimitHeaders.mockReturnValue({ 'x-ratelimit-remaining': '99' });
    m.auditAIInvocation.mockResolvedValue('audit_ref_1');
    m.predictChurnRisk.mockResolvedValue({
      riskScore: 72,
      riskLevel: 'high',
      churnProbability: 0.72,
      confidence: 0.88,
      modelVersion: 'v1',
    });
  });

  it('returns 429 when GET is rate-limited', async () => {
    const { GET } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 40 });

    const response = await GET(new NextRequest('http://localhost/api/ml/predictions/churn-risk'));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('Rate limit exceeded') });
  });

  it('returns predictions and summary on GET success', async () => {
    const { GET } = await loadRoute();
    m.dbExecute.mockResolvedValueOnce([
      {
        member_id: 'member_1',
        member_name: 'Casey Worker',
        risk_score: 81,
        risk_level: 'high',
        contributing_factors: ['inactive'],
        recommended_interventions: ['outreach'],
        days_since_last_activity: 120,
        union_tenure_years: 3,
        total_cases: 5,
        predicted_at: '2026-06-10T00:00:00.000Z',
      },
    ]);

    const response = await GET(new NextRequest('http://localhost/api/ml/predictions/churn-risk?riskLevel=high&limit=10'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.summary).toMatchObject({ total: 1, highRisk: 1 });
    expect(payload.data.predictions[0]).toMatchObject({ memberId: 'member_1', riskLevel: 'high' });
  });

  it('returns validation error on POST with invalid payload', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/ml/predictions/churn-risk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ memberId: 'bad-uuid', organizationId: 'bad-uuid' }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('returns not found when member data is absent', async () => {
    const { POST } = await loadRoute();
    m.dbExecute.mockResolvedValueOnce([]);

    const response = await POST(new NextRequest('http://localhost/api/ml/predictions/churn-risk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        memberId: '00000000-0000-0000-0000-000000000011',
        organizationId: TEST_USER.organizationId,
      }),
    }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });

  it('returns generated prediction payload on POST success', async () => {
    const { POST } = await loadRoute();
    m.dbExecute
      .mockResolvedValueOnce([
        {
          full_name: 'Casey Worker',
          days_since_last_activity: 95,
          resolution_rate: 42,
          avg_satisfaction: 2.4,
          total_cases: 4,
          union_tenure_years: 1.5,
          negative_feedback_count: 3,
        },
      ])
      .mockResolvedValueOnce([]);

    const response = await POST(new NextRequest('http://localhost/api/ml/predictions/churn-risk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        memberId: '00000000-0000-0000-0000-000000000022',
        organizationId: TEST_USER.organizationId,
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.prediction).toMatchObject({
      memberName: 'Casey Worker',
      riskScore: 72,
      riskLevel: 'high',
    });
    expect(m.predictChurnRisk).toHaveBeenCalled();
  });

  // ROUND 48 REGRESSION: a caller-supplied organizationId (query param on GET,
  // request body on POST) must NEVER override the caller's own authenticated
  // organizationId. Prior to the round-48 fix, an 'officer' of one
  // organization could pass another organization's id and read/generate
  // predictions for members outside their own tenant (cross-tenant IDOR).
  const VICTIM_ORG_ID = '00000000-0000-0000-0000-0000000000ff';

  it('GET ignores a caller-supplied organizationId query param (cross-tenant IDOR regression)', async () => {
    const { GET } = await loadRoute();
    m.dbExecute.mockResolvedValueOnce([]);

    await GET(new NextRequest(
      `http://localhost/api/ml/predictions/churn-risk?organizationId=${VICTIM_ORG_ID}`
    ));

    expect(m.dbExecute).toHaveBeenCalledTimes(1);
    const queryArg = m.dbExecute.mock.calls[0][0];
    const serialized = JSON.stringify(queryArg);
    expect(serialized).toContain(TEST_USER.organizationId);
    expect(serialized).not.toContain(VICTIM_ORG_ID);
  });

  it('GET ignores caller-supplied orgId/organization_id/org_id query param aliases (cross-tenant IDOR regression)', async () => {
    const { GET } = await loadRoute();
    for (const alias of ['orgId', 'organization_id', 'org_id']) {
      m.dbExecute.mockClear();
      m.dbExecute.mockResolvedValueOnce([]);

      await GET(new NextRequest(
        `http://localhost/api/ml/predictions/churn-risk?${alias}=${VICTIM_ORG_ID}`
      ));

      const queryArg = m.dbExecute.mock.calls[0][0];
      const serialized = JSON.stringify(queryArg);
      expect(serialized).toContain(TEST_USER.organizationId);
      expect(serialized).not.toContain(VICTIM_ORG_ID);
    }
  });

  it('GET returns validation error when caller has no organization context', async () => {
    const { GET } = await loadRoute();
    m.getCurrentUser.mockResolvedValueOnce({ id: 'user_no_org' });

    const response = await GET(new NextRequest('http://localhost/api/ml/predictions/churn-risk'));

    expect(response.status).toBe(400);
    expect(m.dbExecute).not.toHaveBeenCalled();
  });

  it('POST ignores a caller-supplied organizationId body field (cross-tenant IDOR regression)', async () => {
    const { POST } = await loadRoute();
    m.dbExecute.mockResolvedValueOnce([
      {
        full_name: 'Casey Worker',
        days_since_last_activity: 95,
        resolution_rate: 42,
        avg_satisfaction: 2.4,
        total_cases: 4,
        union_tenure_years: 1.5,
        negative_feedback_count: 3,
      },
    ]).mockResolvedValueOnce([]);

    const response = await POST(new NextRequest('http://localhost/api/ml/predictions/churn-risk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        memberId: '00000000-0000-0000-0000-000000000022',
        organizationId: VICTIM_ORG_ID,
      }),
    }));

    expect(response.status).toBe(200);
    expect(m.dbExecute).toHaveBeenCalledTimes(2);
    const featureQueryArg = m.dbExecute.mock.calls[0][0];
    const insertQueryArg = m.dbExecute.mock.calls[1][0];
    expect(JSON.stringify(featureQueryArg)).toContain(TEST_USER.organizationId);
    expect(JSON.stringify(featureQueryArg)).not.toContain(VICTIM_ORG_ID);
    expect(JSON.stringify(insertQueryArg)).toContain(TEST_USER.organizationId);
    expect(JSON.stringify(insertQueryArg)).not.toContain(VICTIM_ORG_ID);
  });

  it('POST returns validation error when caller has no organization context', async () => {
    const { POST } = await loadRoute();
    m.getCurrentUser.mockResolvedValueOnce({ id: 'user_no_org' });

    const response = await POST(new NextRequest('http://localhost/api/ml/predictions/churn-risk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ memberId: '00000000-0000-0000-0000-000000000022' }),
    }));

    expect(response.status).toBe(400);
    expect(m.dbExecute).not.toHaveBeenCalled();
  });
});
