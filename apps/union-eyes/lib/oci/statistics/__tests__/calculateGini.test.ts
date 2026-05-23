import { describe, expect, it } from 'vitest';
import { calculateGini, GINI_BAND_THRESHOLDS } from '../calculateGini';

describe('calculateGini', () => {
  it('returns 0 / EVEN / INSUFFICIENT on empty input', () => {
    const r = calculateGini([]);
    expect(r.value).toBe(0);
    expect(r.band).toBe('EVEN');
    expect(r.confidence).toBe('INSUFFICIENT');
  });

  it('returns 0 for perfectly equal distribution', () => {
    const r = calculateGini([
      { id: 'a', weight: 1 },
      { id: 'b', weight: 1 },
      { id: 'c', weight: 1 },
      { id: 'd', weight: 1 },
      { id: 'e', weight: 1 },
    ]);
    expect(r.value).toBeCloseTo(0, 4);
    expect(r.band).toBe('EVEN');
  });

  it('approaches 1 as concentration grows (single dominant bearer)', () => {
    const r = calculateGini([
      { id: 'a', weight: 0.001 },
      { id: 'b', weight: 0.001 },
      { id: 'c', weight: 0.001 },
      { id: 'd', weight: 0.001 },
      { id: 'e', weight: 100 },
    ]);
    expect(r.value).toBeGreaterThan(0.7);
    expect(r.band === 'EXTREME' || r.band === 'INEQUITABLE').toBe(true);
  });

  it('value is bounded in [0, 1]', () => {
    for (let n = 2; n <= 12; n++) {
      const inputs = Array.from({ length: n }, (_, i) => ({ id: String(i), weight: Math.pow(2, i) }));
      const r = calculateGini(inputs);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThanOrEqual(1);
    }
  });

  it('thresholds frozen', () => {
    expect(Object.isFrozen(GINI_BAND_THRESHOLDS)).toBe(true);
  });

  it('result is frozen', () => {
    const r = calculateGini([{ id: 'a', weight: 1 }, { id: 'b', weight: 2 }]);
    expect(Object.isFrozen(r)).toBe(true);
  });

  it('single observation returns 0 with INSUFFICIENT confidence', () => {
    const r = calculateGini([{ id: 'a', weight: 1 }]);
    expect(r.value).toBe(0);
    expect(r.confidence).toBe('INSUFFICIENT');
  });
});
