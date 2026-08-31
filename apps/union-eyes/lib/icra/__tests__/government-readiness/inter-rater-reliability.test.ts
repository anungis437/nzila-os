/**
 * ARTIFACT TYPE: Vitest Suite — Government-Readiness Non-Regression (Phase C / IRR)
 * MODULE: Inter-Rater Reliability harness
 * DOCTRINE: docs/oci/superseded/government-readiness/OCI_OCRA_INTER_RATER_RELIABILITY_MODEL.md
 *
 * Proves the IRR statistics are correct against textbook values, that the study
 * is honest under-data (INSUFFICIENT, never fabricated), that measurement never
 * imports scoring, and that measured disagreement lowers finding confidence.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  bandAgreement,
  cohenKappa,
  fleissKappa,
  icc21,
  interpretAgreement,
  weightedKappa,
  type Pair,
} from '../../reliability/interRaterReliability';
import {
  runReliabilityStudy,
  THRESHOLDS,
  type ReliabilityStudyInput,
} from '../../reliability/reliabilityStudy';
import { buildFindingConfidence } from '../../confidence/findingConfidence';

const HERE = dirname(fileURLToPath(import.meta.url));
const RELIABILITY_DIR = resolve(HERE, '../../reliability');

/** Build n copies of a pair. */
function repeat(pair: Pair, n: number): Pair[] {
  return Array.from({ length: n }, () => pair);
}

describe('Phase C — inter-rater reliability statistics', () => {
  it("Cohen's κ matches the textbook 2×2 example (κ = 0.40)", () => {
    // A/B over 50 items: 20 [yes,yes], 5 [yes,no], 10 [no,yes], 15 [no,no].
    const pairs: Pair[] = [
      ...repeat([0, 0], 20),
      ...repeat([0, 1], 5),
      ...repeat([1, 0], 10),
      ...repeat([1, 1], 15),
    ];
    expect(cohenKappa(pairs, 2)).toBeCloseTo(0.4, 4);
  });

  it("Cohen's κ = 1 for perfect agreement, null for a single concentrated category", () => {
    expect(cohenKappa([...repeat([0, 0], 10), ...repeat([1, 1], 10)], 2)).toBe(1);
    // Both raters always pick category 0 → expected agreement = 1 → undefined.
    expect(cohenKappa(repeat([0, 0], 10), 2)).toBeNull();
  });

  it('weighted κ rewards near-misses on ordinal scales (≥ unweighted on adjacent disagreement)', () => {
    // Disagreements are all exactly one level apart → weighted κ > nominal κ.
    const pairs: Pair[] = [
      ...repeat([0, 0], 10),
      ...repeat([1, 1], 10),
      ...repeat([2, 2], 10),
      ...repeat([2, 3], 5),
      ...repeat([3, 2], 5),
    ];
    const nominal = cohenKappa(pairs, 6)!;
    const weighted = weightedKappa(pairs, 6, 'linear')!;
    expect(weighted).toBeGreaterThan(nominal);
    expect(weightedKappa([...repeat([0, 0], 5), ...repeat([5, 5], 5)], 6)).toBe(1);
  });

  it("Fleiss' κ = 1 when all raters agree on every item", () => {
    // 3 raters, 4 items, 2 categories; counts rows are all-3-in-one-category.
    const counts = [
      [3, 0],
      [0, 3],
      [3, 0],
      [0, 3],
    ];
    expect(fleissKappa(counts)).toBe(1);
    // Unequal rater counts per row are unsupported → null.
    expect(fleissKappa([[3, 0], [2, 0]])).toBeNull();
  });

  it('ICC(2,1) = 1 for identical rater columns, null below 2 subjects/raters', () => {
    const perfect = [
      [10, 10],
      [40, 40],
      [70, 70],
      [90, 90],
    ];
    expect(icc21(perfect)).toBe(1);
    expect(icc21([[1, 2]])).toBeNull();
    expect(icc21([[1], [2]])).toBeNull();
  });

  it('band agreement counts exact and within-one over rater pairs', () => {
    const matrix = [
      [2, 2, 3], // pairs: (2,2)exact, (2,3)within1, (2,3)within1
      [1, 3, 1], // (1,3) diff2, (1,1)exact, (3,1)diff2
    ];
    const result = bandAgreement(matrix)!;
    expect(result.comparisons).toBe(6);
    expect(result.exact).toBeCloseTo(2 / 6, 4);
    expect(result.withinOne).toBeCloseTo(4 / 6, 4);
  });

  it('Landis & Koch interpretation bands are correct', () => {
    expect(interpretAgreement(-0.1)).toBe('poor');
    expect(interpretAgreement(0.1)).toBe('slight');
    expect(interpretAgreement(0.3)).toBe('fair');
    expect(interpretAgreement(0.5)).toBe('moderate');
    expect(interpretAgreement(0.7)).toBe('substantial');
    expect(interpretAgreement(0.9)).toBe('almost_perfect');
    expect(interpretAgreement(null)).toBe('undefined');
  });
});

describe('Phase C — reliability study orchestration', () => {
  it('reliability modules do not import the scoring engine', () => {
    for (const file of ['interRaterReliability.ts', 'reliabilityStudy.ts']) {
      const src = readFileSync(resolve(RELIABILITY_DIR, file), 'utf8');
      expect(src).not.toMatch(/from ['"]\.\.\/scoring['"]/);
      expect(src).not.toMatch(/scoreAssessment|computeProfile/);
    }
  });

  it('a small panel is reported INSUFFICIENT, never a fabricated coefficient', () => {
    const input: ReliabilityStudyInput = {
      raters: ['r1', 'r2'],
      answerItems: [
        { itemId: 'q1', categories: 3, ratings: { r1: 0, r2: 0 } },
        { itemId: 'q2', categories: 3, ratings: { r1: 1, r2: 2 } },
      ],
    };
    const result = runReliabilityStudy(input);
    // A value may be computed, but with only 2 items the verdict is insufficient.
    expect(result.answerAgreement.verdict).toBe('insufficient');
    expect(result.meetsProcurementFloor).toBe(false);
    expect(result.notes.some((n) => /< 20|insufficient|hold/i.test(n))).toBe(true);
  });

  it('single-rater panel yields no agreement claims', () => {
    const result = runReliabilityStudy({ raters: ['r1'] });
    expect(result.answerAgreement.verdict).toBe('insufficient');
    expect(result.compositeAgreement.verdict).toBe('insufficient');
    expect(result.meetsProcurementFloor).toBe(false);
  });

  it('a strong, sufficiently-large study can meet the procurement floor', () => {
    // 20 institutions, 2 raters in near-perfect composite + band agreement.
    const subjects = Array.from({ length: 20 }, (_, i) => {
      const composite = 30 + i * 3;
      const band = Math.min(4, Math.floor(composite / 20));
      return {
        subjectId: `inst-${i}`,
        composite: { r1: composite, r2: composite + (i % 2) }, // ±1 jitter
        band: { r1: band, r2: band },
      };
    });
    // 20 evidence items in exact agreement.
    const evidenceItems = Array.from({ length: 20 }, (_, i) => ({
      itemId: `e${i}`,
      ratings: { r1: (i % 6), r2: (i % 6) },
    }));
    const result = runReliabilityStudy({ raters: ['r1', 'r2'], subjects, evidenceItems });

    expect(result.compositeAgreement.value).toBeGreaterThanOrEqual(THRESHOLDS.compositeIcc);
    expect(result.compositeAgreement.verdict).toBe('meets');
    expect(result.bandExactAgreement.verdict).toBe('meets');
    expect(result.evidenceAgreement.verdict).toBe('meets');
    expect(result.meetsProcurementFloor).toBe(true);
  });

  it('is version-pinned and deterministic', () => {
    const input: ReliabilityStudyInput = {
      raters: ['r1', 'r2'],
      evidenceItems: [{ itemId: 'e1', ratings: { r1: 2, r2: 3 } }],
    };
    const a = runReliabilityStudy(input);
    const b = runReliabilityStudy(input);
    expect(a).toStrictEqual(b);
    expect(a.studyVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('Phase C — reliability feeds confidence (closing the loop)', () => {
  it('measured disagreement raises reviewer variance, which lowers confidence', () => {
    // Two raters disagree by 4 evidence levels on the same item → high variance.
    const study = runReliabilityStudy({
      raters: ['r1', 'r2'],
      evidenceItems: [{ itemId: 'f.theme', ratings: { r1: 1, r2: 5 } }],
    });
    const variance = study.reviewerVarianceByItem['f.theme'];
    expect(variance).toBeGreaterThanOrEqual(0.4); // crosses the HIGH_VARIANCE threshold

    // Strong evidence, but high measured disagreement → capped at LOW.
    const env = buildFindingConfidence({
      evidenceLevel: 'CROSS_VALIDATED',
      corroborated: true,
      reviewerVariance: variance,
    });
    expect(env.confidence).toBe('LOW');
    expect(env.cautionStates).toContain('HIGH_VARIANCE');
  });

  it('full agreement produces zero variance and does not depress confidence', () => {
    const study = runReliabilityStudy({
      raters: ['r1', 'r2'],
      evidenceItems: [{ itemId: 'f.agree', ratings: { r1: 3, r2: 3 } }],
    });
    expect(study.reviewerVarianceByItem['f.agree']).toBe(0);
    expect(study.recommendedReviewerVariance).toBe(0);
  });
});
