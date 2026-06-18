import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockGetAiClient: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbQuery: vi.fn(),
  mockDbSelect: vi.fn(),
  mockSelectFrom: vi.fn(),
  mockSelectWhere: vi.fn(),
  mockValues: vi.fn(),
  mockSet: vi.fn(),
  mockWhere: vi.fn(),
  mockGenerate: vi.fn(),
  mockExtract: vi.fn(),
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
    insert: mocks.mockDbInsert,
    update: mocks.mockDbUpdate,
    select: mocks.mockDbSelect,
    query: {
      collectiveAgreements: {
        findFirst: mocks.mockDbQuery,
      },
    },
  },
}));

vi.mock('@/db/schema', () => ({
  cbaClause: { id: 'id', contentHash: 'contentHash', cbaId: 'cbaId' },
  collectiveAgreements: { id: 'id', jurisdiction: 'jurisdiction', sector: 'sector' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { extractClausesFromPDF, batchExtractClauses } from '../clause-extraction-service';

describe('extractClausesFromPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.mockGenerate.mockResolvedValue({ content: 'Article 1 - Wages\n1.01 Base rate...' });
    mocks.mockExtract.mockResolvedValue({
      data: {
        clauses: [
          {
            clauseType: 'wages',
            clauseNumber: '1.01',
            title: 'Base Rate',
            content: 'Base rate is $30/hr',
            articleNumber: '1',
            sectionNumber: '01',
            tags: ['wages', 'base-rate'],
            crossReferences: [],
            confidence: 0.95,
          },
        ],
      },
    });
    mocks.mockGetAiClient.mockReturnValue({
      generate: mocks.mockGenerate,
      extract: mocks.mockExtract,
    });

    mocks.mockDbQuery.mockResolvedValue({
      id: 'cba-1',
      jurisdiction: 'Ontario',
      sector: 'Public',
    });

    // insert().values()
    mocks.mockValues.mockResolvedValue(undefined);
    mocks.mockDbInsert.mockReturnValue({ values: mocks.mockValues });

    // select().from().where() — for duplicate-hash check
    mocks.mockSelectWhere.mockResolvedValue([]);
    mocks.mockSelectFrom.mockReturnValue({ where: mocks.mockSelectWhere });
    mocks.mockDbSelect.mockReturnValue({ from: mocks.mockSelectFrom });

    // update().set().where()
    mocks.mockWhere.mockResolvedValue(undefined);
    mocks.mockSet.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockDbUpdate.mockReturnValue({ set: mocks.mockSet });
  });

  it('extracts clauses from PDF successfully', async () => {
    const result = await extractClausesFromPDF('https://example.com/cba.pdf', 'cba-1', {
      organizationId: 'org-1',
    });
    expect(result.success).toBe(true);
    expect(result.clauses).toHaveLength(1);
    expect(result.clauses[0].clauseType).toBe('wages');
  });

  it('returns processing time', async () => {
    const result = await extractClausesFromPDF('https://example.com/cba.pdf', 'cba-1', {
      organizationId: 'org-1',
    });
    expect(result.processingTime).toBeGreaterThanOrEqual(0);
  });

  it('throws if CBA not found', async () => {
    mocks.mockDbQuery.mockResolvedValue(null);
    const result = await extractClausesFromPDF('https://example.com/cba.pdf', 'cba-999', {
      organizationId: 'org-1',
    });
    expect(result.success).toBe(false);
    expect(result.errors).toContain('CBA with ID cba-999 not found');
  });

  it('saves clauses when autoSave is true', async () => {
    await extractClausesFromPDF('https://example.com/cba.pdf', 'cba-1', {
      organizationId: 'org-1',
      autoSave: true,
    });
    expect(mocks.mockDbInsert).toHaveBeenCalled();
  });

  it('updates CBA with processing metadata', async () => {
    await extractClausesFromPDF('https://example.com/cba.pdf', 'cba-1', {
      organizationId: 'org-1',
    });
    expect(mocks.mockDbUpdate).toHaveBeenCalled();
  });

  it('handles AI extraction error gracefully', async () => {
    mocks.mockGenerate.mockRejectedValue(new Error('AI timeout'));
    const result = await extractClausesFromPDF('https://example.com/cba.pdf', 'cba-1', {
      organizationId: 'org-1',
    });
    expect(result.success).toBe(false);
    expect(result.errors![0]).toContain('Failed to extract text');
  });
});

describe('batchExtractClauses', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.mockGenerate.mockResolvedValue({ content: 'text' });
    mocks.mockExtract.mockResolvedValue({ data: { clauses: [] } });
    mocks.mockGetAiClient.mockReturnValue({
      generate: mocks.mockGenerate,
      extract: mocks.mockExtract,
    });
    mocks.mockDbQuery.mockResolvedValue({ id: 'cba-1', jurisdiction: 'ON', sector: 'Public' });
    mocks.mockValues.mockResolvedValue(undefined);
    mocks.mockDbInsert.mockReturnValue({ values: mocks.mockValues });
    mocks.mockSelectWhere.mockResolvedValue([]);
    mocks.mockSelectFrom.mockReturnValue({ where: mocks.mockSelectWhere });
    mocks.mockDbSelect.mockReturnValue({ from: mocks.mockSelectFrom });
    mocks.mockWhere.mockResolvedValue(undefined);
    mocks.mockSet.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockDbUpdate.mockReturnValue({ set: mocks.mockSet });
  });

  it('processes multiple CBAs', async () => {
    const results = await batchExtractClauses([
      { id: 'cba-1', documentUrl: 'https://example.com/1.pdf', organizationId: 'org-1' },
      { id: 'cba-2', documentUrl: 'https://example.com/2.pdf', organizationId: 'org-1' },
    ]);
    expect(results.size).toBe(2);
  });

  it('respects concurrency option', async () => {
    const results = await batchExtractClauses(
      [
        { id: 'cba-1', documentUrl: 'https://example.com/1.pdf', organizationId: 'org-1' },
      ],
      { concurrency: 1 },
    );
    expect(results.size).toBe(1);
  });
});
