import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  questionById: vi.fn(),
  buildAnswer: vi.fn(),
  withSystemContext: vi.fn(),
  logger: { debug: vi.fn(), error: vi.fn() },
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock('@/lib/icra/questions', () => ({ questionById: m.questionById, QUESTION_BANK_VERSION: '1.0.0' }));
vi.mock('@/lib/icra/scoring', () => ({ buildAnswer: m.buildAnswer }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: m.eq, and: m.and };
});
vi.mock('@/db/schema/icra-schema', () => ({
  icraAssessments: { id: 'id', status: 'status' },
  icraAssessmentAnswers: { assessmentId: 'assessmentId', questionId: 'questionId' },
}));

async function loadRoute() {
  return import('../icra/[assessmentId]/answer/route');
}

describe('icra/[assessmentId]/answer route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
            where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'a1', status: 'in_progress' }]) })),
          })),
        })),
        delete: vi.fn(() => ({ where: vi.fn(async () => ({})) })),
        insert: vi.fn(() => ({ values: vi.fn(async () => ({})) })),
      };
      return fn(tx);
    });
  });

  it('returns 400 for invalid answer payload', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new Request('http://localhost/api/icra/a1/answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ questionId: '' }),
      }),
      { params: Promise.resolve({ assessmentId: 'a1' }) },
    );

    expect(response.status).toBe(400);
  });

  it('returns 400 when question id is unknown', async () => {
    const { POST } = await loadRoute();
    m.questionById.mockReturnValueOnce(null);

    const response = await POST(
      new Request('http://localhost/api/icra/a1/answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ questionId: 'qX', rawValue: 'yes' }),
      }),
      { params: Promise.resolve({ assessmentId: 'a1' }) },
    );

    expect(response.status).toBe(400);
  });

  it('returns 200 and records answer', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new Request('http://localhost/api/icra/a1/answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ questionId: 'q1', rawValue: 'yes' }),
      }),
      { params: Promise.resolve({ assessmentId: 'a1' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
  });

  it('returns 500 when answer transaction fails', async () => {
    const { POST } = await loadRoute();
    m.withSystemContext.mockRejectedValueOnce(new Error('db down'));

    const response = await POST(
      new Request('http://localhost/api/icra/a1/answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ questionId: 'q1', rawValue: 'yes' }),
      }),
      { params: Promise.resolve({ assessmentId: 'a1' }) },
    );

    expect(response.status).toBe(500);
  });
});
