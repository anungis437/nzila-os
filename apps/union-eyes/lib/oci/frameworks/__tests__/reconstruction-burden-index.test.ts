import { describe, expect, it } from 'vitest';
import { computeReconstructionBurden } from '../reconstruction-burden-index';

describe('Reconstruction Burden Index', () => {
  it('returns minimal band when everything is zero', () => {
    const r = computeReconstructionBurden({
      exposedCarriers: 0,
      institutionCriticalCarriers: 0,
      densityIndex: 0,
    });
    // default entropy ordinal 2 -> (2-1)*0.25 = 0.25
    expect(r.score).toBe(0.3); // round1(0.25) = 0.3
    expect(r.band).toBe('minimal');
    expect(r.posture).toMatch(/modest/i);
  });

  it('caps exposedCarriers contribution at 4', () => {
    const r = computeReconstructionBurden({
      exposedCarriers: 100,
      institutionCriticalCarriers: 0,
      densityIndex: 0,
      governanceEntropyOrdinal: 1,
    });
    // exposed cap=4, critical=0, density=0, entropy=(1-1)*0.25=0
    expect(r.score).toBe(4);
    expect(r.band).toBe('moderate');
  });

  it('caps institutionCriticalCarriers contribution at 3', () => {
    const r = computeReconstructionBurden({
      exposedCarriers: 0,
      institutionCriticalCarriers: 100,
      densityIndex: 0,
      governanceEntropyOrdinal: 1,
    });
    expect(r.score).toBe(3);
    expect(r.band).toBe('moderate');
  });

  it('caps total score at 10', () => {
    const r = computeReconstructionBurden({
      exposedCarriers: 1000,
      institutionCriticalCarriers: 1000,
      densityIndex: 1,
      governanceEntropyOrdinal: 5,
    });
    expect(r.score).toBe(10);
    expect(r.band).toBe('severe');
  });

  it('classifies severe for score >= 7', () => {
    const r = computeReconstructionBurden({
      exposedCarriers: 5, // capped at 4
      institutionCriticalCarriers: 3,
      densityIndex: 0,
      governanceEntropyOrdinal: 1,
    });
    expect(r.score).toBe(7);
    expect(r.band).toBe('severe');
    expect(r.posture).toMatch(/sustained institutional effort/i);
  });

  it('classifies substantial for 5 <= score < 7', () => {
    const r = computeReconstructionBurden({
      exposedCarriers: 3,
      institutionCriticalCarriers: 2,
      densityIndex: 0,
      governanceEntropyOrdinal: 1,
    });
    // exposed 2.4 + critical 2 + density 0 + entropy 0 = 4.4 ... bump density
    const r2 = computeReconstructionBurden({
      exposedCarriers: 3,
      institutionCriticalCarriers: 2,
      densityIndex: 0.5,
      governanceEntropyOrdinal: 1,
    });
    expect(r.score).toBeLessThan(5);
    expect(r2.score).toBeGreaterThanOrEqual(5);
    expect(r2.band).toBe('substantial');
    expect(r2.posture).toMatch(/months of internal effort/i);
  });

  it('classifies moderate for 3 <= score < 5', () => {
    computeReconstructionBurden({
      exposedCarriers: 2,
      institutionCriticalCarriers: 1,
      densityIndex: 0,
      governanceEntropyOrdinal: 1,
    });
    // 1.6 + 1 + 0 + 0 = 2.6 -> below 3; add a small density bump
    const r2 = computeReconstructionBurden({
      exposedCarriers: 2,
      institutionCriticalCarriers: 1,
      densityIndex: 0.5,
      governanceEntropyOrdinal: 1,
    });
    expect(r2.score).toBeGreaterThanOrEqual(3);
    expect(r2.score).toBeLessThan(5);
    expect(r2.band).toBe('moderate');
  });

  it('uses default entropy ordinal of 2 when omitted', () => {
    const omitted = computeReconstructionBurden({
      exposedCarriers: 0,
      institutionCriticalCarriers: 0,
      densityIndex: 0,
    });
    const explicit = computeReconstructionBurden({
      exposedCarriers: 0,
      institutionCriticalCarriers: 0,
      densityIndex: 0,
      governanceEntropyOrdinal: 2,
    });
    expect(omitted.score).toBe(explicit.score);
  });

  describe('hardening', () => {
    it('coerces negative carrier counts to 0', () => {
      const r = computeReconstructionBurden({
        exposedCarriers: -10,
        institutionCriticalCarriers: -5,
        densityIndex: 0,
        governanceEntropyOrdinal: 1,
      });
      expect(r.score).toBe(0);
      expect(r.band).toBe('minimal');
    });

    it('clamps densityIndex > 1 to 1', () => {
      const r = computeReconstructionBurden({
        exposedCarriers: 0,
        institutionCriticalCarriers: 0,
        densityIndex: 99,
        governanceEntropyOrdinal: 1,
      });
      // density component 1.0 * 2.0 = 2.0
      expect(r.score).toBe(2);
    });

    it('treats NaN/Infinity inputs as 0 / clamped values', () => {
      const r = computeReconstructionBurden({
        exposedCarriers: Number.NaN,
        institutionCriticalCarriers: Number.POSITIVE_INFINITY,
        densityIndex: Number.NaN,
        governanceEntropyOrdinal: 1,
      });
      // exposed NaN -> 0; critical Infinity -> 0 (defensive); density NaN -> 0; entropy 0
      expect(Number.isFinite(r.score)).toBe(true);
      expect(r.score).toBe(0);
    });

    it('falls back to default ordinal=2 for out-of-range ordinal', () => {
      const r = computeReconstructionBurden({
        exposedCarriers: 0,
        institutionCriticalCarriers: 0,
        densityIndex: 0,
        governanceEntropyOrdinal: 0 as any as 1,
      });
      // default entropy=2 -> (2-1)*0.25 = 0.25 -> round1 = 0.3
      expect(r.score).toBe(0.3);
    });

    it('falls back to default ordinal=2 for non-integer ordinal', () => {
      const r = computeReconstructionBurden({
        exposedCarriers: 0,
        institutionCriticalCarriers: 0,
        densityIndex: 0,
        governanceEntropyOrdinal: 2.5 as any as 2,
      });
      expect(r.score).toBe(0.3);
    });

    it('caps total at exactly 10 (no overshoot)', () => {
      const r = computeReconstructionBurden({
        exposedCarriers: Number.MAX_SAFE_INTEGER,
        institutionCriticalCarriers: Number.MAX_SAFE_INTEGER,
        densityIndex: 1,
        governanceEntropyOrdinal: 5,
      });
      expect(r.score).toBe(10);
      expect(r.band).toBe('severe');
    });
  });
});
