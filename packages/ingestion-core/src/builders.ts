// ---------------------------------------------------------------------------
// @nzila/ingestion-core  —  Fluent pipeline builder
// ---------------------------------------------------------------------------

import type {
  PipelineContext,
  PipelineDefinition,
  PipelineStage,
} from './types';

// ── Stage builder ───────────────────────────────────────────────────────

export class StageBuilder<TInput = unknown, TEntity = unknown> {
  private _name: string;
  private _executeFn: (ctx: PipelineContext<TInput, TEntity>) => Promise<void>;
  private _shouldRunFn?: (ctx: PipelineContext<TInput, TEntity>) => boolean;

  constructor(
    name: string,
    executeFn: (ctx: PipelineContext<TInput, TEntity>) => Promise<void>,
  ) {
    this._name = name;
    this._executeFn = executeFn;
  }

  /**
   * Add a skip predicate. Stage is skipped when predicate returns false.
   */
  when(
    predicate: (ctx: PipelineContext<TInput, TEntity>) => boolean,
  ): this {
    this._shouldRunFn = predicate;
    return this;
  }

  build(): PipelineStage<TInput, TEntity> {
    return {
      name: this._name,
      execute: this._executeFn,
      ...(this._shouldRunFn ? { shouldRun: this._shouldRunFn } : {}),
    };
  }
}

// ── Pipeline builder ────────────────────────────────────────────────────

export class PipelineBuilder<TInput = unknown, TEntity = unknown> {
  private _name: string;
  private _version: string;
  private readonly _stages: PipelineStage<TInput, TEntity>[] = [];

  constructor(name: string, version: string) {
    this._name = name;
    this._version = version;
  }

  /**
   * Add a stage via a StageBuilder.
   */
  addStage(builder: StageBuilder<TInput, TEntity>): this {
    this._stages.push(builder.build());
    return this;
  }

  /**
   * Add a raw stage definition.
   */
  addStageDef(stage: PipelineStage<TInput, TEntity>): this {
    this._stages.push(stage);
    return this;
  }

  build(): PipelineDefinition<TInput, TEntity> {
    return {
      name: this._name,
      version: this._version,
      stages: [...this._stages],
    };
  }
}

// ── Factory functions ───────────────────────────────────────────────────

/**
 * Create a stage builder.
 *
 * @example
 * ```ts
 * stage('validate', async (ctx) => {
 *   if (!ctx.rawInput.id) throw new Error('Missing id');
 * }).when((ctx) => ctx.bag.get('skipValidation') !== true)
 * ```
 */
export function stage<TInput = unknown, TEntity = unknown>(
  name: string,
  executeFn: (ctx: PipelineContext<TInput, TEntity>) => Promise<void>,
): StageBuilder<TInput, TEntity> {
  return new StageBuilder(name, executeFn);
}

/**
 * Create a pipeline builder.
 *
 * @example
 * ```ts
 * const def = pipeline<RawDoc, NormalizedDoc>('doc-ingest', '1.0')
 *   .addStage(stage('normalize', async (ctx) => { ... }))
 *   .addStage(stage('validate', async (ctx) => { ... }))
 *   .addStage(stage('enrich', async (ctx) => { ... }))
 *   .build();
 * ```
 */
export function pipeline<TInput = unknown, TEntity = unknown>(
  name: string,
  version: string,
): PipelineBuilder<TInput, TEntity> {
  return new PipelineBuilder(name, version);
}
