/**
 * ARTIFACT TYPE: Runtime Hooks
 * MODULE: OCI Workflow Runtime
 * DOCTRINE_VERSION: 1.0.0
 *
 * Governance-aware workflow hooks.
 *
 * Hooks are pure functions invoked by an operational workflow at well-defined
 * lifecycle points. The runtime never persists, dispatches, or schedules; it
 * returns a refusable observation the operational system can read.
 */

import type {
  ContinuityEventEnvelope,
  RuntimeContinuitySignal,
} from '../contracts/runtimeContracts';
import { RUNTIME_CONTRACT_VERSION } from '../contracts/runtimeContracts';
import type { CriticalActionAnnotation } from '../primitives/platformContinuityPrimitives';
import {
  evaluateWorkflowAdvance,
  type WorkflowSafetyReading,
} from './continuityWorkflowRuntime';
import { composeContinuityEvent } from '../events/continuityEventEnvelope';

export const GOVERNANCE_AWARE_WORKFLOW_HOOKS_VERSION = '1.0.0' as const;

export interface WorkflowLifecycleObservation {
  readonly engineVersion: typeof GOVERNANCE_AWARE_WORKFLOW_HOOKS_VERSION;
  readonly verdict: WorkflowSafetyReading['verdict'];
  readonly emittedEvents: readonly ContinuityEventEnvelope[];
  readonly signals: readonly RuntimeContinuitySignal[];
}

/**
 * Called before a workflow step is advanced.
 */
export function onBeforeAdvance(
  annotation: CriticalActionAnnotation,
): WorkflowLifecycleObservation {
  const reading = evaluateWorkflowAdvance(annotation);
  const events: ContinuityEventEnvelope[] = [];
  if (reading.verdict === 'refused') {
    events.push(
      composeContinuityEvent({
        eventId: `workflow:${annotation.actionId}:refused`,
        kind: 'ContinuityBreakpointIntroduced',
        observedAt: annotation.statedAt,
        institutionScope: annotation.continuityContext.institutionScope,
        statement:
          'A continuity-critical workflow step was refused on the available reading; reviewer-led continuation is required.',
        evidence: { actionId: annotation.actionId, reasons: reading.reasons },
      }),
    );
  }
  const signals: RuntimeContinuitySignal[] = [
    ...reading.signals,
    {
      contractVersion: RUNTIME_CONTRACT_VERSION,
      signalId: `workflow_hooks:before_advance:${annotation.actionId || 'unknown'}`,
      severity: reading.verdict === 'refused' ? 'critical' : 'observation',
      category: 'workflow_hooks_before_advance',
      statement: `Workflow hook before-advance evaluated for action ${annotation.actionId || 'unknown'}.`,
      evidence: { actionId: annotation.actionId, verdict: reading.verdict },
    },
  ];
  signals.sort((a, b) => a.signalId.localeCompare(b.signalId));
  return {
    engineVersion: GOVERNANCE_AWARE_WORKFLOW_HOOKS_VERSION,
    verdict: reading.verdict,
    emittedEvents: events,
    signals,
  };
}

/**
 * Called after a reviewer-led ratification of a workflow step.
 */
export function onAfterRatification(
  annotation: CriticalActionAnnotation,
): WorkflowLifecycleObservation {
  const events: ContinuityEventEnvelope[] = [
    composeContinuityEvent({
      eventId: `workflow:${annotation.actionId}:ratified`,
      kind: 'GovernanceRecoveryRatified',
      observedAt: annotation.statedAt,
      institutionScope: annotation.continuityContext.institutionScope,
      statement:
        'A reviewer-led ratification of a workflow step has been recorded.',
      evidence: { actionId: annotation.actionId, actionKind: annotation.actionKind },
    }),
  ];
  const signals: RuntimeContinuitySignal[] = [
    {
      contractVersion: RUNTIME_CONTRACT_VERSION,
      signalId: `workflow_hooks:after_ratification:${annotation.actionId || 'unknown'}`,
      severity: 'observation',
      category: 'workflow_hooks_after_ratification',
      statement: `Workflow hook after-ratification observed for action ${annotation.actionId || 'unknown'}.`,
      evidence: { actionId: annotation.actionId },
    },
  ];
  return {
    engineVersion: GOVERNANCE_AWARE_WORKFLOW_HOOKS_VERSION,
    verdict: 'safe_to_advance',
    emittedEvents: events,
    signals,
  };
}
