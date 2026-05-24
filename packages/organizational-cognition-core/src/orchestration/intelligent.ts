/**
 * Cognition Runtime Intelligence
 *
 * Extends the base orchestrator with deterministic, explainable runtime
 * reasoning over cognition execution:
 *   - dependency-aware scheduling (via ontology relationship rules)
 *   - explicit priority weights
 *   - per-step timeouts with graceful degradation
 *   - context-aware execution (e.g. skip-if-feeders-failed)
 *   - rich telemetry via the observability emitter
 *
 * NO autonomous cognition authority. All decisions flow from declared
 * inputs and the canonical ontology. Pure function from inputs to result.
 */

import type { CognitionDomain } from '../ontology/index';
import type { InstitutionalExplainabilityEnvelope } from '../explainability/index';
import { assertLaborSafe, type CognitionGovernanceContext } from '../governance/index';
import { feedersOf } from '../ontology-governance/index';
import { emitCognitionTelemetry } from '../observability/index';
import type { CognitionEngineFn, OrchestrationResult, OrchestrationStep } from './index';

export type CognitionPriority = 'critical' | 'high' | 'normal' | 'low';

export interface IntelligentOrchestrationStep<TPayload = unknown>
  extends OrchestrationStep<TPayload> {
  /** Priority used for scheduling (higher first). */
  priority?: CognitionPriority;
  /** Hard timeout in milliseconds; defaults to 15_000. */
  timeoutMs?: number;
  /** If true, skip when any of this domain's declared feeders failed. */
  skipIfFeedersFailed?: boolean;
}

export interface IntelligentOrchestrationOptions {
  organizationId: string;
  steps: Array<IntelligentOrchestrationStep<unknown>>;
  /** Maximum parallel engine invocations. Default: unlimited. */
  maxConcurrency?: number;
  /** Global default timeout if a step does not declare one. */
  defaultTimeoutMs?: number;
}

export interface IntelligentOrchestrationResult extends OrchestrationResult {
  /** Per-step execution metadata for explainable runtime introspection. */
  trace: Array<{
    engineId: string;
    domain: CognitionDomain;
    status: 'ok' | 'failed' | 'skipped' | 'timeout';
    durationMs: number;
    reason?: string;
  }>;
}

/* -------------------------------------------------------------------------- */
/* Scheduling                                                                  */
/* -------------------------------------------------------------------------- */

const PRIORITY_RANK: Record<CognitionPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

/**
 * Order steps by dependency (feeders first), then by priority.
 * Within the same dependency tier, stable by declaration order.
 */
function scheduleSteps(
  steps: Array<IntelligentOrchestrationStep<unknown>>,
): Array<Array<IntelligentOrchestrationStep<unknown>>> {
  // Tier each step by the count of declared feeder domains present in the run.
  const presentDomains = new Set(steps.map((s) => s.domain));
  const tiers = new Map<number, Array<IntelligentOrchestrationStep<unknown>>>();
  for (const step of steps) {
    const feeders = feedersOf(step.domain).filter((d) => presentDomains.has(d));
    const tier = feeders.length;
    const list = tiers.get(tier) ?? [];
    list.push(step);
    tiers.set(tier, list);
  }
  const sortedTierKeys = [...tiers.keys()].sort((a, b) => a - b);
  return sortedTierKeys.map((k) =>
    tiers.get(k)!.sort(
      (a, b) =>
        PRIORITY_RANK[a.priority ?? 'normal'] - PRIORITY_RANK[b.priority ?? 'normal'],
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* Concurrency limiter                                                         */
/* -------------------------------------------------------------------------- */

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (limit <= 0 || limit >= items.length) {
    await Promise.all(items.map(worker));
    return;
  }
  let cursor = 0;
  const runners: Array<Promise<void>> = [];
  for (let i = 0; i < limit; i += 1) {
    runners.push(
      (async () => {
        while (cursor < items.length) {
          const idx = cursor++;
          await worker(items[idx]!);
        }
      })(),
    );
  }
  await Promise.all(runners);
}

/* -------------------------------------------------------------------------- */
/* Timeout wrapper                                                             */
/* -------------------------------------------------------------------------- */

async function invokeWithTimeout<T>(
  fn: CognitionEngineFn<T>,
  organizationId: string,
  timeoutMs: number,
): Promise<{ envelope?: InstitutionalExplainabilityEnvelope<T>; timedOut: boolean }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<{ timedOut: true }>((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
  });
  try {
    const winner = await Promise.race([
      fn(organizationId).then((envelope) => ({ envelope, timedOut: false as const })),
      timeoutPromise,
    ]);
    if ('envelope' in winner) {
      return { envelope: winner.envelope, timedOut: false };
    }
    return { timedOut: true };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/* Public entrypoint                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Intelligent orchestration: dependency-aware, priority-weighted, timeout-
 * bounded, telemetry-emitting. Drop-in superset of `orchestrateCognition`.
 */
export async function orchestrateCognitionIntelligent(
  options: IntelligentOrchestrationOptions,
): Promise<IntelligentOrchestrationResult> {
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  const defaultTimeoutMs = options.defaultTimeoutMs ?? 15_000;

  emitCognitionTelemetry({
    kind: 'orchestration_started',
    organizationId: options.organizationId,
    stepCount: options.steps.length,
    startedAt,
  });

  const envelopes: Array<InstitutionalExplainabilityEnvelope<unknown>> = [];
  const failures: OrchestrationResult['failures'] = [];
  const trace: IntelligentOrchestrationResult['trace'] = [];
  const failedDomains = new Set<CognitionDomain>();

  const tiers = scheduleSteps(options.steps);

  for (const tier of tiers) {
    await runWithConcurrency(tier, options.maxConcurrency ?? tier.length, async (step) => {
      const stepStartedAt = Date.now();
      const ctx: CognitionGovernanceContext = {
        organizationId: options.organizationId,
        domain: step.domain,
        scopeOfObservation: 'organizational',
      };

      // Skip-if-feeders-failed gating
      if (step.skipIfFeedersFailed) {
        const feeders = feedersOf(step.domain);
        if (feeders.some((f) => failedDomains.has(f))) {
          trace.push({
            engineId: step.engineId,
            domain: step.domain,
            status: 'skipped',
            durationMs: 0,
            reason: 'feeder_failed',
          });
          return;
        }
      }

      try {
        assertLaborSafe(ctx);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failures.push({ engineId: step.engineId, domain: step.domain, error: message });
        failedDomains.add(step.domain);
        trace.push({
          engineId: step.engineId,
          domain: step.domain,
          status: 'failed',
          durationMs: Date.now() - stepStartedAt,
          reason: message,
        });
        return;
      }

      emitCognitionTelemetry({
        kind: 'engine_started',
        engineId: step.engineId,
        domain: step.domain,
        organizationId: options.organizationId,
        startedAt: new Date(stepStartedAt).toISOString(),
      });

      try {
        const timeoutMs = step.timeoutMs ?? defaultTimeoutMs;
        const result = await invokeWithTimeout(step.invoke, options.organizationId, timeoutMs);
        const durationMs = Date.now() - stepStartedAt;
        if (result.timedOut || !result.envelope) {
          failures.push({
            engineId: step.engineId,
            domain: step.domain,
            error: `timeout after ${timeoutMs}ms`,
          });
          failedDomains.add(step.domain);
          trace.push({
            engineId: step.engineId,
            domain: step.domain,
            status: 'timeout',
            durationMs,
            reason: `timeout after ${timeoutMs}ms`,
          });
          emitCognitionTelemetry({
            kind: 'engine_failed',
            engineId: step.engineId,
            domain: step.domain,
            organizationId: options.organizationId,
            durationMs,
            error: `timeout after ${timeoutMs}ms`,
          });
          return;
        }
        envelopes.push(result.envelope);
        trace.push({
          engineId: step.engineId,
          domain: step.domain,
          status: 'ok',
          durationMs,
        });
        emitCognitionTelemetry({
          kind: 'engine_completed',
          engineId: step.engineId,
          domain: step.domain,
          organizationId: options.organizationId,
          durationMs,
          confidence: result.envelope.confidence,
          evidenceCount: result.envelope.evidence.length,
          reasoningSteps: result.envelope.reasoning.length,
        });
      } catch (err) {
        const durationMs = Date.now() - stepStartedAt;
        const message = err instanceof Error ? err.message : String(err);
        failures.push({ engineId: step.engineId, domain: step.domain, error: message });
        failedDomains.add(step.domain);
        trace.push({
          engineId: step.engineId,
          domain: step.domain,
          status: 'failed',
          durationMs,
          reason: message,
        });
        emitCognitionTelemetry({
          kind: 'engine_failed',
          engineId: step.engineId,
          domain: step.domain,
          organizationId: options.organizationId,
          durationMs,
          error: message,
        });
      }
    });
  }

  const completedAt = new Date().toISOString();
  emitCognitionTelemetry({
    kind: 'orchestration_completed',
    organizationId: options.organizationId,
    durationMs: Date.now() - startedAtMs,
    successCount: envelopes.length,
    failureCount: failures.length,
  });

  return {
    organizationId: options.organizationId,
    startedAt,
    completedAt,
    envelopes,
    failures,
    trace,
  };
}
