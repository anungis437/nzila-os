import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock('@/db/db', () => ({ db: { execute: h.execute } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

import {
  CLAUSE_EMBEDDING,
  KNOWLEDGE_BASE_EMBEDDING,
  VectorSearchUnavailableError,
  forgetVectorProbes,
  requireVectorColumn,
  vectorColumnReady,
} from '../vector-readiness';

describe('lib/ai/vector-readiness', () => {
  beforeEach(() => {
    h.execute.mockReset();
    forgetVectorProbes();
    vi.useRealTimers();
  });

  it('is ready only where the vector extension and a vector-typed column both exist', async () => {
    h.execute.mockResolvedValueOnce([{ ready: true }]);
    expect(await vectorColumnReady(KNOWLEDGE_BASE_EMBEDDING)).toBe(true);
    h.execute.mockResolvedValueOnce([{ ready: false }]);
    expect(await vectorColumnReady(CLAUSE_EMBEDDING)).toBe(false);
    expect(h.execute).toHaveBeenCalledTimes(2);
  });

  it('asks the catalog about the named column and about the extension, in one statement', async () => {
    h.execute.mockResolvedValue([{ ready: true }]);
    await vectorColumnReady({ table: 'cba_clauses', column: 'embedding' });
    const query = JSON.stringify(h.execute.mock.calls[0][0]);
    expect(query).toContain("extname = 'vector'");
    expect(query).toContain("t.typname = 'vector'");
    expect(query).toContain('cba_clauses');
    expect(query).toContain('embedding');
  });

  it('treats an answer that is not exactly true as not ready', async () => {
    for (const rows of [[], [{}], [{ ready: null }], [{ ready: 't' }], [{ ready: 1 }]]) {
      forgetVectorProbes();
      h.execute.mockResolvedValueOnce(rows);
      expect(await vectorColumnReady(CLAUSE_EMBEDDING)).toBe(false);
    }
  });

  it('remembers an answer for a minute, per column, and then asks again', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-02T12:00:00Z'));
    h.execute.mockResolvedValue([{ ready: false }]);
    expect(await vectorColumnReady(KNOWLEDGE_BASE_EMBEDDING)).toBe(false);
    expect(await vectorColumnReady(KNOWLEDGE_BASE_EMBEDDING)).toBe(false);
    expect(h.execute).toHaveBeenCalledTimes(1);

    expect(await vectorColumnReady(CLAUSE_EMBEDDING)).toBe(false);
    expect(h.execute).toHaveBeenCalledTimes(2);

    vi.setSystemTime(new Date('2026-11-02T12:01:01Z'));
    h.execute.mockResolvedValue([{ ready: true }]);
    expect(await vectorColumnReady(KNOWLEDGE_BASE_EMBEDDING)).toBe(true);
    expect(h.execute).toHaveBeenCalledTimes(3);
  });

  it('requireVectorColumn throws a typed error that names the column, and passes when ready', async () => {
    h.execute.mockResolvedValueOnce([{ ready: false }]);
    const failure = await requireVectorColumn(CLAUSE_EMBEDDING).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(VectorSearchUnavailableError);
    expect(failure).toMatchObject({ code: 'VECTOR_SEARCH_UNAVAILABLE', target: CLAUSE_EMBEDDING });
    expect((failure as Error).message).toContain('cba_clauses.embedding');

    forgetVectorProbes();
    h.execute.mockResolvedValueOnce([{ ready: true }]);
    await expect(requireVectorColumn(CLAUSE_EMBEDDING)).resolves.toBeUndefined();
  });

  it('uses the executor it is given (a transaction) instead of the ambient database', async () => {
    const executor = { execute: vi.fn().mockResolvedValue([{ ready: true }]) };
    expect(await vectorColumnReady(KNOWLEDGE_BASE_EMBEDDING, executor as never)).toBe(true);
    expect(executor.execute).toHaveBeenCalledTimes(1);
    expect(h.execute).not.toHaveBeenCalled();
  });
});
