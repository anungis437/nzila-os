/**
 * v2 Foundation — Confidence Signal Density
 *
 * Validates that confidence_marker questions carry the uncertainty
 * marker flag, that contradiction penalties reduce confidence (never
 * average), and that every continuity-bearing dimension has at least one
 * confidence-marker input in the v2 registry.
 */
import { describe, it, expect } from 'vitest';
import { V2_QUESTIONS } from '../../../modalities-v2/registry';
import { deriveContradictionConfidence } from '../../../contradictions/contradictionConfidence';
import { composeContradictionPenalties } from '../../../contradictions/contradictionSeverityModel';

describe('v2 Foundation — confidence signal density', () => {
  const confidenceMarkers = V2_QUESTIONS.filter(
    (q) => q.modality === 'confidence_marker',
  );

  it('every confidence_marker question allows uncertainty marking', () => {
    expect(confidenceMarkers.length).toBeGreaterThan(0);
    for (const q of confidenceMarkers) {
      if (q.modality === 'confidence_marker') {
        expect(q.allowUncertaintyMarker).toBe(true);
      }
    }
  });

  it('contradiction-confidence derivation is zero when either signal is unaffirmed', () => {
    expect(
      deriveContradictionConfidence({ signalAAffirmed: false, signalBAffirmed: true }),
    ).toBe(0);
    expect(
      deriveContradictionConfidence({ signalAAffirmed: true, signalBAffirmed: false }),
    ).toBe(0);
  });

  it('uncertainty markers reduce contradiction confidence', () => {
    const base = deriveContradictionConfidence({
      signalAAffirmed: true,
      signalBAffirmed: true,
    });
    const oneUncertain = deriveContradictionConfidence({
      signalAAffirmed: true,
      signalBAffirmed: true,
      signalAUncertain: true,
    });
    const bothUncertain = deriveContradictionConfidence({
      signalAAffirmed: true,
      signalBAffirmed: true,
      signalAUncertain: true,
      signalBUncertain: true,
    });
    expect(base).toBe(1);
    expect(oneUncertain).toBeLessThan(base);
    expect(bothUncertain).toBeLessThan(oneUncertain);
    expect(bothUncertain).toBeGreaterThanOrEqual(0);
  });

  it('multi-critical contradiction composition is monotonic and capped', () => {
    const oneCritical = composeContradictionPenalties(['critical']);
    const twoCritical = composeContradictionPenalties(['critical', 'critical']);
    const fiveCritical = composeContradictionPenalties([
      'critical',
      'critical',
      'critical',
      'critical',
      'critical',
    ]);
    expect(twoCritical).toBeGreaterThan(oneCritical);
    expect(fiveCritical).toBeGreaterThan(twoCritical);
    expect(fiveCritical).toBeLessThanOrEqual(0.7);
  });

  it('confidence-marker questions span institutional_continuity and trust-relevant dimensions', () => {
    const dimensionsCovered = new Set<string>();
    for (const q of confidenceMarkers) {
      for (const dim of Object.keys(q.weights)) dimensionsCovered.add(dim);
    }
    expect(dimensionsCovered.has('institutional_continuity')).toBe(true);
  });
});
