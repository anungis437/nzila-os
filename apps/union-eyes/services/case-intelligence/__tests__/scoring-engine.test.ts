import { describe, expect, it } from 'vitest';

import { computeBaseScore, mergeScores } from '../scoring-engine';
import type { ExtractedFeatures } from '../types';

function makeFeatures(overrides: Partial<ExtractedFeatures> = {}): ExtractedFeatures {
  return {
    sameCase: false,
    sameMember: false,
    sameAgreement: false,
    sameEmployer: false,
    sameWorksite: false,
    sharedTags: 0,
    sameDocumentType: false,
    recentAccessByLRO: false,
    semanticSimilarity: 0,
    patternSimilarity: 0,
    usedInSimilarCase: false,
    isTemplateCandidate: false,
    ...overrides,
  };
}

describe('case-intelligence/scoring-engine', () => {
  describe('computeBaseScore', () => {
    it('sums weights and produces reasons for matched dimensions', () => {
      const result = computeBaseScore(
        makeFeatures({
          sameCase: true,
          sameMember: true,
          sharedTags: 2,
          recentAccessByLRO: true,
        }),
      );

      // 50 + 30 + 15 + 10
      expect(result.baseScore).toBe(105);
      expect(result.reasons).toContain('Directly linked to this case');
      expect(result.reasons).toContain('Same member');
      expect(result.reasons).toContain('Shared tags/topic');
      expect(result.reasons).toContain('Used by assigned LRO');
      expect(result.scoreBreakdown.sameCase).toBe(50);
      expect(result.scoreBreakdown.sharedTags).toBe(15);
    });

    it('combines employer or worksite into a single reason', () => {
      const employerOnly = computeBaseScore(makeFeatures({ sameEmployer: true }));
      expect(employerOnly.reasons).toContain('Same employer/worksite');

      const worksiteOnly = computeBaseScore(makeFeatures({ sameWorksite: true }));
      expect(worksiteOnly.reasons).toContain('Same employer/worksite');
    });

    it('returns zero score and no reasons when nothing matches', () => {
      const result = computeBaseScore(makeFeatures());
      expect(result.baseScore).toBe(0);
      expect(result.reasons).toEqual([]);
    });

    it('scores agreement, document type, similar-case usage, and template candidacy', () => {
      const result = computeBaseScore(
        makeFeatures({
          sameAgreement: true,
          sameDocumentType: true,
          usedInSimilarCase: true,
          isTemplateCandidate: true,
        }),
      );
      // 25 + 10 + 18 + 12
      expect(result.baseScore).toBe(65);
      expect(result.reasons).toContain('Same agreement');
      expect(result.reasons).toContain('Same document type');
      expect(result.reasons).toContain('Used in similar case');
      expect(result.reasons).toContain('Template or precedent candidate');
    });
  });

  describe('mergeScores', () => {
    it('returns the base score when ML is disabled', () => {
      expect(mergeScores({ baseScore: 80, mlScore: 40, mlEnabled: false })).toBe(80);
    });

    it('blends 70/30 when ML is enabled', () => {
      expect(mergeScores({ baseScore: 80, mlScore: 40, mlEnabled: true })).toBe(68);
    });
  });
});
