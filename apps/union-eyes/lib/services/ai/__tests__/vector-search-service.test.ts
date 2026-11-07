import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockGetAiClient: vi.fn(),
  mockEmbed: vi.fn(),
  mockDbExecute: vi.fn(),
  mockDbQuery: vi.fn(),
  mockGetCachedEmbedding: vi.fn(),
  mockSetCachedEmbedding: vi.fn(),
  mockRequireVector: vi.fn(async () => undefined),
  scopes: [] as unknown[],
}));

vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: mocks.mockGetAiClient,
  toGatewayDataClass: (c: string) => c,
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

// Every read runs in the context of the organization it names (row-level security), after the embedding call has returned.
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (scope: unknown, run: (tx: unknown) => Promise<unknown>) => {
    mocks.scopes.push(scope);
    return run({ execute: mocks.mockDbExecute, query: { cbaClause: { findFirst: mocks.mockDbQuery } } });
  },
}));

vi.mock('@/db/schema', () => ({
  cbaClause: { id: 'id', clauseType: 'clause_type', organizationId: 'organization_id' },
}));

vi.mock('drizzle-orm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('drizzle-orm')>()),
  eq: vi.fn((a, b) => ({ field: a, value: b })),
  sql: Object.assign(vi.fn((...args: any[]) => args), { join: (parts: unknown[], separator: unknown) => [...parts, separator] }),
  and: vi.fn((...args: any[]) => args),
  or: vi.fn((...args: any[]) => args),
}));

vi.mock('../embedding-cache', () => ({
  embeddingCache: {
    getCachedEmbedding: mocks.mockGetCachedEmbedding,
    setCachedEmbedding: mocks.mockSetCachedEmbedding,
  },
}));

// These tests are about the query and the ranking; whether pgvector is installed is tested in lib/ai/__tests__/vector-readiness.test.ts.
vi.mock('@/lib/ai/vector-readiness', () => ({
  CLAUSE_EMBEDDING: { table: 'cba_clauses', column: 'embedding' },
  PRECEDENT_EMBEDDING: { table: 'arbitration_decisions', column: 'embedding' },
  requireVectorColumn: mocks.mockRequireVector,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { generateEmbedding, semanticClauseSearch, findSimilarClauses, semanticPrecedentSearch } from '../vector-search-service';

const ORG = { filters: { organizationId: 'org-1' } };
const ORG_ONLY = { organizationId: 'org-1' };

beforeEach(() => {
  mocks.scopes.length = 0;
});

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
    const results = await semanticClauseSearch('wage rates', ORG);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('clause-1');
    expect(results[0].similarity).toBe(0.85);
  });

  it('filters results below threshold', async () => {
    mocks.mockDbExecute.mockResolvedValue([
      { id: 'c1', content: 'Low match', similarity: 0.5, hybrid_score: 0.5, clause_number: '2.01', title: 'Other', clause_type: 'other', article_number: '2', tags: [] },
    ]);
    const results = await semanticClauseSearch('wage rates', { ...ORG, threshold: 0.7 });
    expect(results).toHaveLength(0);
  });

  it('respects limit option', async () => {
    await semanticClauseSearch('wages', { ...ORG, limit: 5 });
    expect(mocks.mockDbExecute).toHaveBeenCalled();
  });

  it('supports filter by clause type', async () => {
    await semanticClauseSearch('wages', {
      filters: { organizationId: 'org-1', clauseType: ['wages', 'overtime'] },
    });
    expect(mocks.mockDbExecute).toHaveBeenCalled();
  });

  it('throws on error', async () => {
    mocks.mockDbExecute.mockRejectedValue(new Error('DB error'));
    await expect(semanticClauseSearch('test', ORG)).rejects.toThrow('Semantic search failed');
  });

  it('searches the clauses of the given organization only', async () => {
    await semanticClauseSearch('wages', ORG);
    const flattened = JSON.stringify(mocks.mockDbExecute.mock.calls[0][0]);
    expect(flattened).toContain('organization_id');
    expect(flattened).toContain('org-1');
    expect(mocks.scopes).toEqual([{ organizationId: 'org-1' }]);
  });

  it('reads no clauses when the organization is not given', async () => {
    await expect(semanticClauseSearch('wages')).rejects.toThrow('organizationId is required');
    expect(mocks.mockDbExecute).not.toHaveBeenCalled();
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
    const results = await findSimilarClauses('clause-1', ORG_ONLY);
    expect(results).toHaveLength(1);
    expect(results[0].similarity).toBe(0.9);
  });

  it('looks the source clause up in the given organization', async () => {
    await findSimilarClauses('clause-1', ORG_ONLY);
    expect(JSON.stringify(mocks.mockDbQuery.mock.calls[0][0])).toContain('org-1');
    // The source clause and the similarity query both read in the organization's own context.
    expect(mocks.scopes).toEqual([{ organizationId: 'org-1' }, { organizationId: 'org-1' }]);
  });

  it('throws if source clause not found', async () => {
    mocks.mockDbQuery.mockResolvedValue(null);
    await expect(findSimilarClauses('clause-999', ORG_ONLY)).rejects.toThrow('Failed to find similar clauses');
  });

  it('respects sameTypeOnly option', async () => {
    await findSimilarClauses('clause-1', { ...ORG_ONLY, sameTypeOnly: true });
    expect(mocks.mockDbExecute).toHaveBeenCalled();
  });

  it('filters by threshold', async () => {
    mocks.mockDbExecute.mockResolvedValue([
      { id: 'c2', content: 'Low match', similarity: 0.5, clause_number: '2.01', title: 'Other', clause_type: 'other', cba_id: 'cba-2', tags: [] },
    ]);
    const results = await findSimilarClauses('clause-1', { ...ORG_ONLY, threshold: 0.75 });
    expect(results).toHaveLength(0);
  });
});

describe('when the database cannot search by similarity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockRequireVector.mockRejectedValue(new Error('VECTOR_SEARCH_UNAVAILABLE'));
  });

  it('refuses a clause search before the query is sent to the embedding service, and does not wrap the reason', async () => {
    await expect(semanticClauseSearch('wages', ORG)).rejects.toThrow('VECTOR_SEARCH_UNAVAILABLE');
    expect(mocks.mockGetAiClient).not.toHaveBeenCalled();
    expect(mocks.mockEmbed).not.toHaveBeenCalled();
    expect(mocks.mockDbExecute).not.toHaveBeenCalled();
  });

  it('refuses a similar-clauses search before it reads the source clause or embeds it', async () => {
    await expect(findSimilarClauses('clause-1', ORG_ONLY)).rejects.toThrow('VECTOR_SEARCH_UNAVAILABLE');
    expect(mocks.mockDbQuery).not.toHaveBeenCalled();
    expect(mocks.mockEmbed).not.toHaveBeenCalled();
  });

  it('refuses a precedent search before the query is embedded', async () => {
    await expect(semanticPrecedentSearch('wrongful dismissal', ORG_ONLY)).rejects.toThrow('VECTOR_SEARCH_UNAVAILABLE');
    expect(mocks.mockEmbed).not.toHaveBeenCalled();
    expect(mocks.mockDbExecute).not.toHaveBeenCalled();
  });
});

describe('semanticPrecedentSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockRequireVector.mockResolvedValue(undefined);
    mocks.mockEmbed.mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]] });
    mocks.mockGetAiClient.mockReturnValue({ embed: mocks.mockEmbed });
    mocks.mockGetCachedEmbedding.mockResolvedValue(null);
    mocks.mockSetCachedEmbedding.mockResolvedValue(undefined);
    mocks.mockDbExecute.mockResolvedValue([
      { id: 'd1', case_title: 'A v B', case_number: '1', precedent_summary: 'Summary', reasoning: 'Why', issue_types: ['termination'], outcome: 'upheld', precedent_value: 'binding', citation_count: 3, similarity: 0.9 },
      { id: 'd2', case_title: 'C v D', case_number: '2', precedent_summary: 'Other', reasoning: 'Why', issue_types: [], outcome: 'denied', precedent_value: 'persuasive', citation_count: 0, similarity: 0.4 },
    ]);
  });

  it('reads in the context of the organization it is given, and keeps the matches above the threshold', async () => {
    const results = await semanticPrecedentSearch('dismissal', ORG_ONLY);

    expect(results.map((result) => result.id)).toEqual(['d1']);
    expect(mocks.scopes).toEqual([{ organizationId: 'org-1' }]);
  });

  it('reads no precedents, and embeds nothing, when the organization is not given', async () => {
    await expect(semanticPrecedentSearch('dismissal', {} as never)).rejects.toThrow('organizationId is required');

    expect(mocks.scopes).toEqual([]);
    expect(mocks.mockEmbed).not.toHaveBeenCalled();
    expect(mocks.mockDbExecute).not.toHaveBeenCalled();
  });
});

describe('the queries name columns the tables have', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockRequireVector.mockResolvedValue(undefined);
    mocks.mockEmbed.mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]] });
    mocks.mockGetAiClient.mockReturnValue({ embed: mocks.mockEmbed });
    mocks.mockGetCachedEmbedding.mockResolvedValue(null);
    mocks.mockSetCachedEmbedding.mockResolvedValue(undefined);
    mocks.mockDbExecute.mockResolvedValue([]);
  });

  const statement = (call: number) => JSON.stringify(mocks.mockDbExecute.mock.calls[call][0]);

  it('reads a clause\'s key terms as its tags (cba_clauses has no tags column)', async () => {
    await semanticClauseSearch('wages', ORG);
    expect(statement(0)).toContain('key_terms AS tags');
    expect(statement(0)).not.toMatch(/\\n\s*tags,/);
  });

  it('filters a precedent by the issues it turned on (issue_types, a jsonb array) and by its jurisdiction column', async () => {
    await semanticPrecedentSearch('dismissal', { ...ORG_ONLY, issueType: 'termination', jurisdiction: 'ON' });
    expect(statement(0)).toContain('issue_types');
    expect(statement(0)).toContain('issue_types @> to_jsonb(');
    expect(statement(0)).toContain('jurisdiction = ');
    expect(statement(0)).not.toContain('tribunal_type');
    expect(statement(0)).not.toMatch(/issue_type[^s]/);
  });
});
