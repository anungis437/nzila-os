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
  buildOrgAiTrace: vi.fn(() => ({
    component: 'test',
    action: 'mock',
  })),
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

vi.mock('./ai-feature-guard', () => ({
  auditAiInteraction: vi.fn(async () => 'ai-copilot-ref-123'),
  buildAiEnvelope: vi.fn((data: any, meta: Record<string, unknown>) => ({
    available: true, data, ...meta, disclaimer: 'AI disclaimer',
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { executeCopilotAction, summarizeTimeline, suggestAction } from '../steward-copilot';

describe('executeCopilotAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});

describe('summarizeTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });
});

describe('suggestAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });
});
