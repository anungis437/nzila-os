import { describe, expect, it } from 'vitest';

import { deriveContradictionConfidence } from '../contradictionConfidence';

describe('lib/icra/contradictions/contradictionConfidence', () => {
  it('returns 0 when either signal is not affirmed', () => {
    expect(deriveContradictionConfidence({ signalAAffirmed: false, signalBAffirmed: true })).toBe(0);
    expect(deriveContradictionConfidence({ signalAAffirmed: true, signalBAffirmed: false })).toBe(0);
    expect(deriveContradictionConfidence({ signalAAffirmed: false, signalBAffirmed: false })).toBe(0);
  });

  it('returns full confidence when both affirmed and certain', () => {
    expect(deriveContradictionConfidence({ signalAAffirmed: true, signalBAffirmed: true })).toBe(1);
  });

  it('subtracts for a single uncertain signal', () => {
    expect(
      deriveContradictionConfidence({
        signalAAffirmed: true,
        signalBAffirmed: true,
        signalAUncertain: true,
      }),
    ).toBeCloseTo(0.65, 5);
  });

  it('subtracts for both uncertain signals', () => {
    expect(
      deriveContradictionConfidence({
        signalAAffirmed: true,
        signalBAffirmed: true,
        signalAUncertain: true,
        signalBUncertain: true,
      }),
    ).toBeCloseTo(0.3, 5);
  });

  it('never returns below 0', () => {
    const value = deriveContradictionConfidence({
      signalAAffirmed: true,
      signalBAffirmed: true,
      signalAUncertain: true,
      signalBUncertain: true,
    });
    expect(value).toBeGreaterThanOrEqual(0);
  });
});
