/**
 * Chaos Experiment Engine
 *
 * Orchestrates fault injection experiments with:
 * - Pre-conditions (verify system is healthy before injecting faults)
 * - Fault injection (apply the chaos)
 * - Steady-state verification (check that system recovers)
 * - Evidence collection (record results for compliance)
 */

import { z } from 'zod';

export const ExperimentConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.enum(['availability', 'latency', 'data', 'dependency', 'resource']),
  targetService: z.string(),
  faultType: z.string(),
  faultParams: z.record(z.string(), z.unknown()).prefault({}),
  durationMs: z.number().positive().default(30_000),
  steadyStateTimeout: z.number().positive().default(60_000),
  rollbackOnFailure: z.boolean().default(true),
});

export type ExperimentConfig = z.infer<typeof ExperimentConfigSchema>;

export interface ExperimentResult {
  name: string;
  status: 'passed' | 'failed' | 'error';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  faultInjected: boolean;
  steadyStateRecovered: boolean;
  details: string;
  evidencePackId?: string;
}

type SteadyStateCheck = () => Promise<boolean>;

export class ChaosExperiment {
  private config: ExperimentConfig;
  private preChecks: SteadyStateCheck[] = [];
  private postChecks: SteadyStateCheck[] = [];
  private injectFault: (() => Promise<void>) | null = null;
  private rollbackFault: (() => Promise<void>) | null = null;

  constructor(config: ExperimentConfig) {
    this.config = ExperimentConfigSchema.parse(config);
  }

  /**
   * Add a pre-condition check (must pass before fault injection).
   */
  addPreCheck(check: SteadyStateCheck): this {
    this.preChecks.push(check);
    return this;
  }

  /**
   * Add a post-condition check (must pass after fault injection to verify recovery).
   */
  addPostCheck(check: SteadyStateCheck): this {
    this.postChecks.push(check);
    return this;
  }

  /**
   * Set the fault injection function.
   */
  setFaultInjection(inject: () => Promise<void>, rollback: () => Promise<void>): this {
    this.injectFault = inject;
    this.rollbackFault = rollback;
    return this;
  }

  /**
   * Execute the chaos experiment.
   */
  async run(): Promise<ExperimentResult> {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    try {
      // Step 1: Verify pre-conditions
      for (const check of this.preChecks) {
        const healthy = await check();
        if (!healthy) {
          return this.result('failed', startedAt, 'Pre-condition check failed — system not healthy', false, false);
        }
      }

      // Step 2: Inject fault
      if (!this.injectFault) {
        return this.result('error', startedAt, 'No fault injection configured', false, false);
      }

      await this.injectFault();

      // Step 3: Wait for duration
      await new Promise((resolve) => setTimeout(resolve, this.config.durationMs));

      // Step 4: Rollback fault
      if (this.rollbackFault) {
        await this.rollbackFault();
      }

      // Step 5: Verify steady-state recovery
      const steadyStateDeadline = Date.now() + this.config.steadyStateTimeout;
      let recovered = false;

      while (Date.now() < steadyStateDeadline) {
        const allPassed = await this.checkAll(this.postChecks);
        if (allPassed) {
          recovered = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      return this.result(
        recovered ? 'passed' : 'failed',
        startedAt,
        recovered
          ? `System recovered within ${Date.now() - startTime}ms`
          : `System did not recover within ${this.config.steadyStateTimeout}ms`,
        true,
        recovered,
      );
    } catch (error) {
      if (this.config.rollbackOnFailure && this.rollbackFault) {
        try {
          await this.rollbackFault();
        } catch {
          // Best effort rollback
        }
      }

      return this.result(
        'error',
        startedAt,
        `Experiment error: ${error instanceof Error ? error.message : 'Unknown'}`,
        false,
        false,
      );
    }
  }

  private async checkAll(checks: SteadyStateCheck[]): Promise<boolean> {
    for (const check of checks) {
      if (!(await check())) return false;
    }
    return true;
  }

  private result(
    status: ExperimentResult['status'],
    startedAt: string,
    details: string,
    faultInjected: boolean,
    steadyStateRecovered: boolean,
  ): ExperimentResult {
    return {
      name: this.config.name,
      status,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - new Date(startedAt).getTime(),
      faultInjected,
      steadyStateRecovered,
      details,
    };
  }
}
