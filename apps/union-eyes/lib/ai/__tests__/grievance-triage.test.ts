import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindFirst, mockInsertValues, mockGenerate } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockInsertValues: vi.fn(),
  mockGenerate: vi.fn(),
}));

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
  buildAiEnvelope: vi.fn((data: unknown, meta: Record<string, unknown>) => ({
    available: true, data, ...meta, disclaimer: 'AI disclaimer',
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { analyzeGrievance } from '../grievance-triage';

describe('analyzeGrievance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('calls AI client with generate', async () => {
    await analyzeGrievance({
      grievanceId: 'grv-1',
      organizationId: 'org-1',
      userId: 'user-1',
    });
    expect(mockGenerate).toHaveBeenCalledOnce();
  });
});
