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
      aiGrievanceTriages: { findMany: sharedDbUse },
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
  UE_PROFILES: { GRIEVANCE_TRIAGE: 'ue-grievance-triage' },
  UE_SYSTEM_ORG_ID: '00000000-0000-0000-0000-000000000000',
}));

vi.mock('@/db/schema/domains/ml/ai-grievance-triage', () => ({
  aiGrievanceTriages: { id: 'id' },
}));

vi.mock('@/db/schema/domains/claims/grievances', () => ({
  grievances: { id: 'id', organizationId: 'organizationId' },
}));

vi.mock('@/lib/ai/ai-feature-guard', () => ({
  auditAiInteraction: vi.fn(async () => 'ai-triage-ref-123'),
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


import { analyzeGrievance, getTriageHistory } from '../grievance-triage';

describe('analyzeGrievance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCaseAccess.mockResolvedValue({ canViewCase: true });
    withRls.mockImplementation(async (_scope: unknown, fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        query: { grievances: { findFirst: mockFindFirst }, aiGrievanceTriages: { findMany: mockFindMany } },
        insert: () => ({ values: mockInsertValues }),
      }));
    audit.mockResolvedValue(undefined);
    operation.mockImplementation(async (_op: unknown, fn: () => Promise<unknown>) => fn());
    mockFindFirst.mockResolvedValue({
      id: 'grv-1',
      organizationId: 'org-1',
      title: 'Test Grievance',
      description: 'Worker was wrongfully terminated',
      status: 'open',
    });
    mockGenerate.mockResolvedValue({
      content: JSON.stringify({
        suggestedPriority: 'high',
        suggestedCategory: 'contract',
        complexity: 'moderate',
        estimatedDaysToResolve: 30,
        confidence: 0.82,
        explanation: 'Based on analysis...',
      }),
    });
    mockInsertValues.mockResolvedValue(undefined);
  });

  it('refuses case access before any AI call or write', async () => {
    mockCaseAccess.mockResolvedValueOnce({ canViewCase: false });
    await expect(analyzeGrievance({ grievanceId: 'grv-1', organizationId: 'org-1', userId: 'user-1' })).rejects.toThrow('Case access denied');
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it('returns an AI envelope with triage result', async () => {
    const result = await analyzeGrievance({
      grievanceId: 'grv-1',
      organizationId: 'org-1',
      userId: 'user-1',
    });
    expect(result.available).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('throws when grievance not found', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(analyzeGrievance({
      grievanceId: 'not-found',
      organizationId: 'org-1',
      userId: 'user-1',
    })).rejects.toThrow('not found');
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it('reads the grievance in the organization\'s own context, never through the shared connection', async () => {
    await analyzeGrievance({ grievanceId: 'grv-1', organizationId: 'org-1', userId: 'user-1' });
    expect(withRls).toHaveBeenCalledWith({ organizationId: 'org-1' }, expect.any(Function));
    expect(mockFindFirst).toHaveBeenCalledOnce();
    expect(sharedDbUse).not.toHaveBeenCalled();
  });

  it('calls AI client with generate through the audited operation', async () => {
    await analyzeGrievance({
      grievanceId: 'grv-1',
      organizationId: 'org-1',
      userId: 'user-1',
    });
    expect(mockGenerate).toHaveBeenCalledOnce();
    expect(operation).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', userId: 'user-1', action: 'ai.grievance_triage.generate', resourceId: 'grv-1' }),
      expect.any(Function),
    );
  });

  it('persists the triage with its audit record on the same transaction', async () => {
    await analyzeGrievance({ grievanceId: 'grv-1', organizationId: 'org-1', userId: 'user-1' });
    expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1', status: 'pending' }));
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ insert: expect.any(Function) }),
      expect.objectContaining({ organizationId: 'org-1', userId: 'user-1', action: 'ai.grievance_triage.create' }),
    );
  });

  it('sends nothing to the provider and stores nothing when the operation intent cannot be recorded', async () => {
    operation.mockRejectedValueOnce(new Error('intent not recorded'));
    await expect(analyzeGrievance({ grievanceId: 'grv-1', organizationId: 'org-1', userId: 'user-1' })).rejects.toThrow('intent not recorded');
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it('does not keep a triage whose audit record cannot be written', async () => {
    audit.mockRejectedValueOnce(new Error('audit down'));
    await expect(analyzeGrievance({ grievanceId: 'grv-1', organizationId: 'org-1', userId: 'user-1' })).rejects.toThrow('audit down');
  });
});

describe('getTriageHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withRls.mockImplementation(async (_scope: unknown, fn: (tx: unknown) => Promise<unknown>) =>
      fn({ query: { aiGrievanceTriages: { findMany: mockFindMany } } }));
  });

  it('lists the triages in the organization\'s own context, never through the shared connection', async () => {
    mockFindMany.mockResolvedValue([{ id: 'triage-1' }]);
    await expect(getTriageHistory('grv-1', 'org-1')).resolves.toEqual([{ id: 'triage-1' }]);
    expect(withRls).toHaveBeenCalledWith({ organizationId: 'org-1' }, expect.any(Function));
    expect(sharedDbUse).not.toHaveBeenCalled();
  });
});
