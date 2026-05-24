import { describe, expect, it } from 'vitest';
import { analyseReviewerVariance } from '../reviewerVarianceModel';

describe('reviewerVarianceModel', () => {
  it('returns INSUFFICIENT for empty inputs', () => {
    const r = analyseReviewerVariance([]);
    expect(r.calibrationConfidence).toBe('INSUFFICIENT');
    expect(r.reviewerAgreement).toBe(0);
  });

  it('marks high agreement when reviewers concur', () => {
    const r = analyseReviewerVariance([
      { reviewerId: '1', entropyOrdinal: 3, classificationConfidence: 0.9, escalated: false },
      { reviewerId: '2', entropyOrdinal: 3, classificationConfidence: 0.85, escalated: false },
      { reviewerId: '3', entropyOrdinal: 3, classificationConfidence: 0.92, escalated: false },
    ]);
    expect(r.entropyVariance).toBe(0);
    expect(r.reviewerAgreement).toBe(1);
    expect(r.calibrationConfidence).toBe('HIGH');
  });

  it('marks LOW calibration when reviewers diverge', () => {
    const r = analyseReviewerVariance([
      { reviewerId: '1', entropyOrdinal: 1, classificationConfidence: 0.8, escalated: false },
      { reviewerId: '2', entropyOrdinal: 4, classificationConfidence: 0.6, escalated: true },
      { reviewerId: '3', entropyOrdinal: 2, classificationConfidence: 0.7, escalated: true },
      { reviewerId: '4', entropyOrdinal: 5, classificationConfidence: 0.5, escalated: true },
    ]);
    expect(r.entropyVariance).toBeGreaterThan(1);
    expect(r.escalationRate).toBeGreaterThan(0.3);
    expect(r.calibrationConfidence === 'LOW' || r.calibrationConfidence === 'INSUFFICIENT').toBe(true);
  });

  it('flags below-threshold panels', () => {
    const r = analyseReviewerVariance([
      { reviewerId: '1', entropyOrdinal: 3, classificationConfidence: 0.9, escalated: false },
    ]);
    expect(r.indicators.some((i) => i.includes('below calibration threshold'))).toBe(true);
    expect(r.calibrationConfidence).toBe('INSUFFICIENT');
  });

  it('result is frozen', () => {
    const r = analyseReviewerVariance([
      { reviewerId: '1', entropyOrdinal: 3, classificationConfidence: 0.9, escalated: false },
    ]);
    expect(Object.isFrozen(r)).toBe(true);
  });
});
