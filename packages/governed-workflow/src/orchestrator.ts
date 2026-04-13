/**
 * @nzila/governed-workflow — Orchestrator
 *
 * Chains ingestion → FSM → evidence into a single audited operation.
 * Every phase is optional — compose only what you need.
 *
 * The orchestrator is pure: no DB writes, no event bus.
 * The caller persists records and emits events.
 */
import { randomUUID } from 'node:crypto'

import { executePipeline, createPipelineContext } from '@nzila/ingestion-core'
import { pipelineEventsFromResult } from '@nzila/ingestion-core'
import { executeTransition } from '@nzila/fsm-core'
import { platformEventsFromTransition } from '@nzila/fsm-core'
import type { TransitionSuccess } from '@nzila/fsm-core'
import type { PlatformEvent, createPlatformEvent } from '@nzila/platform-events'

import type {
  GovernedWorkflowDef,
  GovernedWorkflowContext,
  GovernedWorkflowResult,
  GovernedWorkflowRecord,
  IngestionOutcome,
  FsmOutcome,
  WorkflowOutcome,
} from './types'

/** Options for the governed workflow executor. */
export interface ExecuteGovernedWorkflowOpts<TState extends string, TEntity> {
  /** Current FSM state of the entity. Required if fsm phase is defined. */
  currentState?: TState
  /** Pre-resolved entity. Used when ingestion is skipped. */
  entity?: TEntity
  /** Org ID of the resource (for FSM org-scope check). Defaults to ctx.orgId. */
  resourceOrgId?: string
  /** Platform event factory — injected so the orchestrator has no hard dep on the bus. */
  createEvent?: typeof createPlatformEvent
}

/**
 * Execute a governed workflow — the canonical ingestion → FSM → evidence path.
 *
 * 1. **Ingestion** (optional): normalizes raw input into a typed entity
 * 2. **FSM** (optional): advances entity state via the state machine
 * 3. **Evidence**: collects audit records, emitted events, timing
 *
 * Returns a complete result with records for the caller to persist.
 */
export async function executeGovernedWorkflow<
  TInput,
  TEntity,
  TState extends string,
  TRole extends string,
>(
  def: GovernedWorkflowDef<TInput, TEntity, TState, TRole>,
  ctx: GovernedWorkflowContext<TInput, TRole>,
  opts?: ExecuteGovernedWorkflowOpts<TState, TEntity>,
): Promise<GovernedWorkflowResult<TEntity, TState>> {
  const workflowRunId = randomUUID()
  const startedAt = new Date()
  const collectedEvents: PlatformEvent[] = []

  let entity: TEntity | null = opts?.entity ?? null
  let currentState: TState | null = opts?.currentState ?? null
  let outcome: WorkflowOutcome = 'completed'
  let error: string | undefined
  let ingestion: IngestionOutcome<TEntity> = { ran: false }
  let fsm: FsmOutcome<TState> = { ran: false }

  // ── Phase 1: Ingestion ──────────────────────────────────────────────
  if (def.ingestion) {
    const pipelineCtx = createPipelineContext<TInput, TEntity>({
      orgId: ctx.orgId,
      actorId: ctx.actorId,
      source: ctx.source,
      rawInput: ctx.rawInput,
    })

    // Override the auto-generated correlationId with the workflow's
    const ctxWithCorrelation = { ...pipelineCtx, correlationId: ctx.correlationId }

    const { result, record } = await executePipeline(
      def.ingestion.pipeline,
      ctxWithCorrelation,
      { continueOnError: def.ingestion.continueOnError },
    )

    // Collect ingestion events (requires createEvent factory)
    if (opts?.createEvent) {
      const { started, completed } = pipelineEventsFromResult(
        def.ingestion.pipeline,
        ctxWithCorrelation,
        result,
        opts.createEvent,
      )
      collectedEvents.push(started, completed)
    }

    ingestion = { ran: true, result, record }

    if (result.outcome === 'failed') {
      outcome = 'ingestion_failed'
      error = result.error ?? `Ingestion pipeline "${def.ingestion.pipeline.name}" failed`
    } else {
      entity = result.entity
    }
  }

  // ── Phase 2: FSM Transition ─────────────────────────────────────────
  if (def.fsm && outcome === 'completed') {
    if (!currentState) {
      outcome = 'transition_failed'
      error = 'FSM phase requires currentState but none was provided'
    } else if (!entity) {
      outcome = 'transition_failed'
      error = 'FSM phase requires an entity but ingestion produced none'
    } else {
      const transitionCtx = {
        orgId: ctx.orgId,
        actorId: ctx.actorId,
        role: ctx.role,
        meta: ctx.meta ?? {},
      }

      const { result, record } = executeTransition(
        def.fsm.machine,
        currentState,
        def.fsm.targetState,
        transitionCtx,
        opts?.resourceOrgId ?? ctx.orgId,
        entity,
        {
          entityId: ctx.entityId,
          reason: def.fsm.reason,
          guardResolver: def.fsm.guardResolver,
        },
      )

      fsm = { ran: true, result, record }

      if (result.ok) {
        currentState = result.to

        // Collect FSM events (requires createEvent factory)
        if (opts?.createEvent && record) {
          const fsmEvents = platformEventsFromTransition(
            result as TransitionSuccess<TState>,
            record.machineName,
            record.machineVersion,
            record.entityId,
            {
              orgId: ctx.orgId,
              actorId: ctx.actorId,
              correlationId: ctx.correlationId,
            },
            opts.createEvent,
          )
          collectedEvents.push(...fsmEvents)
        }
      } else {
        outcome = 'transition_failed'
        error = result.reason
      }
    }
  }

  // ── Build result ────────────────────────────────────────────────────
  const completedAt = new Date()
  const durationMs = completedAt.getTime() - startedAt.getTime()

  return {
    workflowRunId,
    workflowName: def.name,
    workflowVersion: def.version,
    correlationId: ctx.correlationId,
    orgId: ctx.orgId,
    actorId: ctx.actorId,
    outcome,
    ingestion,
    fsm,
    entity,
    currentState,
    events: collectedEvents,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs,
    error,
  }
}

/**
 * Build the audit record from a workflow result.
 * The caller persists this — the orchestrator performs no I/O.
 */
export function buildWorkflowRecord<TEntity, TState extends string>(
  result: GovernedWorkflowResult<TEntity, TState>,
): GovernedWorkflowRecord {
  return {
    workflowRunId: result.workflowRunId,
    workflowName: result.workflowName,
    workflowVersion: result.workflowVersion,
    correlationId: result.correlationId,
    orgId: result.orgId,
    actorId: result.actorId,
    outcome: result.outcome,
    ingestionOutcome: result.ingestion.ran ? result.ingestion.result.outcome : null,
    fsmOutcome: result.fsm.ran
      ? (result.fsm.result.ok ? 'success' : result.fsm.result.code)
      : null,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    durationMs: result.durationMs,
    error: result.error,
  }
}
