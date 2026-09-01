/**
 * ARTIFACT TYPE: Vitest Suite — Government-Readiness Non-Regression (T5)
 * MODULE: Confidence never exceeds the evidence floor
 * SPEC: docs/oci/superseded/government-readiness/implementation/NON_REGRESSION_TEST_SPECIFICATION.md §T5
 *
 * The evidence band is the governing cap. No amount of corroboration, sample
 * size, or low variance can lift a finding's confidence above what its evidence
 * supports. VERBAL is never HIGH/MODERATE; NONE is INSUFFICIENT. No probability
 * is ever emitted.
 */

import { describe, expect, it } from 'vitest';

import { CONFIDENCE_STATES } from '@nzila/oci-confidence';
import { buildFindingConfidence, evidenceBandFor } from '../../confidence/findingConfidence';
import type { EvidenceLevel } from '../../evidence-strength/evidenceTaxonomy';

const ALL_EVIDENCE: readonly EvidenceLevel[] = [
  'NONE',
  'VERBAL',
  'DOCUMENTED',
  'OPERATIONAL',
  'VERIFIED',
  'CROSS_VALIDATED',
];

/**
 * Ordinal rank for a confidence band: higher = stronger.
 * CONFIDENCE_STATES is ordered strongest-first (HIGH..INSUFFICIENT), so we
 * invert the index to make HIGH the largest rank.
 */
function rank(band: string): number {
  const idx = CONFIDENCE_STATES.indexOf(band as (typeof CONFIDENCE_STATES)[number]);
  return CONFIDENCE_STATES.length - 1 - idx;
}

describe('T5 — confidence never exceeds the evidence floor', () => {
  it('final band ≤ evidence band for every combination', () => {
    for (const level of ALL_EVIDENCE) {
      const cap = evidenceBandFor(level);
      for (const corroborated of [false, true]) {
        for (const reviewerVariance of [0, 0.2, 0.5, 0.9]) {
          for (const assessmentAgeDays of [0, 90, 400]) {
            const env = buildFindingConfidence({
              evidenceLevel: level,
              corroborated,
              reviewerVariance,
              assessmentAgeDays,
            });
            expect(rank(env.confidence)).toBeLessThanOrEqual(rank(cap));
          }
        }
      }
    }
  });

  it('VERBAL evidence is never HIGH or MODERATE', () => {
    const env = buildFindingConfidence({
      evidenceLevel: 'VERBAL',
      corroborated: true,
      reviewerVariance: 0,
      assessmentAgeDays: 0,
    });
    expect(['HIGH', 'MODERATE']).not.toContain(env.confidence);
  });

  it('NONE evidence is INSUFFICIENT regardless of other signals', () => {
    const env = buildFindingConfidence({
      evidenceLevel: 'NONE',
      corroborated: true,
      reviewerVariance: 0,
      assessmentAgeDays: 0,
    });
    expect(env.confidence).toBe('INSUFFICIENT');
  });

  it('strong corroboration + zero variance + VERBAL still caps at LOW', () => {
    const env = buildFindingConfidence({
      evidenceLevel: 'VERBAL',
      corroborated: true,
      reviewerVariance: 0,
      assessmentAgeDays: 0,
    });
    expect(env.confidence).toBe('LOW');
  });

  it('no probability or percentage is ever emitted in rationale', () => {
    for (const level of ALL_EVIDENCE) {
      const env = buildFindingConfidence({ evidenceLevel: level });
      expect(env.confidenceRationale.length).toBeGreaterThan(0);
      for (const line of env.confidenceRationale) {
        expect(line).not.toMatch(/\d+\s*%/);
        expect(line).not.toMatch(/probability|p\s*=|likelihood\s*\d/i);
      }
    }
  });

  it('high variance pushes a strong-evidence finding down to LOW', () => {
    const env = buildFindingConfidence({
      evidenceLevel: 'CROSS_VALIDATED',
      corroborated: true,
      reviewerVariance: 0.9,
    });
    expect(rank(env.confidence)).toBeLessThanOrEqual(rank('LOW'));
  });
});
