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
  mockReturning: vi.fn(),
  mockGenerate: vi.fn(),
  mockExtract: vi.fn(),
  audit: vi.fn(),
  operation: vi.fn(),
  FakeOperationAuditError: class FakeOperationAuditError extends Error {},
}));
const { FakeOperationAuditError } = mocks;

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

const tx = {
  insert: mocks.mockDbInsert,
  update: mocks.mockDbUpdate,
  select: mocks.mockDbSelect,
  query: {
    collectiveAgreements: {
      findFirst: mocks.mockDbQuery,
    },
  },
};
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_scope: unknown, fn: (t: unknown) => Promise<unknown>) => fn(tx),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: mocks.audit }));
vi.mock('@/lib/audit/operation-audit', () => ({
  performAuditedOperation: mocks.operation,
  OperationAuditError: mocks.FakeOperationAuditError,
}));

vi.mock('@/db/schema', () => ({
  cbaClause: { id: 'id', contentHash: 'contentHash', cbaId: 'cbaId', organizationId: 'clauseOrg' },
  collectiveAgreements: { id: 'id', jurisdiction: 'jurisdiction', sector: 'sector', organizationId: 'organizationId' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
  and: vi.fn((...a) => ({ and: a })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { extractClausesFromPDF, batchExtractClauses } from '../clause-extraction-service';

const OPTS = { organizationId: 'org-1', userId: 'user-1' };

function arrange() {
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

  mocks.mockValues.mockResolvedValue(undefined);
  mocks.mockDbInsert.mockReturnValue({ values: mocks.mockValues });

  mocks.mockSelectWhere.mockResolvedValue([]);
  mocks.mockSelectFrom.mockReturnValue({ where: mocks.mockSelectWhere });
  mocks.mockDbSelect.mockReturnValue({ from: mocks.mockSelectFrom });

  mocks.mockReturning.mockResolvedValue([{ id: 'cba-1' }]);
  mocks.mockWhere.mockReturnValue({ returning: mocks.mockReturning });
  mocks.mockSet.mockReturnValue({ where: mocks.mockWhere });
  mocks.mockDbUpdate.mockReturnValue({ set: mocks.mockSet });

  mocks.audit.mockResolvedValue(undefined);
  mocks.operation.mockImplementation(async (_op: unknown, fn: () => Promise<unknown>) => fn());
}

describe('extractClausesFromPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    arrange();
  });

  it('extracts clauses from PDF successfully', async () => {
    const result = await extractClausesFromPDF('https://example.com/cba.pdf', 'cba-1', OPTS);
    expect(result.success).toBe(true);
    expect(result.clauses).toHaveLength(1);
    expect(result.clauses[0].clauseType).toBe('wages');
  });

  it('returns processing time', async () => {
    const result = await extractClausesFromPDF('https://example.com/cba.pdf', 'cba-1', OPTS);
    expect(result.processingTime).toBeGreaterThanOrEqual(0);
  });

  it('reports a CBA that is missing or in another organization as not found, without calling the AI or writing', async () => {
    mocks.mockDbQuery.mockResolvedValue(null);
    const result = await extractClausesFromPDF('https://example.com/cba.pdf', 'cba-999', OPTS);
    expect(result.success).toBe(false);
    expect(result.errors).toContain('CBA with ID cba-999 not found');
    expect(mocks.operation).not.toHaveBeenCalled();
    expect(mocks.mockGenerate).not.toHaveBeenCalled();
    expect(mocks.mockDbInsert).not.toHaveBeenCalled();
    expect(mocks.mockDbUpdate).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it('looks the CBA up by id and the caller organization', async () => {
    await extractClausesFromPDF('https://example.com/cba.pdf', 'cba-1', OPTS);
    const where = mocks.mockDbQuery.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain('"value":"org-1"');
  });

  it('saves clauses when autoSave is true', async () => {
    await extractClausesFromPDF('https://example.com/cba.pdf', 'cba-1', { ...OPTS, autoSave: true });
    expect(mocks.mockDbInsert).toHaveBeenCalled();
  });

  it('updates CBA with processing metadata and audits it on the same transaction', async () => {
    await extractClausesFromPDF('https://example.com/cba.pdf', 'cba-1', { ...OPTS, autoSave: true });
    expect(mocks.mockDbUpdate).toHaveBeenCalled();
    expect(mocks.audit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-1',
        action: 'ai.clause_extraction.persist',
        resourceId: 'cba-1',
        details: { clausesExtracted: 1, clausesInserted: 1, autoSave: true },
      }),
    );
  });

  it('records the provider intent before calling the AI', async () => {
    await extractClausesFromPDF('https://example.com/cba.pdf', 'cba-1', OPTS);
    expect(mocks.operation).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', userId: 'user-1', action: 'ai.clause_extraction.run', resourceId: 'cba-1' }),
      expect.any(Function),
    );
  });

  it('does not call the AI or write when the provider intent cannot be recorded', async () => {
    mocks.operation.mockRejectedValueOnce(new FakeOperationAuditError('not recorded'));
    await expect(extractClausesFromPDF('https://example.com/cba.pdf', 'cba-1', OPTS)).rejects.toBeInstanceOf(FakeOperationAuditError);
    expect(mocks.mockGenerate).not.toHaveBeenCalled();
    expect(mocks.mockDbInsert).not.toHaveBeenCalled();
  });

  it('fails when the audit record cannot be written', async () => {
    mocks.audit.mockRejectedValueOnce(new Error('audit down'));
    const result = await extractClausesFromPDF('https://example.com/cba.pdf', 'cba-1', OPTS);
    expect(result.success).toBe(false);
    expect(result.errors).toContain('audit down');
  });

  it('fails when the CBA update matched nothing, so no audit is written', async () => {
    mocks.mockReturning.mockResolvedValueOnce([]);
    const result = await extractClausesFromPDF('https://example.com/cba.pdf', 'cba-1', OPTS);
    expect(result.success).toBe(false);
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it('handles AI extraction error gracefully', async () => {
    mocks.mockGenerate.mockRejectedValue(new Error('AI timeout'));
    const result = await extractClausesFromPDF('https://example.com/cba.pdf', 'cba-1', OPTS);
    expect(result.success).toBe(false);
    expect(result.errors![0]).toContain('Failed to extract text');
  });
});

describe('batchExtractClauses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    arrange();
    mocks.mockGenerate.mockResolvedValue({ content: 'text' });
    mocks.mockExtract.mockResolvedValue({ data: { clauses: [] } });
  });

  it('processes multiple CBAs in the caller organization', async () => {
    const results = await batchExtractClauses(
      [
        { id: 'cba-1', documentUrl: 'https://example.com/1.pdf' },
        { id: 'cba-2', documentUrl: 'https://example.com/2.pdf' },
      ],
      OPTS,
    );
    expect(results.size).toBe(2);
    for (const call of mocks.operation.mock.calls) {
      expect(call[0]).toMatchObject({ organizationId: 'org-1', userId: 'user-1' });
    }
  });

  it('respects concurrency option', async () => {
    const results = await batchExtractClauses(
      [{ id: 'cba-1', documentUrl: 'https://example.com/1.pdf' }],
      { ...OPTS, concurrency: 1 },
    );
    expect(results.size).toBe(1);
  });
});
