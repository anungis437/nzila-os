import { describe, expect, it } from 'vitest';
import { computeContinuityBurdenMap } from '../continuity-burden-map';
import type { StewardshipDensityResult } from '../stewardship-density-index';
import { DENSITY_BANDS } from '../stewardship-density-index';

function densityWith(index: number): StewardshipDensityResult {
  return {
    index,
    band: DENSITY_BANDS.find((b) => index >= b.lowerBound) ?? DENSITY_BANDS[DENSITY_BANDS.length - 1],
    totalCarriers: 0,
    loadBearingCount: 0,
    institutionCriticalCount: 0,
    unsuccessedLoadBearingCount: 0,
    unsuccessedInstitutionCriticalCount: 0,
    totalWeight: 0,
    exposedWeight: 0,
  };
}

describe('Continuity Burden Map', () => {
  it('returns composite=0 and distributed posture when all inputs are zero', () => {
    const result = computeContinuityBurdenMap({ density: densityWith(0) });
    expect(result.composite).toBe(0);
    expect(result.posture).toMatch(/reasonably distributed/i);
    // Zero-weight factors are filtered out
    expect(result.contributingFactors).toHaveLength(0);
  });

  it('weights density at 0.6, ICRA at 0.25, reconstruction at 0.15', () => {
    const result = computeContinuityBurdenMap({
      density: densityWith(1),
      icraBurdenIndex: 1,
      reconstructionRisk: 1,
    });
    // 0.6 + 0.25 + 0.15 = 1.0
    expect(result.composite).toBe(1);
    expect(result.contributingFactors).toHaveLength(3);
    expect(result.contributingFactors[0].weight).toBe(0.6);
    expect(result.contributingFactors[1].weight).toBe(0.25);
    expect(result.contributingFactors[2].weight).toBe(0.15);
  });

  it('caps composite at 1.0 even if inputs would overflow', () => {
    const result = computeContinuityBurdenMap({
      density: densityWith(2), // out-of-range but defensive
      icraBurdenIndex: 2,
      reconstructionRisk: 2,
    });
    expect(result.composite).toBe(1);
  });

  it('filters out factors whose weighted contribution is zero', () => {
    const result = computeContinuityBurdenMap({
      density: densityWith(0.5),
      // icraBurdenIndex omitted (-> 0)
      // reconstructionRisk omitted (-> 0)
    });
    expect(result.contributingFactors).toHaveLength(1);
    expect(result.contributingFactors[0].factor).toMatch(/Stewardship Density/);
  });

  it('emits severe-posture statement when composite >= 0.7', () => {
    const result = computeContinuityBurdenMap({ density: densityWith(1), icraBurdenIndex: 1 });
    // 0.6 + 0.25 = 0.85 >= 0.7
    expect(result.posture).toMatch(/significant share/i);
  });

  it('emits moderate-posture statement for composite in [0.5, 0.7)', () => {
    // density=0.83 -> 0.498; +icra 0.1 -> 0.025; total ≈ 0.523
    const result = computeContinuityBurdenMap({
      density: densityWith(0.83),
      icraBurdenIndex: 0.1,
    });
    expect(result.composite).toBeGreaterThanOrEqual(0.5);
    expect(result.composite).toBeLessThan(0.7);
    expect(result.posture).toMatch(/single transition/i);
  });

  it('emits recognisable-posture statement for composite in [0.3, 0.5)', () => {
    const result = computeContinuityBurdenMap({ density: densityWith(0.6) }); // 0.36
    expect(result.composite).toBe(0.36);
    expect(result.posture).toMatch(/recognisable/i);
  });

  describe('hardening', () => {
    it('clamps out-of-range numeric inputs to [0,1]', () => {
      const result = computeContinuityBurdenMap({
        density: densityWith(2),       // > 1 -> clamped to 1
        icraBurdenIndex: 5,            // > 1 -> clamped to 1
        reconstructionRisk: -3,        // < 0 -> clamped to 0
      });
      // 0.6*1 + 0.25*1 + 0.15*0 = 0.85
      expect(result.composite).toBe(0.85);
    });

    it('coerces NaN/Infinity inputs to 0', () => {
      const result = computeContinuityBurdenMap({
        density: densityWith(Number.NaN),
        icraBurdenIndex: Number.POSITIVE_INFINITY,
        reconstructionRisk: Number.NEGATIVE_INFINITY,
      });
      expect(result.composite).toBe(0);
      expect(Number.isFinite(result.composite)).toBe(true);
    });

    it('contributingFactors array is frozen', () => {
      const result = computeContinuityBurdenMap({
        density: densityWith(0.5),
        icraBurdenIndex: 0.5,
      });
      expect(Object.isFrozen(result.contributingFactors)).toBe(true);
      for (const f of result.contributingFactors) {
        expect(Object.isFrozen(f)).toBe(true);
      }
    });

    it('tolerates a missing density block defensively (returns zero composite)', () => {
      // Type-cheating: simulates a caller that passes a partial object.
      const result = computeContinuityBurdenMap({} as Parameters<typeof computeContinuityBurdenMap>[0]);
      expect(result.composite).toBe(0);
      expect(result.posture).toMatch(/reasonably distributed/i);
    });
  });
});
