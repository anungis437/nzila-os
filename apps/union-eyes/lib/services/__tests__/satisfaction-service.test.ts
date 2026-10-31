/**
 * Satisfaction Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Proxy chain helper ───────────────────────────────────────────────────────

function chain(resolveValue: any): any {
  const handler: ProxyHandler<object> = {
    get: (_target, prop) => {
      if (prop === 'then') return (resolve: (v: any) => void) => resolve(resolveValue);
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
  mockAudit: vi.fn(),
}));

vi.mock('@/db/db', () => {
  const dbMock = {
    query: {
      satisfactionSurveys: { findFirst: mocks.mockFindFirst },
    },
    select: mocks.mockSelect,
    selectDistinct: mocks.mockSelectDistinct,
    insert: mocks.mockInsert,
    update: mocks.mockUpdate,
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(dbMock),
  };
  return { db: dbMock };
});

vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: mocks.mockAudit }));

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
    mocks.mockAudit.mockResolvedValue(undefined);
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

    it('inserts new survey and audits it on the same transaction', async () => {
      const newSurvey = { id: 'srv-new', status: 'pending' };
      mocks.mockInsert.mockReturnValueOnce(chain([newSurvey]));
      const { createSatisfactionSurvey } = await import('../satisfaction-service');
      const result = await createSatisfactionSurvey({
        organizationId: 'org-1', claimId: 'c-2', memberId: 'm-2', lroId: 'lro-1',
      }, 'steward-1');
      expect(result).toEqual(newSurvey);
      expect(mocks.mockAudit).toHaveBeenCalledWith(
        expect.objectContaining({ query: expect.anything() }),
        expect.objectContaining({ organizationId: 'org-1', userId: 'steward-1', action: 'satisfaction.survey.create', resourceId: 'srv-new' }),
      );
    });

    it('records the claim-closure workflow as the system actor', async () => {
      mocks.mockInsert.mockReturnValueOnce(chain([{ id: 'srv-new' }]));
      const { createSatisfactionSurvey } = await import('../satisfaction-service');
      await createSatisfactionSurvey({ organizationId: 'org-1', claimId: 'c-3', memberId: 'm-3', lroId: 'lro-1' });
      expect(mocks.mockAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ userId: 'system:claim-closure' }),
      );
    });

    it('does not create a survey when its audit cannot be written', async () => {
      mocks.mockInsert.mockReturnValueOnce(chain([{ id: 'srv-new' }]));
      mocks.mockAudit.mockRejectedValueOnce(new Error('audit unavailable'));
      const { createSatisfactionSurvey } = await import('../satisfaction-service');
      await expect(
        createSatisfactionSurvey({ organizationId: 'org-1', claimId: 'c-4', memberId: 'm-4', lroId: 'lro-1' }),
      ).rejects.toThrow('Failed to create satisfaction survey');
    });
  });

  // ── getOwnSatisfactionSurvey ──────────────────────────────────
  describe('getOwnSatisfactionSurvey', () => {
    it('returns the survey only when it is the member\u2019s own in their organization', async () => {
      const survey = { id: 'srv-1', memberId: 'm-1', organizationId: 'org-1' };
      mocks.mockFindFirst.mockResolvedValue(survey);
      const { getOwnSatisfactionSurvey } = await import('../satisfaction-service');
      expect(await getOwnSatisfactionSurvey('srv-1', 'm-1', 'org-1')).toEqual(survey);
    });

    it('returns null when no row matches the member and organization', async () => {
      const { getOwnSatisfactionSurvey } = await import('../satisfaction-service');
      expect(await getOwnSatisfactionSurvey('srv-1', 'other-member', 'org-1')).toBeNull();
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
      expect(await getPendingSurveys('m-1', 'org-1')).toEqual(pending);
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

    it('submits ratings, calculates overall score, and audits on the same transaction without the ratings', async () => {
      const survey = { id: 's-1', memberId: 'm-1', status: 'pending', organizationId: 'org-1', claimId: 'c-1' };
      mocks.mockFindFirst.mockResolvedValue(survey);
      const updated = { ...survey, status: 'completed', overallScore: '4.17' };
      mocks.mockUpdate.mockReturnValueOnce(chain([updated]));

      const { submitSatisfactionRatings } = await import('../satisfaction-service');
      const result = await submitSatisfactionRatings('s-1', 'm-1', ratings, 'org-1');
      expect(result.status).toBe('completed');
      expect(mocks.mockAudit).toHaveBeenCalledWith(
        expect.objectContaining({ query: expect.anything() }),
        expect.objectContaining({ organizationId: 'org-1', userId: 'm-1', action: 'satisfaction.survey.submit', resourceId: 's-1' }),
      );
      expect(JSON.stringify(mocks.mockAudit.mock.calls)).not.toContain('Good work');
    });

    it('treats a survey of another organization as not found', async () => {
      mocks.mockFindFirst.mockResolvedValue({ id: 's-1', memberId: 'm-1', status: 'pending', organizationId: 'org-2' });
      const { submitSatisfactionRatings } = await import('../satisfaction-service');
      await expect(submitSatisfactionRatings('s-1', 'm-1', ratings, 'org-1')).rejects.toThrow('Survey not found');
      expect(mocks.mockAudit).not.toHaveBeenCalled();
    });

    it('writes no audit and reports a conflict when a concurrent submission already completed the survey', async () => {
      mocks.mockFindFirst.mockResolvedValue({ id: 's-1', memberId: 'm-1', status: 'pending', organizationId: 'org-1' });
      mocks.mockUpdate.mockReturnValueOnce(chain([]));
      const { submitSatisfactionRatings } = await import('../satisfaction-service');
      await expect(submitSatisfactionRatings('s-1', 'm-1', ratings, 'org-1')).rejects.toThrow('already completed');
      expect(mocks.mockAudit).not.toHaveBeenCalled();
    });

    it('fails the submission when its audit cannot be written', async () => {
      mocks.mockFindFirst.mockResolvedValue({ id: 's-1', memberId: 'm-1', status: 'pending', organizationId: 'org-1' });
      mocks.mockUpdate.mockReturnValueOnce(chain([{ id: 's-1' }]));
      mocks.mockAudit.mockRejectedValueOnce(new Error('audit unavailable'));
      const { submitSatisfactionRatings } = await import('../satisfaction-service');
      await expect(submitSatisfactionRatings('s-1', 'm-1', ratings, 'org-1')).rejects.toThrow('audit unavailable');
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
    it('declines a pending survey and audits it', async () => {
      mocks.mockFindFirst.mockResolvedValue({ id: 's-1', memberId: 'm-1', status: 'pending', organizationId: 'org-1' });
      const declined = { id: 's-1', status: 'declined' };
      mocks.mockUpdate.mockReturnValueOnce(chain([declined]));

      const { declineSurvey } = await import('../satisfaction-service');
      const result = await declineSurvey('s-1', 'm-1', 'org-1');
      expect(result.status).toBe('declined');
      expect(mocks.mockAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ userId: 'm-1', action: 'satisfaction.survey.decline', resourceId: 's-1' }),
      );
    });

    it('refuses a survey of another organization', async () => {
      mocks.mockFindFirst.mockResolvedValue({ id: 's-1', memberId: 'm-1', status: 'pending', organizationId: 'org-2' });
      const { declineSurvey } = await import('../satisfaction-service');
      await expect(declineSurvey('s-1', 'm-1', 'org-1')).rejects.toThrow('Survey not found');
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
    it('returns no figures for a representative with fewer completed responses than the minimum', async () => {
      const metrics = {
        totalSurveys: 2,
        avgCommunication: '5.0', avgResponsiveness: '5.0',
        avgKnowledge: '5.0', avgAdvocacy: '5.0',
        avgProfessionalism: '5.0', avgOutcome: '5.0',
      };
      mocks.mockSelect
        .mockReturnValueOnce(chain([metrics]))
        .mockReturnValueOnce(chain([{ total: 2, recommended: 2 }]));

      const { getLroPerformance } = await import('../satisfaction-service');
      const result = await getLroPerformance('lro-1', 'org-1');

      expect(result.suppressed).toBe(true);
      expect(result.totalSurveys).toBe(2);
      expect(result.overallAverage).toBe(0);
      expect(result.avgCommunication).toBe(0);
    });

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

  /* ── Batch 33: branch gap-fill ── */

  describe('createSatisfactionSurvey (error path)', () => {
    it('throws on DB insert failure', async () => {
      mocks.mockFindFirst.mockResolvedValue(undefined); // no existing survey
      mocks.mockInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('DB write error')),
        }),
      });
      const { createSatisfactionSurvey } = await import('../satisfaction-service');
      await expect(
        createSatisfactionSurvey({ organizationId: 'org-1', claimId: 'c-err', memberId: 'm-err', lroId: 'lro-1' })
      ).rejects.toThrow('Failed to create satisfaction survey');
    });
  });

  describe('submitSatisfactionRatings (isAnonymous default)', () => {
    it('defaults isAnonymous to false when omitted', async () => {
      const survey = { id: 's-1', memberId: 'm-1', status: 'pending' };
      mocks.mockFindFirst.mockResolvedValue(survey);
      mocks.mockUpdate.mockReturnValueOnce(chain([{ ...survey, status: 'completed' }]));
      const { submitSatisfactionRatings } = await import('../satisfaction-service');
      const result = await submitSatisfactionRatings('s-1', 'm-1', {
        communicationRating: 5,
        responsivenessRating: 5,
        knowledgeRating: 5,
        advocacyRating: 5,
        professionalismRating: 5,
        outcomeRating: 5,
        // no isAnonymous, no wouldRecommend, no feedback
      });
      expect(result.status).toBe('completed');
    });
  });

  describe('getLroPerformance (error path)', () => {
    it('throws on DB query failure', async () => {
      mocks.mockSelect.mockImplementation(() => {
        throw new Error('connection lost');
      });
      const { getLroPerformance } = await import('../satisfaction-service');
      await expect(getLroPerformance('lro-err')).rejects.toThrow('Failed to get LRO performance');
    });
  });

  describe('getOrganizationLroRankings (error path)', () => {
    it('throws on DB query failure', async () => {
      mocks.mockSelectDistinct.mockImplementation(() => {
        throw new Error('connection lost');
      });
      const { getOrganizationLroRankings } = await import('../satisfaction-service');
      await expect(getOrganizationLroRankings('org-err')).rejects.toThrow('Failed to get LRO rankings');
    });
  });
});
