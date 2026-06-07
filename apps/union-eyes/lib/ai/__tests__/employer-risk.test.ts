import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindFirst, mockGenerate, mockInsertValues, mockWhere } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockGenerate: vi.fn(),
  mockInsertValues: vi.fn(),
  mockWhere: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    query: {
      employers: { findFirst: mockFindFirst },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mockWhere,
      })),
    })),
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: vi.fn(() => ({ generate: mockGenerate })),
  UE_APP_KEY: 'union-eyes',
  UE_PROFILES: { EMPLOYER_RISK: 'ue-employer-risk' },
  UE_SYSTEM_ORG_ID: '00000000-0000-0000-0000-000000000000',
}));

vi.mock('@/db/schema/domains/ml/employer-risk-scores', () => ({
  employerRiskScores: { id: 'id' },
}));

vi.mock('@/db/schema/domains/compliance/employer-compliance', () => ({
  employers: { id: 'id', orgId: 'orgId' },
  complianceAlerts: { id: 'id' },
}));

vi.mock('@/db/schema/domains/claims/grievances', () => ({
  grievances: { id: 'id', organizationId: 'organizationId' },
}));

vi.mock('./ai-feature-guard', () => ({
  auditAiInteraction: vi.fn(async () => 'ai-risk-ref-123'),
  buildAiEnvelope: vi.fn((data: any, meta: Record<string, unknown>) => ({
    available: true, data, ...meta, disclaimer: 'AI disclaimer',
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { calculateEmployerRisk, deriveRiskSignals } from '../employer-risk';

describe('calculateEmployerRisk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue({
      id: 'emp-1',
      orgId: 'org-1',
      name: 'Acme Corp',
    });
    mockGenerate.mockResolvedValue({
      content: JSON.stringify({
        overallScore: 65,
        riskBand: 'moderate',
        trendDirection: 'stable',
        confidence: 0.78,
        explanation: 'Average risk profile...',
      }),
    });
    mockInsertValues.mockResolvedValue(undefined);
    mockWhere.mockResolvedValue([{ value: 0 }]);
  });

  it('returns an AI envelope with risk result', async () => {
    const result = await calculateEmployerRisk({
      employerId: 'emp-1',
      organizationId: 'org-1',
      userId: 'user-1',
    });
    expect(result.available).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('throws when employer not found', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(calculateEmployerRisk({
      employerId: 'not-found',
      organizationId: 'org-1',
      userId: 'user-1',
    })).rejects.toThrow('not found');
  });

  it('calls AI generate', async () => {
    await calculateEmployerRisk({
      employerId: 'emp-1',
      organizationId: 'org-1',
      userId: 'user-1',
    });
    expect(mockGenerate).toHaveBeenCalledOnce();
  });

  it('applies JSON defaults when AI fields are missing or invalid', async () => {
    mockGenerate.mockResolvedValue({
      content: JSON.stringify({
        overallScore: 'not-a-number',
        signals: 'not-an-array',
      }),
    });

    const result = await calculateEmployerRisk({
      employerId: 'emp-1',
      organizationId: 'org-1',
      userId: 'user-1',
    });

    expect(result.data.overallScore).toBe(0);
    expect(result.data.riskBand).toBe('low');
    expect(result.data.trendDirection).toBe('stable');
    expect(result.data.signals).toEqual([]);
    expect(result.confidence).toBe(0.5);
    expect(result.explanation).toBe('AI-generated risk assessment.');
  });

  it('falls back to heuristic scoring when AI response is malformed', async () => {
    mockGenerate.mockResolvedValue({ content: '{invalid-json' });
    mockWhere
      .mockResolvedValueOnce([{ value: 2 }])
      .mockResolvedValueOnce([{ value: 1 }])
      .mockResolvedValueOnce([{ value: 1 }]);

    const result = await calculateEmployerRisk({
      employerId: 'emp-1',
      organizationId: 'org-1',
      userId: 'user-1',
    });

    expect(result.data.overallScore).toBeCloseTo(0.55, 4);
    expect(result.data.riskBand).toBe('elevated');
    expect(result.confidence).toBe(0.3);
    expect(result.explanation).toContain('Heuristic score applied');
  });

  it('handles missing AI content via nullish fallback', async () => {
    mockGenerate.mockResolvedValue({});

    const result = await calculateEmployerRisk({
      employerId: 'emp-1',
      organizationId: 'org-1',
      userId: 'user-1',
    });

    expect(result.available).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('defaults signal counts to zero when count rows are missing', async () => {
    mockWhere
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const signals = await deriveRiskSignals('emp-1', 'org-1');
    expect(signals).toEqual({
      grievanceCount30d: 0,
      complianceAlertCount30d: 0,
      arbitrationCount12m: 0,
    });
  });
});
