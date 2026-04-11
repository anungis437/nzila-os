// ---------------------------------------------------------------------------
// @nzila/ingestion-core  —  Pipeline runner (pure, no I/O)
// ---------------------------------------------------------------------------

import type {
  PipelineContext,
  PipelineDefinition,
  PipelineOutcome,
  PipelineResult,
  StageResult,
} from './types';

/**
 * Execute a pipeline definition against a prepared context.
 *
 * Rules:
 * - Stages run sequentially in definition order.
 * - A stage that throws aborts the pipeline with outcome `failed`.
 * - A stage whose `shouldRun` returns `false` is recorded as `skipped`.
 * - If all stages succeed, outcome is `completed`.
 * - If some stages succeed before a failure, outcome is `failed` (not `partial`).
 *   `partial` is reserved for pipelines that explicitly opt-in via `continueOnError`.
 *
 * The runner performs NO side-effects (no DB, no event bus). The caller is
 * responsible for emitting events and persisting audit records.
 */
export async function runPipeline<TInput, TEntity>(
  definition: PipelineDefinition<TInput, TEntity>,
  ctx: PipelineContext<TInput, TEntity>,
  opts?: { continueOnError?: boolean },
): Promise<PipelineResult<TEntity>> {
  const stageResults: StageResult[] = [];
  const start = performance.now();
  const startedAt = new Date().toISOString();
  let outcome: PipelineOutcome = 'completed';
  let pipelineError: string | undefined;

  for (const stage of definition.stages) {
    // Check skip predicate
    if (stage.shouldRun && !stage.shouldRun(ctx)) {
      stageResults.push({
        stage: stage.name,
        outcome: 'skipped',
        durationMs: 0,
      });
      continue;
    }

    const stageStart = performance.now();
    try {
      await stage.execute(ctx);
      stageResults.push({
        stage: stage.name,
        outcome: 'ok',
        durationMs: performance.now() - stageStart,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      stageResults.push({
        stage: stage.name,
        outcome: 'failed',
        error: errorMessage,
        durationMs: performance.now() - stageStart,
      });

      if (opts?.continueOnError) {
        outcome = 'partial';
      } else {
        outcome = 'failed';
        pipelineError = `Stage "${stage.name}" failed: ${errorMessage}`;
        break;
      }
    }
  }

  return {
    correlationId: ctx.correlationId,
    pipelineName: definition.name,
    pipelineVersion: definition.version,
    outcome,
    entity: ctx.entity,
    stages: stageResults,
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: performance.now() - start,
    error: pipelineError,
  };
}

// ── Context factory ─────────────────────────────────────────────────────

/**
 * Create a new PipelineContext with a fresh correlation ID.
 */
export function createPipelineContext<TInput, TEntity>(input: {
  orgId: string;
  actorId: string;
  source: string;
  rawInput: TInput;
}): PipelineContext<TInput, TEntity> {
  return {
    correlationId: crypto.randomUUID(),
    orgId: input.orgId,
    actorId: input.actorId,
    source: input.source,
    rawInput: input.rawInput,
    entity: null,
    bag: new Map(),
  };
}

// ── Validation helpers ──────────────────────────────────────────────────

export interface PipelineValidationError {
  readonly field: string;
  readonly message: string;
}

/**
 * Validate a pipeline definition for structural correctness.
 */
export function validatePipeline(
  definition: PipelineDefinition,
): PipelineValidationError[] {
  const errors: PipelineValidationError[] = [];

  if (!definition.name || definition.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Pipeline name is required' });
  }

  if (!definition.version || definition.version.trim().length === 0) {
    errors.push({ field: 'version', message: 'Pipeline version is required' });
  }

  if (!definition.stages || definition.stages.length === 0) {
    errors.push({
      field: 'stages',
      message: 'Pipeline must have at least one stage',
    });
  }

  const stageNames = new Set<string>();
  for (const stage of definition.stages) {
    if (!stage.name || stage.name.trim().length === 0) {
      errors.push({
        field: 'stages',
        message: 'All stages must have a non-empty name',
      });
    }
    if (stageNames.has(stage.name)) {
      errors.push({
        field: 'stages',
        message: `Duplicate stage name: "${stage.name}"`,
      });
    }
    stageNames.add(stage.name);
  }

  return errors;
}
