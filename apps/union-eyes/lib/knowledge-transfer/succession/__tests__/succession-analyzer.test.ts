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
  exitInterviews: new Proxy({}, { get: (_t, p) => String(p) }),
}));
vi.mock('drizzle-orm', () => ({ and: (...a: unknown[]) => a, eq: (...a: unknown[]) => a }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: async (_ctx: unknown, fn: (tx: unknown) => unknown) => fn({}) }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn(async () => undefined) }));
vi.mock('@/lib/api/errors', () => ({ ApiError: { internal: (m: string) => Object.assign(new Error(m), { status: 500 }) } }));
vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: () => ({ generate: generateMock }),
  toGatewayDataClass: (c: string) => c,
  buildOrgAiTrace: () => ({}),
  UE_APP_KEY: 'ue',
  UE_SYSTEM_ORG_ID: 'sys',
  UE_PROFILES: { CONTINUITY_RISK: 'cr' },
}));

import { analyzeSuccessionFragility } from '../succession-analyzer';

function interview(role: string, risk: number | null, extra: Record<string, unknown> = {}) {
  return {
    id: `i-${role}-${risk}`,
    roleInUnion: role,
    yearsOfService: 5,
    title: 'Exit',
    topics: ['grievances'],
    expertiseTags: ['x'],
    continuityRiskScore: risk,
    continuityRiskFlags: ['undocumented payroll'],
    ...extra,
  };
}

describe('lib/knowledge-transfer/succession/succession-analyzer', () => {
  beforeEach(() => {
    whereMock.mockReset();
    generateMock.mockReset();
  });

  it('returns empty report and does not call AI when no interviews', async () => {
    whereMock.mockResolvedValue([]);
    const report = await analyzeSuccessionFragility('org-1');
    expect(generateMock).not.toHaveBeenCalled();
    // DEF-0B7-COGB-SUCCESSION-READINESS-SCORE-COUNTS-EXIT-INTERVIEWS-AS-SUCCESSOR-READINESS: an organization with
    // zero published interviews must read 0, never the per-role formula's fixed 50 for "every role has no coverage".
    expect(report.transitionReadinessScore).toBe(0);
    expect(report.executiveSummary).toContain('No published exit interviews');
    expect(report.roleSuccessionStatus.length).toBe(5);
  });

  it('analyzes interviews and parses AI JSON with varied readiness', async () => {
    whereMock.mockResolvedValue([
      interview('steward', 80), // minimal (1 interview, risk>=70)
      interview('officer', 30), // partial (1 interview, risk<70)
      interview('admin', 20), // adequate when 2+
      interview('admin', 40),
    ]);
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        criticalOperationalGaps: ['gap1'],
        documentationPriorities: ['doc1'],
        continuityRecommendations: ['rec1'],
        governanceMitigations: ['gov1'],
        executiveSummary: 'AI summary',
      }),
    });
    const report = await analyzeSuccessionFragility('org-1');
    expect(generateMock).toHaveBeenCalledOnce();
    expect(report.criticalOperationalGaps).toEqual(['gap1']);
    expect(report.executiveSummary).toBe('AI summary');
    expect(report.modelGenerated).toBe(true);
    const steward = report.roleSuccessionStatus.find((r) => r.role === 'steward');
    expect(steward?.successorReadiness).toBe('minimal');
    const admin = report.roleSuccessionStatus.find((r) => r.role === 'admin');
    expect(admin?.successorReadiness).toBe('adequate');
    const officer = report.roleSuccessionStatus.find((r) => r.role === 'officer');
    expect(officer?.successorReadiness).toBe('partial');
    const member = report.roleSuccessionStatus.find((r) => r.role === 'member');
    expect(member?.successorReadiness).toBe('none');
  });

  // DEF-0B7-COGB-INTERVIEW-DERIVED-ROLE-OUTPUT-IDENTIFIES-SINGLE-DEPARTING-PERSON: a role with fewer than
  // MIN_COHORT_SIZE (5) interviews must not carry that departing person's own years of service and risk score.
  it('withholds years-of-service and risk score for a role below the minimum cohort size', async () => {
    whereMock.mockResolvedValue([interview('steward', 80)]);
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        criticalOperationalGaps: [], documentationPriorities: [], continuityRecommendations: [], governanceMitigations: [],
        executiveSummary: 'summary',
      }),
    });
    const report = await analyzeSuccessionFragility('org-1');
    const steward = report.roleSuccessionStatus.find((r) => r.role === 'steward');
    expect(steward?.interviewCount).toBe(1);
    expect(steward?.smallCellSuppressed).toBe(true);
    expect(steward?.totalYearsOfServiceCaptured).toBeNull();
    expect(steward?.averageContinuityRiskScore).toBeNull();
    // successorReadiness is a coarse 4-value label, computed from the withheld figures but not itself withheld.
    expect(steward?.successorReadiness).toBe('minimal');
  });

  it('reports years-of-service and risk score once a role reaches the minimum cohort size', async () => {
    whereMock.mockResolvedValue([
      interview('officer', 20), interview('officer', 30), interview('officer', 40), interview('officer', 50), interview('officer', 60),
    ]);
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        criticalOperationalGaps: [], documentationPriorities: [], continuityRecommendations: [], governanceMitigations: [],
        executiveSummary: 'summary',
      }),
    });
    const report = await analyzeSuccessionFragility('org-1');
    const officer = report.roleSuccessionStatus.find((r) => r.role === 'officer');
    expect(officer?.interviewCount).toBe(5);
    expect(officer?.smallCellSuppressed).toBe(false);
    expect(officer?.totalYearsOfServiceCaptured).toBe(25);
    expect(officer?.averageContinuityRiskScore).toBe(40);
  });

  // DEF-0B7-COGB-SUCCESSION-READINESS-SCORE-COUNTS-EXIT-INTERVIEWS-AS-SUCCESSOR-READINESS: two interviews with no
  // stored continuity risk score must never read as "adequate" (low measured risk) the way a genuinely measured
  // average of zero would - null (no score recorded) must not satisfy the same "< 50" branch as a real 0.
  it('does not report adequate readiness from two interviews with no recorded risk score', async () => {
    whereMock.mockResolvedValue([
      interview('admin', null), interview('admin', null), interview('admin', null), interview('admin', null), interview('admin', null),
    ]);
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        criticalOperationalGaps: [], documentationPriorities: [], continuityRecommendations: [], governanceMitigations: [],
        executiveSummary: 'summary',
      }),
    });
    const report = await analyzeSuccessionFragility('org-1');
    const admin = report.roleSuccessionStatus.find((r) => r.role === 'admin');
    expect(admin?.interviewCount).toBe(5);
    expect(admin?.averageContinuityRiskScore).toBeNull();
    expect(admin?.successorReadiness).toBe('partial');
  });

  it('fails instead of returning a canned summary when the model reply is not usable', async () => {
    whereMock.mockResolvedValue([interview('steward', 50)]);
    generateMock.mockResolvedValue({ content: 'not json' });
    await expect(analyzeSuccessionFragility('org-1')).rejects.toMatchObject({ status: 500 });
    generateMock.mockResolvedValue({ content: JSON.stringify({ executiveSummary: 'incomplete' }) });
    await expect(analyzeSuccessionFragility('org-1')).rejects.toMatchObject({ status: 500 });
  });

  it('marks the report as model-generated only when a model produced it', async () => {
    whereMock.mockResolvedValue([]);
    expect((await analyzeSuccessionFragility('org-1')).modelGenerated).toBe(false);
  });
});
