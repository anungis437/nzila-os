import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindFirst, mockFindMany, mockInsertValues, mockGenerate, mockCaseAccess, withRls, sharedDbUse } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockFindMany: vi.fn(),
  mockInsertValues: vi.fn(),
  mockGenerate: vi.fn(),
  mockCaseAccess: vi.fn(),
  withRls: vi.fn(),
  sharedDbUse: vi.fn(),
}));

vi.mock('@/lib/services/case-access-service', () => ({ getEffectiveCaseAccess: mockCaseAccess }));

// The shared connection is not tenant-scoped: the service must never read or write through it, and a test asserts that.
vi.mock('@/db/db', () => ({
  db: {
    query: {
      grievances: { findFirst: sharedDbUse },
      aiClauseReasonings: { findMany: sharedDbUse },
    },
    insert: vi.fn(() => ({ values: sharedDbUse })),
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: vi.fn(() => ({ generate: mockGenerate })),
  buildOrgAiTrace: vi.fn(() => ({
    component: 'test',
    action: 'mock',
  })),
  toGatewayDataClass: vi.fn(() => 'regulated'),
  UE_APP_KEY: 'union-eyes',
  UE_PROFILES: { CLAUSE_REASONING: 'ue-clause-reasoning' },
  UE_SYSTEM_ORG_ID: '00000000-0000-0000-0000-000000000000',
}));

vi.mock('@/db/schema/domains/ml/ai-clause-reasoning', () => ({
  aiClauseReasonings: { id: 'id' },
}));

vi.mock('@/db/schema/domains/claims/grievances', () => ({
  grievances: { id: 'id', organizationId: 'organizationId' },
}));

vi.mock('@/lib/ai/ai-feature-guard', () => ({
  auditAiInteraction: vi.fn(async () => 'ai-clause-ref-123'),
  buildAiEnvelope: vi.fn((data: any, meta: Record<string, unknown>) => ({
    available: true, data, ...meta, disclaimer: 'AI disclaimer',
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const { audit, operation } = vi.hoisted(() => ({ audit: vi.fn(), operation: vi.fn() }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: withRls }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: audit }));
vi.mock('@/lib/audit/operation-audit', () => ({ performAuditedOperation: operation }));


import { suggestClausesForGrievance, explainClauseRelevance, getClauseReasoningHistory } from '../clause-reasoning';

describe('suggestClausesForGrievance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCaseAccess.mockResolvedValue({ canViewCase: true });
    withRls.mockImplementation(async (_scope: unknown, fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        query: { grievances: { findFirst: mockFindFirst }, aiClauseReasonings: { findMany: mockFindMany } },
        insert: () => ({ values: mockInsertValues }),
      }));
    audit.mockResolvedValue(undefined);
    operation.mockImplementation(async (_op: unknown, fn: () => Promise<unknown>) => fn());
    mockFindFirst.mockResolvedValue({
      id: 'grv-1',
      organizationId: 'org-1',
      title: 'Test Grievance',
      description: 'Contract violation in Article 8',
      status: 'open',
    });
    mockGenerate.mockResolvedValue({
      content: JSON.stringify({
        suggestedClauses: [{
          clauseArticle: 'Article 8',
          clauseSection: '8.1',
          clauseTitle: 'Hours of Work',
          relevanceScore: 0.9,
          reasoning: 'Directly references Article 8',
          strengthAssessment: 'strong',
        }],
        overallAnalysis: 'The grievance relates to working hours...',
        confidence: 0.85,
        explanation: 'Based on text analysis...',
      }),
    });
    mockInsertValues.mockResolvedValue(undefined);
  });

  it('refuses unassigned grievance content before model invocation', async () => {
    mockCaseAccess.mockResolvedValueOnce({ canViewCase: false });
    await expect(suggestClausesForGrievance({ grievanceId: 'grv-1', organizationId: 'org-1', userId: 'user-1' })).rejects.toThrow('Case access denied');
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it('returns an AI envelope with clause suggestions', async () => {
    const result = await suggestClausesForGrievance({
      grievanceId: 'grv-1',
      organizationId: 'org-1',
      userId: 'user-1',
    });
    expect(result.available).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('throws when grievance not found', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(suggestClausesForGrievance({
      grievanceId: 'not-found',
      organizationId: 'org-1',
      userId: 'user-1',
    })).rejects.toThrow('not found');
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it('reads the grievance in the organization\'s own context, never through the shared connection', async () => {
    await suggestClausesForGrievance({ grievanceId: 'grv-1', organizationId: 'org-1', userId: 'user-1' });
    expect(withRls).toHaveBeenCalledWith({ organizationId: 'org-1' }, expect.any(Function));
    expect(mockFindFirst).toHaveBeenCalledOnce();
    expect(sharedDbUse).not.toHaveBeenCalled();
  });

  it('calls AI generate through the audited operation', async () => {
    await suggestClausesForGrievance({
      grievanceId: 'grv-1',
      organizationId: 'org-1',
      userId: 'user-1',
    });
    expect(mockGenerate).toHaveBeenCalledOnce();
    expect(operation).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', userId: 'user-1', action: 'ai.clause_reasoning.generate' }),
      expect.any(Function),
    );
  });

  it('persists the suggestions with one audit record on the same transaction', async () => {
    await suggestClausesForGrievance({ grievanceId: 'grv-1', organizationId: 'org-1', userId: 'user-1' });
    expect(mockInsertValues).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ insert: expect.any(Function) }),
      expect.objectContaining({ organizationId: 'org-1', userId: 'user-1', action: 'ai.clause_reasoning.create' }),
    );
  });

  it('does not keep suggestions whose audit record cannot be written', async () => {
    audit.mockRejectedValueOnce(new Error('audit down'));
    await expect(suggestClausesForGrievance({ grievanceId: 'grv-1', organizationId: 'org-1', userId: 'user-1' })).rejects.toThrow('audit down');
  });
});

describe('explainClauseRelevance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCaseAccess.mockResolvedValue({ canViewCase: true });
    withRls.mockImplementation(async (_scope: unknown, fn: (tx: unknown) => Promise<unknown>) =>
      fn({ query: { grievances: { findFirst: mockFindFirst } } }));
    operation.mockImplementation(async (_op: unknown, fn: () => Promise<unknown>) => fn());
    mockFindFirst.mockResolvedValue({ id: 'grv-1', organizationId: 'org-1', title: 'Test Grievance', description: 'Article 8' });
    mockGenerate.mockResolvedValue({
      content: JSON.stringify({ reasoning: 'Hours of work apply', strength: 'strong', confidence: 0.9, explanation: 'Directly on point' }),
    });
  });

  it('explains the clause from a grievance read in the organization\'s own context', async () => {
    const result = await explainClauseRelevance('grv-1', 'Article 8', 'org-1', 'user-1');
    expect(result.data).toEqual({ reasoning: 'Hours of work apply', strength: 'strong' });
    expect(withRls).toHaveBeenCalledWith({ organizationId: 'org-1' }, expect.any(Function));
    expect(sharedDbUse).not.toHaveBeenCalled();
  });

  it('refuses a case the caller cannot view before any read or provider call', async () => {
    mockCaseAccess.mockResolvedValueOnce({ canViewCase: false });
    await expect(explainClauseRelevance('grv-1', 'Article 8', 'org-1', 'user-1')).rejects.toThrow('Case access denied');
    expect(withRls).not.toHaveBeenCalled();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('sends nothing to the provider for a grievance outside the organization', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(explainClauseRelevance('grv-9', 'Article 8', 'org-1', 'user-1')).rejects.toThrow('not found');
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});

describe('getClauseReasoningHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withRls.mockImplementation(async (_scope: unknown, fn: (tx: unknown) => Promise<unknown>) =>
      fn({ query: { aiClauseReasonings: { findMany: mockFindMany } } }));
  });

  it('lists the suggestions in the organization\'s own context, never through the shared connection', async () => {
    mockFindMany.mockResolvedValue([{ id: 'suggestion-1' }]);
    await expect(getClauseReasoningHistory('grv-1', 'org-1')).resolves.toEqual([{ id: 'suggestion-1' }]);
    expect(withRls).toHaveBeenCalledWith({ organizationId: 'org-1' }, expect.any(Function));
    expect(sharedDbUse).not.toHaveBeenCalled();
  });
});
