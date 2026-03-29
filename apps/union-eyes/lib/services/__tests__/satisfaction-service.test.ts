/**
 * Satisfaction Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Proxy chain helper ───────────────────────────────────────────────────────

function chain(resolveValue: unknown): unknown {
  const handler: ProxyHandler<object> = {
    get: (_target, prop) => {
      if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(resolveValue);
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
}

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockSelect: vi.fn(),
  mockSelectDistinct: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    query: {
      satisfactionSurveys: { findFirst: mocks.mockFindFirst },
    },
    select: mocks.mockSelect,
    selectDistinct: mocks.mockSelectDistinct,
    insert: mocks.mockInsert,
    update: mocks.mockUpdate,
  },
}));

vi.mock('@/db/schema', () => ({
  satisfactionSurveys: {
    id: 'id', claimId: 'claimId', memberId: 'memberId',
    status: 'status', lroId: 'lroId', organizationId: 'organizationId',
    communicationRating: 'commR', responsivenessRating: 'respR',
    knowledgeRating: 'knowR', advocacyRating: 'advR',
    professionalismRating: 'profR', outcomeRating: 'outR',
    wouldRecommend: 'wouldRec', sentAt: 'sentAt',
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SatisfactionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockFindFirst.mockResolvedValue(undefined);
    mocks.mockSelect.mockReturnValue(chain([]));
    mocks.mockSelectDistinct.mockReturnValue(chain([]));
    mocks.mockInsert.mockReturnValue(chain([]));
    mocks.mockUpdate.mockReturnValue(chain([]));
  });

  // ── createSatisfactionSurvey ──────────────────────────────────
  describe('createSatisfactionSurvey', () => {
    it('returns existing survey if already created', async () => {
      const existing = { id: 'srv-1', claimId: 'c-1', memberId: 'm-1' };
      mocks.mockFindFirst.mockResolvedValue(existing);
      const { createSatisfactionSurvey } = await import('../satisfaction-service');
      const result = await createSatisfactionSurvey({
        organizationId: 'org-1', claimId: 'c-1', memberId: 'm-1', lroId: 'lro-1',
      });
      expect(result).toEqual(existing);
    });

    it('inserts new survey when none exists', async () => {
      const newSurvey = { id: 'srv-new', status: 'pending' };
      mocks.mockInsert.mockReturnValueOnce(chain([newSurvey]));
      const { createSatisfactionSurvey } = await import('../satisfaction-service');
      const result = await createSatisfactionSurvey({
        organizationId: 'org-1', claimId: 'c-2', memberId: 'm-2', lroId: 'lro-1',
      });
      expect(result).toEqual(newSurvey);
    });
  });

  // ── getSatisfactionSurvey ─────────────────────────────────────
  describe('getSatisfactionSurvey', () => {
    it('returns survey by id', async () => {
      const survey = { id: 'srv-1', status: 'completed' };
      mocks.mockFindFirst.mockResolvedValue(survey);
      const { getSatisfactionSurvey } = await import('../satisfaction-service');
      expect(await getSatisfactionSurvey('srv-1')).toEqual(survey);
    });

    it('returns null when not found', async () => {
      const { getSatisfactionSurvey } = await import('../satisfaction-service');
      expect(await getSatisfactionSurvey('missing')).toBeNull();
    });
  });

  // ── getPendingSurveys ─────────────────────────────────────────
  describe('getPendingSurveys', () => {
    it('returns pending surveys for a member', async () => {
      const pending = [{ id: 's-1', status: 'pending' }, { id: 's-2', status: 'pending' }];
      mocks.mockSelect.mockReturnValueOnce(chain(pending));
      const { getPendingSurveys } = await import('../satisfaction-service');
      expect(await getPendingSurveys('m-1')).toEqual(pending);
    });
  });

  // ── getSurveyForClaim ─────────────────────────────────────────
  describe('getSurveyForClaim', () => {
    it('returns survey for claim + member', async () => {
      const survey = { id: 's-1', claimId: 'c-1', memberId: 'm-1' };
      mocks.mockFindFirst.mockResolvedValue(survey);
      const { getSurveyForClaim } = await import('../satisfaction-service');
      expect(await getSurveyForClaim('c-1', 'm-1')).toEqual(survey);
    });

    it('returns null when no survey exists', async () => {
      const { getSurveyForClaim } = await import('../satisfaction-service');
      expect(await getSurveyForClaim('c-1', 'm-1')).toBeNull();
    });
  });

  // ── submitSatisfactionRatings ─────────────────────────────────
  describe('submitSatisfactionRatings', () => {
    const ratings = {
      communicationRating: 4,
      responsivenessRating: 5,
      knowledgeRating: 3,
      advocacyRating: 4,
      professionalismRating: 5,
      outcomeRating: 4,
      feedback: 'Good work',
      wouldRecommend: true,
    };

    it('submits ratings and calculates overall score', async () => {
      const survey = { id: 's-1', memberId: 'm-1', status: 'pending' };
      mocks.mockFindFirst.mockResolvedValue(survey);
      const updated = { ...survey, status: 'completed', overallScore: '4.17' };
      mocks.mockUpdate.mockReturnValueOnce(chain([updated]));

      const { submitSatisfactionRatings } = await import('../satisfaction-service');
      const result = await submitSatisfactionRatings('s-1', 'm-1', ratings);
      expect(result.status).toBe('completed');
    });

    it('throws when survey not found', async () => {
      const { submitSatisfactionRatings } = await import('../satisfaction-service');
      await expect(submitSatisfactionRatings('missing', 'm-1', ratings)).rejects.toThrow('Survey not found');
    });

    it('throws when member does not own survey', async () => {
      mocks.mockFindFirst.mockResolvedValue({ id: 's-1', memberId: 'other', status: 'pending' });
      const { submitSatisfactionRatings } = await import('../satisfaction-service');
      await expect(submitSatisfactionRatings('s-1', 'm-1', ratings)).rejects.toThrow('Not authorized');
    });

    it('throws when survey already completed', async () => {
      mocks.mockFindFirst.mockResolvedValue({ id: 's-1', memberId: 'm-1', status: 'completed' });
      const { submitSatisfactionRatings } = await import('../satisfaction-service');
      await expect(submitSatisfactionRatings('s-1', 'm-1', ratings)).rejects.toThrow('already completed');
    });
  });

  // ── declineSurvey ─────────────────────────────────────────────
  describe('declineSurvey', () => {
    it('declines a pending survey', async () => {
      mocks.mockFindFirst.mockResolvedValue({ id: 's-1', memberId: 'm-1', status: 'pending' });
      const declined = { id: 's-1', status: 'declined' };
      mocks.mockUpdate.mockReturnValueOnce(chain([declined]));

      const { declineSurvey } = await import('../satisfaction-service');
      const result = await declineSurvey('s-1', 'm-1');
      expect(result.status).toBe('declined');
    });

    it('throws when survey not found', async () => {
      const { declineSurvey } = await import('../satisfaction-service');
      await expect(declineSurvey('missing', 'm-1')).rejects.toThrow('Survey not found');
    });

    it('throws when member does not own survey', async () => {
      mocks.mockFindFirst.mockResolvedValue({ id: 's-1', memberId: 'other', status: 'pending' });
      const { declineSurvey } = await import('../satisfaction-service');
      await expect(declineSurvey('s-1', 'wrong')).rejects.toThrow('Not authorized');
    });
  });

  // ── getLroPerformance ─────────────────────────────────────────
  describe('getLroPerformance', () => {
    it('returns aggregated LRO metrics', async () => {
      const metrics = {
        totalSurveys: 10,
        avgCommunication: '4.5', avgResponsiveness: '4.0',
        avgKnowledge: '3.8', avgAdvocacy: '4.2',
        avgProfessionalism: '4.6', avgOutcome: '4.0',
      };
      const recMetrics = { total: 8, recommended: 6 };

      mocks.mockSelect
        .mockReturnValueOnce(chain([metrics]))       // aggregated metrics
        .mockReturnValueOnce(chain([recMetrics]));    // recommend metrics

      const { getLroPerformance } = await import('../satisfaction-service');
      const result = await getLroPerformance('lro-1', 'org-1');
      expect(result.lroId).toBe('lro-1');
      expect(result.totalSurveys).toBe(10);
      expect(result.recommendRate).toBeGreaterThan(0);
      expect(result.overallAverage).toBeGreaterThan(0);
    });
  });

  // ── getOrganizationLroRankings ────────────────────────────────
  describe('getOrganizationLroRankings', () => {
    it('returns rankings sorted by overall average', async () => {
      mocks.mockSelectDistinct.mockReturnValueOnce(chain([{ lroId: 'lro-1' }, { lroId: 'lro-2' }]));
      // Promise.all may interleave mock consumption, so use consistent data
      const metricsA = { totalSurveys: 5, avgCommunication: '3.0', avgResponsiveness: '3.0', avgKnowledge: '3.0', avgAdvocacy: '3.0', avgProfessionalism: '3.0', avgOutcome: '3.0' };
      const metricsB = { totalSurveys: 8, avgCommunication: '5.0', avgResponsiveness: '5.0', avgKnowledge: '5.0', avgAdvocacy: '5.0', avgProfessionalism: '5.0', avgOutcome: '5.0' };
      const recA = { total: 5, recommended: 2 };
      const recB = { total: 8, recommended: 7 };
      // 4 sequential select calls (order may vary due to Promise.all)
      mocks.mockSelect
        .mockReturnValueOnce(chain([metricsA]))
        .mockReturnValueOnce(chain([recA]))
        .mockReturnValueOnce(chain([metricsB]))
        .mockReturnValueOnce(chain([recB]));

      const { getOrganizationLroRankings } = await import('../satisfaction-service');
      const result = await getOrganizationLroRankings('org-1');
      expect(result).toHaveLength(2);
      // Verify sorted by overallAverage descending
      expect(result[0].overallAverage).toBeGreaterThanOrEqual(result[1].overallAverage);
    });

    it('returns empty array when no LROs', async () => {
      const { getOrganizationLroRankings } = await import('../satisfaction-service');
      const result = await getOrganizationLroRankings('org-empty');
      expect(result).toEqual([]);
    });
  });
});
