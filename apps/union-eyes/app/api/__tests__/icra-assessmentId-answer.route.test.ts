import { beforeEach, describe, expect, it, vi } from 'vitest';

// The route answers a path value that is not a UUID as not found, so the tests use a real identifier.
const A1 = '00000000-0000-4000-8000-0000000000a1';
import { createHash } from 'crypto';

const TOKEN = 'test-capability-token';
const TOKEN_HASH = createHash('sha256').update(TOKEN, 'utf8').digest('hex');
const FUTURE = new Date(Date.now() + 60_000);

const m = vi.hoisted(() => ({
  questionById: vi.fn(),
  buildAnswer: vi.fn(),
  withSystemContext: vi.fn(),
  logger: { debug: vi.fn(), error: vi.fn() },
  eq: vi.fn(),
  and: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/icra/questions', () => ({ questionById: m.questionById, QUESTION_BANK_VERSION: '1.0.0' }));
vi.mock('@/lib/icra/scoring', () => ({ buildAnswer: m.buildAnswer }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: m.checkRateLimit }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: m.eq, and: m.and };
});
vi.mock('@/db/schema/icra-schema', () => ({
  icraAssessments: { id: 'id', status: 'status' },
  icraAssessmentAnswers: { assessmentId: 'assessmentId', questionId: 'questionId' },
}));

function req(body: unknown, opts: { authorized?: boolean } = { authorized: true }) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.authorized !== false) headers.authorization = `Bearer ${TOKEN}`;
  return new Request('http://localhost/api/icra/a1/answer', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

async function loadRoute() {
  return import('../icra/[assessmentId]/answer/route');
}

describe('icra/[assessmentId]/answer route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.checkRateLimit.mockResolvedValue({ allowed: true });
    m.eq.mockReturnValue('eq');
    m.and.mockReturnValue('and');
    m.questionById.mockReturnValue({ id: 'q1' });
    m.buildAnswer.mockReturnValue({
      questionId: 'q1',
      rawValue: 'yes',
      normalizedScore: 0.8,
      weightsSnapshot: { a: 1 },
      riskInverted: false,
      note: undefined,
    });
    m.withSystemContext.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [
                {
                  id: 'a1',
                  status: 'in_progress',
                  consent: { acceptedAt: '2026-01-01T00:00:00.000Z', doctrineVersion: '1.0.0', acknowledgedAntiSurveillance: true, acknowledgedDataHandling: true, acknowledgedExplainability: true },
                  capabilityTokenHash: TOKEN_HASH,
                  capabilityTokenExpiresAt: FUTURE,
                },
              ]),
            })),
          })),
        })),
        delete: vi.fn(() => ({ where: vi.fn(async () => ({})) })),
        insert: vi.fn(() => ({ values: vi.fn(async () => ({})) })),
      };
      return fn(tx);
    });
  });

  it('refuses to store an answer for an assessment with no recorded consent', async () => {
    m.withSystemContext.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
      const insert = vi.fn(() => ({ values: vi.fn(async () => ({})) }));
      const tx = {
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'a1', status: 'in_progress', consent: null, capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }]) })) })) })),
        delete: vi.fn(() => ({ where: vi.fn(async () => ({})) })),
        insert,
      };
      const result = await fn(tx);
      expect(insert).not.toHaveBeenCalled();
      return result;
    });
    const { POST } = await loadRoute();
    const response = await POST(req({ questionId: 'q1', rawValue: 'yes' }), { params: Promise.resolve({ assessmentId: A1 }) });
    expect(response.status).toBe(409);
  });

  it('returns 400 for invalid answer payload', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      req({ questionId: '' }),
      { params: Promise.resolve({ assessmentId: A1 }) },
    );

    expect(response.status).toBe(400);
  });

  it('returns 400 when question id is unknown', async () => {
    const { POST } = await loadRoute();
    m.questionById.mockReturnValueOnce(null);

    const response = await POST(
      req({ questionId: 'qX', rawValue: 'yes' }),
      { params: Promise.resolve({ assessmentId: A1 }) },
    );

    expect(response.status).toBe(400);
  });

  it('returns 200 and records answer', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      req({ questionId: 'q1', rawValue: 'yes' }),
      { params: Promise.resolve({ assessmentId: A1 }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
  });

  it('returns 401 when no capability token is presented', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      req({ questionId: 'q1', rawValue: 'yes' }, { authorized: false }),
      { params: Promise.resolve({ assessmentId: A1 }) },
    );

    expect(response.status).toBe(401);
  });

  it('returns 401 when the presented capability token does not match', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new Request('http://localhost/api/icra/a1/answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer wrong-token' },
        body: JSON.stringify({ questionId: 'q1', rawValue: 'yes' }),
      }),
      { params: Promise.resolve({ assessmentId: A1 }) },
    );

    expect(response.status).toBe(401);
  });

  it('returns 401 when the capability token is expired', async () => {
    m.withSystemContext.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [
                {
                  id: 'a1',
                  status: 'in_progress',
                  capabilityTokenHash: TOKEN_HASH,
                  capabilityTokenExpiresAt: new Date(Date.now() - 1000),
                },
              ]),
            })),
          })),
        })),
        delete: vi.fn(() => ({ where: vi.fn(async () => ({})) })),
        insert: vi.fn(() => ({ values: vi.fn(async () => ({})) })),
      };
      return fn(tx);
    });
    const { POST } = await loadRoute();
    const response = await POST(
      req({ questionId: 'q1', rawValue: 'yes' }),
      { params: Promise.resolve({ assessmentId: A1 }) },
    );

    expect(response.status).toBe(410);
  });

  it('returns 500 when answer transaction fails', async () => {
    const { POST } = await loadRoute();
    m.withSystemContext.mockRejectedValueOnce(new Error('db down'));

    const response = await POST(
      req({ questionId: 'q1', rawValue: 'yes' }),
      { params: Promise.resolve({ assessmentId: A1 }) },
    );

    expect(response.status).toBe(500);
  });

  // DEF-0B8-ICRA-MALFORMED-IDS-AND-ANSWER-VALUES-SURFACE-AS-SERVER-ERRORS
  it('answers a path value that is not a UUID as not found, before any limiter or database call', async () => {
    const { POST } = await loadRoute();
    const response = await POST(req({ questionId: 'q1', rawValue: 'yes' }), { params: Promise.resolve({ assessmentId: 'not-a-uuid' }) });
    expect(response.status).toBe(404);
    expect(m.checkRateLimit).not.toHaveBeenCalled();
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  it('returns 400, not 500, for a value the question cannot take, and touches no row', async () => {
    const { POST } = await loadRoute();
    m.buildAnswer.mockImplementationOnce(() => { throw new Error('value out of range'); });
    const response = await POST(req({ questionId: 'q1', rawValue: 99 }), { params: Promise.resolve({ assessmentId: A1 }) });
    expect(response.status).toBe(400);
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  // DEF-0B8-ICRA-RATE-LIMITS-PER-PROCESS-AND-KEYED-ON-REQUEST-HEADER-ADDRESS
  it('uses the shared limiter keyed on the trusted address: 429 when refused, 503 when unavailable', async () => {
    const { POST } = await loadRoute();
    const call = () => POST(
      new Request('http://localhost/api/icra/x/answer', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': 'spoofed, 6.6.6.6' }, body: JSON.stringify({ questionId: 'q1', rawValue: 'yes' }) }),
      { params: Promise.resolve({ assessmentId: A1 }) },
    );
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 30 });
    expect((await call()).status).toBe(429);
    expect(m.checkRateLimit).toHaveBeenCalledWith(`icra-answer:${A1}:6.6.6.6`, expect.objectContaining({ limit: 240 }));
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, error: 'redis down', resetIn: 30 });
    expect((await call()).status).toBe(503);
  });
});
