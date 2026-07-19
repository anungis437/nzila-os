import { describe, expect, it } from 'vitest';

import {
  clampScore,
  computeTagOverlapScore,
  computeTokenOverlapSimilarity,
} from '../similarity-provider';

describe('case-intelligence/similarity-provider', () => {
  describe('computeTokenOverlapSimilarity', () => {
    it('returns the overlap ratio over the larger token set', () => {
      // tokens length>2: "safety", "grievance", "overtime" vs "safety", "grievance"
      const score = computeTokenOverlapSimilarity('safety grievance overtime', 'safety grievance');
      expect(score).toBeCloseTo(2 / 3, 5);
    });

    it('ignores short tokens and punctuation', () => {
      // "a", "an" are <=2 chars and dropped, leaving only "safety".
      const score = computeTokenOverlapSimilarity('a an safety!', 'safety');
      expect(score).toBe(1);
    });

    it('returns 0 when either side has no usable tokens', () => {
      expect(computeTokenOverlapSimilarity('', 'safety')).toBe(0);
      expect(computeTokenOverlapSimilarity('safety', null)).toBe(0);
      expect(computeTokenOverlapSimilarity(undefined, undefined)).toBe(0);
    });
  });

  describe('computeTagOverlapScore', () => {
    it('is case-insensitive and divides by the larger set', () => {
      const score = computeTagOverlapScore(['Safety', 'Overtime'], ['safety']);
      expect(score).toBe(1 / 2);
    });

    it('returns 0 when either side is empty', () => {
      expect(computeTagOverlapScore([], ['safety'])).toBe(0);
      expect(computeTagOverlapScore(null, null)).toBe(0);
    });
  });

  describe('clampScore', () => {
    it('clamps to the default 0-100 range', () => {
      expect(clampScore(150)).toBe(100);
      expect(clampScore(-10)).toBe(0);
      expect(clampScore(42)).toBe(42);
    });

    it('respects custom bounds', () => {
      expect(clampScore(5, 1, 3)).toBe(3);
      expect(clampScore(0, 1, 3)).toBe(1);
    });
  });
});
