import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindFirst, mockInsertValues, mockGenerate, mockCaseAccess } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockInsertValues: vi.fn(),
  mockGenerate: vi.fn(),
  mockCaseAccess: vi.fn(),
}));

vi.mock('@/lib/services/case-access-service', () => ({ getEffectiveCaseAccess: mockCaseAccess }));

vi.mock('@/db/db', () => ({
  db: {
    query: {
      grievances: { findFirst: mockFindFirst },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
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

vi.mock('./ai-feature-guard', () => ({
  auditAiInteraction: vi.fn(async () => 'ai-triage-ref-123'),
  buildAiEnvelope: vi.fn((data: any, meta: Record<string, unknown>) => ({
    available: true, data, ...meta, disclaimer: 'AI disclaimer',
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const { audit, operation } = vi.hoisted(() => ({ audit: vi.fn(), operation: vi.fn() }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_scope: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({ insert: () => ({ values: mockInsertValues }) }),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: audit }));
vi.mock('@/lib/audit/operation-audit', () => ({ performAuditedOperation: operation }));


import { analyzeGrievance } from '../grievance-triage';

describe('analyzeGrievance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCaseAccess.mockResolvedValue({ canViewCase: true });
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
