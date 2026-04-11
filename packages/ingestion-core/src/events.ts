// ---------------------------------------------------------------------------
// @nzila/ingestion-core  —  Platform event bridge
// ---------------------------------------------------------------------------
//
// Converts pipeline results into PlatformEvent objects.
// No bus dependency — returns event objects for the caller to emit.
// ---------------------------------------------------------------------------

import type { createPlatformEvent as CreateFn } from '@nzila/platform-events'
import type {
  IngestionStartedPayload,
  IngestionCompletedPayload,
  PipelineContext,
  PipelineDefinition,
  PipelineResult,
} from './types'

/**
 * Build a "pipeline started" platform event.
 * Call this before running the pipeline.
 */
export function pipelineStartedEvent<TInput, TEntity>(
  definition: PipelineDefinition<TInput, TEntity>,
  ctx: PipelineContext<TInput, TEntity>,
  createEvent: typeof CreateFn,
): ReturnType<typeof CreateFn> {
  return createEvent<IngestionStartedPayload>(
    'ingestion.pipeline.started',
    {
      correlationId: ctx.correlationId,
      pipelineName: definition.name,
      pipelineVersion: definition.version,
      source: ctx.source,
    },
    {
      orgId: ctx.orgId,
      actorId: ctx.actorId,
      correlationId: ctx.correlationId,
      source: ctx.source,
    },
  )
}

/**
 * Build a "pipeline completed" platform event.
 * Call this after runPipeline / executePipeline returns.
 */
export function pipelineCompletedEvent(
  result: PipelineResult,
  source: string,
  createEvent: typeof CreateFn,
): ReturnType<typeof CreateFn> {
  const failedStage =
    result.stages.find((s) => s.outcome === 'failed')?.stage ?? null

  return createEvent<IngestionCompletedPayload>(
    'ingestion.pipeline.completed',
    {
      correlationId: result.correlationId,
      pipelineName: result.pipelineName,
      pipelineVersion: result.pipelineVersion,
      source,
      outcome: result.outcome,
      stageCount: result.stages.length,
      durationMs: result.durationMs,
      failedStage,
    },
    {
      orgId: '', // caller should override if needed
      actorId: '',
      correlationId: result.correlationId,
      source,
    },
  )
}

/**
 * Build both started + completed events from a full pipeline run context.
 * Convenience wrapper for the common case.
 */
export function pipelineEventsFromResult<TInput, TEntity>(
  definition: PipelineDefinition<TInput, TEntity>,
  ctx: PipelineContext<TInput, TEntity>,
  result: PipelineResult<TEntity>,
  createEvent: typeof CreateFn,
): { started: ReturnType<typeof CreateFn>; completed: ReturnType<typeof CreateFn> } {
  const started = createEvent<IngestionStartedPayload>(
    'ingestion.pipeline.started',
    {
      correlationId: ctx.correlationId,
      pipelineName: definition.name,
      pipelineVersion: definition.version,
      source: ctx.source,
    },
    {
      orgId: ctx.orgId,
      actorId: ctx.actorId,
      correlationId: ctx.correlationId,
      source: ctx.source,
    },
  )

  const failedStage =
    result.stages.find((s) => s.outcome === 'failed')?.stage ?? null

  const completed = createEvent<IngestionCompletedPayload>(
    'ingestion.pipeline.completed',
    {
      correlationId: ctx.correlationId,
      pipelineName: result.pipelineName,
      pipelineVersion: result.pipelineVersion,
      source: ctx.source,
      outcome: result.outcome,
      stageCount: result.stages.length,
      durationMs: result.durationMs,
      failedStage,
    },
    {
      orgId: ctx.orgId,
      actorId: ctx.actorId,
      correlationId: ctx.correlationId,
      causationId: started.id, // completed caused by started
      source: ctx.source,
    },
  )

  return { started, completed }
}
