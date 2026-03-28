import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindFirst, mockGenerate, mockInsertValues } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockGenerate: vi.fn(),
  mockInsertValues: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    query: {
      employers: { findFirst: mockFindFirst },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [{ value: 0 }]),
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
  buildAiEnvelope: vi.fn((data: unknown, meta: Record<string, unknown>) => ({
    available: true, data, ...meta, disclaimer: 'AI disclaimer',
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { calculateEmployerRisk } from '../employer-risk';

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
});
