import { beforeEach, describe, expect, it, vi } from 'vitest';
// The SQL of the eligibility condition is proven against real SQL in app/api/__tests__/interview-derived-analytics.pglite.test.ts.
vi.mock('@/lib/knowledge-transfer/governance/interview-access', () => ({ derivedAnalyticsCondition: () => 'derived-analytics-condition' }))

const { whereMock, generateMock } = vi.hoisted(() => ({
  whereMock: vi.fn(),
  generateMock: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: { select: () => ({ from: () => ({ where: (...args: unknown[]) => ({ limit: () => whereMock(...args) }) }) }) },
}));
vi.mock('@/db/schema', () => ({
  exitInterviews: {
    id: 'id', roleInUnion: 'roleInUnion', yearsOfService: 'yearsOfService', title: 'title',
    expertiseTags: 'expertiseTags', continuityRiskFlags: 'continuityRiskFlags',
    continuityRiskScore: 'continuityRiskScore', topics: 'topics',
    organizationId: 'organizationId', status: 'status',
  },
  exitInterviewRoleEnum: { enumValues: ['member', 'steward', 'chief_steward', 'officer', 'admin'] },
}));
vi.mock('drizzle-orm', () => ({ and: (...a: unknown[]) => a, eq: (...a: unknown[]) => a }));
vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: () => ({ generate: generateMock }),
  toGatewayDataClass: (c: string) => c,
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
    // DEF-0B7-COGA-RISK-RATINGS-ARE-FIXED-RULES-OVER-TAG-COUNTS: zero interviews means nothing was assessed, which
    // must not read as a measured risk score of 0 (= "assessed and found safe").
    expect(report.overallRiskScore).toBeNull();
    expect(report.executiveSummary).toContain('No published interviews');
    expect(generateMock).not.toHaveBeenCalled();
  });

  it('reports every schema role as a coverage gap when no interviews cover it', async () => {
    whereMock.mockResolvedValue([interview({ roleInUnion: 'officer' })]);
    generateMock.mockResolvedValue({ content: JSON.stringify({ riskFlags: [], executiveSummary: 'ok' }) });
    const report = await detectContinuityRisks('org-4');
    // Derived from the schema's full role enum, not a hand-maintained subset that can silently omit 'member'.
    expect(report.coverageGaps.sort()).toEqual(['admin', 'chief_steward', 'member', 'steward']);
  });
});
