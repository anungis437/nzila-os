/**
 * Cognition Observability & Telemetry
 *
 * Pure, runtime-agnostic telemetry primitives for observing cognition
 * execution. NO external SDKs, NO global state side effects beyond an
 * in-process emitter. Hosting apps wire `subscribeCognitionTelemetry` to
 * their own observability stack (Sentry, App Insights, OpenTelemetry, etc.).
 */

import type { CognitionDomain } from '../ontology/index';

/* -------------------------------------------------------------------------- */
/* Event shapes                                                                */
/* -------------------------------------------------------------------------- */

export type CognitionTelemetryEvent =
  | {
      kind: 'engine_started';
      engineId: string;
      domain: CognitionDomain;
      organizationId: string;
      startedAt: string;
    }
  | {
      kind: 'engine_completed';
      engineId: string;
      domain: CognitionDomain;
      organizationId: string;
      durationMs: number;
      confidence: string;
      evidenceCount: number;
      reasoningSteps: number;
    }
  | {
      kind: 'engine_failed';
      engineId: string;
      domain: CognitionDomain;
      organizationId: string;
      durationMs: number;
      error: string;
    }
  | {
      kind: 'orchestration_started';
      organizationId: string;
      stepCount: number;
      startedAt: string;
    }
  | {
      kind: 'orchestration_completed';
      organizationId: string;
      durationMs: number;
      successCount: number;
      failureCount: number;
    }
  | {
      kind: 'cache_hit';
      engineId: string;
      organizationId: string;
    }
  | {
      kind: 'cache_miss';
      engineId: string;
      organizationId: string;
    }
  | {
      kind: 'ontology_drift_warning';
      detail: string;
    };

export type CognitionTelemetryListener = (event: CognitionTelemetryEvent) => void;

/* -------------------------------------------------------------------------- */
/* Emitter                                                                     */
/* -------------------------------------------------------------------------- */

const listeners = new Set<CognitionTelemetryListener>();

export function subscribeCognitionTelemetry(listener: CognitionTelemetryListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitCognitionTelemetry(event: CognitionTelemetryEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      /* listeners must never break cognition */
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Aggregator                                                                  */
/* -------------------------------------------------------------------------- */

export interface CognitionRuntimeMetrics {
  totalEngineRuns: number;
  totalEngineFailures: number;
  totalOrchestrations: number;
  cacheHits: number;
  cacheMisses: number;
  /** Engine-level rolling averages. */
  byEngine: Record<
    string,
    {
      runs: number;
      failures: number;
      avgDurationMs: number;
      lastDurationMs: number;
    }
  >;
}

/**
 * Create an in-memory metrics aggregator subscribed to telemetry events.
 * Returns the metrics object (mutated live) and an `unsubscribe` callback.
 * Hosting apps may snapshot this into their dashboards.
 */
export function createRuntimeMetricsAggregator(): {
  metrics: CognitionRuntimeMetrics;
  unsubscribe: () => void;
} {
  const metrics: CognitionRuntimeMetrics = {
    totalEngineRuns: 0,
    totalEngineFailures: 0,
    totalOrchestrations: 0,
    cacheHits: 0,
    cacheMisses: 0,
    byEngine: {},
  };

  const ensure = (engineId: string) => {
    if (!metrics.byEngine[engineId]) {
      metrics.byEngine[engineId] = {
        runs: 0,
        failures: 0,
        avgDurationMs: 0,
        lastDurationMs: 0,
      };
    }
    return metrics.byEngine[engineId]!;
  };

  const unsubscribe = subscribeCognitionTelemetry((event) => {
    switch (event.kind) {
      case 'engine_completed': {
        const slot = ensure(event.engineId);
        slot.runs += 1;
        slot.lastDurationMs = event.durationMs;
        slot.avgDurationMs =
          slot.avgDurationMs === 0
            ? event.durationMs
            : Math.round((slot.avgDurationMs * (slot.runs - 1) + event.durationMs) / slot.runs);
        metrics.totalEngineRuns += 1;
        break;
      }
      case 'engine_failed': {
        const slot = ensure(event.engineId);
        slot.failures += 1;
        metrics.totalEngineFailures += 1;
        break;
      }
      case 'orchestration_completed':
        metrics.totalOrchestrations += 1;
        break;
      case 'cache_hit':
        metrics.cacheHits += 1;
        break;
      case 'cache_miss':
        metrics.cacheMisses += 1;
        break;
      default:
        break;
    }
  });

  return { metrics, unsubscribe };
}
