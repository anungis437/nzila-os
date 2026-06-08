import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockGetAiClient: vi.fn(),
  mockEmbed: vi.fn(),
  mockDbExecute: vi.fn(),
  mockDbQuery: vi.fn(),
  mockGetCachedEmbedding: vi.fn(),
  mockSetCachedEmbedding: vi.fn(),
}));

vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: mocks.mockGetAiClient,
  buildOrgAiTrace: vi.fn(() => ({
    component: 'test',
    action: 'mock',
  })),
  UE_APP_KEY: 'test-app-key',
  UE_PROFILES: {
    CLAUSE_EXTRACTION: 'clause-extraction',
    EMBEDDINGS: 'embeddings',
  },
  UE_SYSTEM_ORG_ID: 'system-org',
}));

vi.mock('@/db', () => ({
  db: {
    execute: mocks.mockDbExecute,
    query: {
      cbaClause: {
        findFirst: mocks.mockDbQuery,
      },
    },
  },
}));

vi.mock('@/db/schema', () => ({
  cbaClause: { id: 'id', clauseType: 'clause_type' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
  sql: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
  or: vi.fn((...args: any[]) => args),
  SQL: vi.fn(),
}));

vi.mock('../embedding-cache', () => ({
  embeddingCache: {
    getCachedEmbedding: mocks.mockGetCachedEmbedding,
    setCachedEmbedding: mocks.mockSetCachedEmbedding,
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { generateEmbedding, semanticClauseSearch, findSimilarClauses } from '../vector-search-service';

describe('generateEmbedding', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.mockEmbed.mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]] });
    mocks.mockGetAiClient.mockReturnValue({ embed: mocks.mockEmbed });
    mocks.mockGetCachedEmbedding.mockResolvedValue(null);
    mocks.mockSetCachedEmbedding.mockResolvedValue(undefined);
  });

  it('returns cached embedding on hit', async () => {
    mocks.mockGetCachedEmbedding.mockResolvedValue([0.5, 0.6, 0.7]);
    const result = await generateEmbedding('test text');
    expect(result).toEqual([0.5, 0.6, 0.7]);
    expect(mocks.mockEmbed).not.toHaveBeenCalled();
  });

  it('calls AI SDK on cache miss', async () => {
    const result = await generateEmbedding('test text');
    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(mocks.mockEmbed).toHaveBeenCalled();
  });

  it('caches embedding after generation', async () => {
    await generateEmbedding('test text');
    expect(mocks.mockSetCachedEmbedding).toHaveBeenCalledWith(
      'test text',
      'text-embedding-3-small',
      [0.1, 0.2, 0.3],
    );
  });

  it('throws on AI SDK error', async () => {
    mocks.mockEmbed.mockRejectedValue(new Error('API error'));
    await expect(generateEmbedding('test')).rejects.toThrow('Failed to generate embedding');
  });
});

describe('semanticClauseSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.mockEmbed.mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]] });
    mocks.mockGetAiClient.mockReturnValue({ embed: mocks.mockEmbed });
    mocks.mockGetCachedEmbedding.mockResolvedValue(null);
    mocks.mockSetCachedEmbedding.mockResolvedValue(undefined);

    mocks.mockDbExecute.mockResolvedValue([
      {
        id: 'clause-1',
        content: 'Wages shall be $30/hr',
        similarity: 0.85,
        hybrid_score: 0.85,
        clause_number: '1.01',
        title: 'Base Rate',
        clause_type: 'wages',
        article_number: '1',
        tags: ['wages'],
      },
    ]);
  });

  it('returns search results above threshold', async () => {
    const results = await semanticClauseSearch('wage rates');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('clause-1');
    expect(results[0].similarity).toBe(0.85);
  });

  it('filters results below threshold', async () => {
    mocks.mockDbExecute.mockResolvedValue([
      { id: 'c1', content: 'Low match', similarity: 0.5, hybrid_score: 0.5, clause_number: '2.01', title: 'Other', clause_type: 'other', article_number: '2', tags: [] },
    ]);
    const results = await semanticClauseSearch('wage rates', { threshold: 0.7 });
    expect(results).toHaveLength(0);
  });

  it('respects limit option', async () => {
    await semanticClauseSearch('wages', { limit: 5 });
    expect(mocks.mockDbExecute).toHaveBeenCalled();
  });

  it('supports filter by clause type', async () => {
    await semanticClauseSearch('wages', {
      filters: { clauseType: ['wages', 'overtime'] },
    });
    expect(mocks.mockDbExecute).toHaveBeenCalled();
  });

  it('throws on error', async () => {
    mocks.mockDbExecute.mockRejectedValue(new Error('DB error'));
    await expect(semanticClauseSearch('test')).rejects.toThrow('Semantic search failed');
  });
});

describe('findSimilarClauses', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.mockEmbed.mockResolvedValue({ embeddings: [[0.1, 0.2]] });
    mocks.mockGetAiClient.mockReturnValue({ embed: mocks.mockEmbed });
    mocks.mockGetCachedEmbedding.mockResolvedValue(null);
    mocks.mockSetCachedEmbedding.mockResolvedValue(undefined);

    mocks.mockDbQuery.mockResolvedValue({
      id: 'clause-1',
      content: 'Base rate $30/hr',
      clauseType: 'wages',
    });

    mocks.mockDbExecute.mockResolvedValue([
      {
        id: 'clause-2',
        content: 'Base wage $32/hr',
        similarity: 0.9,
        clause_number: '1.02',
        title: 'Adjusted Rate',
        clause_type: 'wages',
        cba_id: 'cba-2',
        tags: ['wages'],
      },
    ]);
  });

  it('finds similar clauses', async () => {
    const results = await findSimilarClauses('clause-1');
    expect(results).toHaveLength(1);
    expect(results[0].similarity).toBe(0.9);
  });

  it('throws if source clause not found', async () => {
    mocks.mockDbQuery.mockResolvedValue(null);
    await expect(findSimilarClauses('clause-999')).rejects.toThrow('Failed to find similar clauses');
  });

  it('respects sameTypeOnly option', async () => {
    await findSimilarClauses('clause-1', { sameTypeOnly: true });
    expect(mocks.mockDbExecute).toHaveBeenCalled();
  });

  it('filters by threshold', async () => {
    mocks.mockDbExecute.mockResolvedValue([
      { id: 'c2', content: 'Low match', similarity: 0.5, clause_number: '2.01', title: 'Other', clause_type: 'other', cba_id: 'cba-2', tags: [] },
    ]);
    const results = await findSimilarClauses('clause-1', { threshold: 0.75 });
    expect(results).toHaveLength(0);
  });
});
