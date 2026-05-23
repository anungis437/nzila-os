import { describe, expect, it } from 'vitest';
import { classifyStability, STABILITY_THRESHOLDS } from './stability-engine';

describe('Stability Engine', () => {
  it('returns UNKNOWN when no signals provided', () => {
    const r = classifyStability({});
    expect(r.state).toBe('UNKNOWN');
    expect(r.stabilityScore).toBe(0);
    expect(r.temporalConfidence).toBe('INSUFFICIENT');
  });

  it('returns STABLE when all signals zero (but at least one provided)', () => {
    const r = classifyStability({ modernizationVolatility: 0 });
    expect(r.state).toBe('STABLE');
    expect(r.temporalConfidence).toBe('HIGH');
  });

  it('returns VOLATILE when all signals near 1', () => {
    const r = classifyStability({
      modernizationVolatility: 1,
      governanceVolatility: 1,
      onboardingInstability: 1,
      stewardshipTurnover: 1,
      continuityVariance: 1,
      transitionTurbulence: 1,
    });
    expect(r.state).toBe('VOLATILE');
    expect(r.stabilityScore).toBeGreaterThanOrEqual(STABILITY_THRESHOLDS.volatile);
    expect(r.temporalConfidence).toBe('LOW');
  });

  it('returns TRANSITIONAL for mid-range', () => {
    const r = classifyStability({
      modernizationVolatility: 0.5,
      governanceVolatility: 0.5,
      onboardingInstability: 0.5,
      stewardshipTurnover: 0.5,
      continuityVariance: 0.5,
      transitionTurbulence: 0.5,
    });
    expect(r.state).toBe('TRANSITIONAL');
  });

  it('clamps out-of-range inputs', () => {
    const r = classifyStability({ modernizationVolatility: 5, governanceVolatility: -1 });
    expect(Number.isFinite(r.stabilityScore)).toBe(true);
    expect(r.stabilityScore).toBeGreaterThanOrEqual(0);
    expect(r.stabilityScore).toBeLessThanOrEqual(1);
  });

  it('result is frozen', () => {
    const r = classifyStability({ governanceVolatility: 0.7 });
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.varianceIndicators)).toBe(true);
  });
});
