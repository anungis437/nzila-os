import { describe, expect, it, vi } from 'vitest';

const { buildConfidenceEnvelope } = vi.hoisted(() => ({
  buildConfidenceEnvelope: vi.fn((value: unknown, inputs: unknown) => ({ value, inputs })),
}));

vi.mock('@nzila/oci-confidence', () => ({ buildConfidenceEnvelope }));

import { enveloperGini, enveloperHHI } from '../statisticalConfidenceModel';

describe('lib/oci/statistics/statisticalConfidenceModel', () => {
  it('envelopes HHI using population as sample size', () => {
    const result = { population: 12 } as never;
    enveloperHHI(result, { dataCompleteness: 0.5 });
    expect(buildConfidenceEnvelope).toHaveBeenCalledWith(result, {
      sampleSize: 12,
      dataCompleteness: 0.5,
    });
  });

  it('envelopes Gini with default completeness', () => {
    const result = { population: 7 } as never;
    enveloperGini(result);
    expect(buildConfidenceEnvelope).toHaveBeenCalledWith(result, {
      sampleSize: 7,
      dataCompleteness: 1,
    });
  });
});
