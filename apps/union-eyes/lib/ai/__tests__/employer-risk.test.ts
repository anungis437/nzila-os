import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindFirst, mockGenerate, mockInsertValues, mockWhere, mockScoreFindFirst, mockScoreFindMany, withRls, sharedDbUse } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockGenerate: vi.fn(),
  mockInsertValues: vi.fn(),
  mockWhere: vi.fn(),
  mockScoreFindFirst: vi.fn(),
  mockScoreFindMany: vi.fn(),
  withRls: vi.fn(),
  sharedDbUse: vi.fn(),
}));

// The shared connection is not tenant-scoped: the service must never read or write through it, and a test asserts that.
vi.mock('@/db/db', () => ({
  db: {
    query: {
      employers: { findFirst: sharedDbUse },
      employerRiskScores: { findFirst: sharedDbUse, findMany: sharedDbUse },
    },
    insert: vi.fn(() => ({ values: sharedDbUse })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: sharedDbUse,
      })),
    })),
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/ai/ai-client', () => ({
  toGatewayDataClass: vi.fn((dataClass: string) => dataClass),
  getAiClient: vi.fn(() => ({ generate: mockGenerate })),
  buildOrgAiTrace: vi.fn(() => ({
    component: 'test',
    action: 'mock',
  })),
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

vi.mock('@/lib/ai/ai-feature-guard', () => ({
  auditAiInteraction: vi.fn(async () => 'ai-risk-ref-123'),
  buildAiEnvelope: vi.fn((data: any, meta: Record<string, unknown>) => ({
    available: true, data, ...meta, disclaimer: 'AI disclaimer',
  })),
}));

vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: withRls }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn(async () => undefined) }));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { calculateEmployerRisk, deriveRiskSignals, getLatestRiskScore, getRiskHistory } from '../employer-risk';

// The tenant transaction every service call runs its reads in
const tenantTx = () => ({
  query: {
    employers: { findFirst: mockFindFirst },
    employerRiskScores: { findFirst: mockScoreFindFirst, findMany: mockScoreFindMany },
  },
  select: () => ({ from: () => ({ where: mockWhere }) }),
  insert: () => ({ values: mockInsertValues }),
});

describe('calculateEmployerRisk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withRls.mockImplementation(async (_scope: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(tenantTx()));
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
    // Reading a risk reading materializes nothing
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it('throws when employer not found', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(calculateEmployerRisk({
      employerId: 'not-found',
      organizationId: 'org-1',
      userId: 'user-1',
    })).rejects.toThrow('not found');
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('calls AI generate', async () => {
    await calculateEmployerRisk({
      employerId: 'emp-1',
      organizationId: 'org-1',
      userId: 'user-1',
    });
    expect(mockGenerate).toHaveBeenCalledOnce();
  });

  it('reads the employer and its signals in the organization\'s own context before the provider is called, never through the shared connection', async () => {
    await calculateEmployerRisk({ employerId: 'emp-1', organizationId: 'org-1', userId: 'user-1' });
    expect(withRls.mock.calls[0][0]).toEqual({ organizationId: 'org-1' });
    expect(mockFindFirst).toHaveBeenCalledOnce();
    expect(mockWhere).toHaveBeenCalledTimes(3);
    expect(withRls.mock.invocationCallOrder[0]).toBeLessThan(mockGenerate.mock.invocationCallOrder[0]);
    expect(sharedDbUse).not.toHaveBeenCalled();
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

  it('derives the signals in the organization\'s own context when given no transaction, and joins the caller\'s transaction when given one', async () => {
    mockWhere.mockResolvedValue([{ value: 4 }]);
    await expect(deriveRiskSignals('emp-1', 'org-1')).resolves.toEqual({ grievanceCount30d: 4, complianceAlertCount30d: 4, arbitrationCount12m: 4 });
    expect(withRls).toHaveBeenCalledTimes(1);
    expect(withRls).toHaveBeenCalledWith({ organizationId: 'org-1' }, expect.any(Function));

    withRls.mockClear();
    await deriveRiskSignals('emp-1', 'org-1', tenantTx() as never);
    expect(withRls).not.toHaveBeenCalled();
  });
});

describe('risk score reads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withRls.mockImplementation(async (_scope: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(tenantTx()));
  });

  it('reads the latest score in the organization\'s own context, never through the shared connection', async () => {
    mockScoreFindFirst.mockResolvedValue({ id: 'score-1' });
    await expect(getLatestRiskScore('emp-1', 'org-1')).resolves.toEqual({ id: 'score-1' });
    expect(withRls).toHaveBeenCalledWith({ organizationId: 'org-1' }, expect.any(Function));
    expect(sharedDbUse).not.toHaveBeenCalled();
  });

  it('reads the history in the organization\'s own context, never through the shared connection', async () => {
    mockScoreFindMany.mockResolvedValue([{ id: 'score-2' }, { id: 'score-1' }]);
    await expect(getRiskHistory('emp-1', 'org-1', 5)).resolves.toHaveLength(2);
    expect(mockScoreFindMany).toHaveBeenCalledWith(expect.objectContaining({ limit: 5 }));
    expect(withRls).toHaveBeenCalledWith({ organizationId: 'org-1' }, expect.any(Function));
    expect(sharedDbUse).not.toHaveBeenCalled();
  });
});
