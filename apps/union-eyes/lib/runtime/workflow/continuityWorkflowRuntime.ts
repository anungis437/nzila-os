/**
 * ARTIFACT TYPE: Runtime Engine
 * MODULE: OCI Workflow Runtime
 * DOCTRINE_VERSION: 1.0.0
 *
 * The Continuity Workflow Runtime evaluates whether an operational workflow
 * step is safe to advance under the current continuity context. The runtime
 * never proceeds an action; it returns a refusable reading and lets the
 * operational system decide.
 *
 * Posture:
 *   - Refusal-first: missing reviewer reference → not safe.
 *   - Continuity-critical actions require both governance lineage and a
 *     governance memory reference; otherwise the runtime refuses.
 *   - Deterministic; no side effects.
 */

import type {
  ContinuityRuntimeContext,
  RuntimeContinuitySignal,
} from '../contracts/runtimeContracts';
import { RUNTIME_CONTRACT_VERSION } from '../contracts/runtimeContracts';
import {
  isContinuityCritical,
  isContinuitySensitive,
} from '../primitives/continuityRuntimeContext';
import type { CriticalActionAnnotation } from '../primitives/platformContinuityPrimitives';
import {
  readAnnotationCompleteness,
  readTraceability,
} from '../primitives/platformContinuityPrimitives';

export const CONTINUITY_WORKFLOW_RUNTIME_VERSION = '1.0.0' as const;

export type WorkflowSafetyVerdict =
  | 'safe_to_advance'
  | 'reviewer_attention_required'
  | 'refused';

export interface WorkflowSafetyReading {
  readonly engineVersion: typeof CONTINUITY_WORKFLOW_RUNTIME_VERSION;
  readonly verdict: WorkflowSafetyVerdict;
  readonly reasons: readonly string[];
  readonly signals: readonly RuntimeContinuitySignal[];
  readonly statement: string;
}

export function evaluateWorkflowAdvance(
  annotation: CriticalActionAnnotation,
): WorkflowSafetyReading {
  const reasons: string[] = [];
  const traceability = readTraceability(annotation);
  if (!traceability.traceable) reasons.push(...traceability.reasons);
  const completeness = readAnnotationCompleteness(annotation);
  if (!completeness.complete) reasons.push(...completeness.missing);

  const ctx: ContinuityRuntimeContext = annotation.continuityContext;
  if (isContinuityCritical(ctx)) {
    if (annotation.governanceLineage.length === 0) reasons.push('governanceLineage_required_for_continuity_critical');
    if (annotation.memoryReferences.length === 0) reasons.push('memoryReferences_required_for_continuity_critical');
  }

  let verdict: WorkflowSafetyVerdict;
  if (reasons.length === 0) {
    verdict = 'safe_to_advance';
  } else if (isContinuityCritical(ctx)) {
    verdict = 'refused';
  } else if (isContinuitySensitive(ctx)) {
    verdict = 'reviewer_attention_required';
  } else {
    verdict = 'reviewer_attention_required';
  }

  const statement =
    verdict === 'safe_to_advance'
      ? 'Workflow step presents as safe to advance on the available reading.'
      : verdict === 'refused'
        ? 'The runtime refuses to advance this continuity-critical step on the available reading.'
        : 'Reviewer attention is required before advancing this step.';

  const signals: RuntimeContinuitySignal[] = [
    {
      contractVersion: RUNTIME_CONTRACT_VERSION,
      signalId: `workflow_runtime:verdict:${annotation.actionId || 'unknown'}`,
      severity: verdict === 'refused' ? 'critical' : verdict === 'reviewer_attention_required' ? 'warning' : 'observation',
      category: 'workflow_runtime_verdict',
      statement,
      evidence: {
        actionId: annotation.actionId,
        actionKind: annotation.actionKind,
        verdict,
        reasons,
        sensitivity: ctx.sensitivity,
      },
    },
  ];
  signals.sort((a, b) => a.signalId.localeCompare(b.signalId));

  return {
    engineVersion: CONTINUITY_WORKFLOW_RUNTIME_VERSION,
    verdict,
    reasons,
    signals,
    statement,
  };
}
