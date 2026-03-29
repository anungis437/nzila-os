import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  ChaosMonkey,
  ChaosError,
} from '../chaos-monkey';
import {
  highLatencyExperiment,
  intermittentErrorsExperiment,
  databaseFailureExperiment,
  memoryPressureExperiment,
  cpuSaturationExperiment,
  CHAOS_EXPERIMENTS,
  runExperiment,
  runAllExperiments,
  type ChaosExperiment,
} from '../experiments';

describe('Experiment constants', () => {
  it('highLatencyExperiment has correct shape', () => {
    expect(highLatencyExperiment.name).toBe('High Latency');
    expect(highLatencyExperiment.description).toContain('1-3 second');
    expect(highLatencyExperiment.hypothesis).toBeTruthy();
    expect(typeof highLatencyExperiment.method).toBe('function');
  });

  it('intermittentErrorsExperiment has correct shape', () => {
    expect(intermittentErrorsExperiment.name).toBe('Intermittent Errors');
    expect(intermittentErrorsExperiment.description).toContain('500 errors');
    expect(typeof intermittentErrorsExperiment.method).toBe('function');
  });

  it('databaseFailureExperiment has correct shape', () => {
    expect(databaseFailureExperiment.name).toBe('Database Failures');
    expect(typeof databaseFailureExperiment.method).toBe('function');
  });

  it('memoryPressureExperiment has correct shape', () => {
    expect(memoryPressureExperiment.name).toBe('Memory Pressure');
    expect(typeof memoryPressureExperiment.method).toBe('function');
  });

  it('cpuSaturationExperiment has correct shape', () => {
    expect(cpuSaturationExperiment.name).toBe('CPU Saturation');
    expect(typeof cpuSaturationExperiment.method).toBe('function');
  });

  it('CHAOS_EXPERIMENTS contains all 5 experiments', () => {
    expect(CHAOS_EXPERIMENTS).toHaveLength(5);
    const names = CHAOS_EXPERIMENTS.map((e) => e.name);
    expect(names).toContain('High Latency');
    expect(names).toContain('Intermittent Errors');
    expect(names).toContain('Database Failures');
    expect(names).toContain('Memory Pressure');
    expect(names).toContain('CPU Saturation');
  });

  it('all experiments have required fields', () => {
    for (const exp of CHAOS_EXPERIMENTS) {
      expect(exp.name).toBeTruthy();
      expect(exp.description).toBeTruthy();
      expect(exp.hypothesis).toBeTruthy();
      expect(typeof exp.method).toBe('function');
    }
  });
});

describe('runExperiment', () => {
  let chaos: ChaosMonkey;

  beforeEach(() => {
    chaos = new ChaosMonkey({ enabled: false, seed: 1 });
  });

  it('runs method without error when chaos is disabled', async () => {
    await runExperiment(highLatencyExperiment, chaos);
    // No throw because chaos is disabled
  });

  it('catches errors thrown by experiment method', async () => {
    const enabled = new ChaosMonkey({ enabled: true, seed: 1 });
    // intermittentErrors uses injectError which throws ChaosError
    // With seed=1, the seeded random may or may not trigger
    // Either way, runExperiment should not propagate the error
    await expect(
      runExperiment(intermittentErrorsExperiment, enabled)
    ).resolves.toBeUndefined();
  });

  it('calls rollback on error if rollback is defined', async () => {
    const rollbackFn = vi.fn();
    const throwingExperiment: ChaosExperiment = {
      name: 'Test',
      description: 'throws',
      hypothesis: 'test',
      method: async () => {
        throw new ChaosError('forced', 500, 'test');
      },
      rollback: rollbackFn,
    };
    await runExperiment(throwingExperiment, chaos);
    expect(rollbackFn).toHaveBeenCalledOnce();
  });

  it('does not call rollback when method succeeds', async () => {
    const rollbackFn = vi.fn();
    const okExperiment: ChaosExperiment = {
      name: 'OK',
      description: 'ok',
      hypothesis: 'ok',
      method: async () => {},
      rollback: rollbackFn,
    };
    await runExperiment(okExperiment, chaos);
    expect(rollbackFn).not.toHaveBeenCalled();
  });
});

describe('runAllExperiments', () => {
  it('runs all experiments sequentially on disabled chaos', async () => {
    vi.useFakeTimers();
    const chaos = new ChaosMonkey({ enabled: false, seed: 1 });
    const promise = runAllExperiments(chaos);
    // Each experiment has a 2s delay between them
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(2100);
    }
    await promise;
    vi.useRealTimers();
  });
});
