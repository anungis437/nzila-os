// ---------------------------------------------------------------------------
// @nzila/ingestion-core  —  Barrel export
// ---------------------------------------------------------------------------

// Types
export type {
  StageOutcome,
  StageResult,
  PipelineContext,
  PipelineStage,
  PipelineDefinition,
  PipelineOutcome,
  PipelineResult,
  IngestionRecord,
  IngestionStartedPayload,
  IngestionCompletedPayload,
} from './types';

// Runner
export {
  runPipeline,
  createPipelineContext,
  validatePipeline,
} from './runner';
export type { PipelineValidationError } from './runner';

// Audited execution
export { executePipeline } from './audited';
export type { AuditedPipelineResult } from './audited';

// Registry
export {
  registerPipeline,
  getPipeline,
  listPipelines,
  unregisterPipeline,
  clearPipelineRegistry,
} from './registry';

// Builders
export { stage, pipeline, StageBuilder, PipelineBuilder } from './builders'

// Event bridge
export {
  pipelineStartedEvent,
  pipelineCompletedEvent,
  pipelineEventsFromResult,
} from './events';
