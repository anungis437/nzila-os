import { describe, expect, it } from 'vitest';
import { ExperimentConfigSchema } from '../experiment';
const config = { name: 'recovery', description: 'test', category: 'latency', targetService: 'api', faultType: 'delay' };
describe('Zod 4 chaos experiment ingress', () => {
  it('preserves defaults and keyed fault parameters', () => {
    const result = ExperimentConfigSchema.parse({ ...config, faultParams: { delayMs: 100 } });
    expect(result.faultParams).toEqual({ delayMs: 100 });
    expect(result.durationMs).toBe(30_000);
    expect(result.rollbackOnFailure).toBe(true);
  });
  it('rejects array fault parameters, negative durations and unsupported categories', () => {
    expect(ExperimentConfigSchema.safeParse({ ...config, faultParams: [100] }).success).toBe(false);
    expect(ExperimentConfigSchema.safeParse({ ...config, durationMs: -1 }).success).toBe(false);
    expect(ExperimentConfigSchema.safeParse({ ...config, category: 'unknown' }).success).toBe(false);
  });
});
