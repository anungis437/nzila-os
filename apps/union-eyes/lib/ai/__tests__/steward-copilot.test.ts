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
      aiCopilotSessions: { findMany: sharedDbUse },
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
  UE_PROFILES: { STEWARD_COPILOT: 'ue-steward-copilot' },
  UE_SYSTEM_ORG_ID: '00000000-0000-0000-0000-000000000000',
}));

vi.mock('@/db/schema/domains/ml/ai-copilot-sessions', () => ({
  aiCopilotSessions: { id: 'id' },
}));

vi.mock('@/db/schema/domains/claims/grievances', () => ({
  grievances: { id: 'id', organizationId: 'organizationId' },
}));

vi.mock('@/lib/ai/ai-feature-guard', () => ({
  auditAiInteraction: vi.fn(async () => 'ai-copilot-ref-123'),
  buildAiEnvelope: vi.fn((data: any, meta: Record<string, unknown>) => ({
    available: true, data, ...meta, disclaimer: 'AI disclaimer',
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: withRls }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/audit/operation-audit', () => ({
  performAuditedOperation: async (_op: unknown, fn: () => Promise<unknown>) => fn(),
}));

import { executeCopilotAction, summarizeTimeline, suggestAction, getCopilotHistory } from '../steward-copilot';

// The tenant transaction every service call runs its reads and writes in
const useTenantTx = () =>
  withRls.mockImplementation(async (_scope: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      query: { grievances: { findFirst: mockFindFirst }, aiCopilotSessions: { findMany: mockFindMany } },
      insert: () => ({ values: mockInsertValues }),
    }));

describe('executeCopilotAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTenantTx();
    mockCaseAccess.mockResolvedValue({ canViewCase: true });
    mockFindFirst.mockResolvedValue({
      id: 'grv-1',
      organizationId: 'org-1',
      grievanceNumber: 'G-1',
      title: 'Test Grievance',
      description: 'Contract violation in Article 8',
      status: 'open',
      type: 'individual',
    });
    mockGenerate.mockResolvedValue({
      content: JSON.stringify({
        responseText: 'Here is a summary of the grievance timeline...',
        structuredOutput: null,
        sourcesUsed: [],
        confidence: 0.8,
        explanation: 'Based on grievance history...',
      }),
    });
    mockInsertValues.mockResolvedValue(undefined);
  });

  it('refuses unauthorized grievance context before any model call', async () => {
    mockCaseAccess.mockResolvedValueOnce({ canViewCase: false });
    await expect(executeCopilotAction({ organizationId: 'org-1', userId: 'user-1', userRole: 'steward', actionType: 'timeline_summary', relatedEntityType: 'grievance', relatedEntityId: 'grv-1' })).rejects.toThrow('Case access denied');
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it('returns an AI envelope with copilot result', async () => {
    const result = await executeCopilotAction({
      organizationId: 'org-1',
      userId: 'user-1',
      userRole: 'steward',
      actionType: 'custom_query',
      query: 'What should I do next?',
    });
    expect(result.available).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('calls AI generate', async () => {
    await executeCopilotAction({
      organizationId: 'org-1',
      userId: 'user-1',
      userRole: 'steward',
      actionType: 'timeline_summary',
      relatedEntityType: 'grievance',
      relatedEntityId: 'grv-1',
    });
    expect(mockGenerate).toHaveBeenCalledOnce();
  });

  it('reads the grievance context in the organization\'s own context before the provider is called, never through the shared connection', async () => {
    await executeCopilotAction({
      organizationId: 'org-1',
      userId: 'user-1',
      userRole: 'steward',
      actionType: 'timeline_summary',
      relatedEntityType: 'grievance',
      relatedEntityId: 'grv-1',
    });
    expect(mockCaseAccess).toHaveBeenCalledWith({ organizationId: 'org-1', grievanceId: 'grv-1', userId: 'user-1' });
    expect(withRls.mock.calls[0][0]).toEqual({ organizationId: 'org-1' });
    expect(mockFindFirst).toHaveBeenCalledOnce();
    expect(withRls.mock.invocationCallOrder[0]).toBeLessThan(mockGenerate.mock.invocationCallOrder[0]);
    expect(mockGenerate.mock.calls[0][0].input).toContain('Contract violation in Article 8');
    expect(sharedDbUse).not.toHaveBeenCalled();
  });

  it('puts no case content in the prompt when the grievance is not in the organization', async () => {
    mockFindFirst.mockResolvedValue(null);
    await executeCopilotAction({
      organizationId: 'org-1',
      userId: 'user-1',
      userRole: 'steward',
      actionType: 'timeline_summary',
      relatedEntityType: 'grievance',
      relatedEntityId: 'grv-other-org',
    });
    expect(mockGenerate.mock.calls[0][0].input).not.toContain('Grievance #');
  });
});

describe('summarizeTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTenantTx();
    mockCaseAccess.mockResolvedValue({ canViewCase: true });
    mockFindFirst.mockResolvedValue(null);
    mockGenerate.mockResolvedValue({
      content: JSON.stringify({
        responseText: 'Timeline summary...',
        structuredOutput: null,
        sourcesUsed: [],
        confidence: 0.75,
        explanation: 'Analysis of timeline...',
      }),
    });
    mockInsertValues.mockResolvedValue(undefined);
  });

  it('delegates to executeCopilotAction with timeline_summary', async () => {
    const result = await summarizeTimeline('grv-1', 'org-1', 'user-1');
    expect(result.available).toBe(true);
    expect(mockGenerate).toHaveBeenCalledOnce();
    expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1', actionType: 'timeline_summary', relatedEntityId: 'grv-1' }));
  });
});

describe('suggestAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTenantTx();
    mockCaseAccess.mockResolvedValue({ canViewCase: true });
    mockFindFirst.mockResolvedValue(null);
    mockGenerate.mockResolvedValue({
      content: JSON.stringify({
        responseText: 'Suggested action...',
        structuredOutput: null,
        sourcesUsed: [],
        confidence: 0.7,
        explanation: 'Based on case analysis...',
      }),
    });
    mockInsertValues.mockResolvedValue(undefined);
  });

  it('delegates to executeCopilotAction with suggest_action', async () => {
    const result = await suggestAction('grv-1', 'org-1', 'user-1');
    expect(result.available).toBe(true);
    expect(mockGenerate).toHaveBeenCalledOnce();
    expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1', actionType: 'suggest_action', relatedEntityId: 'grv-1' }));
  });
});

describe('getCopilotHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTenantTx();
  });

  it('lists the user\'s sessions in the organization\'s own context, never through the shared connection', async () => {
    mockFindMany.mockResolvedValue([{ id: 'session-1' }]);
    await expect(getCopilotHistory('user-1', 'org-1')).resolves.toEqual([{ id: 'session-1' }]);
    expect(withRls).toHaveBeenCalledWith({ organizationId: 'org-1' }, expect.any(Function));
    expect(sharedDbUse).not.toHaveBeenCalled();
  });
});
