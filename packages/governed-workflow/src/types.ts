/**
 * @nzila/governed-workflow — Type definitions
 *
 * Orchestrates the canonical path: ingestion → FSM → evidence.
 * Each phase is optional — callers compose only what they need.
 */
import type {
  PipelineDefinition,
  PipelineContext,
  PipelineResult,
  IngestionRecord,
} from '@nzila/ingestion-core'
import type {
  MachineDefinition,
  TransitionContext,
  TransitionRecord,
  TransitionResult,
  GuardResolver,
} from '@nzila/fsm-core'
import type { PlatformEvent } from '@nzila/platform-events'

/* ─── Workflow definition ──────────────────────────────── */

/** Ingestion phase configuration. */
export interface IngestionPhase<TInput = unknown, TEntity = unknown> {
  readonly pipeline: PipelineDefinition<TInput, TEntity>
  readonly continueOnError?: boolean
}

/** FSM phase configuration. */
export interface FsmPhase<
  TState extends string = string,
  TEntity = unknown,
  TRole extends string = string,
> {
  readonly machine: MachineDefinition<TState, TEntity, TRole>
  readonly targetState: TState
  readonly guardResolver?: GuardResolver<TState, TEntity, TRole>
  readonly reason?: string
}

/** Evidence phase configuration. */
export interface EvidencePhase {
  /** Control family for the evidence pack. */
  readonly controlFamily?: string
  /** Retention class override. */
  readonly retentionClass?: string
  /** Additional metadata to attach. */
  readonly metadata?: Record<string, unknown>
}

/**
 * A governed workflow definition — the composed pipeline.
 *
 * At least one phase must be provided (ingestion or fsm).
 * Evidence is always collected.
 */
export interface GovernedWorkflowDef<
  TInput = unknown,
  TEntity = unknown,
  TState extends string = string,
  TRole extends string = string,
> {
  readonly name: string
  readonly version: string
  readonly ingestion?: IngestionPhase<TInput, TEntity>
  readonly fsm?: FsmPhase<TState, TEntity, TRole>
  readonly evidence?: EvidencePhase
}

/* ─── Execution context ───────────────────────────────── */

/**
 * Context for a governed workflow run.
 * Carried through all phases and used for audit/evidence.
 */
export interface GovernedWorkflowContext<
  TInput = unknown,
  TRole extends string = string,
> {
  readonly correlationId: string
  readonly orgId: string
  readonly actorId: string
  readonly role: TRole
  readonly source: string
  readonly rawInput: TInput
  readonly entityId?: string
  readonly meta?: Record<string, unknown>
}

/* ─── Phase results ───────────────────────────────────── */

export interface IngestionPhaseResult<TEntity = unknown> {
  readonly ran: true
  readonly result: PipelineResult<TEntity>
  readonly record: IngestionRecord
}

export interface IngestionPhaseSkipped {
  readonly ran: false
}

export type IngestionOutcome<TEntity = unknown> =
  | IngestionPhaseResult<TEntity>
  | IngestionPhaseSkipped

export interface FsmPhaseResult<TState extends string = string> {
  readonly ran: true
  readonly result: TransitionResult<TState>
  readonly record: TransitionRecord<TState> | null
}

export interface FsmPhaseSkipped {
  readonly ran: false
}

export type FsmOutcome<TState extends string = string> =
  | FsmPhaseResult<TState>
  | FsmPhaseSkipped

/* ─── Workflow result ──────────────────────────────────── */

export type WorkflowOutcome = 'completed' | 'ingestion_failed' | 'transition_failed'

export interface GovernedWorkflowResult<
  TEntity = unknown,
  TState extends string = string,
> {
  readonly workflowRunId: string
  readonly workflowName: string
  readonly workflowVersion: string
  readonly correlationId: string
  readonly orgId: string
  readonly actorId: string
  readonly outcome: WorkflowOutcome
  readonly ingestion: IngestionOutcome<TEntity>
  readonly fsm: FsmOutcome<TState>
  readonly entity: TEntity | null
  readonly currentState: TState | null
  readonly events: readonly PlatformEvent[]
  readonly startedAt: string
  readonly completedAt: string
  readonly durationMs: number
  readonly error?: string
}

/* ─── Workflow record (audit) ──────────────────────────── */

export interface GovernedWorkflowRecord {
  readonly workflowRunId: string
  readonly workflowName: string
  readonly workflowVersion: string
  readonly correlationId: string
  readonly orgId: string
  readonly actorId: string
  readonly outcome: WorkflowOutcome
  readonly ingestionOutcome: string | null
  readonly fsmOutcome: string | null
  readonly startedAt: string
  readonly completedAt: string
  readonly durationMs: number
  readonly error?: string
}

/* ─── Event payloads ──────────────────────────────────── */

export interface WorkflowStartedPayload {
  readonly workflowRunId: string
  readonly workflowName: string
  readonly workflowVersion: string
  readonly correlationId: string
  readonly source: string
}

export interface WorkflowCompletedPayload {
  readonly workflowRunId: string
  readonly workflowName: string
  readonly workflowVersion: string
  readonly correlationId: string
  readonly outcome: WorkflowOutcome
  readonly durationMs: number
  readonly ingestionOutcome: string | null
  readonly fsmOutcome: string | null
}
