/**
 * Pre-defined Chaos Experiments for Nzila OS
 *
 * These experiments validate the platform's resilience patterns.
 */

import type { ExperimentConfig } from './experiment.js';

export interface NzilaExperiment {
  config: ExperimentConfig;
  description: string;
  frequency: 'weekly' | 'monthly' | 'quarterly';
  category: string;
}

export const NZILA_EXPERIMENTS: NzilaExperiment[] = [
  // ── Availability ──────────────────────────────────────────────────────
  {
    config: {
      name: 'database-connection-loss',
      description: 'Simulates PostgreSQL connection loss to verify circuit breaker activation',
      category: 'dependency',
      targetService: 'orchestrator-api',
      faultType: 'connection-drop',
      faultParams: {},
      durationMs: 15_000,
      steadyStateTimeout: 60_000,
      rollbackOnFailure: true,
    },
    description: 'Verify that the circuit breaker opens when the database becomes unreachable, and that the service returns graceful error responses.',
    frequency: 'weekly',
    category: 'Infrastructure',
  },
  {
    config: {
      name: 'ai-gateway-latency',
      description: 'Injects 5s latency into AI gateway to verify timeout handling',
      category: 'latency',
      targetService: 'ai-gateway',
      faultType: 'latency',
      faultParams: { delayMs: 5000, jitterMs: 1000 },
      durationMs: 30_000,
      steadyStateTimeout: 45_000,
      rollbackOnFailure: true,
    },
    description: 'Verify that AI requests timeout gracefully and that the UI shows appropriate loading/error states.',
    frequency: 'weekly',
    category: 'AI',
  },
  {
    config: {
      name: 'blob-storage-unavailable',
      description: 'Simulates Azure Blob Storage outage to verify evidence pack fallback',
      category: 'dependency',
      targetService: 'evidence-system',
      faultType: 'error',
      faultParams: { errorRate: 1.0, errorMessage: 'Blob Storage unavailable' },
      durationMs: 20_000,
      steadyStateTimeout: 60_000,
      rollbackOnFailure: true,
    },
    description: 'Verify that evidence packs are queued locally when Blob Storage is unavailable and are synced when storage recovers.',
    frequency: 'monthly',
    category: 'Infrastructure',
  },

  // ── Latency ───────────────────────────────────────────────────────────
  {
    config: {
      name: 'auth-provider-latency',
      description: 'Injects 3s latency into auth provider to verify request timeout handling',
      category: 'latency',
      targetService: 'web',
      faultType: 'latency',
      faultParams: { delayMs: 3000 },
      durationMs: 20_000,
      steadyStateTimeout: 30_000,
      rollbackOnFailure: true,
    },
    description: 'Verify that auth timeout doesn\'t cascade into request timeouts across the platform.',
    frequency: 'monthly',
    category: 'Auth',
  },

  // ── Data ──────────────────────────────────────────────────────────────
  {
    config: {
      name: 'cross-org-isolation',
      description: 'Verifies that org isolation holds under concurrent multi-org load',
      category: 'data',
      targetService: 'all',
      faultType: 'error',
      faultParams: {},
      durationMs: 30_000,
      steadyStateTimeout: 15_000,
      rollbackOnFailure: true,
    },
    description: 'Run concurrent requests with different orgIds and verify no data leaks between orgs.',
    frequency: 'weekly',
    category: 'Security',
  },

  // ── Resource ──────────────────────────────────────────────────────────
  {
    config: {
      name: 'bulkhead-saturation',
      description: 'Saturates the AI bulkhead to verify queue behavior and rejection',
      category: 'resource',
      targetService: 'orchestrator-api',
      faultType: 'cpu-pressure',
      faultParams: {},
      durationMs: 20_000,
      steadyStateTimeout: 30_000,
      rollbackOnFailure: true,
    },
    description: 'Verify that bulkhead correctly rejects excess requests with proper error codes when at capacity.',
    frequency: 'monthly',
    category: 'Resilience',
  },
];
