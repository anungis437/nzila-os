import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';

const TOKEN = 'test-capability-token';
const TOKEN_HASH = createHash('sha256').update(TOKEN, 'utf8').digest('hex');
const FUTURE = new Date(Date.now() + 60_000);

const m = vi.hoisted(() => ({
  withSystemContext: vi.fn(),
  computeProfile: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn() },
  eq: vi.fn(),
}));

vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/lib/icra/scoring', () => ({ computeProfile: m.computeProfile }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: m.eq };
});
vi.mock('@/db/schema/icra-schema', () => ({
  icraAssessments: { id: 'id' },
  icraAssessmentAnswers: { assessmentId: 'assessmentId' },
  icraMaturityProfiles: { assessmentId: 'assessmentId', generatedAt: 'generatedAt' },
  icraContinuityScores: { assessmentId: 'assessmentId' },
  icraGovernanceFlags: { assessmentId: 'assessmentId' },
  icraFollowupRecommendations: { assessmentId: 'assessmentId' },
}));

function req(authorized = true) {
  const headers: Record<string, string> = {};
  if (authorized) headers.authorization = `Bearer ${TOKEN}`;
  return new Request('http://localhost', { headers });
}

async function loadRoute() {
  return import('../icra/[assessmentId]/submit/route');
}

describe('icra/[assessmentId]/submit route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.eq.mockReturnValue('eq');
    m.computeProfile.mockReturnValue({
      maturityBand: { id: 'developing' },
      composite: 62.5,
      answeredQuestionCount: 1,
      dimensions: [{ dimension: 'governance', score: 60, contributingQuestions: ['q1'], weightTotal: 1 }],
      observations: [{ id: 'obs1', severity: 'medium', category: 'governance', statement: 'Needs policy' }],
      recommendations: [{ id: 'rec1', kind: 'policy', title: 'Write policy', description: 'Create policy', ctaLabel: 'Open', ctaHref: '/x' }],
    });
  });

  it('returns 404 when assessment is missing', async () => {
    const { POST } = await loadRoute();
    m.withSystemContext.mockImplementationOnce(async (fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => []), orderBy: vi.fn(() => ({ limit: vi.fn(async () => []) })) })),
          })),
        })),
      };
      return fn(tx);
    });

    const response = await POST(req(), { params: Promise.resolve({ assessmentId: 'a1' }) });
    expect(response.status).toBe(404);
  });

  it('returns 401 when no capability token is presented', async () => {
    const { POST } = await loadRoute();
    m.withSystemContext.mockImplementationOnce(async (fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [
                { id: 'a1', status: 'in_progress', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE },
              ]),
            })),
          })),
        })),
      };
      return fn(tx);
    });

    const response = await POST(req(false), { params: Promise.resolve({ assessmentId: 'a1' }) });
    expect(response.status).toBe(401);
  });

  it('returns 400 when no answers are recorded', async () => {
    const { POST } = await loadRoute();
    m.withSystemContext.mockImplementationOnce(async (fn: (tx: any) => Promise<unknown>) => {
      let selectCall = 0;
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => {
              selectCall += 1;
              if (selectCall === 1) {
                return {
                  limit: vi.fn(async () => [
                    { id: 'a1', status: 'in_progress', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE },
                  ]),
                };
              }
              return Promise.resolve([]);
            }),
          })),
        })),
      };
      return fn(tx);
    });

    const response = await POST(req(), { params: Promise.resolve({ assessmentId: 'a1' }) });
    expect(response.status).toBe(400);
  });

  it('returns profile and marks assessment as submitted', async () => {
    const { POST } = await loadRoute();
    m.withSystemContext.mockImplementationOnce(async (fn: (tx: any) => Promise<unknown>) => {
      let selectCall = 0;
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => {
              selectCall += 1;
              if (selectCall === 1) {
                return {
                  limit: vi.fn(async () => [
                    { id: 'a1', status: 'in_progress', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE },
                  ]),
                };
              }
              return Promise.resolve([
                {
                  questionId: 'q1',
                  questionVersion: '1',
                  rawValue: 'yes',
                  normalizedScore: '0.8',
                  weightsSnapshot: { governance: 1 },
                  riskInverted: false,
                  note: null,
                  answeredAt: new Date('2026-01-01T00:00:00.000Z'),
                },
              ]);
            }),
          })),
        })),
        delete: vi.fn(() => ({ where: vi.fn(async () => ({})) })),
        insert: vi.fn(() => ({ values: vi.fn(async () => ({})) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => ({})) })) })),
      };
      return fn(tx);
    });

    const response = await POST(req(), { params: Promise.resolve({ assessmentId: 'a1' }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.profile.maturityBand.id).toBe('developing');
    expect(m.logger.info).toHaveBeenCalled();
  });

  it('is idempotent: a repeat submit after already-submitted returns the existing profile without rebuilding', async () => {
    const { POST } = await loadRoute();
    m.withSystemContext.mockImplementationOnce(async (fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [
                { id: 'a1', status: 'submitted', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE },
              ]),
              orderBy: vi.fn(() => ({
                limit: vi.fn(async () => [{ profilePayload: { maturityBand: { id: 'developing' } } }]),
              })),
            })),
          })),
        })),
        delete: vi.fn(() => ({ where: vi.fn(async () => ({})) })),
        insert: vi.fn(() => ({ values: vi.fn(async () => ({})) })),
      };
      return fn(tx);
    });

    const response = await POST(req(), { params: Promise.resolve({ assessmentId: 'a1' }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.profile.maturityBand.id).toBe('developing');
    // Idempotent path must not touch delete/insert (no rebuild)
    expect(m.computeProfile).not.toHaveBeenCalled();
  });

  it('returns 409 when already submitted but no profile exists yet', async () => {
    const { POST } = await loadRoute();
    m.withSystemContext.mockImplementationOnce(async (fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [
                { id: 'a1', status: 'submitted', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE },
              ]),
              orderBy: vi.fn(() => ({ limit: vi.fn(async () => []) })),
            })),
          })),
        })),
      };
      return fn(tx);
    });

    const response = await POST(req(), { params: Promise.resolve({ assessmentId: 'a1' }) });
    expect(response.status).toBe(409);
  });

  it('returns 500 when submit transaction fails', async () => {
    const { POST } = await loadRoute();
    m.withSystemContext.mockRejectedValueOnce(new Error('db down'));

    const response = await POST(req(), { params: Promise.resolve({ assessmentId: 'a1' }) });
    expect(response.status).toBe(500);
  });
});
