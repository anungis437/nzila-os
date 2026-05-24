/**
 * Context-Aware Cognition Runtime
 *
 * A thin, deterministic policy layer on top of `orchestrateCognitionIntelligent`.
 * Given a declared institutional context (e.g. `executive_briefing`,
 * `governance_review`, `incident_triage`), produces a tuned execution plan:
 *
 *   - per-step priority adjustments
 *   - per-step timeout adjustments
 *   - explainability depth hints (consumed by narrative layer)
 *   - cognition budget caps (max steps, max concurrency)
 *   - graceful degradation: optional steps skipped when budget exhausted
 *
 * NO autonomous decision authority. The policy is a pure function from
 * (context, steps) → (plan); all results are emitted via canonical telemetry
 * for review.
 */

import type { CognitionDomain } from '../ontology/index';
import { emitCognitionTelemetry } from '../observability/index';
import {
  orchestrateCognitionIntelligent,
  type IntelligentOrchestrationResult,
  type IntelligentOrchestrationStep,
  type CognitionPriority,
} from './intelligent';

/* -------------------------------------------------------------------------- */
/* Declared institutional contexts                                             */
/* -------------------------------------------------------------------------- */

/**
 * Closed set of recognized execution contexts. CI rejects unknown contexts.
 * Adding a context is an explicit, reviewable change.
 */
export const COGNITION_EXECUTION_CONTEXTS = [
  'executive_briefing',
  'governance_review',
  'continuity_planning',
  'incident_triage',
  'longitudinal_review',
  'standard',
] as const;

export type CognitionExecutionContext = (typeof COGNITION_EXECUTION_CONTEXTS)[number];

/**
 * Suggested explainability depth — consumed by storytelling/narrative layer
 * to decide how many reasoning steps and review signals to surface.
 */
export type ExplainabilityDepth = 'executive' | 'standard' | 'deep';

/* -------------------------------------------------------------------------- */
/* Context policies                                                            */
/* -------------------------------------------------------------------------- */

interface ContextPolicy {
  /** Domains promoted to higher priority for this context. */
  readonly promote: ReadonlyArray<{ domain: CognitionDomain; priority: CognitionPriority }>;
  /** Maximum total steps to execute. Lower-priority steps drop first. */
  readonly maxSteps: number;
  /** Maximum parallel engine invocations. */
  readonly maxConcurrency: number;
  /** Default per-step timeout (ms) when the step does not declare one. */
  readonly defaultTimeoutMs: number;
  /** Suggested narrative depth for downstream surfaces. */
  readonly explainabilityDepth: ExplainabilityDepth;
  /** Domains permitted to skip if their feeders failed. */
  readonly skipIfFeedersFailed: ReadonlyArray<CognitionDomain>;
}

const POLICIES: Readonly<Record<CognitionExecutionContext, ContextPolicy>> = {
  executive_briefing: {
    promote: [
      { domain: 'governance', priority: 'critical' },
      { domain: 'continuity', priority: 'critical' },
      { domain: 'resilience', priority: 'high' },
      { domain: 'systems_coherence', priority: 'high' },
    ],
    maxSteps: 12,
    maxConcurrency: 6,
    defaultTimeoutMs: 8_000,
    explainabilityDepth: 'executive',
    skipIfFeedersFailed: ['adaptation', 'coordination'],
  },
  governance_review: {
    promote: [
      { domain: 'governance', priority: 'critical' },
      { domain: 'precedent', priority: 'high' },
      { domain: 'institutional_memory', priority: 'high' },
    ],
    maxSteps: 16,
    maxConcurrency: 4,
    defaultTimeoutMs: 12_000,
    explainabilityDepth: 'deep',
    skipIfFeedersFailed: [],
  },
  continuity_planning: {
    promote: [
      { domain: 'continuity', priority: 'critical' },
      { domain: 'resilience', priority: 'critical' },
      { domain: 'procedural_intelligence', priority: 'high' },
    ],
    maxSteps: 14,
    maxConcurrency: 5,
    defaultTimeoutMs: 10_000,
    explainabilityDepth: 'standard',
    skipIfFeedersFailed: ['systems_coherence'],
  },
  incident_triage: {
    promote: [
      { domain: 'continuity', priority: 'critical' },
      { domain: 'governance', priority: 'critical' },
      { domain: 'resilience', priority: 'high' },
      { domain: 'coordination', priority: 'high' },
    ],
    maxSteps: 8,
    maxConcurrency: 8,
    defaultTimeoutMs: 4_000,
    explainabilityDepth: 'executive',
    skipIfFeedersFailed: ['precedent', 'institutional_memory', 'adaptation', 'systems_coherence'],
  },
  longitudinal_review: {
    promote: [
      { domain: 'institutional_memory', priority: 'critical' },
      { domain: 'precedent', priority: 'high' },
      { domain: 'adaptation', priority: 'high' },
    ],
    maxSteps: 20,
    maxConcurrency: 3,
    defaultTimeoutMs: 20_000,
    explainabilityDepth: 'deep',
    skipIfFeedersFailed: [],
  },
  standard: {
    promote: [],
    maxSteps: Number.POSITIVE_INFINITY,
    maxConcurrency: 6,
    defaultTimeoutMs: 15_000,
    explainabilityDepth: 'standard',
    skipIfFeedersFailed: [],
  },
};

/* -------------------------------------------------------------------------- */
/* Plan                                                                        */
/* -------------------------------------------------------------------------- */

const PRIORITY_RANK: Record<CognitionPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export interface ContextAwarePlan {
  readonly context: CognitionExecutionContext;
  readonly explainabilityDepth: ExplainabilityDepth;
  readonly maxConcurrency: number;
  readonly defaultTimeoutMs: number;
  readonly executedSteps: ReadonlyArray<IntelligentOrchestrationStep<unknown>>;
  readonly droppedSteps: ReadonlyArray<{ engineId: string; domain: CognitionDomain; reason: string }>;
}

/**
 * Build a context-aware plan from a free set of steps. Pure function — no
 * side effects, no engine invocation.
 */
export function planForContext(input: {
  context: CognitionExecutionContext;
  steps: ReadonlyArray<IntelligentOrchestrationStep<unknown>>;
}): ContextAwarePlan {
  const policy = POLICIES[input.context];
  const promoteByDomain = new Map(policy.promote.map((p) => [p.domain, p.priority] as const));
  const skipDomains = new Set(policy.skipIfFeedersFailed);

  // Apply policy adjustments.
  const adjusted: IntelligentOrchestrationStep<unknown>[] = input.steps.map((step) => ({
    ...step,
    priority: promoteByDomain.get(step.domain) ?? step.priority ?? 'normal',
    skipIfFeedersFailed: skipDomains.has(step.domain) ? true : step.skipIfFeedersFailed,
    timeoutMs: step.timeoutMs ?? policy.defaultTimeoutMs,
  }));

  // Sort by priority for budget pruning (stable within priority via index).
  const indexed = adjusted.map((step, index) => ({ step, index }));
  indexed.sort((a, b) => {
    const pa = PRIORITY_RANK[a.step.priority ?? 'normal'];
    const pb = PRIORITY_RANK[b.step.priority ?? 'normal'];
    if (pa !== pb) return pa - pb;
    return a.index - b.index;
  });

  const executed: IntelligentOrchestrationStep<unknown>[] = [];
  const dropped: Array<{ engineId: string; domain: CognitionDomain; reason: string }> = [];
  for (const { step } of indexed) {
    if (executed.length < policy.maxSteps) {
      executed.push(step);
    } else {
      dropped.push({
        engineId: step.engineId,
        domain: step.domain,
        reason: `cognition_budget_exhausted (max=${policy.maxSteps})`,
      });
    }
  }

  return {
    context: input.context,
    explainabilityDepth: policy.explainabilityDepth,
    maxConcurrency: policy.maxConcurrency,
    defaultTimeoutMs: policy.defaultTimeoutMs,
    executedSteps: executed,
    droppedSteps: dropped,
  };
}

/* -------------------------------------------------------------------------- */
/* Public entrypoint                                                           */
/* -------------------------------------------------------------------------- */

export interface ContextAwareOrchestrationResult extends IntelligentOrchestrationResult {
  readonly plan: ContextAwarePlan;
}

/**
 * Plan and execute. Drop-in superset of `orchestrateCognitionIntelligent`.
 * Telemetry includes a synthetic `orchestration_started` event with the
 * adopted context for downstream observability.
 */
export async function orchestrateCognitionContextAware(input: {
  organizationId: string;
  context: CognitionExecutionContext;
  steps: ReadonlyArray<IntelligentOrchestrationStep<unknown>>;
}): Promise<ContextAwareOrchestrationResult> {
  const plan = planForContext({ context: input.context, steps: input.steps });

  emitCognitionTelemetry({
    kind: 'orchestration_started',
    organizationId: input.organizationId,
    stepCount: plan.executedSteps.length,
    startedAt: new Date().toISOString(),
  });

  const result = await orchestrateCognitionIntelligent({
    organizationId: input.organizationId,
    steps: [...plan.executedSteps],
    maxConcurrency: plan.maxConcurrency,
    defaultTimeoutMs: plan.defaultTimeoutMs,
  });

  return { ...result, plan };
}
