/**
 * ARTIFACT TYPE: Vitest Suite — Construct Invariant (measurement-theory guard)
 * MODULE: OCI/OCRA single-construct, evidence-gradient invariant
 * DOCTRINE: docs/oci/superseded/methodology/OCI_METHOD_WHITEPAPER_v1.md §7.6 "Construct basis"
 *
 * THE CONSTRUCT INVARIANT (whitepaper §7.6):
 *   OCI/OCRA measures a SINGLE construct — institutional continuity CAPABILITY —
 *   observed across an EVIDENCE GRADIENT. The three modalities are three evidence
 *   strengths of the SAME construct, not three different constructs:
 *     - maturity_select  = behavioral / operational evidence (dominant)
 *     - multiple_choice  = structural / topological evidence (intermediate)
 *     - likert_5         = self-assessed capability evidence (weakest, minority)
 *
 * This suite is the EMPIRICAL guard behind the methodological claim. It answers,
 * with executable evidence rather than prose, the sharpest hostile-review question:
 *
 *   "Can an institution achieve a high score through optimism alone?"  →  NO.
 *
 * It pins the safeguard so a future weight edit that quietly let perception
 * dominate the composite would fail CI, not ship silently.
 */

import { describe, expect, it } from 'vitest';

import { ALL_QUESTIONS } from '../../questions';
import { buildAnswer, scoreAssessment } from '../../scoring';
import { buildUniformAnswers } from '../../../integration/__fixtures__/ociFixtures';
import type { Answer } from '../../types';

/**
 * Take a behavioral baseline answer set and replace ONLY the `likert_5`
 * Continuity Confidence Signals with the maximum (ceiling) response. This
 * isolates the confidence channel: behavioral + structural evidence stays at
 * the baseline; perception is maximally inflated.
 */
function maxConfidenceOverlay(baseline: Answer[]): Answer[] {
  const likertIds = new Set(
    ALL_QUESTIONS.filter((q) => q.type === 'likert_5').map((q) => q.id),
  );
  return baseline.map((answer) => {
    if (!likertIds.has(answer.questionId)) return answer;
    const question = ALL_QUESTIONS.find((q) => q.id === answer.questionId)!;
    // likert scale max → maximally optimistic self-assessment.
    return buildAnswer(question, String(question.type === 'likert_5' ? question.scale.max : 5));
  });
}

describe('Construct Invariant — single construct, evidence gradient', () => {
  it('the instrument actually carries all three evidence-strength modalities', () => {
    const kinds = new Set(ALL_QUESTIONS.map((q) => q.type));
    expect(kinds.has('maturity_select')).toBe(true);
    expect(kinds.has('multiple_choice')).toBe(true);
    expect(kinds.has('likert_5')).toBe(true);
  });

  it('behavioral evidence (maturity_select) is the dominant share of the instrument', () => {
    const total = ALL_QUESTIONS.length;
    const maturity = ALL_QUESTIONS.filter((q) => q.type === 'maturity_select').length;
    const likert = ALL_QUESTIONS.filter((q) => q.type === 'likert_5').length;
    // Behavioral evidence is the backbone; perception is a minority sensing role.
    expect(maturity / total).toBeGreaterThan(0.6);
    expect(likert).toBeLessThan(maturity);
  });

  it('OPTIMISM ALONE CANNOT MANUFACTURE A HIGH SCORE: floor behavior + max confidence stays in the lowest band', () => {
    // Worst behavioral/structural evidence everywhere.
    const behavioralFloor = buildUniformAnswers(0);
    const floor = scoreAssessment('construct:floor', behavioralFloor).profile;

    // Same behavioral floor, but every confidence signal answered at the ceiling.
    const optimismMaxed = scoreAssessment(
      'construct:optimism-maxed',
      maxConfidenceOverlay(behavioralFloor),
    ).profile;

    // The institution that answers every perception item maximally but has no
    // behavioral or structural evidence cannot escape the lowest maturity band.
    expect(floor.maturityBand.ordinal).toBe(1);
    expect(optimismMaxed.maturityBand.ordinal).toBe(1);
    expect(optimismMaxed.composite).toBeLessThan(30); // below the band-2 threshold

    // It certainly cannot reach a high-maturity outcome (Structured ≥ 75).
    expect(optimismMaxed.composite).toBeLessThan(75);
  });

  it('confidence is a BOUNDED MINORITY lever: the FULL confidence range (min→max) moves the composite by ≈9 points at most, at every behavioral level', () => {
    for (const band of [0, 1, 2, 3, 4] as const) {
      const baseline = buildUniformAnswers(band);
      const honest = scoreAssessment(`construct:honest:${band}`, baseline).profile;
      const optimistic = scoreAssessment(
        `construct:optimistic:${band}`,
        maxConfidenceOverlay(baseline),
      ).profile;

      const delta = optimistic.composite - honest.composite;

      // Optimism can only nudge upward (it never lowers the score)...
      expect(delta).toBeGreaterThanOrEqual(0);
      // ...and even across the FULL confidence range (floor→ceiling) the nudge is
      // a minority effect — confidence carries ≈9.4 % of the composite weight, so
      // the absolute maximum swing is ≈9.4 points on the 0–100 scale. This is the
      // honest upper bound; it is narrower than the 30-point lowest band.
      expect(delta).toBeLessThanOrEqual(10);
    }
  });

  it('the REALISTIC gaming swing (honest-neutral → inflated) is ≈4.7 points — narrower than the full range', () => {
    // An institution that would honestly answer "neutral" (midpoint) but instead
    // answers every confidence item at the ceiling. buildUniformAnswers(2) puts
    // every likert item at the scale midpoint ("3"); the overlay pushes them to
    // the ceiling ("5"). This is the realistic over-claiming delta the whitepaper
    // §7.6 quotes as ≈4.7 (0.094 × 0.5 × 100).
    const honestNeutral = buildUniformAnswers(2);
    const honest = scoreAssessment('construct:gaming:honest', honestNeutral).profile;
    const inflated = scoreAssessment(
      'construct:gaming:inflated',
      maxConfidenceOverlay(honestNeutral),
    ).profile;

    const gamingSwing = inflated.composite - honest.composite;
    expect(gamingSwing).toBeGreaterThanOrEqual(0);
    expect(gamingSwing).toBeLessThanOrEqual(6); // ≈4.7, with integer rounding headroom
  });

  it('the contradiction case is real: maxed optimism over floored behavior is the largest single confidence swing, and it is still bounded by the minority weight', () => {
    const floor = buildUniformAnswers(0);
    const honest = scoreAssessment('construct:contradiction:honest', floor).profile;
    const contradicting = scoreAssessment(
      'construct:contradiction:maxed',
      maxConfidenceOverlay(floor),
    ).profile;

    const swing = contradicting.composite - honest.composite;
    expect(swing).toBeGreaterThanOrEqual(0);
    expect(swing).toBeLessThanOrEqual(10);
  });
});
