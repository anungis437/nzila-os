import { describe, expect, it } from 'vitest';
import { calculateHHI, HHI_BAND_THRESHOLDS } from '../calculateHHI';

describe('calculateHHI', () => {
  it('returns DISTRIBUTED + INSUFFICIENT confidence on empty input', () => {
    const r = calculateHHI([]);
    expect(r.value).toBe(0);
    expect(r.scaled).toBe(0);
    expect(r.band).toBe('DISTRIBUTED');
    expect(r.population).toBe(0);
    expect(r.confidence).toBe('INSUFFICIENT');
  });

  it('honours 1/n floor when all weights equal', () => {
    const r = calculateHHI([
      { id: 'a', weight: 1 },
      { id: 'b', weight: 1 },
      { id: 'c', weight: 1 },
      { id: 'd', weight: 1 },
    ]);
    expect(r.value).toBeCloseTo(0.25, 4);
    expect(r.scaled).toBe(2500);
  });

  it('returns 1 when all weight on a single bearer', () => {
    const r = calculateHHI([{ id: 'a', weight: 99 }]);
    expect(r.value).toBe(1);
    expect(r.scaled).toBe(10000);
    expect(r.band).toBe('HIGHLY_CONCENTRATED');
  });

  it('bands map by DOJ-style anchors', () => {
    expect(HHI_BAND_THRESHOLDS.highlyConcentrated).toBe(0.25);
    expect(HHI_BAND_THRESHOLDS.concentrated).toBe(0.15);
    expect(HHI_BAND_THRESHOLDS.moderate).toBe(0.1);
  });

  it('skips non-finite / non-positive weights', () => {
    const r = calculateHHI([
      { id: 'a', weight: 5 },
      { id: 'b', weight: 0 },
      { id: 'c', weight: Number.NaN },
      { id: 'd', weight: -1 },
    ]);
    expect(r.population).toBe(1);
  });

  it('value bounded in [1/n, 1]', () => {
    for (let n = 1; n <= 12; n++) {
      const inputs = Array.from({ length: n }, (_, i) => ({ id: String(i), weight: 1 + i }));
      const r = calculateHHI(inputs);
      expect(r.value).toBeGreaterThanOrEqual(1 / n - 1e-9);
      expect(r.value).toBeLessThanOrEqual(1);
    }
  });

  it('result is frozen', () => {
    const r = calculateHHI([{ id: 'a', weight: 1 }, { id: 'b', weight: 1 }]);
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.cautionStates)).toBe(true);
  });
});
