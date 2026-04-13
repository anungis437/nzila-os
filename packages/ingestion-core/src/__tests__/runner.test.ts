// ---------------------------------------------------------------------------
// @nzila/ingestion-core  —  Test suite
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach } from 'vitest';
import type {
  PipelineContext,
  PipelineDefinition,
  PipelineStage,
} from '../types';
import {
  runPipeline,
  createPipelineContext,
  validatePipeline,
} from '../runner';
import { executePipeline } from '../audited';
import {
  registerPipeline,
  getPipeline,
  listPipelines,
  unregisterPipeline,
  clearPipelineRegistry,
} from '../registry';
import { stage, pipeline } from '../builders';
import {
  pipelineStartedEvent,
  pipelineCompletedEvent,
  pipelineEventsFromResult,
} from '../events';
import {
  runPipeline as runPipelineFromBarrel,
  validatePipeline as validatePipelineFromBarrel,
  stage as stageFromBarrel,
  pipeline as pipelineFromBarrel,
} from '../index';

// ── Test fixtures ───────────────────────────────────────────────────────

interface RawDoc {
  id: string;
  title: string;
  body: string;
}

interface NormDoc {
  id: string;
  title: string;
  bodyLower: string;
  wordCount: number;
}

const normalizeStage: PipelineStage<RawDoc, NormDoc> = {
  name: 'normalize',
  async execute(ctx) {
    const raw = ctx.rawInput;
    ctx.entity = {
      id: raw.id,
      title: raw.title.trim(),
      bodyLower: raw.body.toLowerCase(),
      wordCount: raw.body.split(/\s+/).length,
    };
  },
};

const validateStage: PipelineStage<RawDoc, NormDoc> = {
  name: 'validate',
  async execute(ctx) {
    if (!ctx.entity) throw new Error('No entity to validate');
    if (ctx.entity.wordCount === 0) {
      throw new Error('Document body is empty');
    }
  },
};

const enrichStage: PipelineStage<RawDoc, NormDoc> = {
  name: 'enrich',
  async execute(ctx) {
    ctx.bag.set('enriched', true);
  },
};

function makePipeline(): PipelineDefinition<RawDoc, NormDoc> {
  return {
    name: 'doc-ingest',
    version: '1.0',
    stages: [normalizeStage, validateStage, enrichStage],
  };
}

function makeCtx(
  overrides?: Partial<Pick<PipelineContext<RawDoc, NormDoc>, 'rawInput'>>,
): PipelineContext<RawDoc, NormDoc> {
  return createPipelineContext<RawDoc, NormDoc>({
    orgId: 'org-1',
    actorId: 'user-1',
    source: 'test',
    rawInput: overrides?.rawInput ?? {
      id: 'doc-1',
      title: '  Hello World  ',
      body: 'This is a test document',
    },
  });
}

// ── runPipeline ─────────────────────────────────────────────────────────

describe('runPipeline', () => {
  it('executes all stages and returns completed', async () => {
    const result = await runPipeline(makePipeline(), makeCtx());
    expect(result.outcome).toBe('completed');
    expect(result.stages).toHaveLength(3);
    expect(result.stages.every((s) => s.outcome === 'ok')).toBe(true);
    expect(result.entity).toEqual({
      id: 'doc-1',
      title: 'Hello World',
      bodyLower: 'this is a test document',
      wordCount: 5,
    });
    expect(result.error).toBeUndefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('stops on first error by default', async () => {
    const failingPipeline: PipelineDefinition<RawDoc, NormDoc> = {
      name: 'fail-test',
      version: '1.0',
      stages: [
        normalizeStage,
        {
          name: 'explode',
          async execute() {
            throw new Error('Boom!');
          },
        },
        enrichStage,
      ],
    };

    const result = await runPipeline(failingPipeline, makeCtx());
    expect(result.outcome).toBe('failed');
    expect(result.stages).toHaveLength(2); // normalize + explode, enrich never ran
    expect(result.stages[0]!.outcome).toBe('ok');
    expect(result.stages[1]!.outcome).toBe('failed');
    expect(result.stages[1]!.error).toBe('Boom!');
    expect(result.error).toContain('Stage "explode" failed');
  });

  it('continues on error when continueOnError is set', async () => {
    const failingPipeline: PipelineDefinition<RawDoc, NormDoc> = {
      name: 'partial-test',
      version: '1.0',
      stages: [
        normalizeStage,
        {
          name: 'soft-fail',
          async execute() {
            throw new Error('Non-critical');
          },
        },
        enrichStage,
      ],
    };

    const result = await runPipeline(failingPipeline, makeCtx(), {
      continueOnError: true,
    });
    expect(result.outcome).toBe('partial');
    expect(result.stages).toHaveLength(3);
    expect(result.stages[0]!.outcome).toBe('ok');
    expect(result.stages[1]!.outcome).toBe('failed');
    expect(result.stages[2]!.outcome).toBe('ok');
  });

  it('skips stages where shouldRun returns false', async () => {
    const skipPipeline: PipelineDefinition<RawDoc, NormDoc> = {
      name: 'skip-test',
      version: '1.0',
      stages: [
        normalizeStage,
        {
          name: 'conditional',
          async execute(ctx) {
            ctx.bag.set('ran', true);
          },
          shouldRun: () => false,
        },
        enrichStage,
      ],
    };

    const ctx = makeCtx();
    const result = await runPipeline(skipPipeline, ctx);
    expect(result.outcome).toBe('completed');
    expect(result.stages[1]!.outcome).toBe('skipped');
    expect(result.stages[1]!.durationMs).toBe(0);
    expect(ctx.bag.has('ran')).toBe(false);
  });

  it('records per-stage timing', async () => {
    const result = await runPipeline(makePipeline(), makeCtx());
    for (const s of result.stages) {
      expect(typeof s.durationMs).toBe('number');
      expect(s.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles non-Error throws', async () => {
    const failingPipeline: PipelineDefinition<RawDoc, NormDoc> = {
      name: 'non-error-throw',
      version: '1.0',
      stages: [
        {
          name: 'explode',
          async execute() {
            throw 'raw failure';
          },
        },
      ],
    };

    const result = await runPipeline(failingPipeline, makeCtx());
    expect(result.outcome).toBe('failed');
    expect(result.stages[0]!.error).toBe('raw failure');
    expect(result.error).toContain('raw failure');
  });
});

// ── createPipelineContext ───────────────────────────────────────────────

describe('createPipelineContext', () => {
  it('generates a correlation ID', () => {
    const ctx = makeCtx();
    expect(ctx.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('initialises entity as null and bag as empty', () => {
    const ctx = makeCtx();
    expect(ctx.entity).toBeNull();
    expect(ctx.bag.size).toBe(0);
  });
});

// ── validatePipeline ────────────────────────────────────────────────────

describe('validatePipeline', () => {
  it('returns no errors for valid pipeline', () => {
    expect(validatePipeline(makePipeline())).toHaveLength(0);
  });

  it('errors on missing name', () => {
    const errors = validatePipeline({
      name: '',
      version: '1.0',
      stages: [normalizeStage],
    });
    expect(errors.some((e) => e.field === 'name')).toBe(true);
  });

  it('errors on empty stages', () => {
    const errors = validatePipeline({
      name: 'test',
      version: '1.0',
      stages: [],
    });
    expect(errors.some((e) => e.field === 'stages')).toBe(true);
  });

  it('errors on duplicate stage names', () => {
    const errors = validatePipeline({
      name: 'test',
      version: '1.0',
      stages: [normalizeStage, normalizeStage],
    });
    expect(
      errors.some((e) => e.message.includes('Duplicate stage name')),
    ).toBe(true);
  });

  it('errors on missing version and empty stage names', () => {
    const errors = validatePipeline({
      name: 'x',
      version: '',
      stages: [{ name: '   ', execute: async () => {} }],
    });

    expect(errors.some((e) => e.field === 'version')).toBe(true);
    expect(
      errors.some((e) => e.message.includes('non-empty name')),
    ).toBe(true);
  });
});

// ── executePipeline (audited) ───────────────────────────────────────────

describe('executePipeline', () => {
  it('produces an IngestionRecord on success', async () => {
    const { result, record } = await executePipeline(
      makePipeline(),
      makeCtx(),
    );
    expect(result.outcome).toBe('completed');
    expect(record.correlationId).toBe(result.correlationId);
    expect(record.pipelineName).toBe('doc-ingest');
    expect(record.pipelineVersion).toBe('1.0');
    expect(record.orgId).toBe('org-1');
    expect(record.actorId).toBe('user-1');
    expect(record.source).toBe('test');
    expect(record.outcome).toBe('completed');
    expect(record.stageCount).toBe(3);
    expect(record.failedStage).toBeNull();
    expect(record.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records the failed stage name on failure', async () => {
    const bad: PipelineDefinition<RawDoc, NormDoc> = {
      name: 'fail',
      version: '1.0',
      stages: [
        normalizeStage,
        {
          name: 'kaboom',
          async execute() {
            throw new Error('Nope');
          },
        },
      ],
    };
    const { record } = await executePipeline(bad, makeCtx());
    expect(record.outcome).toBe('failed');
    expect(record.failedStage).toBe('kaboom');
  });
});

// ── Registry ────────────────────────────────────────────────────────────

describe('pipeline registry', () => {
  beforeEach(() => clearPipelineRegistry());

  it('registers and retrieves a pipeline', () => {
    const def = makePipeline();
    registerPipeline(def);
    expect(getPipeline('doc-ingest', '1.0')).toBe(def);
    expect(listPipelines()).toContain('doc-ingest@1.0');
  });

  it('throws on invalid pipeline registration', () => {
    expect(() =>
      registerPipeline({ name: '', version: '1.0', stages: [] }),
    ).toThrow(/Invalid pipeline/);
  });

  it('unregisters existing pipelines and returns false when missing', () => {
    const def = makePipeline();
    registerPipeline(def);

    expect(unregisterPipeline('doc-ingest', '1.0')).toBe(true);
    expect(unregisterPipeline('doc-ingest', '1.0')).toBe(false);
  });
});

// ── Builders ────────────────────────────────────────────────────────────

describe('pipeline builder', () => {
  it('builds a valid pipeline definition', () => {
    const def = pipeline<RawDoc, NormDoc>('built', '2.0')
      .addStage(
        stage<RawDoc, NormDoc>('norm', async (ctx) => {
          ctx.entity = {
            id: ctx.rawInput.id,
            title: ctx.rawInput.title,
            bodyLower: ctx.rawInput.body.toLowerCase(),
            wordCount: 1,
          };
        }),
      )
      .addStage(
        stage<RawDoc, NormDoc>('check', async (ctx) => {
          if (!ctx.entity) throw new Error('No entity');
        }).when((ctx) => ctx.entity !== null),
      )
      .build();

    expect(def.name).toBe('built');
    expect(def.version).toBe('2.0');
    expect(def.stages).toHaveLength(2);
    expect(def.stages[0]!.name).toBe('norm');
    expect(def.stages[1]!.shouldRun).toBeDefined();
  });

  it('can run a builder-constructed pipeline', async () => {
    const def = pipeline<RawDoc, NormDoc>('builder-run', '1.0')
      .addStage(
        stage<RawDoc, NormDoc>('init', async (ctx) => {
          ctx.entity = {
            id: ctx.rawInput.id,
            title: ctx.rawInput.title,
            bodyLower: ctx.rawInput.body.toLowerCase(),
            wordCount: ctx.rawInput.body.split(/\s+/).length,
          };
        }),
      )
      .build();

    const result = await runPipeline(def, makeCtx());
    expect(result.outcome).toBe('completed');
    expect(result.entity?.wordCount).toBe(5);
  });

  it('supports addStageDef for raw stage definitions', async () => {
    const def = pipeline<RawDoc, NormDoc>('raw', '1.0')
      .addStageDef({
        name: 'raw-stage',
        async execute(ctx) {
          ctx.bag.set('raw', true);
        },
      })
      .build();

    const ctx = makeCtx();
    const result = await runPipeline(def, ctx);
    expect(result.outcome).toBe('completed');
    expect(ctx.bag.get('raw')).toBe(true);
  });
});

describe('events bridge', () => {
  const createEvent = <T,>(
    type: string,
    payload: T,
    metadata: Record<string, unknown>,
  ) => ({
    id: `evt-${type}`,
    type,
    payload,
    metadata,
  });

  it('creates started and completed events', async () => {
    const def = makePipeline();
    const ctx = makeCtx();
    const result = await runPipeline(def, ctx);

    const started = pipelineStartedEvent(def, ctx, createEvent);
    const completed = pipelineCompletedEvent(result, ctx.source, createEvent);

    expect(started.type).toBe('ingestion.pipeline.started');
    expect((started.payload as { pipelineName: string }).pipelineName).toBe('doc-ingest');
    expect(completed.type).toBe('ingestion.pipeline.completed');
    expect((completed.payload as { failedStage: string | null }).failedStage).toBeNull();
  });

  it('captures failed stage and causation metadata when building both events', async () => {
    const def: PipelineDefinition<RawDoc, NormDoc> = {
      name: 'event-fail',
      version: '1.0',
      stages: [
        {
          name: 'kaboom',
          async execute() {
            throw new Error('boom');
          },
        },
      ],
    };
    const ctx = makeCtx();
    const result = await runPipeline(def, ctx);

    const both = pipelineEventsFromResult(def, ctx, result, createEvent);
    expect((both.completed.payload as { failedStage: string | null }).failedStage).toBe('kaboom');
    expect((both.completed.metadata as { causationId: string }).causationId).toBe(
      both.started.id,
    );
  });
});

describe('barrel exports', () => {
  it('re-exports core API symbols', async () => {
    const stageBuilder = stageFromBarrel<RawDoc, NormDoc>('noop', async () => {});
    const def = pipelineFromBarrel<RawDoc, NormDoc>('barrel', '1.0')
      .addStage(stageBuilder)
      .build();

    const validation = validatePipelineFromBarrel(def);
    const result = await runPipelineFromBarrel(def, makeCtx());

    expect(validation).toHaveLength(0);
    expect(result.outcome).toBe('completed');
  });
});
