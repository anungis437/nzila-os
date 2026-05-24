/**
 * Question Architecture Audit™ — Statistical Interpretability test
 *
 * Audit reference: docs/oci/audit/STATISTICAL_INTERPRETABILITY_AUDIT.md
 *
 * Enforces:
 *  - Every `maturity_select` question's options carry monotonically
 *    non-decreasing 0..1 scores (ordinal-safe).
 *  - Every `likert_5` question's options carry exactly 5 distinct ordinal
 *    score points (interval-eligible only with σ + n disclosure).
 *  - No `multiple_choice` question silently encodes ordinal semantics
 *    (categorical-only).
 *
 * The "governance-authority HHI input floor >= 3" invariant is a v1.2.0
 * target (Roadmap R-H5) — tracked as `.todo`.
 */
import { describe, it, expect } from 'vitest';
import { ALL_QUESTIONS } from '../../questions';
import type { QuestionOption } from '../../types';

function options(q: { options?: ReadonlyArray<QuestionOption> }): readonly QuestionOption[] {
  return q.options ?? [];
}

describe('Question Architecture Audit™ — statistical interpretability', () => {
  it('every maturity_select question has monotonically non-decreasing option scores', () => {
    for (const q of ALL_QUESTIONS) {
      if (q.type !== 'maturity_select') continue;
      const scores = options(q).map((o) => o.score);
      expect(scores.length, `${q.id}: empty options`).toBeGreaterThan(0);
      for (let i = 1; i < scores.length; i++) {
        expect(
          scores[i] >= scores[i - 1],
          `${q.id}: option ${i} score ${scores[i]} < ${scores[i - 1]} (non-monotonic)`,
        ).toBe(true);
      }
      for (const s of scores) {
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
      }
    }
  });

  it('every likert_5 question declares a 1..5 interval scale with anchored min/max labels', () => {
    for (const q of ALL_QUESTIONS) {
      if (q.type !== 'likert_5') continue;
      const scale = (q as { scale?: { min: number; max: number; minLabel?: string; maxLabel?: string } }).scale;
      expect(scale, `${q.id}: likert_5 must declare a scale`).toBeDefined();
      if (!scale) continue;
      expect(scale.min, `${q.id}: likert scale.min must be 1`).toBe(1);
      expect(scale.max, `${q.id}: likert scale.max must be 5`).toBe(5);
      expect(
        typeof scale.minLabel === 'string' && scale.minLabel.length > 0,
        `${q.id}: likert scale.minLabel required (interval anchoring)`,
      ).toBe(true);
      expect(
        typeof scale.maxLabel === 'string' && scale.maxLabel.length > 0,
        `${q.id}: likert scale.maxLabel required (interval anchoring)`,
      ).toBe(true);
    }
  });

  it('multiple_choice questions do not silently encode ordinal semantics', () => {
    // Heuristic: a multiple_choice with strictly increasing, 5-point, 0..1
    // ordinal scores is structurally indistinguishable from a likert and
    // would invite arithmetic-mean misuse. Require either:
    //   (a) more than 5 options (clearly categorical), or
    //   (b) at least one repeated score (clearly non-ordinal), or
    //   (c) explicit non-monotonicity.
    for (const q of ALL_QUESTIONS) {
      if (q.type !== 'multiple_choice') continue;
      const scores = options(q).map((o) => o.score);
      if (scores.length === 0) continue;
      const isStrictlyIncreasing = scores.every(
        (s, i) => i === 0 || s > scores[i - 1],
      );
      const fiveOrdinalPoints =
        scores.length === 5 && new Set(scores).size === 5 && isStrictlyIncreasing;
      expect(
        fiveOrdinalPoints,
        `${q.id}: multiple_choice mimics likert (use likert_5 instead)`,
      ).toBe(false);
    }
  });

  // v1.2.0 — Roadmap R-H5:
  it.todo('governance-authority HHI is composed from >= 3 declared inputs');
  it.todo('every composite score in confidence emission carries explicit `sampleSize`');
});
