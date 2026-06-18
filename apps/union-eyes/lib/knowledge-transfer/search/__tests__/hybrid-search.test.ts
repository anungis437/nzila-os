import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  selectQueue: [] as unknown[],
  execute: vi.fn(),
  embed: vi.fn(),
  getCached: vi.fn(),
  setCached: vi.fn(),
}));

function chain(): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'from', 'where', 'limit', 'orderBy', 'innerJoin']) {
    c[m] = () => c;
  }
  c.then = (resolve: (v: unknown) => void) => resolve(h.selectQueue.shift() ?? []);
  return c;
}

vi.mock('@/db/db', () => ({
  db: { select: () => chain(), execute: h.execute },
}));
vi.mock('@/db/schema', () => ({
  exitInterviews: new Proxy({}, { get: (_t, p) => String(p) }),
}));
vi.mock('drizzle-orm', () => ({
  and: (...a: unknown[]) => a, eq: (...a: unknown[]) => a, ilike: (...a: unknown[]) => a, or: (...a: unknown[]) => a,
  sql: Object.assign((..._a: unknown[]) => ({}), { raw: (s: string) => s }),
}));
vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: () => ({ embed: h.embed }),
  UE_APP_KEY: 'ue', UE_SYSTEM_ORG_ID: 'sys', UE_PROFILES: { EMBEDDINGS: 'emb' },
}));
vi.mock('@/lib/services/ai/embedding-cache', () => ({
  embeddingCache: { getCachedEmbedding: h.getCached, setCachedEmbedding: h.setCached },
}));

import { hybridKnowledgeSearch } from '../hybrid-search';

function row(id: string, sensitivity = 'low') {
  return {
    id, title: `T${id}`, roleInUnion: 'steward', yearsOfService: 5, summary: 's',
    sensitivityLevel: sensitivity, expertiseTags: ['x'], topics: ['y'],
    publishedAt: { toISOString: () => '2025-01-01T00:00:00.000Z' },
  };
}

describe('lib/knowledge-transfer/search/hybrid-search', () => {
  beforeEach(() => {
    h.selectQueue.length = 0;
    h.execute.mockReset();
    h.embed.mockReset();
    h.getCached.mockReset();
    h.setCached.mockReset();
    h.setCached.mockResolvedValue(undefined);
  });

  it('combines keyword and semantic results with cached embedding', async () => {
    h.getCached.mockResolvedValue([0.1, 0.2, 0.3]);
    h.selectQueue.push([row('a'), row('b', 'high')]); // keyword rows (b filtered out)
    h.selectQueue.push([row('c')]); // semantic-only rows
    h.execute.mockResolvedValue([{ source_id: 'a', similarity: 0.9 }, { source_id: 'c', similarity: 0.8 }]);

    const results = await hybridKnowledgeSearch({ query: 'safety', orgId: 'org-1', allowedSensitivityLevels: ['low'] });
    expect(results.length).toBe(2);
    const ids = results.map((r) => r.id);
    expect(ids).toContain('a');
    expect(ids).toContain('c');
    expect(results[0].relevanceScore).toBeGreaterThanOrEqual(results[1].relevanceScore);
  });

  it('generates embedding via AI when cache misses', async () => {
    h.getCached.mockResolvedValue(null);
    h.embed.mockResolvedValue({ embeddings: [[0.5, 0.5]] });
    h.setCached.mockRejectedValue(new Error('cache write failed'));
    h.selectQueue.push([row('a')]);
    h.execute.mockResolvedValue([{ source_id: 'a', similarity: 0.7 }]);

    const results = await hybridKnowledgeSearch({ query: 'grievance', orgId: 'org-1', allowedSensitivityLevels: ['low'], limit: 5 });
    expect(h.embed).toHaveBeenCalled();
    expect(h.setCached).toHaveBeenCalled();
    expect(results[0].id).toBe('a');
  });

  it('falls back to keyword-only when embedding generation fails', async () => {
    h.getCached.mockResolvedValue(null);
    h.embed.mockRejectedValue(new Error('embed down'));
    h.selectQueue.push([row('a')]);

    const results = await hybridKnowledgeSearch({ query: 'pension', orgId: 'org-1', allowedSensitivityLevels: ['low'] });
    expect(results.length).toBe(1);
    expect(results[0].semanticScore).toBeNull();
    expect(results[0].keywordScore).toBe(1);
    expect(h.execute).not.toHaveBeenCalled();
  });
});
