/**
 * @nzila/governed-workflow — Event bridge
 *
 * Converts workflow results into PlatformEvent objects.
 * No bus dependency — returns event objects for the caller to emit.
 */
import type { createPlatformEvent as CreateFn } from '@nzila/platform-events'

import type {
  GovernedWorkflowResult,
  WorkflowStartedPayload,
  WorkflowCompletedPayload,
} from './types'

/** Build a workflow-started platform event. */
export function workflowStartedEvent(
  workflowRunId: string,
  workflowName: string,
  workflowVersion: string,
  correlationId: string,
  source: string,
  meta: { orgId: string; actorId: string },
  createEvent: typeof CreateFn,
): ReturnType<typeof CreateFn> {
  return createEvent<WorkflowStartedPayload>(
    'governed-workflow.started',
    {
      workflowRunId,
      workflowName,
      workflowVersion,
      correlationId,
      source,
    },
    {
      orgId: meta.orgId,
      actorId: meta.actorId,
      correlationId,
      source: 'governed-workflow',
    },
  )
}

/** Build a workflow-completed platform event. */
export function workflowCompletedEvent<TEntity, TState extends string>(
  result: GovernedWorkflowResult<TEntity, TState>,
  createEvent: typeof CreateFn,
): ReturnType<typeof CreateFn> {
  return createEvent<WorkflowCompletedPayload>(
    'governed-workflow.completed',
    {
      workflowRunId: result.workflowRunId,
      workflowName: result.workflowName,
      workflowVersion: result.workflowVersion,
      correlationId: result.correlationId,
      outcome: result.outcome,
      durationMs: result.durationMs,
      ingestionOutcome: result.ingestion.ran ? result.ingestion.result.outcome : null,
      fsmOutcome: result.fsm.ran
        ? (result.fsm.result.ok ? 'success' : result.fsm.result.code)
        : null,
    },
    {
      orgId: result.orgId,
      actorId: result.actorId,
      correlationId: result.correlationId,
      source: 'governed-workflow',
    },
  )
}
