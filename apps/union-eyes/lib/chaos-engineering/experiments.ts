/**
 * Chaos Experiments Configuration
 * 
 * Predefined chaos experiments for testing system resilience
 */

import { ChaosMonkey } from './chaos-monkey';

export interface ChaosExperiment {
  name: string;
  description: string;
  hypothesis: string;
  method: (chaos: ChaosMonkey) => Promise<void>;
  rollback?: () => void;
}

/**
 * Experiment 1: High Latency
 * Test: Can system handle slow database queries?
 */
export const highLatencyExperiment: ChaosExperiment = {
  name: 'High Latency',
  description: 'Inject 1-3 second delays in 50% of requests',
  hypothesis: 'System should remain responsive with proper timeouts and user feedback',
  method: async (chaos) => {
    await chaos.injectLatency({
      probability: 0.5,
      minMs: 1000,
      maxMs: 3000,
    });
  },
};

/**
 * Experiment 2: Intermittent Errors
 * Test: Can system gracefully handle random errors?
 */
export const intermittentErrorsExperiment: ChaosExperiment = {
  name: 'Intermittent Errors',
  description: 'Inject 500 errors in 20% of requests',
  hypothesis: 'Circuit breakers should open and retry logic should engage',
  method: async (chaos) => {
    chaos.injectError({
      probability: 0.2,
      errorCode: 500,
      errorMessage: 'Internal server error (chaos)',
    });
  },
};

/**
 * Experiment 3: Database Failures
 * Test: Can system handle database connection loss?
 */
export const databaseFailureExperiment: ChaosExperiment = {
  name: 'Database Failures',
  description: 'Inject database connection failures in 30% of requests',
  hypothesis: 'System should use cached data and show appropriate error messages',
  method: async (chaos) => {
    chaos.injectDatabaseFailure(0.3);
  },
};

/**
 * Experiment 4: Memory Pressure
 * Test: Can system handle memory exhaustion?
 */
export const memoryPressureExperiment: ChaosExperiment = {
  name: 'Memory Pressure',
  description: 'Exhaust memory temporarily to simulate high load',
  hypothesis: 'System should gracefully degrade without crashing',
  method: async (chaos) => {
    await chaos.injectResourceExhaustion({
      probability: 1.0,
      type: 'memory',
      durationMs: 5000,
    });
  },
};

/**
 * Experiment 5: CPU Saturation
 * Test: Can system handle CPU-intensive operations?
 */
export const cpuSaturationExperiment: ChaosExperiment = {
  name: 'CPU Saturation',
  description: 'Saturate CPU to simulate heavy computation',
  hypothesis: 'System should maintain responsiveness in other threads',
  method: async (chaos) => {
    await chaos.injectResourceExhaustion({
      probability: 1.0,
      type: 'cpu',
      durationMs: 3000,
    });
  },
};

/**
 * All experiments
 */
export const CHAOS_EXPERIMENTS: ChaosExperiment[] = [
  highLatencyExperiment,
  intermittentErrorsExperiment,
  databaseFailureExperiment,
  memoryPressureExperiment,
  cpuSaturationExperiment,
];

/**
 * Run a chaos experiment
 */
export async function runExperiment(
  experiment: ChaosExperiment,
  chaos: ChaosMonkey
): Promise<void> {
try {
    await experiment.method(chaos);
} catch (_error) {
if (experiment.rollback) {
experiment.rollback();
    }
  }
}

/**
 * Run all experiments sequentially
 */
export async function runAllExperiments(chaos: ChaosMonkey): Promise<void> {
for (const experiment of CHAOS_EXPERIMENTS) {
    await runExperiment(experiment, chaos);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

