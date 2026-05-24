import { describe, expect, it } from 'vitest';
import { classifyEntropy, ENTROPY_LEVELS } from '../governance-entropy-scale';

describe('Governance Entropy Scale', () => {
  it('exposes exactly five levels with strictly descending lowerBounds', () => {
    expect(ENTROPY_LEVELS).toHaveLength(5);
    const ordinals = ENTROPY_LEVELS.map((l) => l.ordinal).sort();
    expect(ordinals).toEqual([1, 2, 3, 4, 5]);
    for (let i = 0; i < ENTROPY_LEVELS.length - 1; i++) {
      expect(ENTROPY_LEVELS[i].lowerBound).toBeGreaterThan(ENTROPY_LEVELS[i + 1].lowerBound);
    }
  });

  it('returns systemic_entropy for drift >= 0.8', () => {
    expect(classifyEntropy(0.8).id).toBe('systemic_entropy');
    expect(classifyEntropy(1).id).toBe('systemic_entropy');
  });

  it('returns institutional_drift for 0.6 <= drift < 0.8', () => {
    expect(classifyEntropy(0.6).id).toBe('institutional_drift');
    expect(classifyEntropy(0.79).id).toBe('institutional_drift');
  });

  it('returns patterned_drift for 0.4 <= drift < 0.6', () => {
    expect(classifyEntropy(0.4).id).toBe('patterned_drift');
    expect(classifyEntropy(0.59).id).toBe('patterned_drift');
  });

  it('returns recognised_drift for 0.2 <= drift < 0.4', () => {
    expect(classifyEntropy(0.2).id).toBe('recognised_drift');
    expect(classifyEntropy(0.39).id).toBe('recognised_drift');
  });

  it('returns coherent for drift < 0.2', () => {
    expect(classifyEntropy(0).id).toBe('coherent');
    expect(classifyEntropy(0.19).id).toBe('coherent');
  });

  it('clamps negative drift to 0 (coherent)', () => {
    expect(classifyEntropy(-5).id).toBe('coherent');
  });

  it('clamps drift > 1 to 1 (systemic_entropy)', () => {
    expect(classifyEntropy(99).id).toBe('systemic_entropy');
  });

  describe('hardening', () => {
    it('ENTROPY_LEVELS is deeply frozen', () => {
      expect(Object.isFrozen(ENTROPY_LEVELS)).toBe(true);
      for (const lvl of ENTROPY_LEVELS) {
        expect(Object.isFrozen(lvl)).toBe(true);
      }
    });

    it('treats NaN as 0 (coherent)', () => {
      expect(classifyEntropy(Number.NaN).id).toBe('coherent');
    });

    it('treats Infinity as 0 (coherent) — Infinity is never a valid measurement, do not escalate alerts on bad data', () => {
      expect(classifyEntropy(Number.POSITIVE_INFINITY).id).toBe('coherent');
      expect(classifyEntropy(Number.NEGATIVE_INFINITY).id).toBe('coherent');
    });

    it('treats non-number inputs as 0 (coherent) — defensive', () => {
      expect(classifyEntropy('0.9' as unknown as number).id).toBe('coherent');
      expect(classifyEntropy(undefined as unknown as number).id).toBe('coherent');
    });

    it('ordinals are unique and in 1..5', () => {
      const ords = ENTROPY_LEVELS.map((l) => l.ordinal);
      expect(new Set(ords).size).toBe(5);
      for (const o of ords) {
        expect(o).toBeGreaterThanOrEqual(1);
        expect(o).toBeLessThanOrEqual(5);
      }
    });
  });
});
