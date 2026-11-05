import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  selectQueue: [] as unknown[],
  execute: vi.fn(),
  embed: vi.fn(),
  getCached: vi.fn(),
  setCached: vi.fn(),
  vectorReady: vi.fn(),
  listCondition: vi.fn(),
  where: [] as unknown[],
}));

function chain(): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'from', 'limit', 'orderBy', 'innerJoin']) {
    c[m] = () => c;
  }
  c.where = (arg: unknown) => { h.where.push(arg); return c; };
  c.then = (resolve: (v: unknown) => void) => resolve(h.selectQueue.shift() ?? []);
  return c;
}

vi.mock('@/db/db', () => ({
  db: { select: () => chain(), execute: h.execute },
}));
// These tests are about ranking and merging; whether pgvector is installed is tested in lib/ai/__tests__/vector-readiness.test.ts.
vi.mock('@/lib/ai/vector-readiness', () => ({
  KNOWLEDGE_BASE_EMBEDDING: { table: 'knowledge_base', column: 'embedding' },
  vectorColumnReady: h.vectorReady,
}));
// The consent and level predicate is interview-access.ts's own (tested there, and on real PostgreSQL in db/__tests__/semantic-search.postgres.test.ts).
vi.mock('@/lib/knowledge-transfer/governance/interview-access', () => ({ interviewListCondition: h.listCondition }));
vi.mock('@/db/schema', () => ({
  exitInterviews: new Proxy({}, { get: (_t, p) => String(p) }),
}));
vi.mock('drizzle-orm', () => ({
  and: (...a: unknown[]) => a, eq: (...a: unknown[]) => a, ilike: (...a: unknown[]) => a, inArray: (...a: unknown[]) => a, or: (...a: unknown[]) => a,
  sql: Object.assign((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings: [...strings], values }), { raw: (s: string) => s }),
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
    id, title: `T${id}`, roleInUnion: 'steward', yearsOfService: 5, summary: 's', aiSummary: `ai ${id}`,
    sensitivityLevel: sensitivity, expertiseTags: ['x'], topics: ['y'],
    publishedAt: { toISOString: () => '2025-01-01T00:00:00.000Z' },
    indexingStatus: 'indexed',
  };
}

describe('lib/knowledge-transfer/search/hybrid-search', () => {
  beforeEach(() => {
    h.selectQueue.length = 0;
    h.where.length = 0;
    h.execute.mockReset();
    h.embed.mockReset();
    h.getCached.mockReset();
    h.setCached.mockReset();
    h.setCached.mockResolvedValue(undefined);
    h.vectorReady.mockReset();
    h.vectorReady.mockResolvedValue(true);
    h.listCondition.mockReset();
    h.listCondition.mockReturnValue('list-condition');
  });

  it('is the keyword search, with no embedding requested and no vector query, when pgvector is not installed', async () => {
    h.vectorReady.mockResolvedValue(false);
    h.selectQueue.push([row('a')]);

    const results = await hybridKnowledgeSearch({ query: 'safety', orgId: 'org-1', allowedSensitivityLevels: ['low'] });
    expect(results.map((r) => r.id)).toEqual(['a']);
    expect(results[0]).toMatchObject({ keywordScore: 1, semanticScore: null });
    expect(h.getCached).not.toHaveBeenCalled();
    expect(h.embed).not.toHaveBeenCalled();
    expect(h.execute).not.toHaveBeenCalled();
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

  it('returns the operational summary and the indexing status of a result, from the keyword search and from the semantic-only one', async () => {
    h.getCached.mockResolvedValue([0.1, 0.2, 0.3]);
    h.selectQueue.push([row('a')]); // keyword rows
    h.selectQueue.push([{ ...row('c'), aiSummary: null, indexingStatus: 'pending' }]); // semantic-only rows
    h.execute.mockResolvedValue([{ source_id: 'a', similarity: 0.9 }, { source_id: 'c', similarity: 0.8 }]);

    const results = await hybridKnowledgeSearch({ query: 'safety', orgId: 'org-1', allowedSensitivityLevels: ['low'] });
    expect(results.find((r) => r.id === 'a')).toMatchObject({ aiSummary: 'ai a', indexingStatus: 'indexed' });
    expect(results.find((r) => r.id === 'c')).toMatchObject({ aiSummary: null, indexingStatus: 'pending' });
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

  // DEF-0B7-EXC-SEARCH-LIMITS-BEFORE-FILTERING-BY-SENSITIVITY
  it('puts the sensitivity floor in the query and reads nothing when no level is allowed', async () => {
    const results = await hybridKnowledgeSearch({ query: 'safety', orgId: 'org-1', allowedSensitivityLevels: [] });
    expect(results).toEqual([]);
  });

  it('reads interviews through the consent and level predicate for a reader below steward, unless the caller is a steward or above', async () => {
    h.selectQueue.push([row('a')]);
    h.vectorReady.mockResolvedValue(false);
    await hybridKnowledgeSearch({ query: 'safety', orgId: 'org-1', allowedSensitivityLevels: ['low'] });
    // No author branch (search results are the shared knowledge) and consent required: stewardPlus is false unless the caller says so.
    expect(h.listCondition).toHaveBeenLastCalledWith({ userId: null, stewardPlus: false, levels: new Set(['low']) });

    h.selectQueue.push([row('a')]);
    await hybridKnowledgeSearch({ query: 'safety', orgId: 'org-1', allowedSensitivityLevels: ['low', 'medium'], stewardPlus: true });
    expect(h.listCondition).toHaveBeenLastCalledWith({ userId: null, stewardPlus: true, levels: new Set(['low', 'medium']) });
  });

  it('applies the same predicate to an interview found only by meaning', async () => {
    h.getCached.mockResolvedValue([0.1, 0.2, 0.3]);
    h.selectQueue.push([]); // no keyword rows
    h.selectQueue.push([row('c')]);
    h.execute.mockResolvedValue([{ source_id: 'c', similarity: 0.8 }]);

    const results = await hybridKnowledgeSearch({ query: 'safety', orgId: 'org-1', allowedSensitivityLevels: ['low'] });
    expect(results.map((r) => r.id)).toEqual(['c']);
    // The keyword read and the read of the semantic-only interviews each go through the predicate.
    expect(h.listCondition).toHaveBeenCalledTimes(2);
  });

  it('keeps the knowledge copy of an interview out of the semantic match once the retiree\'s consent is withdrawn, and binds the vector instead of writing it into the statement', async () => {
    h.getCached.mockResolvedValue([0.1, 0.2, 0.3]);
    h.selectQueue.push([]);
    h.execute.mockResolvedValue([]);

    await hybridKnowledgeSearch({ query: 'safety', orgId: 'org-1', allowedSensitivityLevels: ['low'] });
    const statement = h.execute.mock.calls[0][0] as { strings: string[]; values: unknown[] };
    expect(statement.strings.join('?')).toContain('ei.consent_granted = true');
    expect(statement.strings.join('?')).not.toContain('0.1,0.2');
    expect(statement.values).toContain('[0.1,0.2,0.3]');
  });

  // The keyword read and the re-read of semantic-only interviews require consent in their own predicate, whatever the
  // caller's role, so a withdrawal between the vector query and the re-read wins.
  it('requires the retiree\'s consent in the keyword read and in the re-read of semantic-only interviews, for a steward too', async () => {
    h.getCached.mockResolvedValue([0.1, 0.2, 0.3]);
    h.selectQueue.push([]);
    h.selectQueue.push([row('c')]);
    h.execute.mockResolvedValue([{ source_id: 'c', similarity: 0.8 }]);

    await hybridKnowledgeSearch({ query: 'safety', orgId: 'org-1', allowedSensitivityLevels: ['low'], stewardPlus: true });
    expect(h.where).toHaveLength(2);
    for (const predicate of h.where) {
      expect(predicate).toEqual(expect.arrayContaining([['consentGranted', true], ['organizationId', 'org-1']]));
    }
    const statement = (h.execute.mock.calls[0][0] as { strings: string[] }).strings.join('?');
    expect(statement).toContain('ei.organization_id = ?');
    expect(statement).toContain('kb.organization_id = ?');
  });
});
