// ---------------------------------------------------------------------------
// @nzila/ingestion-core  —  Audited pipeline execution
// ---------------------------------------------------------------------------
//
// Wraps the pure `runPipeline` with IngestionRecord generation.
// The caller persists the record — this module performs no I/O.
// ---------------------------------------------------------------------------

import type {
  IngestionRecord,
  PipelineContext,
  PipelineDefinition,
  PipelineResult,
} from './types';
import { runPipeline } from './runner';

export interface AuditedPipelineResult<TEntity = unknown> {
  readonly result: PipelineResult<TEntity>;
  readonly record: IngestionRecord;
}

/**
 * Execute a pipeline and produce an IngestionRecord alongside the result.
 */
export async function executePipeline<TInput, TEntity>(
  definition: PipelineDefinition<TInput, TEntity>,
  ctx: PipelineContext<TInput, TEntity>,
  opts?: { continueOnError?: boolean },
): Promise<AuditedPipelineResult<TEntity>> {
  const result = await runPipeline(definition, ctx, opts);

  const failedStage =
    result.stages.find((s) => s.outcome === 'failed')?.stage ?? null;

  const record: IngestionRecord = {
    correlationId: result.correlationId,
    pipelineName: result.pipelineName,
    pipelineVersion: result.pipelineVersion,
    orgId: ctx.orgId,
    actorId: ctx.actorId,
    source: ctx.source,
    outcome: result.outcome,
    stageCount: result.stages.length,
    failedStage,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    durationMs: result.durationMs,
  };

  return { result, record };
}
