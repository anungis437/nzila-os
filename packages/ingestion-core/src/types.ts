// ---------------------------------------------------------------------------
// @nzila/ingestion-core  —  Pipeline type definitions
// ---------------------------------------------------------------------------

/**
 * Status of a single stage execution.
 */
export type StageOutcome = 'ok' | 'skipped' | 'failed';

/**
 * Result produced by each stage in the pipeline.
 */
export interface StageResult<T = unknown> {
  readonly stage: string;
  readonly outcome: StageOutcome;
  readonly data?: T;
  readonly error?: string;
  readonly durationMs: number;
}

/**
 * Context threaded through every stage. Provides correlation, org-scoping,
 * and an accumulator for downstream consumers.
 */
export interface PipelineContext<TInput = unknown, TEntity = unknown> {
  /** Unique run identifier (UUID v4). */
  readonly correlationId: string;
  /** Organisation scope — tenant isolation. */
  readonly orgId: string;
  /** Authenticated actor or "system". */
  readonly actorId: string;
  /** Source system identifier (e.g. "agrimo", "deal-engine"). */
  readonly source: string;
  /** Original raw input before any transformation. */
  readonly rawInput: TInput;
  /** Normalised entity built up across stages. */
  entity: TEntity | null;
  /** Arbitrary key-value bag for inter-stage data passing. */
  readonly bag: Map<string, unknown>;
}

// ── Stage definition ────────────────────────────────────────────────────

/**
 * A single pipeline stage. Stages are executed in order.
 * Return the (possibly mutated) context to continue, or throw to abort.
 */
export interface PipelineStage<TInput = unknown, TEntity = unknown> {
  /** Human-readable stage name (used in audit trail). */
  readonly name: string;
  /**
   * Execute this stage. May mutate `ctx.entity` and `ctx.bag`.
   * Throw to signal failure — the pipeline will record the error and stop.
   */
  execute(ctx: PipelineContext<TInput, TEntity>): Promise<void>;
  /**
   * Optional predicate: return `false` to skip this stage.
   * Defaults to always-run when omitted.
   */
  shouldRun?(ctx: PipelineContext<TInput, TEntity>): boolean;
}

// ── Pipeline definition ─────────────────────────────────────────────────

/**
 * Declarative pipeline definition.
 */
export interface PipelineDefinition<TInput = unknown, TEntity = unknown> {
  /** Pipeline name — used in events & audit records. */
  readonly name: string;
  /** Semantic version of this pipeline definition. */
  readonly version: string;
  /** Ordered stages. */
  readonly stages: ReadonlyArray<PipelineStage<TInput, TEntity>>;
}

// ── Pipeline result ─────────────────────────────────────────────────────

export type PipelineOutcome = 'completed' | 'failed' | 'partial';

export interface PipelineResult<TEntity = unknown> {
  readonly correlationId: string;
  readonly pipelineName: string;
  readonly pipelineVersion: string;
  readonly outcome: PipelineOutcome;
  readonly entity: TEntity | null;
  readonly stages: ReadonlyArray<StageResult>;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly error?: string;
}

// ── Ingestion record (audit) ────────────────────────────────────────────

/**
 * Immutable record emitted after every pipeline run.
 * The caller persists this — the pipeline itself performs no I/O.
 */
export interface IngestionRecord {
  readonly correlationId: string;
  readonly pipelineName: string;
  readonly pipelineVersion: string;
  readonly orgId: string;
  readonly actorId: string;
  readonly source: string;
  readonly outcome: PipelineOutcome;
  readonly stageCount: number;
  readonly failedStage: string | null;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
}

// ── Ingestion event payloads ────────────────────────────────────────────

export interface IngestionStartedPayload {
  readonly correlationId: string;
  readonly pipelineName: string;
  readonly pipelineVersion: string;
  readonly source: string;
}

export interface IngestionCompletedPayload {
  readonly correlationId: string;
  readonly pipelineName: string;
  readonly pipelineVersion: string;
  readonly source: string;
  readonly outcome: PipelineOutcome;
  readonly stageCount: number;
  readonly durationMs: number;
  readonly failedStage: string | null;
}
