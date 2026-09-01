/**
 * Question Architecture Audit™ — Confidence Generation Coverage test
 *
 * Audit reference: docs/oci/superseded/audit/CONFIDENCE_GENERATION_AUDIT.md
 *
 * Enforces:
 *  - Every dimension has >= 5 questions feeding `score`.
 *  - Every dimension has >= 1 confidence-sensitive (`likert_5`) input.
 *  - Zero cosmetic prompts (every scored question contributes to >= 1
 *    envelope field — verified via dimension weights presence).
 *
 * The `trust_debt` modality-diversity = 3 invariant is a v1.2.0 target
 * (Roadmap R-C3) — tracked as `.todo`.
 */
import { describe, it, expect } from 'vitest';
import { ALL_QUESTIONS } from '../../questions';
import type { DimensionId, Question } from '../../types';

const DIMENSIONS: DimensionId[] = [
  'institutional_continuity',
  'governance_fragility',
  'trust_debt',
  'operational_memory',
  'transition_readiness',
];

function dimensionWeights(q: Question): Partial<Record<DimensionId, number>> {
  // Authoritative field on the Question shape is `weights` (see types.ts).
  return (q as { weights?: Partial<Record<DimensionId, number>> }).weights ?? {};
}

describe('Question Architecture Audit™ — confidence generation coverage', () => {
  it('every scored question contributes to >= 1 dimension (zero cosmetic prompts)', () => {
    for (const q of ALL_QUESTIONS) {
      const dims = dimensionWeights(q);
      const total = Object.values(dims).reduce<number>(
        (a, b) => a + (typeof b === 'number' ? b : 0),
        0,
      );
      expect(total, `${q.id}: declares zero dimension contribution`).toBeGreaterThan(0);
    }
  });

  for (const dim of DIMENSIONS) {
    it(`dimension ${dim} has >= 5 contributing scored questions`, () => {
      const n = ALL_QUESTIONS.filter((q) => {
        const w = dimensionWeights(q)[dim];
        return typeof w === 'number' && w > 0;
      }).length;
      expect(n).toBeGreaterThanOrEqual(5);
    });

    it(`dimension ${dim} has >= 1 confidence-sensitive (likert_5) input`, () => {
      const n = ALL_QUESTIONS.filter((q) => {
        if (q.type !== 'likert_5') return false;
        const w = dimensionWeights(q)[dim];
        return typeof w === 'number' && w > 0;
      }).length;
      expect(n).toBeGreaterThanOrEqual(1);
    });
  }

  it('dimension trust_debt reaches modality-diversity = 3 (maturity + likert + multiple_choice)', () => {
    const modalities = new Set(
      ALL_QUESTIONS.filter((q) => {
        const w = dimensionWeights(q).trust_debt;
        return typeof w === 'number' && w > 0;
      }).map((q) => q.type),
    );
    expect(modalities.has('maturity_select')).toBe(true);
    expect(modalities.has('likert_5')).toBe(true);
    expect(modalities.has('multiple_choice')).toBe(true);
    expect(modalities.size).toBeGreaterThanOrEqual(3);
  });
});
