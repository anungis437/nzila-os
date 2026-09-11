import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  hashIp: vi.fn(),
  fireAndForgetEvent: vi.fn(),
  verifyTurnstileToken: vi.fn(),
  scoreAssessment: vi.fn(),
  withSystemContext: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  classifyOrgContext: vi.fn(),
  routeQuestionBank: vi.fn(),
  buildPersistedAdaptiveContext: vi.fn(),
  embedPersistedAdaptiveContext: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rateLimit }));
vi.mock('@/lib/icra/observability', () => ({
  hashIp: m.hashIp,
  fireAndForgetEvent: m.fireAndForgetEvent,
}));
vi.mock('@/lib/icra/turnstile', () => ({ verifyTurnstileToken: m.verifyTurnstileToken }));
vi.mock('@/lib/icra/scoring', () => ({ scoreAssessment: m.scoreAssessment }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/icra/adaptation', () => ({
  classifyOrgContext: m.classifyOrgContext,
  routeQuestionBank: m.routeQuestionBank,
  buildPersistedAdaptiveContext: m.buildPersistedAdaptiveContext,
  embedPersistedAdaptiveContext: m.embedPersistedAdaptiveContext,
}));

function baseBody() {
  return {
    consent: {
      acknowledgedAntiSurveillance: true,
      acknowledgedDataHandling: true,
      acknowledgedExplainability: true,
    },
    orgContext: { sector: 'public' },
    answers: [
      {
        questionId: 'q1',
        questionVersion: '1',
        rawValue: 'yes',
        normalizedScore: 0.5,
        weightsSnapshot: { governance: 1 },
        riskInverted: false,
        answeredAt: new Date().toISOString(),
      },
    ],
    locale: 'en-CA',
    turnstileToken: 'token',
  };
}

async function loadRoute() {
  return import('../icra/submit/route');
}

describe('icra/submit route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.hashIp.mockReturnValue('ip_hash_1');
    m.rateLimit.mockReturnValue({ success: true });
    m.verifyTurnstileToken.mockResolvedValue({ success: true });
    m.classifyOrgContext.mockReturnValue({ orgType: 'local' });
    m.routeQuestionBank.mockReturnValue([{ id: 'q1' }]);
    m.buildPersistedAdaptiveContext.mockReturnValue({ routed: true });
    m.embedPersistedAdaptiveContext.mockReturnValue({ sector: 'public', _adaptive: { routed: true } });
    m.scoreAssessment.mockReturnValue({
      profile: {
        maturityBand: { id: 'developing' },
        composite: 62.5,
        answeredQuestionCount: 1,
        dimensions: [{ dimension: 'governance', score: 60, contributingQuestions: ['q1'], weightTotal: 1 }],
        observations: [{ id: 'obs1', severity: 'medium', category: 'governance', statement: 'Needs policy' }],
        recommendations: [{ id: 'rec1', kind: 'policy', title: 'Write policy', description: 'Create governance policy', ctaLabel: 'Open', ctaHref: '/x' }],
      },
    });

    m.withSystemContext.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        insert: vi.fn((table: any) => {
          const tableName = String(table?.[Symbol.for('drizzle:Name')] ?? 'unknown');
          if (tableName.includes('icra_assessments')) {
            return {
              values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'assessment_1' }]) })),
            };
          }
          return {
            values: vi.fn(async () => []),
          };
        }),
      };
      return fn(tx);
    });
  });

  it('returns 429 when submission rate limit is exceeded', async () => {
    const { POST } = await loadRoute();
    m.rateLimit.mockReturnValueOnce({ success: false });

    const response = await POST(new NextRequest('http://localhost/api/icra/submit', {
      method: 'POST',
      body: JSON.stringify(baseBody()),
      headers: { 'content-type': 'application/json' },
    }));

    expect(response.status).toBe(429);
  });

  it('returns 400 for invalid request payload', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/icra/submit', {
      method: 'POST',
      body: JSON.stringify({ consent: {}, answers: [] }),
      headers: { 'content-type': 'application/json' },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('Missing or invalid') });
  });

  it('returns 403 when turnstile verification fails', async () => {
    const { POST } = await loadRoute();
    m.verifyTurnstileToken.mockResolvedValueOnce({ success: false, errorCodes: ['bad-token'] });

    const response = await POST(new NextRequest('http://localhost/api/icra/submit', {
      method: 'POST',
      body: JSON.stringify(baseBody()),
      headers: { 'content-type': 'application/json' },
    }));

    expect(response.status).toBe(403);
  });

  it('returns 201 with assessment id on successful submission', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/icra/submit', {
      method: 'POST',
      body: JSON.stringify(baseBody()),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({ assessmentId: 'assessment_1' });
    expect(m.scoreAssessment).toHaveBeenCalled();
  });

  it('issues a capability token and sets the issuance cookie on creation', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/icra/submit', {
      method: 'POST',
      body: JSON.stringify(baseBody()),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
    }));
    const payload = await response.json();

    expect(typeof payload.capabilityToken).toBe('string');
    expect(payload.capabilityToken.length).toBeGreaterThan(20);
    expect(response.headers.get('set-cookie')).toContain('icra_cap_assessment_1=');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  });

  it('returns 500 when persistence layer throws', async () => {
    const { POST } = await loadRoute();
    m.withSystemContext.mockRejectedValueOnce(new Error('db failure'));

    const response = await POST(new NextRequest('http://localhost/api/icra/submit', {
      method: 'POST',
      body: JSON.stringify(baseBody()),
      headers: { 'content-type': 'application/json' },
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('Submission failed') });
  });
});
