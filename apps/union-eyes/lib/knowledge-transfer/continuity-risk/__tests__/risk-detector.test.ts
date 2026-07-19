import { beforeEach, describe, expect, it, vi } from 'vitest';

const { whereMock, generateMock } = vi.hoisted(() => ({
  whereMock: vi.fn(),
  generateMock: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: { select: () => ({ from: () => ({ where: whereMock }) }) },
}));
vi.mock('@/db/schema', () => ({
  exitInterviews: {
    id: 'id', roleInUnion: 'roleInUnion', yearsOfService: 'yearsOfService', title: 'title',
    expertiseTags: 'expertiseTags', continuityRiskFlags: 'continuityRiskFlags',
    continuityRiskScore: 'continuityRiskScore', topics: 'topics',
    organizationId: 'organizationId', status: 'status',
  },
}));
vi.mock('drizzle-orm', () => ({ and: (...a: unknown[]) => a, eq: (...a: unknown[]) => a }));
vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: () => ({ generate: generateMock }),
  buildOrgAiTrace: (o: string) => ({ orgId: o }),
  UE_APP_KEY: 'ue',
  UE_PROFILES: { CONTINUITY_RISK: 'continuity_risk' },
  UE_SYSTEM_ORG_ID: 'sys',
}));

import { detectContinuityRisks } from '../risk-detector';

function interview(overrides: Record<string, unknown> = {}) {
  return {
    id: 'i1', roleInUnion: 'steward', yearsOfService: 5, title: 'Exit',
    expertiseTags: ['grievances'], continuityRiskFlags: [], continuityRiskScore: 50,
    topics: ['arbitration'], ...overrides,
  };
}

describe('lib/knowledge-transfer/continuity-risk/risk-detector', () => {
  beforeEach(() => {
    whereMock.mockReset();
    generateMock.mockReset();
  });

  it('analyzes interviews and parses AI risk flags', async () => {
    whereMock.mockResolvedValue([
      interview({ id: 'a', roleInUnion: 'steward', topics: ['arbitration', 'bargaining'], expertiseTags: ['grievances'], continuityRiskScore: 80 }),
      interview({ id: 'b', roleInUnion: 'officer', topics: ['bargaining'], expertiseTags: ['finance'], continuityRiskScore: 40 }),
    ]);
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        riskFlags: [{ flag: 'Concentration', severity: 'high', affectedRoles: ['steward'], topicAreas: ['arbitration'], recommendation: 'Cross-train' }],
        executiveSummary: 'Risk detected.',
      }),
    });

    const report = await detectContinuityRisks('org-1');
    expect(report.totalPublishedInterviews).toBe(2);
    expect(report.overallRiskScore).toBeGreaterThan(0);
    expect(report.riskFlags.length).toBe(1);
    expect(report.singleSourceTopics).toContain('arbitration');
    expect(report.isolatedExpertise).toContain('grievances');
    expect(report.coverageGaps).toContain('admin');
    expect(report.executiveSummary).toBe('Risk detected.');
  });

  it('falls back to manual summary when AI output is invalid JSON', async () => {
    whereMock.mockResolvedValue([interview()]);
    generateMock.mockResolvedValue({ content: 'not json' });
    const report = await detectContinuityRisks('org-2');
    expect(report.executiveSummary).toContain('Manual review');
    expect(report.riskFlags).toEqual([]);
  });

  it('returns empty report with no published interviews', async () => {
    whereMock.mockResolvedValue([]);
    const report = await detectContinuityRisks('org-3');
    expect(report.totalPublishedInterviews).toBe(0);
    expect(report.overallRiskScore).toBe(0);
    expect(report.executiveSummary).toContain('No published interviews');
    expect(generateMock).not.toHaveBeenCalled();
  });
});
